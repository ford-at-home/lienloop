import { describe, expect, test } from "vitest";
import { advance, createState, currentBalance, type DemoState, type Scenario } from "../engine";
import { executeStepTool, isAllowedTool, operatorDecision, operatorResolve, postingsFor, stepTools, toolDefinitions } from "../hosted";

const toolForPhase = (phase: number) => Object.entries(stepTools).find(([, t]) => t.phase === phase)![0];
const decide = (s: DemoState, decision: "approve" | "reject" = "approve") =>
  operatorDecision(s, { runId: s.runId, approvalId: s.approval!.id, revision: s.approval!.revision, decision }, "Test operator");

/** Drive a hosted run exactly as the server does: model-chosen step tools + human decisions. */
function hostedUntil(s: DemoState, phase: number) {
  const postings: string[] = [];
  let guard = 0;
  while (s.phase < phase) {
    if (++guard > 40) throw new Error("did not advance");
    if (s.blocker) s = operatorResolve(s, { runId: s.runId, revision: s.revision });
    else if (s.approval) {
      const r = decide(s);
      postings.push(...r.postings.map((p) => p.kind));
      s = r.next;
    } else s = executeStepTool(s, toolForPhase(s.phase), { fileId: "TL-2048" });
  }
  return { s, postings };
}

describe("hosted tool surface", () => {
  test("model tools exclude approve, reject, resolve, reset, file, shell and network tools", () => {
    const names = toolDefinitions().map((t) => t.name);
    for (const n of names) expect(n).not.toMatch(/approve|reject|resolve|reset|shell|file|fetch|http/i);
    expect(isAllowedTool("core__approve_quote")).toBe(false);
    expect(names).toHaveLength(14);
  });
  test("unknown tool names and malformed input are refused server-side", () => {
    const s = createState();
    expect(() => executeStepTool(s, "core__post_money", { fileId: "TL-2048" })).toThrow(/not a permitted/);
    expect(() => executeStepTool(s, "core__analyze_and_prepare_quote", { fileId: "TL-2049" })).toThrow(/exactly/);
    expect(() => executeStepTool(s, "core__analyze_and_prepare_quote", { fileId: "TL-2048", amount: 1 })).toThrow(/exactly/);
  });
  test("a step for the wrong phase is refused and leaves state unchanged", () => {
    const s = createState();
    const before = JSON.stringify(s);
    expect(() => executeStepTool(s, "elt__prepare_release", { fileId: "TL-2048" })).toThrow(/Wrong phase/);
    expect(JSON.stringify(s)).toBe(before);
  });
  test("the model cannot step past a pending human approval", () => {
    const s = executeStepTool(createState(), "core__analyze_and_prepare_quote", { fileId: "TL-2048" });
    expect(s.approval?.kind).toBe("quote");
    expect(() => executeStepTool(s, "core__prepare_payment_hold", { fileId: "TL-2048" })).toThrow(/human/);
  });
});

describe("hosted human decisions", () => {
  test("stale revision, wrong run and replayed approvals are refused", () => {
    const s = executeStepTool(createState(), "core__analyze_and_prepare_quote", { fileId: "TL-2048" });
    const a = s.approval!;
    expect(() => operatorDecision(s, { runId: s.runId, approvalId: a.id, revision: a.revision - 1, decision: "approve" }, "x")).toThrow(/stale/);
    expect(() => operatorDecision(s, { runId: "other-run", approvalId: a.id, revision: a.revision, decision: "approve" }, "x")).toThrow(/stale/);
    const { next } = decide(s);
    expect(next.quoteIssued).toBe(true);
    expect(() => operatorDecision(next, { runId: s.runId, approvalId: a.id, revision: a.revision, decision: "approve" }, "x")).toThrow(/stale/);
  });
  test("insurance posting is partial: 2,485,000 posts, 364,200 remains, release unavailable", () => {
    const { s, postings } = hostedUntil(createState(), 3);
    expect(s.insurance).toBe(2485000);
    expect(currentBalance(s)).toBe(364200);
    expect(postings).toContain("insurance_posting");
    expect(s.release).toBe("not_requested");
    expect(() => executeStepTool(s, "elt__prepare_release", { fileId: "TL-2048" })).toThrow(/Wrong phase/);
    expect(() => advance({ ...s, phase: 5 })).toThrow(/full payoff/);
  });
  test("recoveries post 268,200 GAP + 96,000 refund and settle to zero before release", () => {
    const { s, postings } = hostedUntil(createState(), 5);
    expect(s.gap).toBe(268200);
    expect(s.refund).toBe(96000);
    expect(currentBalance(s)).toBe(0);
    expect(postings).toEqual(expect.arrayContaining(["gap_posting", "contract_refund_posting"]));
  });
  test("an approved release stays queued until the separate batch acknowledgement", () => {
    const { s } = hostedUntil(createState(), 6);
    expect(s.release).toBe("queued");
    const acked = executeStepTool(s, "elt__advance_batch", { fileId: "TL-2048" });
    expect(acked.release).toBe("acknowledged");
  });
  test("rejection executes nothing and records no posting", () => {
    let { s } = hostedUntil(createState(), 2);
    s = executeStepTool(s, "core__receive_ach_and_prepare_posting", { fileId: "TL-2048" });
    const r = decide(s, "reject");
    expect(r.postings).toEqual([]);
    expect(r.next.insurance).toBe(0);
  });
  test("postings carry engine amounts bound to approval id and revision", () => {
    const s = executeStepTool(createState(), "core__analyze_and_prepare_quote", { fileId: "TL-2048" });
    const { next } = decide(s);
    expect(postingsFor(s.approval!, next)).toEqual([{ kind: "quote_issued", amount_cents: 2849200, approval_id: s.approval!.id, revision: s.approval!.revision }]);
  });
  for (const scenario of ["standard", "expired", "perdiem", "missing", "duplicate"] as Scenario[])
    test(`${scenario}: hosted path completes with six human approvals and one posting set`, () => {
      const { s, postings } = hostedUntil(createState(scenario), 8);
      expect(currentBalance(s)).toBe(0);
      expect(s.quote).toBe(2849200);
      expect(s.handoff).toBe(true);
      expect(new Set(postings).size).toBe(postings.length);
      expect(postings).toHaveLength(7);
    });
});
