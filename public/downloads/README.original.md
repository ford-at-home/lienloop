# LienLoop

A synthetic total-loss orchestration demo for a credit-union VP of lending. A network feed, an email/PDF and a fax become a unified queue. One negative-equity file proceeds through six mocked systems, with deterministic calculations and explicit human decisions.

## Run the browser replay

Use **Node.js 24 or newer**. No API key is needed for the replay.

```bash
npm ci
npm run dev
```

Open the localhost URL Vite prints. Click **Start replay**, then review and approve each proposal. The replay pauses at every decision. Choose an exception scenario from the menu or use **Run this step** for manual progression.

The published static page runs the same deterministic replay. It does not run a hosted LLM, process uploaded documents, connect to a vendor, send a real message or move money. A browser refresh resets the replay. Export the audit JSON to keep a run.

## Run Claude with the local web UI

Provide your own Anthropic API key in the terminal environment, then explicitly enable the local controller:

```bash
export ANTHROPIC_API_KEY='your-own-key'
export LIENLOOP_ENABLE_AGENT_UI=1
npm run dev
```

Open **http://localhost:5173** (or the printed localhost port). Use the **Scripted replay** toggle to switch to **Live Claude**, then click **Start live agent**. The agent uses six stdio MCP processes; the UI polls their shared local SQLite ledger. Approve or reject proposals in the web UI. Source exceptions require operator review there as well. The controller accepts mutation requests only from the same localhost origin and is absent from the published static build. Its endpoints are for local demonstration, not production authentication.

The key stays in the Node server's environment. Do not add it to a `VITE_` variable, source file or browser field. Live mode invokes your Anthropic account and incurs API usage. The runner sets `maxBudgetUsd: 3` and a 45-turn limit; the SDK's budget is an estimate and may be exceeded. Set `CLAUDE_MODEL` if you want to select an account-supported model. Otherwise the installed SDK selects its default.

**Validation limit:** live Claude calls have not been executed in the authoring environment. The runner typechecks; the actual six-server protocol and the complete financial workflow were tested without a paid model call. Authentication, model availability and vision-tool behavior in a live account remain to be verified.

## Run from the terminal

Deterministic replay with human terminal approvals:

```bash
npm run replay -- standard
npm run replay -- expired
npm run replay -- perdiem
npm run replay -- missing
npm run replay -- duplicate
```

For live Claude orchestration, set `ANTHROPIC_API_KEY` and use:

```bash
npm run agent -- standard
```

Type `APPROVE`, `REJECT` or `STOP` when the terminal controller asks. Type `REVIEW` to resolve a document exception. There is no unattended auto-approval option. The agent does not receive the approval function as a tool. Terminal mode requires an interactive TTY; an absent key or noninteractive approval attempt produces an explicit error.

The model can view rendered source PDF pages and the original fax PNG via `inbox.read_source_image`. Pre-extracted document text is also exposed and explicitly labeled. These fixtures are trusted **as test data only**, never as instructions. The financial engine reads verified synthetic core inputs and a fixed fictional contract rule. No model-generated financial amount is accepted for posting.

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

All money is stored in integer cents. The contract refund rounds half up after the full fraction is calculated. Invalid terms, unsafe integers and overpayments are rejected. The synthetic 30-day collections hold does not waive interest or change the fixed demo quote. It is an invented lender policy, not a statement of legal requirements or production policy.

## Six vendor boundaries

| MCP process | Tools and responsibility |
| --- | --- |
| `core` | Verified loan inputs, code-calculated quote, hold proposal, insurance and recovery posting proposals |
| `inbox` | Network/email/fax sources, vision images, explicitly pre-extracted text, duplicate provenance |
| `elt` | Zero-balance release proposal, queued request, separate next-batch acknowledgement |
| `gap` | Required-document validation and packet submission; separate adjudication event |
| `los` | Consented application invitation; no credit decision, pre-qualification or loan funding |
| `communications` | Read the approved synthetic status message and its simulated sent state |

Each process runs `scripts/vendor.ts <vendor>` over MCP stdio. They share `.runtime/demo.sqlite`; SQLite transactions serialize mutations. Human approvals bind to a run ID, proposal ID and calculation revision. A stale approval or a replayed posting is rejected. The agent's configured tool set excludes built-in file and shell tools and exposes no approval, reset, arbitrary-file-read or source-resolution operation.

The human controller performs the approved mock side effects. This deliberate boundary is demonstrative: a production implementation would require authenticated operator identities, vendor credentials, durable settlement reconciliation, signed policy decisions and operational controls. This repo does not claim any certification, compliance status, vendor compatibility or real integration.

## Three clocks

- **Payoff:** the synthetic quote runs November 9–14, 2026.
- **GAP:** submission, administrator decision and receipt are distinct events. The operator explicitly advances a synthetic outcome; the demo does not model elapsed adjudication days.
- **ELT:** a release remains queued until the simulated November 10, 02:00 batch acknowledgement.

A fast replay is a presentation target, not a claim about real settlement speed. Dates, policies, consents, loan balances, counterparties and documents are fictional.

## Failure injections

- **Expired letter:** the November 6 letter is visible as the original source until the operator retrieves the current core-backed letter.
- **Per-diem mismatch:** a network figure of $7.10/day conflicts with the verified $6.40/day core figure. The operator reviews the current source before approval.
- **Missing addendum:** the GAP packet cannot submit until the synthetic signed addendum is retrieved.
- **Duplicate request:** a second network request matches VIN + loan + loss date. Originals are retained, with one member file and one set of postings. The fax for another member stays separate.

## Verify

```bash
npm test
npm run test:mcp
npm run build
```

The MCP smoke test starts all six real stdio processes, lists and calls tools, verifies source-image output and runs the shared-state workflow. It tests approval gates, an early-release attempt and a duplicate posting. It uses a separate temporary database and does not overwrite a running demo.

The PDF and PNG fixtures are included. If you change fixture contents, regenerate PDFs and page images:

```bash
npm run fixtures
npm run fixtures:render
```

Page-image regeneration requires Poppler's `pdftoppm`. The supplied fax PNG is the raster version of the supplied fax SVG. There is no OCR engine in the replay.

## Project map

```text
src/engine.ts              Pure financial workflow and approval rules
src/main.tsx               Browser UI, replay and optional local controller client
src/style.css              Responsive visual design
scripts/vendor.ts          Six separately launched MCP mock boundaries
scripts/store.ts           Transactional local SQLite state
scripts/agent.ts            Claude Agent SDK runner
scripts/local-agent-plugin.ts  Opt-in localhost web controller
scripts/review.ts           Human-only terminal approval controller
scripts/replay.ts           Deterministic terminal replay
scripts/check-mcp.ts        Real stdio integration smoke test
public/fixtures/            Fictional source PDFs, images and JSON
tests/                     Financial and approval invariants
```

Technical references: [Claude Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript), [MCP TypeScript SDK v1](https://ts.sdk.modelcontextprotocol.io/server). The lockfile pins the installed dependency versions. The mocks are independent fictional contracts, not implementations of SymXchange, a GAP administrator or a state DMV API.
