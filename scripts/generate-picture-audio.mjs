// Bounded CPU workers for large vocabulary additions. Existing matching audio is reused.
import {fork} from 'node:child_process';
import {readFile,writeFile,mkdir,access,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {KokoroTTS} from 'kokoro-js';
import {StyleTextToSpeech2Model,AutoTokenizer} from '@huggingface/transformers';
import {encodePcm16} from './audio-pcm.mjs';
const model='onnx-community/Kokoro-82M-v1.0-ONNX',voice='af_heart',speed=.9;
const directory=new URL('../assets/audio/',import.meta.url),cache=new URL('../.audio-cache/picture-audio/',import.meta.url);
await mkdir(cache,{recursive:true});
const signature=text=>JSON.stringify({model,voice,speed,text});
if(process.argv[2]==='--worker'){
 const tasks=JSON.parse(await readFile(process.argv[3],'utf8')),slot=Number(process.argv[4]),workers=Number(process.argv[5]);
 const [network,tokenizer]=await Promise.all([StyleTextToSpeech2Model.from_pretrained(model,{dtype:'q8',device:'cpu',session_options:{intraOpNumThreads:2,interOpNumThreads:1}}),AutoTokenizer.from_pretrained(model)]);
 const tts=new KokoroTTS(network,tokenizer);let done=0;
 for(let i=slot;i<tasks.length;i+=workers){
  const {key,text}=tasks[i],audio=await tts.generate(text,{voice,speed});
  if(!audio.audio.length||!audio.audio.some(v=>Math.abs(v)>.0001))throw Error(`Empty audio: ${key}`);
  const target=new URL(`${key}.wav`,directory),temp=new URL(`${key}.part-${slot}`,directory);
  await writeFile(temp,encodePcm16(audio.audio,audio.sampling_rate));await rename(temp,target);
  await writeFile(new URL(encodeURIComponent(key)+'.json',cache),signature(text));
  if(++done%25===0)console.log(JSON.stringify({worker:slot,done,key}));
 }
 console.log(JSON.stringify({worker:slot,done,complete:true}));await network.dispose();
}else{
 const {COURSE_AUDIO}=await import('../app/course-content.js');
 const prior=await readFile(new URL('course-sources.json',directory),'utf8').then(JSON.parse).catch(()=>({clips:[]}));
 const old=new Map(prior.clips.map(c=>[c.key,c.text])),tasks=[];
 for(const entry of COURSE_AUDIO){
  const exists=await access(new URL(`${entry.key}.wav`,directory)).then(()=>true,()=>false);
  const cached=await readFile(new URL(encodeURIComponent(entry.key)+'.json',cache),'utf8').catch(()=>null);
  if(exists&&(cached===signature(entry.text)||(!cached&&old.get(entry.key)===entry.text)))continue;
  tasks.push(entry);
 }
 const workers=Math.min(3,Math.max(1,tasks.length)),job=new URL(`job-${Date.now()}.json`,cache);await writeFile(job,JSON.stringify(tasks));
 console.log(JSON.stringify({pending:tasks.length,workers}));
 const results=await Promise.allSettled(Array.from({length:workers},(_,slot)=>new Promise((resolve,reject)=>{
  const worker=fork(fileURLToPath(import.meta.url),['--worker',fileURLToPath(job),String(slot),String(workers)],{stdio:'inherit'});
  worker.on('error',reject);worker.on('exit',code=>code===0?resolve():reject(Error(`Audio worker ${slot} exited ${code}`)));
 })));
 const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
 await writeFile(new URL('course-sources.json',directory),JSON.stringify({model,voice,speed,notice:'Synthetic reference speech; project-authored and attributed/adapted corpus examples; see data/vocabulary/sources.json; not teacher reviewed',clips:COURSE_AUDIO},null,2));
 console.log(JSON.stringify({complete:true,generated:tasks.length,clips:COURSE_AUDIO.length}));
}
