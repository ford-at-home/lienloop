-- LienLoop hosted state. Browser clients may only READ their own rows; all writes go
-- through authenticated server functions that call these service-role-only functions.
CREATE TABLE public.lienloop_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  scenario text NOT NULL CHECK (scenario IN ('standard','expired','perdiem','missing','duplicate')),
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 0,
  model_calls integer NOT NULL DEFAULT 0,
  model_call_limit integer NOT NULL DEFAULT 30,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lienloop_runs TO authenticated;
GRANT ALL ON public.lienloop_runs TO service_role;
ALTER TABLE public.lienloop_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their runs" ON public.lienloop_runs FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX lienloop_runs_owner_idx ON public.lienloop_runs (owner_id, created_at DESC);

CREATE TABLE public.lienloop_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.lienloop_runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  kind text NOT NULL,
  amount_cents bigint,
  approval_id text NOT NULL,
  revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, kind)
);
GRANT SELECT ON public.lienloop_postings TO authenticated;
GRANT ALL ON public.lienloop_postings TO service_role;
ALTER TABLE public.lienloop_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their postings" ON public.lienloop_postings FOR SELECT TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.lienloop_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.lienloop_runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  approval_id text NOT NULL UNIQUE,
  revision integer NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lienloop_decisions TO authenticated;
GRANT ALL ON public.lienloop_decisions TO service_role;
ALTER TABLE public.lienloop_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their decisions" ON public.lienloop_decisions FOR SELECT TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.lienloop_ai_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.lienloop_runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  call_index integer NOT NULL,
  state_version integer NOT NULL,
  tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_text text,
  stop_reason text,
  outcome text NOT NULL,
  error text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  gateway_run_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lienloop_ai_calls TO authenticated;
GRANT ALL ON public.lienloop_ai_calls TO service_role;
ALTER TABLE public.lienloop_ai_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their AI calls" ON public.lienloop_ai_calls FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX lienloop_ai_calls_run_idx ON public.lienloop_ai_calls (run_id, created_at);
CREATE INDEX lienloop_ai_calls_owner_idx ON public.lienloop_ai_calls (owner_id, created_at);

-- Atomic compare-and-swap commit: state version check, unique postings and one-time decisions in one transaction.
CREATE OR REPLACE FUNCTION public.lienloop_commit(
  p_run uuid, p_owner uuid, p_expected integer, p_state jsonb,
  p_postings jsonb DEFAULT '[]'::jsonb, p_decision jsonb DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_new integer; p jsonb;
BEGIN
  UPDATE public.lienloop_runs SET state = p_state, version = version + 1, updated_at = now()
   WHERE id = p_run AND owner_id = p_owner AND version = p_expected
   RETURNING version INTO v_new;
  IF v_new IS NULL THEN
    RAISE EXCEPTION 'STALE_STATE: the case changed since this view was loaded. Refresh and review the current snapshot.';
  END IF;
  IF p_decision IS NOT NULL THEN
    BEGIN
      INSERT INTO public.lienloop_decisions (run_id, owner_id, approval_id, revision, decision)
      VALUES (p_run, p_owner, p_decision->>'approval_id', (p_decision->>'revision')::int, p_decision->>'decision');
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'REPLAYED_APPROVAL: approval % was already decided.', p_decision->>'approval_id';
    END;
  END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(p_postings) LOOP
    BEGIN
      INSERT INTO public.lienloop_postings (run_id, owner_id, kind, amount_cents, approval_id, revision)
      VALUES (p_run, p_owner, p->>'kind', NULLIF(p->>'amount_cents','')::bigint, p->>'approval_id', (p->>'revision')::int);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'DUPLICATE_POSTING: % was already posted for this run.', p->>'kind';
    END;
  END LOOP;
  RETURN v_new;
END $$;
REVOKE ALL ON FUNCTION public.lienloop_commit(uuid, uuid, integer, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lienloop_commit(uuid, uuid, integer, jsonb, jsonb, jsonb) TO service_role;

-- Reserve one bounded model call: per-run limit and per-owner rolling 24h limit.
CREATE OR REPLACE FUNCTION public.lienloop_reserve_model_call(p_run uuid, p_owner uuid, p_daily_limit integer)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_calls integer; v_daily integer;
BEGIN
  SELECT count(*) INTO v_daily FROM public.lienloop_ai_calls WHERE owner_id = p_owner AND created_at > now() - interval '24 hours';
  IF v_daily >= p_daily_limit THEN
    RAISE EXCEPTION 'USAGE_LIMIT: the 24-hour Cloud AI call limit (%) for this account is reached.', p_daily_limit;
  END IF;
  UPDATE public.lienloop_runs SET model_calls = model_calls + 1
   WHERE id = p_run AND owner_id = p_owner AND model_calls < model_call_limit
   RETURNING model_calls INTO v_calls;
  IF v_calls IS NULL THEN
    RAISE EXCEPTION 'USAGE_LIMIT: this run reached its Cloud AI call limit. Start a new run to continue.';
  END IF;
  RETURN v_calls;
END $$;
REVOKE ALL ON FUNCTION public.lienloop_reserve_model_call(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lienloop_reserve_model_call(uuid, uuid, integer) TO service_role;