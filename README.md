# LienLoop

A synthetic total-loss orchestration demo for a credit-union VP of lending. A network feed, an email/PDF and a fax become a unified queue. One negative-equity file proceeds through six mocked systems, with deterministic calculations and explicit human decisions.

Everything is fictional: members, institutions, receipts, consents, policies and dates. Nothing connects to a real financial institution, sends a real SMS/email, makes a credit decision or moves money. Replay dates and time jumps are explicitly simulated.

## Two modes in the hosted app

Use the **Scripted replay / Lovable Cloud AI** switch in the control bar.

### Scripted replay

The original deterministic browser state machine. No model calls and no backend. Click **Start replay** (or **Run this step**) and review each proposal. A refresh resets it; export the audit JSON to keep a run.

### Lovable Cloud AI (hosted)

Runs on this project's Lovable Cloud backend and the built-in Lovable AI connector. **No personal Anthropic API key is needed** — calls use the project's managed credentials and draw on the workspace's existing AI allowance.

- **Model:** `anthropic/claude-haiku-4-5` (Anthropic Claude Haiku 4.5) through the Lovable AI Gateway's Anthropic Messages endpoint, streamed, server-side only. The gateway key never reaches the browser.
- **Operator-started:** opening the app makes no model call. Sign in, click **Start Cloud AI run** (creates a case, no model call), then **Ask Cloud AI: next step** for each step.
- **What the model does:** reads the source fixtures (rasterized PDF pages and the fax image, plus explicitly pre-extracted text) and the current case state, then chooses one permitted mock vendor step. It may read, extract and coordinate.
- **What the model cannot do:** approve, reject or resolve anything; execute quote issuance, payment hold, financial posting, lien release or the member handoff; choose an amount. Those are explicit human clicks, validated server-side. No filesystem, shell or arbitrary network tool is exposed.
- **Bounds:** max 1,024 output tokens per call, at most 4 model calls per click, 30 per case, 80 per account per rolling 24 hours.
- **Errors:** a gateway error, refusal or refused tool choice is shown in the UI, recorded as a Cloud AI call, and leaves the case state unchanged. There is no silent fallback to the replay.
- **Audit:** every model call records provider, model, tool calls and results, response text, stop reason, tokens and gateway run ID. A successful step also adds a `cloud_ai:<tool>` event to the case timeline. **Export audit** includes all of it.

#### Hosted safety model

- The deterministic engine (`src/lienloop/engine.ts`, unchanged from the original) is authoritative for every amount, precondition and transition.
- Browser clients can only **read** their own rows (row-level security). All writes go through authenticated server functions, which call service-role-only database functions.
- Each write is an atomic compare-and-swap on the case version. Human approvals bind to the exact run, approval ID and revision; stale views, replayed approvals and duplicate postings are refused by the database (`STALE_STATE`, `REPLAYED_APPROVAL`, `DUPLICATE_POSTING`).
- Hosted vendor adapters are **serverless functions inside one backend**, not six running stdio MCP processes. They keep the same six logical boundaries (core, inbox, ELT, GAP, loan origination, communications) and remain synthetic mocks.

## The demo file

| Item | Amount | What it means |
| --- | ---: | --- |
| Loan balance | $28,460.00 | Synthetic core balance |
| Additional quote interest | $32.00 | 5 days at $6.40/day |
| Verified payoff | $28,492.00 | Code-calculated quote |
| Insurance payment | $24,850.00 | Partial payment; does not permit a lien release |
| Initial shortfall | $3,642.00 | Remains open after insurance posts |
| GAP proceeds | $2,682.00 | Synthetic administrator decision and separately received funds |
| Service-contract refund | $960.00 | $1,600 × 36 unused months / 60 total months |
| Final remaining balance | $0.00 | Reconciles only after all approved receipts post |

All money is stored in integer cents. The contract refund rounds half up after the full fraction is calculated. A lien release requires a zero balance and explicit human approval, then stays queued until the separate simulated batch acknowledgement. An application invitation is not pre-qualification, a funded loan or a lending decision. The synthetic 30-day collections hold is an invented lender policy.

## Three clocks

- **Payoff:** the synthetic quote runs November 9–14, 2026.
- **GAP:** submission, administrator decision and receipt are distinct events.
- **ELT:** a release remains queued until the simulated November 10, 02:00 batch acknowledgement.

## Failure injections

- **Expired letter:** the November 6 letter is visible as the original source until the operator retrieves the current core-backed letter.
- **Per-diem mismatch:** a network figure of $7.10/day conflicts with the verified $6.40/day core figure. The operator reviews the current source before approval.
- **Missing addendum:** the GAP packet cannot submit until the synthetic signed addendum is retrieved.
- **Duplicate request:** a second network request matches VIN + loan + loss date. Originals are retained, with one member file and one set of postings. The fax for Elliot Brooks (different VIN, loan and loss date) stays a separate file.

## Tests

```bash
bunx vitest run
```

- `src/lienloop/__tests__/engine.test.ts` — the original 17 engine tests, assertions unchanged.
- `src/lienloop/__tests__/hosted.test.ts` — hosted tool surface, server-side validation, stale/replayed approvals, partial insurance, zero balance before release, all five scenarios.

## Local development (original six stdio MCP processes + Claude runner)

The original local repo is kept unchanged as a download at `/downloads/lienloop-source.zip` (also in `public/downloads/`), with its own README. Reference copies of its scripts are in `local/` (imports point at `src/lienloop/engine.ts`). To run the original locally, unzip the archive and follow its README:

```bash
npm ci
npm run dev           # browser replay
npm test              # engine + localhost controller tests
npm run test:mcp      # starts all six real stdio MCP processes
npm run replay -- standard
```

The **local** Claude runner (`npm run agent`, or `LIENLOOP_ENABLE_AGENT_UI=1 npm run dev`) uses the Claude Agent SDK with **your own** `ANTHROPIC_API_KEY` in your terminal environment, six real stdio MCP mock processes and a shared local SQLite ledger. That is separate from the hosted Cloud AI mode and is not used by this app.

## Project map

```text
src/lienloop/engine.ts          Pure financial workflow and approval rules (original)
src/lienloop/LienLoopApp.tsx    Browser UI: replay + hosted Cloud AI mode
src/lienloop/lienloop.css       Original responsive visual design
src/lienloop/hosted.ts          Hosted tool registry, validation, decisions, postings
src/lienloop/cloud.functions.ts Authenticated server functions (Cloud persistence + AI step)
src/lienloop/ai.server.ts       Streamed Lovable AI Gateway call (server only)
src/lienloop/sources.server.ts  Source page images for the model (server only)
public/fixtures/                Original PDF/PNG/SVG/JSON fixtures
local/                          Reference copy of the original local MCP/CLI scripts
```
