const CACHE='abc-garden-656d18b1d49f';
const root=new URL('./',self.location.href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const response=await fetch(new URL('precache.json',root),{cache:'no-store'});
  if(!response.ok) throw new Error('Cannot load offline manifest');
  const manifest=await response.json();
  const cache=await caches.open(CACHE);
  await cache.addAll([...manifest.files.map(file=>new URL(file,root).href),new URL('precache.json',root).href]);
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys()) if(key.startsWith('abc-garden-')&&key!==CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==root.origin) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(event.request,{ignoreSearch:true});
    if(cached) {
      const range=event.request.headers.get('Range');
      if(range){
        // Safari probes media with byte ranges, including when the full file is cached.
        const bytes=await cached.arrayBuffer(),size=bytes.byteLength;
        const match=/^bytes=(\d*)-(\d*)$/.exec(range);
        if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
        const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
        const end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
        if(start>end||start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
        return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':cached.headers.get('Content-Type')||'audio/wav','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
      }
      return cached;
    }
    try{return await fetch(event.request);}catch(error){
      if(event.request.mode==='navigate') {
        const fallback=await cache.match(new URL('./',root));
        if(fallback) return fallback;
      }
      throw error;
    }
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='CHECK_OFFLINE') return;
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const response=await cache.match(new URL('precache.json',root));
    let ready=false;
    if(response){const manifest=await response.json();const results=await Promise.all(manifest.files.map(file=>cache.match(new URL(file,root))));ready=results.every(Boolean);}
    event.ports[0]?.postMessage({ready,version:'656d18b1d49f'});
  })());
});
