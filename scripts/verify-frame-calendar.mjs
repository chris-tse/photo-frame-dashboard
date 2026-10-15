// Requires the frame's temporary WebView debug socket forwarded to localhost:9223.
// Reports counts and geometry only, never calendar content.
import assert from 'node:assert/strict';
const tabs=await (await fetch('http://127.0.0.1:9223/json')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.onopen=resolve);
let sequence=0;const pending=new Map();
ws.onmessage=message=>{const data=JSON.parse(message.data);if(data.id&&pending.has(data.id)){pending.get(data.id)(data);pending.delete(data.id);}};
async function evaluate(expression){const id=++sequence;const response=new Promise(resolve=>pending.set(id,resolve));ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));const data=await response;if(data.result.exceptionDetails)throw new Error('Calendar verification expression failed');return data.result.result.value;}
try{
const result=await evaluate(`(async()=>{
 document.querySelector('[data-view=calendar]').click();
 await new Promise(r=>setTimeout(r,1800));
 const checks=[];
 for(const mode of ['week','month','day']){
  document.querySelector('[data-calendar-mode='+mode+']').click();
  await new Promise(r=>setTimeout(r,1200));
  for(let attempt=0;attempt<30&&!document.querySelector('.calendar-content [data-work-event]');attempt++)await new Promise(r=>setTimeout(r,200));
  const content=document.querySelector('.calendar-content');
  const cards=[...content.querySelectorAll('[data-work-event]')];
  checks.push({mode,noVerticalScroll:content.scrollHeight<=content.clientHeight+1,noHorizontalScroll:content.scrollWidth<=content.clientWidth+1,documentFits:document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1,workCards:cards.length,weekDays:mode==='week'?[...content.querySelectorAll('.day-heading span')].map(node=>node.textContent):null,noDemoCards:content.querySelectorAll('[data-event]').length===0,cells:content.querySelectorAll('.month-day').length});
 }
 const card=document.querySelector('[data-work-event]');let details=false;
 if(card){card.click();await new Promise(r=>setTimeout(r,100));details=document.getElementById('work-dialog').open&&document.querySelectorAll('#work-dialog input,#work-dialog textarea').length===0;document.querySelector('#work-dialog button[aria-label=Close]').click();}
 document.querySelector('[data-calendar-mode=week]').click();
 return {checks,readOnlyDetails:details};
})()`);
for(const check of result.checks){assert.ok(check.noVerticalScroll,check.mode+' vertical overflow');assert.ok(check.noHorizontalScroll,check.mode+' horizontal overflow');assert.ok(check.documentFits,check.mode+' document overflow');assert.ok(check.noDemoCards,check.mode+' demo events');if(check.mode==='month')assert.equal(check.cells,42);if(check.mode==='week')assert.deepEqual(check.weekDays,['Sun','Mon','Tue','Wed','Thu','Fri','Sat']);}
assert.ok(result.checks.some(check=>check.workCards>0),'Work events rendered');
console.log(JSON.stringify(result));
}finally{ws.close();}
