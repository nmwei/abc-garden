import {synthesize,validateSpeech} from './speech-service.mjs';
import http from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
const root=resolve(process.env.SERVE_DIR||'dist');
const port=Number(process.env.PORT||4173);
const prefix=process.env.URL_PREFIX||'';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.wav':'audio/wav','.mp3':'audio/mpeg'};
http.createServer(async(req,res)=>{
  try {
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(prefix){if(pathname!==prefix&&!pathname.startsWith(prefix+'/')){res.writeHead(404);res.end();return;}pathname=pathname.slice(prefix.length)||'/';}
    if(pathname==='/api/speech'){
      const origin=req.headers.origin;
      if(origin&&origin!==`http://${req.headers.host}`){res.writeHead(403);res.end();return;}
      if(req.method!=='POST'){res.writeHead(405);res.end();return;}
      if(!req.headers['content-type']?.startsWith('application/json')){res.writeHead(415);res.end();return;}
      let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){res.writeHead(413);res.end();return;}}
      let request;try{request=validateSpeech(JSON.parse(body));}catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));return;}
      try{const bytes=await synthesize(request);res.writeHead(200,{'Content-Type':'audio/wav','Cache-Control':'no-store'});res.end(bytes);}catch(error){console.error(error.message);res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'音频生成暂未完成，请检查本地生成服务后重试。'}));}return;
    }
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
}).listen(port,process.env.SERVE_HOST||'127.0.0.1',()=>console.log(`ABC Garden: http://localhost:${port}`));
