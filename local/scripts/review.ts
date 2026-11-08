import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {approve,reject,resolveBlocker} from '../../src/lienloop/engine';
import {readState,updateState} from './store';
export async function humanReview():Promise<boolean>{
  const s=readState();if(!s.approval&&!s.blocker)return true;
  if(!stdin.isTTY)throw new Error('Operator approval requires an interactive terminal. No action was approved.');
  const rl=createInterface({input:stdin,output:stdout});
  try{
    if(s.blocker){console.log(`\nSOURCE EXCEPTION: ${s.blocker.title}\n${s.blocker.detail}`);const answer=await rl.question(`Type REVIEW to ${s.blocker.action.toLowerCase()}, or STOP: `);if(answer!=='REVIEW')return false;updateState(current=>{if(current.revision!==s.revision)throw new Error('State changed during review.');return resolveBlocker(current);});return true;}
    const a=s.approval!;console.log(`\nHUMAN DECISION ${a.id} / revision ${a.revision}\n${a.title}\n${a.description}\n${a.effects.map(e=>` - ${e}`).join('\n')}`);
    const answer=await rl.question('Type APPROVE to execute this exact proposal, REJECT to discard it, or STOP: ');
    if(answer==='APPROVE'){updateState(current=>approve(current,a.id,a.revision,'Terminal operator'));return true;}
    if(answer==='REJECT'){updateState(current=>{if(current.approval?.id!==a.id)throw new Error('Stale rejection.');return reject(current);});return false;}
    return false;
  }finally{rl.close();}
}
