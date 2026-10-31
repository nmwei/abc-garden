import './compile-sentence-meanings.mjs';
import { mkdir,cp,readdir,readFile,writeFile,rm,stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {WORDS,READY_WORDS,COURSE_AUDIO,READINGS,DIALOGUES} from '../app/course-content.js';
import { ALPHABET,BLENDS,PROMPTS } from '../app/content.js';
const out=new URL('../dist/',import.meta.url);
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const path of ['index.html','manifest.webmanifest','app','assets']) await cp(new URL(`../${path}`,import.meta.url),new URL(path,out),{recursive:true});
await writeFile(new URL('.nojekyll',out),'');
for(const word of WORDS.filter(w=>w.image))await readFile(new URL(word.image,out));
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
hash.update(worker).update(await readFile(new URL(import.meta.url)));
const version=hash.digest('hex').slice(0,12);
// Only the interface is installed automatically; media belongs to explicit optional packs.
const shell=paths.filter(p=>p==='index.html'||p==='manifest.webmanifest'||p==='assets/icon.svg'||p.startsWith('app/')||/^assets\/icon-.*\.png$/.test(p));
const packs=[];
async function pack(id,title,files){const unique=[...new Set(files)];let bytes=0;for(const file of unique)bytes+=(await stat(new URL(file,out))).size;packs.push({id,title,files:unique,bytes});}
const wav=key=>`./assets/audio/${key}.wav`;
const other=[...ALPHABET.flatMap(a=>[a.nameAudio,a.soundAudio,wav(`example-${a.upper}`)]),...BLENDS.map(b=>wav(`blend-${b.id}`)),...Object.keys(PROMPTS).map(k=>wav(`prompt-${k}`)),wav('silence'),
 ...[[READINGS,'read'],[DIALOGUES,'talk']].flatMap(([rows,prefix])=>rows.flatMap(r=>[WORDS.find(w=>w.id===r.image).image,...r.lines.map((_,i)=>wav(`${prefix}-${r.id}-${i}`))])),
 ...['index.html','preview.js','manifest.json','SOURCE-README.txt','GPL-3.0.txt'].map(f=>`./assets/audio/gcompris/${f}`),...candidate.clips.map(c=>`./assets/audio/gcompris/${c.file}`),
 './assets/credits.json','./assets/pictures/LICENSE-NOTO.txt','./assets/audio/gk/source.mp3','./assets/audio/gk/cuts.json'];
await pack('pictures','词卡图片',READY_WORDS.map(w=>w.image));
await pack('word-audio','单词读音',READY_WORDS.map(w=>wav(w.audio)));
await pack('sentence-audio','例句读音',READY_WORDS.map(w=>wav(`sentence-${w.id}`)));
await pack('other','其他内容',other);
await pack('all','全部学习内容',packs.filter(p=>['pictures','word-audio','sentence-audio','other'].includes(p.id)).flatMap(p=>p.files));
const resources={};
for(const file of packs.at(-1).files){const bytes=await readFile(new URL(file,out));resources[file]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
const offline={version,files:['./',...shell.map(p=>`./${p}`)],packs,resources};
await writeFile(new URL('precache.json',out),JSON.stringify(offline));
await writeFile(new URL('offline-packs.json',out),JSON.stringify(packs.map(({files,...meta})=>meta)));
// The tiny pack index must itself be available while offline.
offline.files.push('./offline-packs.json');await writeFile(new URL('precache.json',out),JSON.stringify(offline));
await writeFile(new URL('sw.js',out),worker.replaceAll('__BUILD_ID__',version));
console.log(`Built ${paths.length} files, ${required.length} audio clips. Version ${version}`);
