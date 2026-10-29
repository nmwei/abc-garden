import http from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
const root=resolve(process.env.SERVE_DIR||'dist');
const port=Number(process.env.PORT||4173);
const prefix=process.env.URL_PREFIX||'';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.wav':'audio/wav'};
http.createServer(async(req,res)=>{
  try {
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(prefix){if(pathname!==prefix&&!pathname.startsWith(prefix+'/')){res.writeHead(404);res.end();return;}pathname=pathname.slice(prefix.length)||'/';}
    const target=resolve(root,`.${pathname}`);
    if(target!==root&&!target.startsWith(root+sep)) {res.writeHead(403);res.end();return;}
    const file=(await stat(target)).isDirectory()?resolve(target,'index.html'):target;
    const data=await readFile(file);
    const headers={'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes'};
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      const start=match?.[1]?Number(match[1]):Math.max(0,data.length-Number(match?.[2]));
      const end=match?.[1]?(match[2]?Math.min(Number(match[2]),data.length-1):data.length-1):data.length-1;
      if(!match||(!match[1]&&!match[2])||start>end||start>=data.length){res.writeHead(416,{'Content-Range':`bytes */${data.length}`});res.end();return;}
      res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});res.end(data.subarray(start,end+1));
    }else{res.writeHead(200,{...headers,'Content-Length':data.length});res.end(data);}
  }catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'0.0.0.0',()=>console.log(`ABC Garden: http://localhost:${port}`));
