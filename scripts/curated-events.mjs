// Local editorial tool. Never deploys or changes a database. All output is local.
import fs from 'node:fs';
import path from 'node:path';
import { draftCuratedEvent,reviewCuratedEvent,publishCuratedEvent,activeCuratedEvents } from '../lib/curated-events.ts';
const [action,input,output]=process.argv.slice(2);
if(!['draft','review','publish','check'].includes(action)||!input){console.error('Usage: node scripts/curated-events.mjs draft|review|publish INPUT OUTPUT, or check CATALOG');process.exit(1);}
try {
 const value=JSON.parse(fs.readFileSync(input,'utf8'));
 if(action==='check'){const rows=Array.isArray(value)?value:[value];console.log(JSON.stringify({records:rows.length,active:activeCuratedEvents(rows)},null,2));}
 else {
  if(!output)throw Error('Specify a separate local output path.');
  if(path.resolve(input)===path.resolve(output))throw Error('Keep the input: choose a separate output file.');
  const values=Array.isArray(value)?value:[value];
  const results=values.map(item=>action==='draft'?draftCuratedEvent(item.facts||item):action==='review'?reviewCuratedEvent(item):publishCuratedEvent(item));
  const result=action==='publish'||Array.isArray(value)?results:results[0];
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(`${action} saved locally: ${output}. No production event was published.`);
 }
}catch(e){console.error(e.message);process.exit(1);}
