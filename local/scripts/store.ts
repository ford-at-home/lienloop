import { DatabaseSync } from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createState,type DemoState,type Scenario} from '../../src/lienloop/engine';
const path=process.env.LIENLOOP_DB?resolve(process.env.LIENLOOP_DB):resolve('.runtime/demo.sqlite');
mkdirSync(dirname(path),{recursive:true});
const db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS demo (id INTEGER PRIMARY KEY CHECK (id=1), data TEXT NOT NULL)');
db.prepare('INSERT OR IGNORE INTO demo (id,data) VALUES (1,?)').run(JSON.stringify(createState()));
export function readState():DemoState {const row=db.prepare('SELECT data FROM demo WHERE id=1').get() as {data:string};return JSON.parse(row.data);}
export function updateState(fn:(s:DemoState)=>DemoState):DemoState {
  db.exec('BEGIN IMMEDIATE');try{const state=fn(readState());db.prepare('UPDATE demo SET data=? WHERE id=1').run(JSON.stringify(state));db.exec('COMMIT');return state;}catch(e){db.exec('ROLLBACK');throw e;}
}
export function resetStore(scenario:Scenario='standard'){return updateState(()=>createState(scenario));}
