import { mkdir,cp,readdir,readFile,writeFile,rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {WORDS,COURSE_AUDIO} from '../app/course-content.js';
import { ALPHABET,BLENDS,PROMPTS } from '../app/content.js';
const out=new URL('../dist/',import.meta.url);
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const path of ['index.html','manifest.webmanifest','app','assets']) await cp(new URL(`../${path}`,import.meta.url),new URL(path,out),{recursive:true});
await writeFile(new URL('.nojekyll',out),'');
for(const word of WORDS)await readFile(new URL(word.image,out));
const credits=JSON.parse(await readFile(new URL('assets/credits.json',out),'utf8'));
const twocs=JSON.parse(await readFile(new URL('assets/audio/twocs-names.json',out),'utf8'));
const sources=JSON.parse(await readFile(new URL('assets/audio/sources.json',out),'utf8'));
for(const clip of sources.recordingOverrides){
  if(!credits.some(c=>c.file===clip.file&&c.author===clip.author&&c.source===clip.source))throw new Error(`Missing audio attribution: ${clip.file}`);
  if(clip.sha256&&createHash('sha256').update(await readFile(new URL(`assets/${clip.file}`,out))).digest('hex')!==clip.sha256)throw new Error(`Imported audio changed: ${clip.file}`);
}
for(const clip of sources.recordingOverrides.filter(c=>c.author==='Twocs'))if(!twocs.clips.some(c=>c.file===clip.file&&c.originalSha1===clip.originalSha1)||!credits.some(c=>c.file===clip.file&&c.author===clip.author&&c.license===clip.license))throw new Error(`Missing Twocs attribution: ${clip.file}`);
const required=[...COURSE_AUDIO.map(a=>`./assets/audio/${a.key}.wav`),...ALPHABET.flatMap(a=>[a.nameAudio,a.soundAudio,`./assets/audio/example-${a.upper}.wav`]),...BLENDS.map(b=>`./assets/audio/blend-${b.id}.wav`),...Object.keys(PROMPTS).map(key=>`./assets/audio/prompt-${key}.wav`),'./assets/audio/silence.wav'];
const candidate=JSON.parse(await readFile(new URL('assets/audio/gcompris/manifest.json',out),'utf8'));
if(candidate.clips.map(c=>c.letter).join('')!=='ABCDEFGHIJKLMNOPQRSTUVWXYZ')throw new Error('Incomplete candidate alphabet');
for(const clip of candidate.clips){
  const original=await readFile(new URL(`assets/audio/gcompris/originals/${clip.original}`,out));
  if(createHash('sha1').update(`blob ${original.length}\0`).update(original).digest('hex')!==clip.gitBlobSha1)throw new Error(`Candidate source changed: ${clip.letter}`);
  required.push(`./assets/audio/gcompris/${clip.file}`);
}
for(const file of ['SOURCE-README.txt','GPL-3.0.txt'])await readFile(new URL(`assets/audio/gcompris/${file}`,out));
for(const name of required) {
  const bytes=await readFile(new URL(name,out));
  if(bytes.length<100||bytes.toString('ascii',0,4)!=='RIFF'||bytes.readUInt16LE(20)!==1||bytes.readUInt16LE(34)!==16) throw new Error(`Missing or non-PCM16 audio: ${name}`);
}
async function files(dir,prefix='') { const entries=await readdir(dir,{withFileTypes:true});const result=[]; for(const e of entries) { const p=`${prefix}${e.name}`; if(e.isDirectory()) result.push(...await files(new URL(`${e.name}/`,dir),`${p}/`)); else result.push(p); }return result; }
const paths=(await files(out)).sort();
const hash=createHash('sha256');
for(const path of paths) hash.update(path).update(await readFile(new URL(path,out)));
const worker=await readFile(new URL('../sw.js',import.meta.url),'utf8');
hash.update(worker);
const version=hash.digest('hex').slice(0,12);
await writeFile(new URL('precache.json',out),JSON.stringify({version,files:['./',...paths.map(p=>`./${p}`)]}));
await writeFile(new URL('sw.js',out),worker.replaceAll('__BUILD_ID__',version));
console.log(`Built ${paths.length} files, ${required.length} audio clips. Version ${version}`);
