import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
function worker(){
 const stores=new Map(),listeners=new Map(),bytes=new Uint8Array(1024*1024),hash=createHash('sha256').update(bytes).digest('hex');let requests=0,failId=null,corruptId=null,lastReplies=[];
 const files=[0,1,2,3].map(id=>`./assets/audio/${id}.wav`),resources=Object.fromEntries(files.map(file=>[file,{bytes:bytes.length,sha256:hash}]));
 const packs=[{id:'a',files:files.slice(0,2)},{id:'b',files:files.slice(1,3)},{id:'all',files}].map(p=>({...p,title:p.id,bytes:p.files.length*bytes.length}));
 const data={files:[],packs,resources};
 const caches={
  async keys(){return [...stores.keys()]},async delete(name){return stores.delete(name)},
  async open(name){
   if(!stores.has(name))stores.set(name,new Map());const values=stores.get(name),key=r=>typeof r==='string'?r:r.url||r.href;
   return {async keys(){return [...values.keys()].map(url=>new Request(url))},async match(r){return values.get(key(r))?.clone()},async put(r,value){values.set(key(r),value.clone())},async delete(r){return values.delete(key(r))}};
  },
 };
 vm.runInNewContext(source,{URL,Headers,Request,Response,Map,Set,Promise,Error,AbortSignal,crypto:webcrypto,caches,self:{clients:{claim:async()=>{}},location:{href:'https://garden.test/app/sw.js'},addEventListener:(name,fn)=>listeners.set(name,fn)},fetch:async url=>{
  if(String(url).endsWith('precache.json'))return new Response(JSON.stringify(data));requests++;
  if(String(url).endsWith(`/${failId}.wav`))throw Error('network interrupted');
  return new Response(String(url).endsWith(`/${corruptId}.wav`)?bytes.slice(0,20):bytes,{headers:{'Content-Type':'audio/wav'}});
 }});
 return {async activate(){let task;listeners.get('activate')({waitUntil:p=>task=p});await task;},stores,data,bytes,get replies(){return lastReplies},get requests(){return requests},set fail(id){failId=id},set corrupt(id){corruptId=id},async message(type,id){let task;const replies=[];lastReplies=replies;listeners.get('message')({data:{type,id},ports:[{postMessage:r=>replies.push(r)}],waitUntil:p=>task=p});await task;return replies.at(-1);},async fetch(id,range){const tasks=[];let result;listeners.get('fetch')({request:new Request(`https://garden.test/app/assets/audio/${id}.wav`,{headers:range?{Range:range}:{}}),respondWith:p=>result=p,waitUntil:p=>tasks.push(p)});const response=await result;await Promise.all(tasks);return response;}};
}
test('unselected resources evict at 40 MiB and retained ranges use no network',async()=>{
 const w=worker();for(let i=0;i<45;i++)assert.equal((await w.fetch(i)).status,200);
 const values=[...w.stores.entries()].find(([key])=>key.endsWith('-media'))[1];assert.equal(values.size,40);assert.equal(values.has('https://garden.test/app/assets/audio/0.wav'),false);
 const calls=w.requests,response=await w.fetch(44,'bytes=0-1');assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,2);assert.equal(w.requests,calls);assert.equal((await w.fetch(44,'bytes=99999999-')).status,416);
});
test('browsing, repeated packs and full download share bytes; removing one pin retains shared resources',async()=>{
 const w=worker();await w.fetch(0);assert.equal((await w.message('PLAN_PACK','a')).neededBytes,1024*1024);
 assert.equal((await w.message('DOWNLOAD_PACK','a')).mediaCount,2);const requests=w.requests;
 await w.message('DOWNLOAD_PACK','a');assert.equal(w.requests,requests);
 await w.message('DOWNLOAD_PACK','b');assert.equal(w.requests,requests+1);
 const full=await w.message('DOWNLOAD_PACK','all');assert.equal(full.mediaCount,4);assert.equal(full.allReady,true);
 await w.message('REMOVE_PACK','a');await w.message('REMOVE_PACK','all');
 for(let i=10;i<55;i++)await w.fetch(i);
 const before=w.requests;await w.fetch(1);await w.fetch(2);assert.equal(w.requests,before);const state=await w.message('CHECK_OFFLINE');assert.ok(state.packs.includes('b'));assert.equal(state.recentCount,40);
 const cleared=await w.message('CLEAR_MEDIA');assert.equal(cleared.mediaCount,0);assert.equal(cleared.selected.length,0);
});
test('interruption retains verified files and resume only fetches missing files',async()=>{
 const w=worker();w.fail=2;const failed=await w.message('DOWNLOAD_PACK','all');assert.match(failed.error,/interrupted/);
 const plan=await w.message('PLAN_PACK','all');assert.equal(plan.savedCount,3);assert.equal(plan.neededBytes,1024*1024);
 const calls=w.requests;w.fail=null;const done=await w.message('DOWNLOAD_PACK','all');assert.equal(done.allReady,true);assert.equal(w.requests,calls+1);assert.equal(w.replies[0].doneBytes,3*1024*1024);assert.equal(w.replies[0].progress,3);
});
test('corrupt content never counts as complete',async()=>{
 const w=worker();w.corrupt=1;assert.match((await w.message('DOWNLOAD_PACK','a')).error,/不完整/);assert.equal((await w.message('PLAN_PACK','a')).savedCount,1);
 assert.equal((await w.message('CHECK_OFFLINE')).packs.length,0);
});

