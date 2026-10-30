// One resource store per build; package membership pins resources without copying them.
const CACHE='abc-garden-b1d58d53ccaa',MEDIA=CACHE+'-media',META=CACHE+'-meta',root=new URL('./',self.location.href);
const RECENT_LIMIT=40*1024*1024,RECENT_COUNT=240;
let localPromise,resourceSpecs,pinnedPromise,manifestPromise,indexPromise,selectionPromise,cacheQueue=Promise.resolve(),download=null,mediaEpoch=0;
const absolute=file=>new URL(file,root).href;
const metadataUrl=absolute('./offline-selection');
const manifest=()=>manifestPromise??=fetch(absolute('precache.json'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('无法读取离线清单。');return r.json();}).catch(e=>{manifestPromise=null;throw e;});
const serial=fn=>{const work=cacheQueue.then(fn);cacheQueue=work.catch(()=>{});return work;};
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const data=await manifest(),cache=await caches.open(CACHE);
 await cache.addAll([...data.files.map(absolute),absolute('precache.json')]);await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('abc-garden-')&&![CACHE,MEDIA,META].includes(key))await caches.delete(key);
 await self.clients.claim();
})()));
async function localManifest(){return localPromise??=(async()=>{const r=await (await caches.open(CACHE)).match(absolute('precache.json'));return r?await r.json():manifest();})().catch(e=>{localPromise=null;throw e;});}
async function selections(){return selectionPromise??=(async()=>{const r=await (await caches.open(META)).match(metadataUrl);return new Set(r?await r.json():[]);})().catch(e=>{selectionPromise=null;throw e;});}
async function saveSelections(){pinnedPromise=null;await (await caches.open(META)).put(metadataUrl,new Response(JSON.stringify([...(await selections())]),{headers:{'Content-Type':'application/json'}}));}
async function resourceIndex(){return indexPromise??=(async()=>{
 const cache=await caches.open(MEDIA),keys=await cache.keys(),index=new Map();
 for(let i=0;i<keys.length;i+=24)for(const [url,size] of await Promise.all(keys.slice(i,i+24).map(async key=>[key.url,Number((await cache.match(key)).headers.get('Content-Length'))||0])))index.set(url,size);
 return index;
})().catch(e=>{indexPromise=null;throw e;});}
async function pinnedUrls(){return pinnedPromise??=(async()=>{const data=await localManifest(),selected=await selections();return new Set(data.packs.filter(p=>selected.has(p.id)).flatMap(p=>p.files.map(absolute)));})().catch(e=>{pinnedPromise=null;throw e;});}
async function trimRecent(){
 const index=await resourceIndex(),pinned=await pinnedUrls(),recent=[...index].filter(([url])=>!pinned.has(url));let bytes=recent.reduce((n,[,size])=>n+size,0),count=recent.length;
 const cache=await caches.open(MEDIA);
 for(const [url,size] of recent){if(bytes<=RECENT_LIMIT&&count<=RECENT_COUNT)break;await cache.delete(url);index.delete(url);bytes-=size;count--;}
}
async function storeResource(url,response,epoch=mediaEpoch){
 const bytes=await response.arrayBuffer(),data=await localManifest();
 resourceSpecs??=new Map(Object.entries(data.resources||{}).map(([file,spec])=>[absolute(file),spec]));
 const spec=resourceSpecs.get(url);
 if(spec){
  if(bytes.byteLength!==spec.bytes)throw Error('素材大小不完整，请重试。');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==spec.sha256)throw Error('素材校验失败，请重试。');
 }
 const headers=new Headers(response.headers);headers.set('Content-Length',String(bytes.byteLength));headers.delete('Content-Encoding');
 await serial(async()=>{
  if(epoch!==mediaEpoch)return;
  const cache=await caches.open(MEDIA),index=await resourceIndex();
  // First completed writer wins; concurrent browsing and downloading share this slot.
  if(!index.has(url)){await cache.put(url,new Response(bytes,{headers}));index.set(url,bytes.byteLength);}
  await trimRecent();
 });
}
const fullUrl=url=>{const u=new URL(url);u.search='';return u.href;};
const isMedia=url=>url.startsWith(root.href+'assets/')&&/\.(wav|svg|png|mp3)$/.test(new URL(url).pathname);
function withRange(response,range){
 if(!range||!response.ok)return response;
 return (async()=>{
  const bytes=await response.arrayBuffer(),size=bytes.byteLength,match=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
  const end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
  if(start>end||start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':response.headers.get('Content-Type')||'audio/wav','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
 })();
}
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET'||!request.url.startsWith(root.href))return;
 const url=fullUrl(request.url),epoch=mediaEpoch;
 if(isMedia(url)){
  const result=(async()=>{const cached=await (await caches.open(CACHE)).match(url)||await (await caches.open(MEDIA)).match(url);if(cached)return {response:cached};const response=await fetch(url);return {response,store:response.ok&&response.status===200?response.clone():null};})();
  event.waitUntil(result.then(x=>x.store?storeResource(url,x.store,epoch):null).catch(()=>{}));
  event.respondWith(result.then(x=>withRange(x.response,request.headers.get('Range'))));return;
 }
 event.respondWith((async()=>{
  const cached=await (await caches.open(CACHE)).match(request,{ignoreSearch:true})||await (await caches.open(MEDIA)).match(url);if(cached)return cached;
  try{return await fetch(request);}catch(error){if(request.mode==='navigate'){const fallback=await (await caches.open(CACHE)).match(absolute('./'));if(fallback)return fallback;}throw error;}
 })());
});
async function packPlan(id){
 const data=await localManifest(),pack=data.packs.find(p=>p.id===id);if(!pack)throw Error('没有找到这个离线包。');
 await cacheQueue;const index=await resourceIndex();let savedBytes=0,savedCount=0;
 for(const file of pack.files)if(index.has(absolute(file))){savedBytes+=data.resources[file].bytes;savedCount++;}
 return {id,title:pack.title,totalBytes:pack.bytes,savedBytes,neededBytes:pack.bytes-savedBytes,total:pack.files.length,savedCount};
}
async function status(){
 await cacheQueue;const data=await localManifest(),keys=new Set((await (await caches.open(CACHE)).keys()).map(r=>r.url)),index=await resourceIndex(),selected=await selections(),pinned=await pinnedUrls();
 const complete=p=>p.files.every(f=>index.has(absolute(f))),packs=data.packs.filter(p=>selected.has(p.id)&&complete(p)).map(p=>p.id);
 let mediaBytes=0,recentBytes=0,recentCount=0;for(const [url,size] of index){mediaBytes+=size;if(!pinned.has(url)){recentBytes+=size;recentCount++;}}
 return {ready:data.files.every(f=>keys.has(absolute(f))),packs,pending:[...selected].filter(id=>!packs.includes(id)),selected:[...selected],allReady:complete(data.packs.find(p=>p.id==='all')),mediaBytes,mediaCount:index.size,recentBytes,recentCount,downloading:download?.id||null,version:'b1d58d53ccaa'};
}
async function downloadPack(id,port){
 if(download)throw Error('已有下载正在进行，请稍后再试。');
 const job={id,cancelled:false};download=job;
 try{
  const data=await localManifest(),pack=data.packs.find(p=>p.id===id);if(!pack)throw Error('没有找到这个离线包。');
  // Persist intent before fetching: partial packages survive interruption and are not evicted.
  await serial(async()=>{(await selections()).add(id);await saveSelections();});
  let done=0,doneBytes=0;const index=await resourceIndex(),missing=[];
  for(const file of pack.files){if(index.has(absolute(file))){done++;doneBytes+=data.resources[file].bytes;}else missing.push(file);}
  const report=()=>port.postMessage({progress:done,total:pack.files.length,doneBytes,totalBytes:pack.bytes});report();
  for(let i=0;i<missing.length;i+=4){
   if(job.cancelled)break;
   const results=await Promise.allSettled(missing.slice(i,i+4).map(async file=>{
    const url=absolute(file);if(!index.has(url)){const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok||response.status!==200)throw Error('下载中断，请联网后继续。');await storeResource(url,response);}
    done++;doneBytes+=data.resources[file].bytes;report();
   }));
   const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
  }
  download=null;const result=await status();
  if(!job.cancelled&&!result.packs.includes(id))throw Error('离线内容尚未完整，请继续下载。');
  port.postMessage({done:!job.cancelled,cancelled:job.cancelled,...result});
 }finally{download=null;}
}
self.addEventListener('message',event=>{
 const port=event.ports[0];if(!port)return;
 event.waitUntil((async()=>{try{
  const {type,id}=event.data||{};
  if(type==='CHECK_OFFLINE'){port.postMessage(await status());return;}
  if(type==='PLAN_PACK'){port.postMessage(await packPlan(id));return;}
  if(type==='DOWNLOAD_PACK'){await downloadPack(id,port);return;}
  if(type==='CANCEL_DOWNLOAD'){if(download)download.cancelled=true;port.postMessage({ok:true});return;}
  if(type==='REMOVE_PACK'){
   if(download)throw Error('请先暂停下载。');
   await serial(async()=>{(await selections()).delete(id);await saveSelections();await trimRecent();});port.postMessage(await status());return;
  }
  if(type==='CLEAR_MEDIA'){
   if(download)throw Error('请先暂停下载。');
   mediaEpoch++;await serial(async()=>{await caches.delete(MEDIA);await caches.delete(META);indexPromise=null;selectionPromise=null;pinnedPromise=null;});port.postMessage(await status());return;
  }
  throw Error('Unknown offline request');
 }catch(error){port.postMessage({error:error.name==='QuotaExceededError'?'设备空间不足。已完成部分已保留，清理空间后可继续下载。':error.message});}})());
});
