import {KokoroTTS} from 'kokoro-js';
import {Tensor} from '@huggingface/transformers';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {PROMPTS} from '../app/content.js';
import {encodePcm16} from './audio-pcm.mjs';

const model='onnx-community/Kokoro-82M-v1.1-zh-ONNX';
const voice='zf_001';
try {
const python=process.env.ABC_TTS_PYTHON||'python3';
const phonemes=JSON.parse(execFileSync(python,[fileURLToPath(new URL('./phonemize-prompts.py',import.meta.url))],{input:JSON.stringify(PROMPTS),encoding:'utf8'}));
const tts=await KokoroTTS.from_pretrained(model,{dtype:'q8',device:'cpu'});
const response=await fetch(`https://huggingface.co/${model}/resolve/main/voices/${voice}.bin`);
if(!response.ok)throw new Error(`Voice download failed: ${response.status}`);
const styles=new Float32Array(await response.arrayBuffer());
const clips=[];
for(const [key,text] of Object.entries(PROMPTS)){
  const {input_ids}=tts.tokenizer(phonemes[key],{truncation:true});
  const length=input_ids.dims.at(-1)-2;
  const offset=256*Math.min(Math.max(length,0),509);
  const {waveform}=await tts.model({input_ids,style:new Tensor('float32',styles.slice(offset,offset+256),[1,256]),speed:new Tensor('float32',[1],[1])});
  await writeFile(new URL(`../assets/audio/prompt-${key}.wav`,import.meta.url),encodePcm16(waveform.data,24000));
  const duration=waveform.data.length/24000;
  if(duration<.2||duration>15)throw new Error(`Unexpected duration for ${key}: ${duration}`);
  clips.push({key,text,phonemes:phonemes[key],duration:Number(duration.toFixed(2))});
  console.log(`${key}: ${duration.toFixed(2)}s`);
}
const path=new URL('../assets/audio/sources.json',import.meta.url);
const sources=JSON.parse(await readFile(path,'utf8'));
sources.mandarin={model,voice,license:'Apache-2.0',clips};
await writeFile(path,JSON.stringify(sources,null,2));
}catch(error){console.error('Mandarin generation failed:',error.message);process.exitCode=1;}
