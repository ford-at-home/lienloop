import type {Plugin} from 'vite';
import {spawn,type ChildProcess} from 'node:child_process';
import {resolve} from 'node:path';
import {approve,reject,resolveBlocker,scenarios,type Scenario} from '../../src/lienloop/engine';

/** Opt-in, same-origin development controller. Not included in the deployed static app. */
export function localAgentPlugin():Plugin {
  let child:ChildProcess|null=null;let diagnostic='';let lastExit:number|null=null;
  return {name:'lienloop-local-agent',apply:'serve',async configureServer(server){
    const {readState,updateState,resetStore}=await import('./store');
    const snapshot=()=>({state:readState(),active:child!==null,available:!!process.env.ANTHROPIC_API_KEY,error:diagnostic,lastExit});
    server.middlewares.use(async(req,res,next)=>{
      const path=(req.url||'').split('?')[0];if(!path.startsWith('/__lienloop/'))return next();
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
      const send=(value:unknown,status=200)=>{res.statusCode=status;res.end(JSON.stringify(value));};
      try{
        if(req.method==='GET'&&path==='/__lienloop/status'){send(snapshot());return;}
        if(req.method!=='POST'){send({error:'Method not allowed'},405);return;}
        const origin=req.headers.origin;
        if(!origin||!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname)||new URL(origin).host!==req.headers.host){send({error:'Same-origin localhost operator request required'},403);return;}
        if(req.headers['content-type']!=='application/json'){send({error:'JSON required'},415);return;}
        let raw='';for await(const chunk of req){raw+=String(chunk);if(raw.length>4096)throw new Error('Request too large');}
        const body=JSON.parse(raw||'{}') as {scenario?:Scenario;approvalId?:string;revision?:number};
        if(path==='/__lienloop/start'){
          if(child)throw new Error('An agent run is already active.');
          if(!process.env.ANTHROPIC_API_KEY)throw new Error('Set ANTHROPIC_API_KEY in the server environment before starting live mode.');
          const scenario=body.scenario||'standard';if(!(scenario in scenarios))throw new Error('Unknown scenario.');
          resetStore(scenario);diagnostic='';lastExit=null;
          child=spawn(process.execPath,['--import',resolve('node_modules/tsx/dist/loader.mjs'),resolve('scripts/agent.ts'),scenario,'--web'],{cwd:process.cwd(),env:process.env,stdio:['ignore','pipe','pipe']});
          child.stderr?.on('data',chunk=>{console.error(String(chunk));});
          child.stdout?.on('data',chunk=>{console.log(String(chunk));});
          child.on('error',e=>{diagnostic=e.message;child=null;});
          child.on('exit',(code,signal)=>{lastExit=code;if(code!==0&&signal!=='SIGTERM')diagnostic=`Agent exited with code ${code}. See the local terminal for details.`;child=null;});
        }else if(path==='/__lienloop/stop'){child?.kill('SIGTERM');}
        else if(path==='/__lienloop/reset'){if(child)throw new Error('Stop the agent before resetting the scenario.');const scenario=body.scenario||'standard';if(!(scenario in scenarios))throw new Error('Unknown scenario.');resetStore(scenario);diagnostic='';}
        else if(path==='/__lienloop/approve'){
          if(!body.approvalId||body.revision===undefined)throw new Error('Approval ID and revision required.');
          updateState(s=>approve(s,body.approvalId!,body.revision!,'Local web operator'));
        }else if(path==='/__lienloop/reject'){
          updateState(s=>{if(s.approval?.id!==body.approvalId||s.revision!==body.revision)throw new Error('Stale rejection.');return reject(s);});
        }else if(path==='/__lienloop/resolve'){
          updateState(s=>{if(s.revision!==body.revision)throw new Error('State changed during document review.');return resolveBlocker(s);});
        }else{send({error:'Unknown operation'},404);return;}
        send(snapshot());
      }catch(e){send({error:e instanceof Error?e.message:String(e)},400);}
    });
    server.httpServer?.once('close',()=>child?.kill('SIGTERM'));
  }};
}
