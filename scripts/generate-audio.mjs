import {KokoroTTS} from 'kokoro-js';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {encodePcm16} from './audio-pcm.mjs';
import {ALPHABET,BLENDS} from '../app/content.js';

const directory=new URL('../assets/audio/',import.meta.url);
await mkdir(directory,{recursive:true});
const model='onnx-community/Kokoro-82M-v1.0-ONNX';
const voice='af_heart';
const imported=await readFile(new URL('credits.json',new URL('../assets/',import.meta.url)),'utf8').then(JSON.parse).catch(()=>[]);
const preserved=new Set(imported.filter(x=>x.file.startsWith('audio/')).map(x=>x.file.slice(6)));

try {
const tts=await KokoroTTS.from_pretrained(model,{dtype:'q8',device:'cpu'});
// Canonical phonemes avoid reading a standalone A as an unstressed article.
const manifest={engine:'Kokoro 82M v1.0',model,voice,license:'Apache-2.0',notice:'自然合成示范，非教师录音。名称与字母音分别用明确音素生成。字母音启用前仍需核对课堂，可用教师录音替换。',clips:[]};
async function generate(file,phonemes){
  if(preserved.has(file)){console.log(`Preserving licensed recording: ${file}`);return null;}
  const {input_ids}=tts.tokenizer(`${phonemes}.`,{truncation:true});
  const audio=await tts.generate_from_ids(input_ids,{voice,speed:.9});
  if(audio.audio.length<2400)throw new Error(`Generated clip too short: ${file}`);
  await writeFile(new URL(file,directory),encodePcm16(audio.audio,audio.sampling_rate));
  return Number((audio.audio.length/audio.sampling_rate).toFixed(2));
}
for(const [i,letter] of ALPHABET.entries()){
  const nameDuration=await generate(`name-${letter.upper}.wav`,letter.nameIpa);
  const soundPhonemes=letter.ipa==='r'?'ɹ':letter.ipa;
  const soundDuration=await generate(`sound-${letter.upper}.wav`,soundPhonemes);
  const exampleAudio=await tts.generate(`${letter.example}.`,{voice,speed:.9});
  await writeFile(new URL(`example-${letter.upper}.wav`,directory),encodePcm16(exampleAudio.audio,exampleAudio.sampling_rate));
  manifest.clips.push({letter:letter.upper,namePhonemes:letter.nameIpa,soundPhonemes,nameDuration,soundDuration,example:letter.example});
  console.log(`${letter.upper}: name ${nameDuration}s, sound ${soundDuration}s`);
}
for(const blend of BLENDS){
  const phonemes=blend.letters.map(l=>ALPHABET.find(a=>a.upper===l).ipa).join('');
  await generate(`blend-${blend.id}.wav`,phonemes);
}
// A silent PCM clip primes iOS media playback inside the user's tap gesture.
const bytes=Buffer.alloc(44+4800);
bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(4800,40);
await writeFile(new URL('silence.wav',directory),bytes);
// Mandarin guidance is generated separately by generate-prompts.mjs.
const previous=await readFile(new URL('sources.json',directory),'utf8').then(JSON.parse).catch(()=>({}));
await writeFile(new URL('sources.json',directory),JSON.stringify({...previous,...manifest},null,2));
console.log('Generated 26 natural letter names, 26 reference sounds, and 9 blends.');
}catch(error){console.error('Audio generation failed:',error.message);process.exitCode=1;}
