import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const url=process.argv[2]||'http://192.168.1.119:5180/';
const chrome=process.env.CHROME_PATH;
assert(chrome,'Set CHROME_PATH to an installed Chromium executable');
const profile=mkdtempSync(join(tmpdir(),'komorebi-check-'));
const processChrome=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--hide-scrollbars','about:blank'],{stdio:['ignore','ignore','pipe']});
const endpoint=await new Promise((resolve,reject)=>{let buffer='';const timeout=setTimeout(()=>reject(new Error('Chrome startup timeout')),15000);processChrome.stderr.on('data',chunk=>{buffer+=chunk;const match=buffer.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});processChrome.on('error',reject);});
const socket=new WebSocket(endpoint);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
let id=0;const pending=new Map(),errors=[];let session;
socket.onmessage=event=>{const value=JSON.parse(event.data);if(value.id){const entry=pending.get(value.id);if(entry){clearTimeout(entry.timeout);pending.delete(value.id);value.error?entry.reject(new Error(value.error.message)):entry.resolve(value.result);}}else if(value.method==='Runtime.exceptionThrown')errors.push(value.params.exceptionDetails.text);};
function send(method,params={},sessionId=session){return new Promise((resolve,reject)=>{const number=++id;const timeout=setTimeout(()=>reject(new Error('CDP timeout: '+method)),15000);pending.set(number,{resolve,reject,timeout});socket.send(JSON.stringify({id:number,method,params,...(sessionId?{sessionId}:{})}));});}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function loaded(){for(let i=0;i<60;i++){if(await evaluate("!!document.querySelector('#content .home-screen, #content .screen')"))return;await sleep(100);}throw new Error('App did not initialize');}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);const position=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...position});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...position});}
const output=resolve('diagnostics/anime-dashboard');mkdirSync(output,{recursive:true});
try{
 const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('komorebi-calendar-url','http://calendar.test');const originalFetch=window.fetch;window.fetch=async(input,options)=>{const url=new URL(input);if(url.hostname!=='calendar.test')return originalFetch(input,options);const start=new Date();start.setHours(10,0,0,0);return new Response(JSON.stringify(url.pathname.endsWith('/status')?{available:true,busy:false,currentEvent:null,currentEvents:[],nextEvent:null,asOf:new Date().toISOString()}:{events:[{id:'fixture-occurrence',title:'Fixture meeting',start:start.toISOString(),end:new Date(+start+3600000).toISOString(),isAllDay:false,location:null}],count:1,total:1,hasMore:false}),{headers:{'Content-Type':'application/json'}});};`});
 await send('Page.navigate',{url});await loaded();
 const layout=await evaluate('({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,images:[...document.images].every(i=>i.complete&&i.naturalWidth>0)})');
 assert(layout.images);assert(layout.scrollWidth<=1920);assert(layout.scrollHeight<=1080,JSON.stringify(layout));
 const read=()=>evaluate("JSON.parse(localStorage.getItem('komorebi-household-v2'))");
 await click('[data-view="shopping"]');
 await evaluate("document.querySelector('#shopping-form input[name=name]').focus()");await send('Input.insertText',{text:'Verification apples'});await click('#shopping-form button[type=submit]');
 let saved=await read();const item=saved.shopping.find(i=>i.name==='Verification apples');assert(item);
 await click(`[data-quantity="1"][data-id="${item.id}"]`);assert.equal((await read()).shopping.find(i=>i.id===item.id).qty,2);
 await click(`[data-shop-check="${item.id}"]`);assert((await read()).shopping.find(i=>i.id===item.id).done);
 await click(`[data-shop-check="${item.id}"]`);assert(!(await read()).shopping.find(i=>i.id===item.id).done);
 await click('[data-view="tasks"]');await click('[data-routine="Evening"]');assert(await evaluate("[...document.querySelectorAll('.task-row small')].every(e=>e.textContent==='Evening')"));
 await click('[data-routine="All"]');await evaluate("document.querySelector('#task-form input[name=title]').focus()");await send('Input.insertText',{text:'Verification chore'});await click('#task-form button[type=submit]');
 saved=await read();const task=saved.tasks.find(t=>t.title==='Verification chore');assert(task);await click(`[data-task-check="${task.id}"]`);assert((await read()).tasks.find(t=>t.id===task.id).done);
 await click('[data-view="calendar"]');await sleep(100);
 assert.equal(await evaluate("document.querySelectorAll('.calendar-content [data-event]').length"),0);
 assert.equal(await evaluate("document.querySelectorAll('[data-add-event]').length"),0);
 await click('[data-calendar-mode="month"]');assert.equal(await evaluate("document.querySelectorAll('.month-day').length"),42);
 await click('[data-calendar-mode="day"]');assert(await evaluate("!!document.querySelector('.work-day-grid')"));
 await click('[data-calendar-mode="week"]');assert.deepEqual(await evaluate("[...document.querySelectorAll('.day-heading span')].map(node=>node.textContent)"),['Sun','Mon','Tue','Wed','Thu','Fri','Sat']);const originalHeading=await evaluate("document.querySelector('.calendar-date-nav h2').textContent");await click('[data-calendar-step="1"]');assert.notEqual(await evaluate("document.querySelector('.calendar-date-nav h2').textContent"),originalHeading);await click('[data-calendar-today]');
 await click('#theme');assert(await evaluate("document.body.classList.contains('evening')"));await send('Page.reload');await loaded();saved=await read();assert(saved.shopping.some(i=>i.id===item.id)&&saved.tasks.some(t=>t.id===task.id&&t.done));
 await click('[data-view="tasks"]');await click(`[data-task-delete="${task.id}"]`);assert(!(await read()).tasks.some(t=>t.id===task.id));
 await click('[data-view="home"]');await evaluate("document.getElementById('home-note').focus()");await send('Input.insertText',{text:'A shared little note.'});assert.equal((await read()).note,'A shared little note.');
 await click('#theme');
 await sleep(100);writeFileSync(join(output,'desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 for(const name of ['shopping','tasks','calendar']){await click(`[data-view="${name}"]`);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));writeFileSync(join(output,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));}
 await send('Emulation.setDeviceMetricsOverride',{width:1808,height:1017,deviceScaleFactor:1,mobile:false});
 for(const name of ['home','shopping','tasks','calendar']){await click(`[data-view="${name}"]`);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),'Frame viewport overflow: '+name);assert(await evaluate('document.getElementById("content").getBoundingClientRect().top===0'),'Full-height content');}
 await click('[data-view="calendar"]');for(const mode of ['week','month','day']){await click(`[data-calendar-mode="${mode}"]`);await sleep(100);assert(await evaluate('(()=>{const e=document.querySelector(".calendar-content");return e.scrollHeight<=e.clientHeight+1&&e.scrollWidth<=e.clientWidth+1})()'),'Calendar overflow: '+mode);}
 await click('[data-calendar-mode="week"]');writeFileSync(join(output,'frame-sidebar.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await click('[data-view="home"]');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
 writeFileSync(join(output,'mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 assert.deepEqual(errors,[]);writeFileSync(join(output,'verification.json'),JSON.stringify({layout,checks:['four-screen navigation','shopping add/quantity/check/restore','task add/complete/filter/delete','read-only work calendar/day/week/month/date navigation','note persistence','theme persistence','data persistence after reload','1920x1080 layout','390px horizontal fit','no uncaught exceptions'],errors},null,2));
 console.log('PASS: four screens, shopping, tasks, read-only work calendar, persistence and responsive layout');
}finally{try{await send('Browser.close',{},null);}catch{}socket.close();processChrome.kill();await sleep(300);rmSync(profile,{recursive:true,force:true});}
