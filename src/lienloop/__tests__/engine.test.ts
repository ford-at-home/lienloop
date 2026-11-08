import {test} from 'vitest';
import assert from 'node:assert/strict';
import {advance,approve,caseData,createState,currentBalance,dedupeKey,normalize,payoff,refund,reject,remaining,requests,resolveBlocker,stepDone,type DemoState,type Scenario} from '../engine';
const sign=(s:DemoState)=>approve(s,s.approval!.id,s.approval!.revision,'Test operator');
function until(s:DemoState,phase:number):DemoState{let guard=0;while(s.phase<phase){if(++guard>40)throw new Error('Workflow did not advance');s=s.blocker?resolveBlocker(s):s.approval?sign(s):advance(s);}return s;}
test('money uses integer cents, rejects invalid inputs and flags overpayments',()=>{
  assert.equal(payoff(2846000,640,5),2849200);assert.equal(refund(160000,60,24),96000);
  assert.equal(refund(1,2,1),1);assert.equal(refund(160000,60,60),0);
  for(const bad of [NaN,Infinity,-1,.01,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>payoff(bad,640,5));
  assert.throws(()=>refund(100,0,0));assert.throws(()=>refund(100,12,13));assert.throws(()=>remaining(100,101));assert.throws(()=>payoff(Number.MAX_SAFE_INTEGER,1,1));
});
test('deduplication retains two sources but does not merge an unrelated loan or loss',()=>{
  const groups=normalize(requests);assert.equal(groups.length,2);assert.deepEqual(groups[0].map(x=>x.id),['RQ-701','RQ-702']);
  assert.notEqual(dedupeKey({...requests[0],loan:'LN-9999'}),dedupeKey(requests[0]));assert.notEqual(dedupeKey({...requests[0],lossDate:'2026-11-05'}),dedupeKey(requests[0]));
});
for(const scenario of ['standard','expired','perdiem','missing','duplicate'] as Scenario[])test(`${scenario}: complete journey reconciles and confirms five outcomes`,()=>{
  const s=until(createState(scenario),8);assert.equal(currentBalance(s),0);assert.equal(s.insurance+s.gap+s.refund,s.quote);assert.equal(s.quote,2849200);assert.equal(s.release,'acknowledged');assert.equal(s.handoff,true);assert.equal(s.consent,true);assert.ok([0,1,2,3,4].every(i=>stepDone(s,i)));assert.equal(s.approval,null);
  assert.equal(s.events.filter(x=>x.kind==='approval').length,6);
});
test('pending quote cannot advance without a matching human approval',()=>{
  const s=advance(createState());assert.equal(s.quoteIssued,false);assert.equal(s.insurance,0);assert.throws(()=>advance(s),/human/);assert.throws(()=>approve(s,'made-up',s.revision),/stale/);assert.throws(()=>approve(s,s.approval!.id,s.revision-1),/stale/);
  const issued=sign(s);assert.equal(issued.quoteIssued,true);assert.throws(()=>approve(issued,s.approval!.id,s.revision),/stale/);
});
test('approval from an earlier replay is invalid in a fresh run',()=>{
  const first=advance(createState()),second=advance(createState());assert.equal(first.revision,second.revision);assert.throws(()=>approve(second,first.approval!.id,first.revision),/stale/);
});
test('rejected action has no financial side effect and can be prepared again',()=>{
  let s=until(createState(),2);s=advance(s);assert.equal(s.insurance,0);const id=s.approval!.id;s=reject(s);assert.equal(s.insurance,0);assert.equal(s.phase,2);s=advance(s);assert.notEqual(s.approval!.id,id);assert.equal(s.insurance,0);
});
test('insurance receipt is a partial payment; release stays unavailable',()=>{
  let s=until(createState(),3);assert.equal(s.insurance,2485000);assert.equal(currentBalance(s),364200);assert.equal(s.release,'not_requested');assert.equal(s.gap,0);assert.equal(s.refund,0);
  assert.throws(()=>advance({...s,phase:5}),/full payoff/);assert.equal(s.gapSubmitted,false);
});
test('queued ELT request is not counted as an acknowledged outcome',()=>{
  let s=until(createState(),6);assert.equal(s.release,'queued');assert.equal(stepDone(s,3),false);assert.equal(s.handoff,false);s=advance(s);assert.equal(s.release,'acknowledged');assert.equal(stepDone(s,3),true);assert.equal(s.batchAdvanced,true);
});
test('expired and mismatched letters block the approval path',()=>{
  for(const scenario of ['expired','perdiem'] as Scenario[]){let s=advance(createState(scenario));assert.ok(s.blocker);assert.equal(s.approval,null);assert.equal(s.quoteIssued,false);assert.throws(()=>advance(s),/exception/);s=resolveBlocker(s);assert.equal(s.approval?.kind,'quote');assert.equal(s.approval?.amount,2849200);assert.ok(s.events.some(e=>e.actor==='Operator'));}
});
test('missing GAP document is held before submission',()=>{
  let s=until(createState('missing'),3);s=advance(s);assert.equal(s.blocker?.kind,'missing');assert.equal(s.gapSubmitted,false);s=resolveBlocker(s);assert.equal(s.addendum,true);s=advance(s);assert.equal(s.gapSubmitted,true);assert.equal(s.phase,4);
});
test('the ledger is immutable on proposal, rejection and failed approval',()=>{
  const original=createState();const json=JSON.stringify(original);const proposed=advance(original);assert.equal(JSON.stringify(original),json);assert.equal(proposed.insurance,0);assert.throws(()=>approve(proposed,'invalid',99));assert.equal(proposed.quoteIssued,false);
});
test('GAP submission and decisions alone do not post received money',()=>{
  const submitted=until(createState(),4);const decision=advance(submitted);assert.equal(decision.gapSubmitted,true);assert.equal(decision.gap,0);assert.equal(decision.refund,0);assert.equal(decision.release,'not_requested');assert.equal(decision.approval?.kind,'recoveries');const posted=sign(decision);assert.equal(posted.gap,268200);assert.equal(posted.refund,96000);
});
test('quote cannot be approved above the delegation limit',()=>{
  const s=advance(createState());s.quote=3500001;assert.throws(()=>sign(s),/delegated/);
});
