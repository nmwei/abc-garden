// Import pinned Noto pictures in a small pool; never touch audio or original artwork.
import {readFile,writeFile,access,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {WORDS} from '../app/course-content.js';
const base=new URL('../assets/',import.meta.url),revision='v2.047';
const credits=JSON.parse(await readFile(new URL('credits.json',base),'utf8'));
const byFile=new Map(credits.map(c=>[c.file,c])),downloads=new Map();
const pictureSources=new Map(credits.filter(c=>c.file.startsWith('pictures/')&&c.source.includes(`noto-emoji@${revision}`)).map(c=>[c.source,c.file]));
async function getPicture(source,code){
 if(!downloads.has(source))downloads.set(source,(async()=>{
  if(pictureSources.has(source)){try{return await readFile(new URL(pictureSources.get(source),base));}catch{}}
  let error;
  for(let attempt=0;attempt<3;attempt++)try{
   const url=attempt<2?source:`https://raw.githubusercontent.com/googlefonts/noto-emoji/${revision}/svg/emoji_u${code}.svg`;
   const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);
   const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.toString().includes('<svg'))throw Error(`Invalid SVG: ${url}`);return bytes;
  }catch(e){error=e;}
  throw error;
 })());
 return downloads.get(source);
}
let cursor=0,done=0;
const results=await Promise.allSettled(Array.from({length:4},async()=>{
 while(cursor<WORDS.length){
  const w=WORDS[cursor++];if(['top','jam'].includes(w.id))continue;
  const file=`pictures/${w.id}.svg`,target=new URL(file,base),previous=byFile.get(file);
  const source=`https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@${revision}/svg/emoji_u${w.emoji}.svg`;
  const exists=await access(target).then(()=>true,()=>false);
  if(exists&&previous?.source===source)continue;
  if(exists&&previous&&!previous.source.includes('noto-emoji'))throw Error(`Refusing to replace non-Noto artwork: ${file}`);
  const bytes=await getPicture(source,w.emoji),temp=new URL(file+'.part',base);await writeFile(temp,bytes);await rename(temp,target);
  byFile.set(file,{file,author:'Google Noto Emoji contributors',source,license:'Apache-2.0',licenseUrl:'https://www.apache.org/licenses/LICENSE-2.0',changes:'None',sha256:createHash('sha256').update(bytes).digest('hex')});
  if(++done%25===0)console.log(JSON.stringify({downloaded:done,word:w.id}));
 }
}));
// Record successful files even when another worker failed, so retries can resume safely.
await writeFile(new URL('credits.json',base),JSON.stringify([...byFile.values()],null,2)+'\n');
const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
console.log(JSON.stringify({complete:true,imported:done,total:WORDS.length}));
