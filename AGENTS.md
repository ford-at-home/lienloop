<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## LienLoop rules

- The desk lives only under the client-only `_authenticated` gate, validating identities with getUser; root owns the sole auth listener and sign-out clears queries before leaving (why: prevents anonymous entry and cached-state restoration).

- `src/lienloop/engine.ts` is the authoritative financial engine imported verbatim from the original repo; do not change its math or transitions — wrap behaviour in `src/lienloop/hosted.ts` instead (why: preserves tested synthetic amounts and sequencing).
- Hosted writes go only through `src/lienloop/cloud.functions.ts` → service-role-only `lienloop_commit` / `lienloop_reserve_model_call`; browsers get SELECT-only RLS (why: clients must not forge case state, approvals or postings).
- Model tools are the allowlist in `hosted.ts`; approve/reject/resolve are never model tools (why: a model output must not approve its own action).
- tsconfig keeps plain `strict` without noUncheckedIndexedAccess / exactOptionalPropertyTypes / noPropertyAccessFromIndexSignature (why: the imported original source was written for plain strict mode).
- `local/` is a reference copy of the original stdio MCP/CLI scripts; the runnable original is `public/downloads/lienloop-source.zip` (why: hosted mode replaces the localhost SQLite controller).
