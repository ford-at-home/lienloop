import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {caseData,money,requests} from '../../src/lienloop/engine';

const destination=resolve('public/fixtures');await mkdir(destination,{recursive:true});
const items:[string,string,string,[string,string][],string[]][]=[
  ['settlement-letter.pdf','Insurance settlement','Horizon Mutual · Fictional carrier',[
    ['Document ID','SET-4821'],['Member','Mira Chen'],['Loan','LN-4821'],['Loss date','November 4, 2026'],['Settlement amount','$24,850.00'],['Payment reference','ACH-091'],['Receipt date','November 9, 2026'],['Vehicle','2023 compact SUV · DEMO0000000000421']],
    ['For this synthetic scenario, this is a confirmed insurance receipt.','This payment alone does not satisfy the full loan payoff.']],
  ['payoff-letter.pdf','Current payoff letter','Northstar Credit Union · Fictional lender',[
    ['Document ID','PAY-4821-R2'],['Quote date','November 9, 2026'],['Valid through','November 14, 2026'],['Principal + existing balance','$28,460.00'],['Per diem','$6.40'],['Additional days','5'],['Additional interest','$32.00'],['Payoff amount','$28,492.00']],
    ['Formula: 2,846,000 cents + 640 cents x 5 = 2,849,200 cents.','Fictional operator delegation limit: $35,000.00.','The loan is settled only when all approved credits equal the payoff.']],
  ['expired-payoff-letter.pdf','Expired payoff letter','Northstar Credit Union · Fictional lender',[
    ['Document ID','PAY-4821-R1'],['Quote date','November 1, 2026'],['Expired on','November 6, 2026'],['Scenario review date','November 9, 2026'],['Status','EXPIRED - DO NOT APPROVE']],
    ['This source is intentionally stale for the expired-letter scenario.','Retrieve current document PAY-4821-R2 before preparing approval.']],
  ['gap-addendum.pdf','Signed GAP addendum','Harbor Protection · Fictional GAP administrator',[
    ['Document ID','GAP-ADD-4821'],['Contract holder','Mira Chen'],['Loan','LN-4821'],['Member signature','Mira Chen - SYNTHETIC SIGNATURE'],['Contract date','November 9, 2024'],['Benefit decision','$2,682.00 in the simulated adjudication event']],
    ['A signed addendum is required by this fictional intake rule.','Coverage is determined by the mock administrator, not by the model.','Submission is not a coverage decision, payment or confirmation.']],
  ['valuation-report.pdf','Vehicle valuation','Cedar Valuation · Fictional valuation provider',[
    ['Document ID','VAL-4821'],['Member','Mira Chen'],['Vehicle','2023 compact SUV'],['VIN','DEMO0000000000421'],['Agreed settlement','$24,850.00'],['Scenario date','November 9, 2026']],
    ['This is a synthetic valuation input, not a real vehicle appraisal.','LienLoop does not revalue the vehicle or audit the ACV in this demo.']],
  ['service-contract.pdf','Service-contract refund schedule','Meadow Service Plans · Fictional administrator',[
    ['Document ID','SVC-4821'],['Original price','$1,600.00'],['Contract term','60 months'],['Months used','24 months'],['Unused term','36 months'],['Refund rule','Pro-rata unused months; no cancellation fee'],['Calculated refund','$960.00']],
    ['Formula: 160,000 cents x (60 - 24) / 60 = 96,000 cents.','Round half up to integer cents after calculating the full fraction.','The refund is not posted until a vendor receipt and operator approval.']],
  ['loan-history.pdf','Loan ledger extract','Northstar Credit Union · Fictional core ledger',[
    ['Document ID','LED-4821'],['Loan','LN-4821'],['Member','Mira Chen'],['Balance before quote','$28,460.00'],['Verified per diem','$6.40'],['Insurance receipt','$24,850.00'],['GAP receipt after decision','$2,682.00'],['Service-contract refund receipt','$960.00']],
    ['Scenario events are accelerated. Real elapsed processing time is not modeled.','Every posting requires a separate human approval of its action snapshot.','The synthetic 30-day hold does not change the fixed demo interest schedule.']],
];
for(const [filename,title,issuer,rows,notes] of items){
  const pdf=await PDFDocument.create();const p=pdf.addPage([612,792]);
  const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const green=rgb(.12,.27,.20),muted=rgb(.42,.47,.40),line=rgb(.87,.90,.84);
  const text=(v:string,x:number,y:number,size=11,font=regular,color=green)=>p.drawText(v,{x,y,size,font,color});
  p.drawRectangle({x:0,y:716,width:612,height:76,color:rgb(.94,.96,.90)});
  text('LIENLOOP / SOURCE FIXTURE',42,754,9,bold);text('SYNTHETIC - NOT A REAL FINANCIAL DOCUMENT',42,735,8,regular,muted);
  text(title,42,674,25,bold);text(issuer,42,650,10,regular,muted);
  p.drawLine({start:{x:42,y:628},end:{x:570,y:628},thickness:1,color:line});
  let y=593;for(const [label,value]of rows){text(label,42,y,10,regular,muted);text(value,250,y,10,bold);p.drawLine({start:{x:42,y:y-14},end:{x:570,y:y-14},thickness:.5,color:line});y-=39;}
  y-=18;for(const note of notes){text(note,42,y,9,regular,muted);y-=18;}
  p.drawLine({start:{x:42,y:73},end:{x:570,y:73},thickness:1,color:line});
  text('Fictional names, values and policies. No vendor affiliation or API compatibility asserted.',42,55,8,regular,muted);text('01',550,55,8,bold);
  pdf.setTitle(`${title} - Synthetic LienLoop fixture`);pdf.setAuthor('LienLoop demo');
  await writeFile(resolve(destination,filename),await pdf.save());
}
await writeFile(resolve(destination,'network-request.json'),JSON.stringify({synthetic:true,request:requests[0],quotedPerDiemCents:640,contractPriceCents:160000,notes:'Authoritative fixture figures; no production vendor API.'},null,2));
await writeFile(resolve(destination,'perdiem-mismatch.json'),JSON.stringify({synthetic:true,request:requests[0],networkPerDiemCents:710,verifiedCorePerDiemCents:640,blocked:true},null,2));
await writeFile(resolve(destination,'fax-request.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="612" height="792" viewBox="0 0 612 792"><rect width="612" height="792" fill="#fafafa"/><g font-family="monospace" fill="#333"><text x="40" y="50" font-size="10">FAX RX // CEDAR CLAIMS // NOV 09 2026 // 10:24</text><path d="M40 70H572" stroke="#666"/><text x="40" y="110" font-size="22">PAYOFF REQUEST</text><text x="40" y="145" font-size="11">SYNTHETIC IMAGE FIXTURE - NOT A REAL REQUEST</text><text x="40" y="215" font-size="14">Request: RQ-703</text><text x="40" y="250" font-size="14">Member: Elliot Brooks</text><text x="40" y="285" font-size="14">Loan: LN-6130</text><text x="40" y="320" font-size="14">VIN: DEMO0000000000827</text><text x="40" y="355" font-size="14">Loss date: November 5, 2026</text><text x="40" y="390" font-size="14">Settlement: $17,400.00</text><text x="40" y="425" font-size="14">Payoff: $16,180.00</text><path d="M40 470H572" stroke="#999"/><text x="40" y="510" font-size="11">Different VIN + loan from TL-2048.</text><text x="40" y="535" font-size="11">Retain as a separate member file.</text><text x="40" y="720" font-size="10">Fictional names and figures. No real personal data.</text></g></svg>`);
console.log(`Generated ${items.length} PDFs, two JSON fixtures and one fax image.`);
