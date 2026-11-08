import {advance,scenarios,type Scenario} from '../../src/lienloop/engine';
import {humanReview} from './review';
import {readState,resetStore,updateState} from './store';
const scenario=(process.argv[2]||'standard') as Scenario;if(!(scenario in scenarios))throw new Error('Unknown scenario.');
resetStore(scenario);console.log('LienLoop / deterministic terminal replay / SYNTHETIC DATA');
while(readState().phase<8){let s=readState();if(s.approval||s.blocker){if(!await humanReview()){console.log('Stopped. Pending state retained locally.');process.exit(0);}continue;}s=updateState(advance);console.log(s.events.at(-1)?.title);}
console.log('All five synthetic outcomes confirmed. No live model or vendor was used.');
