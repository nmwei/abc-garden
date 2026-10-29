import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export function encodePcm16(samples,sampleRate=24000){
  const bytes=Buffer.alloc(44+samples.length*2);
  bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);
  bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);
  bytes.writeUInt32LE(sampleRate,24);bytes.writeUInt32LE(sampleRate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);
  bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);
  for(let i=0;i<samples.length;i++)bytes.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
  return bytes;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const directory=new URL('../assets/audio/',import.meta.url);
  for(const file of await readdir(directory)){
    if(!file.endsWith('.wav'))continue;
    const path=new URL(file,directory),data=await readFile(path);
    if(data.readUInt16LE(20)!==3||data.readUInt16LE(34)!==32)continue;
    const samples=new Float32Array((data.length-44)/4);
    for(let i=0;i<samples.length;i++)samples[i]=data.readFloatLE(44+i*4);
    await writeFile(path,encodePcm16(samples,data.readUInt32LE(24)));
  }
  console.log('Normalized audio clips to PCM16 WAV.');
}
