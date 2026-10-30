import {KokoroTTS} from 'kokoro-js';
import {writeFile,access} from 'node:fs/promises';
import {encodePcm16} from './audio-pcm.mjs';
import {COURSE_AUDIO} from '../app/course-content.js';
const model='onnx-community/Kokoro-82M-v1.0-ONNX',voice='af_heart';
const tts=await KokoroTTS.from_pretrained(model,{dtype:'q8',device:'cpu'});
for(const {key,text} of COURSE_AUDIO){
 const path=new URL(`../assets/audio/${key}.wav`,import.meta.url);
 if(await access(path).then(()=>true,()=>false))continue;
 const audio=await tts.generate(text,{voice,speed:.9});await writeFile(path,encodePcm16(audio.audio,audio.sampling_rate));console.log(key);
}
await writeFile(new URL('../assets/audio/course-sources.json',import.meta.url),JSON.stringify({model,voice,notice:'Synthetic reference speech; not teacher reviewed',clips:COURSE_AUDIO},null,2));
