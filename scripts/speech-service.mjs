import {KokoroTTS} from 'kokoro-js';
import {Tensor} from '@huggingface/transformers';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ALPHABET} from '../app/content.js';
import {encodePcm16} from './audio-pcm.mjs';
const cache=new URL('../.audio-cache/',import.meta.url);
let english,mandarin,styles,queue=Promise.resolve();
export function validateSpeech(input){
 const {kind,text}=input||{};
 if(!['name','sound','word','sentence','zh'].includes(kind)||typeof text!=='string'||!text.trim()||text.length>160)throw Error('Invalid speech request');
 if(['name','sound'].includes(kind)&&! /^[A-Z]$/.test(text))throw Error('Invalid letter');
 if(['word','sentence'].includes(kind)&&! /^[a-zA-Z0-9\s.,!?'-]+$/.test(text))throw Error('英文内容仅支持英文字母、数字和常用标点');
 return {kind,text:text.trim()};
}
export async function synthesize(input){
 const request=validateSpeech(input);const work=queue.then(()=>generate(request));queue=work.catch(()=>{});return work;
}
async function generate({kind,text}){
 await mkdir(cache,{recursive:true});
 const key=createHash('sha256').update(JSON.stringify({version:1,kind,text})).digest('hex');const path=new URL(key+'.wav',cache);
 try{return await readFile(path);}catch{}
 let audio;
 if(kind==='zh'){
  const local=fileURLToPath(new URL('../.audio-env/bin/python',import.meta.url));
  const python=process.env.ABC_TTS_PYTHON||await access(local).then(()=>local,()=> 'python3');
  const phonemes=await new Promise((resolve,reject)=>{const child=execFile(python,[fileURLToPath(new URL('./phonemize-prompts.py',import.meta.url))],{timeout:60000,maxBuffer:1000000},(error,out)=>{if(error){reject(Error('中文语音组件未就绪，请安装 scripts/requirements-audio.txt'));return;}try{resolve(JSON.parse(out).item);}catch{reject(Error('中文语音转换返回了无效结果'));}});child.stdin.end(JSON.stringify({item:text}));});
  mandarin??=KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.1-zh-ONNX',{dtype:'q8',device:'cpu'}).catch(e=>{mandarin=null;throw e;});
  const tts=await mandarin;
  if(!styles){const file=new URL('zf_001.bin',cache);let bytes;try{bytes=await readFile(file);}catch{const response=await fetch('https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX/resolve/main/voices/zf_001.bin',{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('中文音色下载失败');bytes=Buffer.from(await response.arrayBuffer());await writeFile(file,bytes);}styles=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));}
  const {input_ids}=tts.tokenizer(phonemes,{truncation:true}),offset=256*Math.min(Math.max(input_ids.dims.at(-1)-2,0),509);
  const {waveform}=await tts.model({input_ids,style:new Tensor('float32',styles.slice(offset,offset+256),[1,256]),speed:new Tensor('float32',[.9],[1])});audio={audio:waveform.data,sampling_rate:24000};
 }else{
  english??=KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'q8',device:'cpu'}).catch(e=>{english=null;throw e;});const tts=await english;
  if(['name','sound'].includes(kind)){
   const letters=[...text.toUpperCase()];const phonemes=letters.map(l=>{const a=ALPHABET.find(a=>a.upper===l);return kind==='name'?a.nameIpa:a.ipa.replace('r','ɹ');}).join('');
   const {input_ids}=tts.tokenizer(phonemes+'.',{truncation:true});audio=await tts.generate_from_ids(input_ids,{voice:'af_heart',speed:.9});
  }else audio=await tts.generate(text,{voice:'af_heart',speed:.9});
 }
 if(!audio.audio.length)throw Error('音频生成结果为空');
 const bytes=encodePcm16(audio.audio,audio.sampling_rate);await writeFile(path,bytes);return bytes;
}
