import {KokoroTTS} from 'kokoro-js';
import {writeFile} from 'node:fs/promises';
import {ALPHABET} from '../app/content.js';
import {encodePcm16} from './audio-pcm.mjs';
const model='onnx-community/Kokoro-82M-v1.0-ONNX',voice='af_heart';
const tts=await KokoroTTS.from_pretrained(model,{dtype:'q8',device:'cpu'});
const clips=[];
for(const letter of ALPHABET){
  const audio=await tts.generate(`${letter.example}.`,{voice,speed:.9});
  await writeFile(new URL(`../assets/audio/example-${letter.upper}.wav`,import.meta.url),encodePcm16(audio.audio,audio.sampling_rate));
  clips.push({letter:letter.upper,word:letter.example,duration:Number((audio.audio.length/audio.sampling_rate).toFixed(2))});
  console.log(`${letter.upper}: ${letter.example}`);
}
await writeFile(new URL('../assets/audio/examples.json',import.meta.url),JSON.stringify({model,voice,license:'Apache-2.0',clips},null,2));
