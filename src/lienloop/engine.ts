export type Scenario = 'standard' | 'expired' | 'perdiem' | 'missing' | 'duplicate';
export type Vendor = 'core' | 'inbox' | 'elt' | 'gap' | 'los' | 'communications';
export const vendors: Vendor[] = ['core', 'inbox', 'elt', 'gap', 'los', 'communications'];
export const vendorLabels: Record<Vendor, string> = {core:'Core banking',inbox:'Lien networks',elt:'Electronic title',gap:'GAP administrator',los:'Loan origination',communications:'Member communications'};
export const scenarios: Record<Scenario, {label: string; description: string}> = {
  standard:{label:'Full journey',description:'A negative-equity file, from three inbound requests to a completed member handoff.'},
  expired:{label:'Expired payoff letter',description:'A stale letter stops approval until a current source document is retrieved.'},
  perdiem:{label:'Per-diem mismatch',description:'A network quotes $7.10/day. The verified core quotes $6.40/day. Human review is required.'},
  missing:{label:'Missing GAP addendum',description:'Submission waits for a required document. Retrieve the synthetic signed addendum to continue.'},
  duplicate:{label:'Duplicate network request',description:'A second network submits the same VIN, loan and loss date. Both source records stay in one file.'},
};
export const money = (cents:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
function integer(n:number, name:string) { if(!Number.isSafeInteger(n)||n<0)throw new Error(`${name} must be a nonnegative safe integer.`); }
export function payoff(balance:number, perDiem:number, days:number) {
  [balance,perDiem,days].forEach((n,i)=>integer(n,['balance','per diem','days'][i]));
  const total=balance+perDiem*days;integer(total,'payoff');return total;
}
export function refund(price:number, totalMonths:number, usedMonths:number) {
  [price,totalMonths,usedMonths].forEach((n,i)=>integer(n,['price','total months','used months'][i]));
  if(totalMonths===0||usedMonths>totalMonths)throw new Error('Invalid contract term.');
  const numerator=price*(totalMonths-usedMonths);integer(numerator,'refund numerator');
  return Math.floor((numerator+Math.floor(totalMonths/2))/totalMonths);
}
export function remaining(total:number,...credits:number[]) {
  [total,...credits].forEach((n)=>integer(n,'amount'));
  const sum=credits.reduce((a,b)=>a+b,0);integer(sum,'credit sum');
  if(sum>total)throw new Error('Overpayment requires a separate review.');
  return total-sum;
}
export interface Request {id:string;channel:'Network feed'|'Email + PDF'|'Fax image';source:string;vin:string;loan:string;lossDate:string;member:string;amount:number;document:string;}
export const requests:Request[] = [
  {id:'RQ-701',channel:'Network feed',source:'Meridian Network',vin:'DEMO0000000000421',loan:'LN-4821',lossDate:'2026-11-04',member:'Mira Chen',amount:2485000,document:'network-request.json'},
  {id:'RQ-702',channel:'Email + PDF',source:'Horizon Mutual',vin:'DEMO0000000000421',loan:'LN-4821',lossDate:'2026-11-04',member:'Mira Chen',amount:2485000,document:'settlement-letter.pdf'},
  {id:'RQ-703',channel:'Fax image',source:'Cedar Claims',vin:'DEMO0000000000827',loan:'LN-6130',lossDate:'2026-11-05',member:'Elliot Brooks',amount:1740000,document:'fax-request.svg'},
];
export function dedupeKey(r:Request) {return [r.vin.toUpperCase().replace(/\s/g,''),r.loan.trim(),r.lossDate].join('|');}
export function normalize(items:Request[]) {
  const groups=new Map<string,Request[]>();
  for(const r of items){const k=dedupeKey(r);groups.set(k,[...(groups.get(k)||[]),r]);}
  return [...groups.values()];
}
export interface AuditEvent {seq:number;time:string;actor:'System'|'Calculator'|'Operator'|'Mock vendor';vendor:Vendor;tool:string;title:string;detail:string;kind:'info'|'success'|'approval'|'warning';}
export interface Approval {id:string;revision:number;kind:'quote'|'hold'|'settlement'|'recoveries'|'release'|'handoff';title:string;description:string;amount?:number;effects:string[];}
export interface Blocker {kind:'expired'|'perdiem'|'missing';title:string;detail:string;action:string;}
export interface DemoState {
  runId:string;scenario:Scenario;phase:number;revision:number;events:AuditEvent[];approval:Approval|null;blocker:Blocker|null;
  normalized:boolean;quote:number|null;perDiem:number;quoteIssued:boolean;hold:boolean;insurance:number;gap:number;refund:number;gapSubmitted:boolean;addendum:boolean;
  release:'not_requested'|'queued'|'acknowledged';handoff:boolean;consent:boolean;resolved:boolean;batchAdvanced:boolean;
}
export const caseData={id:'TL-2048',member:'Mira Chen',initials:'MC',loan:'LN-4821',vin:'DEMO0000000000421',vehicle:'2023 · Compact SUV',balance:2846000,perDiem:640,days:5,settlement:2485000,contractPrice:160000,contractMonths:60,usedMonths:24,gapDecision:268200,quoteDate:'2026-11-09',validThrough:'2026-11-14',cu:'Northstar Credit Union'};
const times=['10:24:00','10:24:02','10:24:05','10:24:08','10:24:10','10:24:13','10:24:16','10:24:20','10:24:25','10:24:30','10:24:35','10:24:40','10:24:45','10:24:50','10:24:55','10:25:00','10:25:05','10:25:10','10:25:15','10:25:20','10:25:25','10:25:30','10:25:35','10:25:40'];
function log(s:DemoState,vendor:Vendor,tool:string,title:string,detail:string,kind:AuditEvent['kind']='info',actor:AuditEvent['actor']='System'){
  s.events.push({seq:s.events.length+1,time:s.batchAdvanced?'Nov 10 · 02:00':times[Math.min(s.events.length,times.length-1)],actor,vendor,tool,title,detail,kind});
}
function approval(s:DemoState,kind:Approval['kind'],title:string,description:string,effects:string[],amount?:number){
  s.approval={id:`AP-${s.runId.slice(0,8)}-${s.revision}-${kind}`,revision:s.revision,kind,title,description,effects,amount};
}
export function createState(scenario:Scenario='standard'):DemoState {
  const runId=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  const s:DemoState={runId,scenario,phase:0,revision:0,events:[],approval:null,blocker:null,normalized:false,quote:null,perDiem:caseData.perDiem,quoteIssued:false,hold:false,insurance:0,gap:0,refund:0,gapSubmitted:false,addendum:scenario!=='missing',release:'not_requested',handoff:false,consent:false,resolved:false,batchAdvanced:false};
  log(s,'inbox','list_requests','Three requests. Two member files.','A JSON feed, an email attachment and a fax have arrived. All data is synthetic.');return s;
}
export function currentBalance(s:DemoState) {return remaining(s.quote??payoff(caseData.balance,caseData.perDiem,caseData.days),s.insurance,s.gap,s.refund);}
export function nextLabel(s:DemoState):string {
  if(s.phase===8)return 'Journey complete';
  if(s.approval)return 'Waiting for your approval';
  if(s.blocker)return 'Exception needs review';
  return ['Analyze inbound requests','Prepare payment hold','Receive simulated ACH','Build GAP claim packet','Simulate GAP decision + refund','Prepare lien release','Advance to next ELT batch','Prepare member handoff'][s.phase];
}
export function advance(input:DemoState):DemoState {
  if(input.approval)throw new Error('A human must approve or reject the pending action.');
  if(input.blocker)throw new Error('Resolve the source-document exception first.');
  if(input.phase===8)return input;
  const s=structuredClone(input);s.revision++;
  switch(s.phase){
    case 0:{
      s.normalized=true;
      log(s,'inbox','normalize_requests','Matched to one member file','RQ-701 and RQ-702 share VIN + loan + loss date. Both originals are retained; RQ-703 remains a separate file.','success');
      if(s.scenario==='duplicate')log(s,'inbox','deduplicate_request','Cross-network duplicate linked','RQ-704 from a second network matches TL-2048. A source link was added; no second posting was created.','warning');
      s.quote=payoff(caseData.balance,caseData.perDiem,caseData.days);
      log(s,'core','calculate_payoff','Payoff calculated in integer cents',`${money(caseData.balance)} + 5 days × ${money(caseData.perDiem)} = ${money(s.quote)}. Refund schedule: ${money(refund(caseData.contractPrice,caseData.contractMonths,caseData.usedMonths))}.`,'success','Calculator');
      if(s.scenario==='expired'&&!s.resolved){s.blocker={kind:'expired',title:'This payoff letter has expired',detail:'The attached letter expired November 6. This scenario is dated November 9. No approval is available for the stale letter.',action:'Retrieve current payoff letter'};log(s,'core','validate_quote','Expired letter blocked','Approval is unavailable until a current source document is retrieved.','warning');break;}
      if(s.scenario==='perdiem'&&!s.resolved){s.blocker={kind:'perdiem',title:'The per-diem amounts do not match',detail:'Network letter: $7.10/day. Verified mock core: $6.40/day. An operator must select the current core-backed letter.',action:'Review and use core-backed letter'};log(s,'core','validate_quote','Per-diem mismatch blocked','$7.10 differs from $6.40. The agent cannot pick a new financial value.','warning');break;}
      prepareQuote(s);break;
    }
    case 1:if(!s.quoteIssued)throw new Error('Issue the approved payoff letter first.');approval(s,'hold','Approve temporary payment hold','Apply the fictional credit union’s 30-day payment hold while the total-loss file is resolved. This is a demo policy.', ['Pause scheduled collections for 30 days','Accrued-interest treatment follows the synthetic quote; no fee waiver is implied']);break;
    case 2:
      if(!s.hold)throw new Error('The payment hold requires operator review first.');
      log(s,'inbox','receive_ach','Insurance ACH received',`Synthetic bank event ACH-091 confirms ${money(caseData.settlement)}. The member loan is not yet paid off.`,'info','Mock vendor');
      approval(s,'settlement','Approve insurance payment posting','Post the matched ACH receipt to this loan. The remaining shortfall stays open.', [`Post ${money(caseData.settlement)} to ${caseData.loan}`,`Keep ${money(remaining(s.quote!,caseData.settlement))} outstanding`],caseData.settlement);break;
    case 3:
      if(!s.insurance)throw new Error('Post the received insurance payment first.');
      if(!s.addendum){s.blocker={kind:'missing',title:'The GAP addendum is missing',detail:'The packet has a valuation report, settlement letter and loan history. The mock administrator also requires the signed GAP addendum.',action:'Retrieve signed addendum'};log(s,'gap','validate_packet','GAP submission held','Missing required signed addendum. No incomplete packet was submitted.','warning');break;}
      s.gapSubmitted=true;s.phase=4;
      log(s,'gap','submit_packet','Complete GAP packet submitted','Settlement, valuation, loan history, payoff letter and signed addendum. Receipt GAP-301. Submission is not adjudication.','success');break;
    case 4:
      if(!s.gapSubmitted)throw new Error('Submit a complete GAP packet before receiving its decision.');
      log(s,'gap','receive_decision','GAP decision + funds received',`Accelerated scenario event: approved benefit ${money(caseData.gapDecision)}. The $960.00 contract refund was confirmed separately. These are synthetic vendor receipts, not a model’s coverage decision.`,'info','Mock vendor');
      approval(s,'recoveries','Approve the final two credits','Apply the independently received GAP proceeds and service-contract refund. Approval uses this exact calculation snapshot.',[`Post GAP proceeds: ${money(caseData.gapDecision)}`,`Post contract refund: ${money(refund(caseData.contractPrice,caseData.contractMonths,caseData.usedMonths))}`,'Remaining balance after posting: $0.00'],caseData.gapDecision+refund(caseData.contractPrice,caseData.contractMonths,caseData.usedMonths));break;
    case 5:
      if(currentBalance(s)!==0)throw new Error('Lien release is blocked until the full payoff has settled.');
      approval(s,'release','Approve electronic lien release','The ledger is at $0.00. Queue a release with the mock ELT provider. Completion still waits for its acknowledgement.',['Send release request ELT-601','Wait for the next simulated overnight batch']);break;
    case 6:
      if(s.release!=='queued')throw new Error('There is no queued release.');
      s.batchAdvanced=true;s.release='acknowledged';s.phase=7;
      log(s,'elt','run_nightly_batch','Lien release acknowledged','The scenario advanced to November 10 at 02:00. Mock provider acknowledgement ACK-601 received. A queued request alone did not close the lien.','success','Mock vendor');break;
    case 7:
      if(s.release!=='acknowledged')throw new Error('Wait for the provider release acknowledgement.');
      approval(s,'handoff','Approve the member’s next step','Synthetic consent record CONSENT-72 authorizes one status message and a replacement-loan invitation. No credit decision or pre-qualification is made.', ['Send the approved status SMS and email','Create a consented application invitation in the mock loan system','Do not run a credit check']);break;
  }
  return s;
}
function prepareQuote(s:DemoState){approval(s,'quote','Approve the payoff letter','The draft is within the synthetic $35,000 delegation limit. Review the source figures before issuing it.', [`Issue ${money(s.quote!)} payoff letter`,`Valid through November 14 · per diem ${money(caseData.perDiem)}`,'Authority: fictional lending operations policy'],s.quote!);}
export function resolveBlocker(input:DemoState):DemoState {
  if(!input.blocker)throw new Error('There is no open exception.');
  const s=structuredClone(input);s.revision++;const b=s.blocker!;s.blocker=null;s.resolved=true;
  if(b.kind==='missing'){s.addendum=true;log(s,'gap','retrieve_addendum','Signed addendum retrieved','Synthetic document GAP-ADD-4821 has been added. The packet can now be validated again.','success','Operator');}
  else{log(s,'core','retrieve_current_letter','Current source document verified',`Operator selected the core-backed quote: ${money(s.quote!)}; $6.40/day; valid through November 14.`,'success','Operator');prepareQuote(s);}
  return s;
}
export function approve(input:DemoState,id:string,revision:number,reviewer='Demo operator'):DemoState {
  if(!input.approval||input.approval.id!==id||input.approval.revision!==revision||input.revision!==revision)throw new Error('Approval is missing or stale. Refresh the exact calculation snapshot.');
  const s=structuredClone(input);const a=s.approval!;s.approval=null;s.revision++;
  if(a.kind==='quote'){if(!s.quote||s.quote>3500000||s.blocker)throw new Error('Quote is outside delegated authority.');s.quoteIssued=true;s.phase=1;}
  if(a.kind==='hold'){s.hold=true;s.phase=2;}
  if(a.kind==='settlement'){if(s.insurance)throw new Error('Receipt already posted.');s.insurance=caseData.settlement;s.phase=3;}
  if(a.kind==='recoveries'){if(!s.gapSubmitted||s.gap||s.refund)throw new Error('Recovery is duplicate or unsupported.');s.gap=caseData.gapDecision;s.refund=refund(caseData.contractPrice,caseData.contractMonths,caseData.usedMonths);if(currentBalance(s)!==0)throw new Error('The received recoveries do not settle the quote.');s.phase=5;}
  if(a.kind==='release'){if(currentBalance(s)!==0)throw new Error('Outstanding balance blocks release.');s.release='queued';s.phase=6;}
  if(a.kind==='handoff'){if(s.release!=='acknowledged')throw new Error('Wait for the lien release acknowledgement.');s.consent=true;s.handoff=true;s.phase=8;}
  const vendor:Vendor= a.kind==='release'?'elt':a.kind==='handoff'?'los':'core';
  log(s,vendor,`approve_${a.kind}`,a.title.replace('Approve','Approved'),`${reviewer} approved ${a.id} at revision ${revision}. ${a.effects.join('. ')}.`,'approval','Operator');
  if(a.kind==='settlement')log(s,'core','post_insurance','Insurance payment posted',`Balance remaining: ${money(currentBalance(s))}. ELT release remains blocked.`,'success');
  if(a.kind==='recoveries')log(s,'core','post_recoveries','Loan settled in full','Insurance $24,850.00 + GAP $2,682.00 + refund $960.00 = payoff $28,492.00.','success','Calculator');
  if(a.kind==='handoff'){log(s,'communications','send_consented_message','Member status message sent','Synthetic SMS + email. “Your loan has been settled and your lien released. If you would like another vehicle loan, your invitation is ready.”','success');log(s,'los','create_invitation','Replacement-loan invitation created','LOS-880 · member consent CONSENT-72. Application invitation only; no new loan was funded.','success');}
  return s;
}
export function reject(input:DemoState):DemoState {
  if(!input.approval)throw new Error('No approval to reject.');
  const s=structuredClone(input);const a=s.approval!;s.revision++;s.approval=null;
  log(s,'core','reject_action','Action rejected by operator',`${a.id}: ${a.title}. No requested action was executed. Advance to prepare a new review.`,'warning','Operator');
  return s;
}
export const steps=[{title:'Payoff',subtitle:'Verified quote',vendor:'core'},{title:'Insurance',subtitle:'Matched payment',vendor:'inbox'},{title:'Recoveries',subtitle:'GAP + refund',vendor:'gap'},{title:'Title',subtitle:'Release acknowledged',vendor:'elt'},{title:'Next loan',subtitle:'Consented invitation',vendor:'los'}] as const;
export function stepDone(s:DemoState,i:number){return [s.quoteIssued,s.insurance>0,s.gap>0&&s.refund>0,s.release==='acknowledged',s.handoff][i];}