test('activation removes old site caches and download choices without importing media',async()=>{
 const w=worker(),base='https://garden.test/app/';
 w.stores.set('abc-garden-old',new Map([[base+'precache.json',new Response(JSON.stringify(w.data))]]));
 w.stores.set('abc-garden-old-meta',new Map([[base+'offline-selection',new Response(JSON.stringify(['all']))]]));
 w.stores.set('abc-garden-old-media',new Map([[base+'assets/audio/0.wav',new Response(w.bytes,{headers:{'Content-Length':String(w.bytes.length)}})]]));
 w.stores.set('unrelated-cache',new Map([[base+'keep',new Response('keep')]]));
 await w.activate();assert.equal(w.stores.has('abc-garden-old-media'),false);assert.equal(w.stores.has('abc-garden-old-meta'),false);assert.equal(w.stores.has('abc-garden-old'),false);assert.equal(w.stores.has('unrelated-cache'),true);
 const state=await w.message('CHECK_OFFLINE');assert.equal(state.mediaCount,0);assert.equal(state.selected.length,0);assert.equal((await w.message('PLAN_PACK','all')).savedBytes,0);
 await w.message('DOWNLOAD_PACK','all');assert.equal((await w.message('CHECK_OFFLINE')).allReady,true);
});

test('category status distinguishes temporary cache from retained files and reuses full downloads',async()=>{
 const w=worker();await w.fetch(0);await w.fetch(1);
 let state=await w.message('CHECK_OFFLINE');let a=state.packStatus.find(p=>p.id==='a');
 assert.equal(a.complete,true);assert.equal(a.retained,false);assert.equal(a.savedBytes,2*w.bytes.length);assert.equal(a.neededBytes,0);
 const before=w.requests;await w.message('DOWNLOAD_PACK','a');assert.equal(w.requests,before);
 state=await w.message('CHECK_OFFLINE');assert.equal(state.packStatus.find(p=>p.id==='a').retained,true);
 await w.message('DOWNLOAD_PACK','all');state=await w.message('CHECK_OFFLINE');
 assert.ok(state.packStatus.every(p=>p.complete&&p.retained&&p.neededBytes===0));
 await w.message('CLEAR_MEDIA');state=await w.message('CHECK_OFFLINE');assert.ok(state.packStatus.every(p=>!p.complete&&p.savedBytes===0));assert.equal(state.allReady,false);
});

function categoryWorker(){const w=worker();w.data.packs[0].id='pictures';w.data.packs[1].id='other';w.data.packs.push({id:'word-audio',title:'words',files:[w.data.packs[2].files[3]],bytes:w.bytes.length});return w;}
test('clearing one category after all download removes unique bytes and keeps other categories pinned',async()=>{
 const w=categoryWorker();await w.message('DOWNLOAD_PACK','all');
 const cleared=await w.message('CLEAR_PACK','pictures');assert.equal(cleared.error,undefined);assert.equal(cleared.mediaCount,3);assert.equal(cleared.allReady,false);
 assert.deepEqual([...cleared.selected].sort(),['other','word-audio']);
 const picture=cleared.packStatus.find(p=>p.id==='pictures');assert.equal(picture.savedBytes,w.bytes.length);assert.equal(picture.clearableBytes,0);
 assert.equal(cleared.packStatus.find(p=>p.id==='other').complete,true);
 const before=w.requests;await w.fetch(1);await w.fetch(2);await w.fetch(3);assert.equal(w.requests,before);
 await w.message('DOWNLOAD_PACK','pictures');assert.equal(w.requests,before+1);assert.equal((await w.message('CHECK_OFFLINE')).allReady,true);
});
test('clearing browsed category removes current caches',async()=>{
 const w=categoryWorker(),base='https://garden.test/app/';
 await w.fetch(0);
 await w.fetch(1);await w.fetch(3);
 const state=await w.message('CLEAR_PACK','pictures');assert.equal(state.mediaCount,1);assert.equal((await w.message('PLAN_PACK','pictures')).savedBytes,0);
 for(const [name,cache] of w.stores)if(name.endsWith('-media'))assert.equal(cache.has(base+'assets/audio/0.wav'),false);
 assert.match((await w.message('CLEAR_PACK','all')).error,/分类/);
 const before=w.requests;await w.fetch(3);assert.equal(w.requests,before);
});
