import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {ViteDevServer} from 'vite';
import {localAgentPlugin} from '../scripts/local-agent-plugin';
import {advance} from '../../src/lienloop/engine';

test('localhost controller rejects cross-origin writes and stale operator decisions',async()=>{
  process.env.LIENLOOP_DB=resolve(mkdtempSync(resolve(tmpdir(),'lienloop-controller-')),'state.sqlite');
  const oldKey=process.env.ANTHROPIC_API_KEY;delete process.env.ANTHROPIC_API_KEY;
  let middleware:((req:IncomingMessage,res:ServerResponse,next:()=>void)=>unknown)|undefined;
  const server={middlewares:{use:(fn:typeof middleware)=>{middleware=fn;}},httpServer:{once:()=>{}}} as unknown as ViteDevServer;
  const plugin=localAgentPlugin();const configure=plugin.configureServer as (s:ViteDevServer)=>Promise<void>;
  await configure(server);
  const request=async(path:string,body?:object,origin='http://localhost:5173',host='localhost:5173',contentType='application/json')=>{
    const req=Object.assign(Readable.from(body?[JSON.stringify(body)]:[]),{url:`/__lienloop/${path}`,method:body?'POST':'GET',headers:{origin,host,'content-type':contentType}});
    let result:Record<string,unknown>={};const response={statusCode:200,setHeader:()=>{},end:(text:string)=>{result=JSON.parse(text);}};
    await middleware!(req as unknown as IncomingMessage,response as unknown as ServerResponse,()=>{throw new Error('Unexpected next()');});return {status:response.statusCode,body:result};
  };
  try{
    assert.equal((await request('status')).status,200);
    assert.equal((await request('reset',{scenario:'standard'},'https://attacker.example')).status,403);
    assert.equal((await request('reset',{scenario:'standard'},'http://attacker.example','attacker.example')).status,403);
    assert.equal((await request('reset',{scenario:'standard'},'http://localhost:5173','localhost:5173','text/plain')).status,415);
    assert.equal((await request('start',{scenario:'standard'})).status,400);
    const {readState,updateState}=await import('../scripts/store');updateState(advance);const a=readState().approval!;
    assert.equal((await request('approve',{approvalId:'made-up',revision:a.revision})).status,400);assert.equal(readState().quoteIssued,false);
    assert.equal((await request('approve',{approvalId:a.id,revision:a.revision})).status,200);assert.equal(readState().quoteIssued,true);
    assert.equal((await request('approve',{approvalId:a.id,revision:a.revision})).status,400);
  }finally{if(oldKey===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=oldKey;}
});
