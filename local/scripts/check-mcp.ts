import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {resolve} from 'node:path';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {approve,advance,currentBalance,vendors} from '../../src/lienloop/engine';

// Isolate the smoke-test ledger from a user's running demo.
const dir=mkdtempSync(resolve(tmpdir(),'lienloop-mcp-'));process.env.LIENLOOP_DB=resolve(dir,'state.sqlite');
const {readState,updateState}=await import('./store');
const clients=new Map<string,Client>();
try{
  for(const vendor of vendors){
    const client=new Client({name:'lienloop-integration-check',version:'1.0.0'});
    const transport=new StdioClientTransport({command:process.execPath,args:['--import',resolve('node_modules/tsx/dist/loader.mjs'),resolve('scripts/vendor.ts'),vendor],env:{...Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>typeof e[1]==='string')),LIENLOOP_DB:process.env.LIENLOOP_DB!},stderr:'pipe'});
    await client.connect(transport);clients.set(vendor,client);const list=await client.listTools();assert.ok(list.tools.length>=1);assert.ok(!list.tools.some(t=>/^(approve|reject|reset|resolve)/.test(t.name)));
    const state=await client.callTool({name:'read_status',arguments:{}});assert.ok(!state.isError);console.log(`PASS ${vendor}: ${list.tools.map(t=>t.name).join(', ')}`);
  }
  const call=async(vendor:string,name:string)=>{const r=await clients.get(vendor)!.callTool({name,arguments:{fileId:'TL-2048'}});assert.ok(!r.isError,JSON.stringify(r));return r;};
  const visual=await clients.get('inbox')!.callTool({name:'read_source_image',arguments:{documentId:'settlement'}});assert.ok(!visual.isError);assert.ok((visual.content as {type:string}[]).some(c=>c.type==='image'));console.log('PASS original PDF page is available as a vision tool image.');
  const human=()=>updateState(s=>approve(s,s.approval!.id,s.approval!.revision,'Integration-test operator'));
  await call('core','analyze_and_prepare_quote');assert.equal(readState().quoteIssued,false);human();
  await call('core','prepare_payment_hold');human();
  await call('core','receive_ach_and_prepare_posting');assert.equal(readState().insurance,0);human();
  const early=await clients.get('elt')!.callTool({name:'prepare_release',arguments:{fileId:'TL-2048'}});assert.equal(early.isError,true);
  await call('gap','validate_and_submit_packet');await call('core','receive_recoveries_and_prepare_posting');assert.equal(readState().gap,0);human();
  await call('elt','prepare_release');human();assert.equal(readState().release,'queued');await call('elt','advance_batch');
  await call('los','prepare_member_handoff');human();assert.equal(readState().phase,8);assert.equal(currentBalance(readState()),0);
  const sms=await clients.get('communications')!.callTool({name:'preview_message',arguments:{}});assert.ok(!sms.isError);
  const duplicate=await clients.get('core')!.callTool({name:'receive_ach_and_prepare_posting',arguments:{fileId:'TL-2048'}});assert.equal(duplicate.isError,true);
  console.log('PASS cross-process workflow: six approvals, exact reconciliation, early release and duplicate posting rejected.');
}finally{await Promise.all([...clients.values()].map(c=>c.close()));}
