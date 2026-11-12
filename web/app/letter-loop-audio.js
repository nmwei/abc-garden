import {letterAudioPath} from './letter-audio.js';

// Read RIFF chunks instead of assuming every WAV has a 44-byte header.
export function readPcmWav(buffer){
 const view=new DataView(buffer),tag=offset=>String.fromCharCode(...new Uint8Array(buffer,offset,4));
 if(view.byteLength<12||tag(0)!=='RIFF'||tag(8)!=='WAVE'||view.getUint32(4,true)+8!==view.byteLength)throw Error('Invalid WAV');
 let format,data;
 for(let offset=12;offset+8<=view.byteLength;){
  const length=view.getUint32(offset+4,true),start=offset+8,end=start+length;
  if(end>view.byteLength)throw Error('Truncated WAV');
  if(tag(offset)==='fmt '){
   if(length<16||view.getUint16(start,true)!==1)throw Error('Expected PCM WAV');
   format={channels:view.getUint16(start+2,true),sampleRate:view.getUint32(start+4,true),byteRate:view.getUint32(start+8,true),blockAlign:view.getUint16(start+12,true),bits:view.getUint16(start+14,true)};
  }
  if(tag(offset)==='data')data=new Uint8Array(buffer,start,length);
  offset=end+(length%2);
 }
 if(!format||!data?.length||format.bits!==16||!format.channels||!format.sampleRate||format.blockAlign!==format.channels*2||format.byteRate!==format.sampleRate*format.blockAlign||data.length%format.blockAlign)throw Error('Invalid PCM format');
 return {format,data,duration:data.length/format.byteRate};
}

export async function loadLetterLoopClips(letters,source,signal){
 return Promise.all(letters.flatMap((letter,index)=>['name','sound'].map(async phase=>{
  const response=await fetch(letterAudioPath(`${phase}-${letter}`,source),{signal});
  if(!response.ok)throw Error('Letter audio unavailable');
  return {index,phase,...readPcmWav(await response.arrayBuffer())};
 })));
}

export function makeLetterLoop(clips,repeats){
 if(!clips.length||![1,2,3].includes(repeats))throw Error('Invalid letter loop');
 const format=clips[0].format,parts=[],segments=[];
 let bytes=0;
 for(const clip of clips){
  if(Object.keys(format).some(key=>format[key]!==clip.format[key]))throw Error('Incompatible WAV formats');
  for(let repeatIndex=0;repeatIndex<repeats;repeatIndex++){
   const start=bytes/format.byteRate;parts.push(clip.data);bytes+=clip.data.length;
   segments.push({index:clip.index,phase:clip.phase,repeatIndex,start,end:bytes/format.byteRate});
  }
 }
 const header=new ArrayBuffer(44),view=new DataView(header);
 const tag=(offset,text)=>[...text].forEach((char,index)=>view.setUint8(offset+index,char.charCodeAt(0)));
 tag(0,'RIFF');view.setUint32(4,36+bytes,true);tag(8,'WAVE');tag(12,'fmt ');view.setUint32(16,16,true);
 view.setUint16(20,1,true);view.setUint16(22,format.channels,true);view.setUint32(24,format.sampleRate,true);view.setUint32(28,format.byteRate,true);
 view.setUint16(32,format.blockAlign,true);view.setUint16(34,format.bits,true);tag(36,'data');view.setUint32(40,bytes,true);
 return {blob:new Blob([header,...parts],{type:'audio/wav'}),segments,duration:bytes/format.byteRate};
}
