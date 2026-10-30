import {readFile,writeFile,mkdtemp,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {encodePcm16} from './audio-pcm.mjs';

const assets=new URL('../assets/',import.meta.url),base=new URL('audio/gk/',assets);
const manifest=JSON.parse(await readFile(new URL('cuts.json',base)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(sha(await readFile(new URL(manifest.source,base)))!==manifest.sourceSha256)throw Error('Source recording changed; review cut times first.');
if(manifest.clips.map(c=>c.letter).join('')!=='ABCDEFGHIJKLMNOPQRSTUVWXYZ')throw Error('Expected 26 letters');
const temp=await mkdtemp(join(tmpdir(),'gk-cuts-'));
try{
  const decoded=join(temp,'decoded.wav');
  // Decode once: the supplied MP3 has malformed frames at splice points.
  execFileSync('ffmpeg',['-v','warning','-y','-i',fileURLToPath(new URL(manifest.source,base)),'-ac','1','-ar','24000',decoded]);
  const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',decoded],{encoding:'utf8'}));
  if(Math.abs(duration-manifest.decodedDuration)>.001)throw Error('Decoded timeline changed; review cut times first.');
  const imported=[];
  for(const clip of manifest.clips){
    if(!(clip.start<clip.split&&clip.split<clip.end&&clip.end<=duration))throw Error(`Invalid cuts for ${clip.letter}`);
    for(const [mode,start,end] of [['name',clip.start,clip.split],['sound',clip.split,clip.end]]){
      const file=`audio/${mode}-${clip.letter}.wav`,output=join(temp,`${mode}-${clip.letter}.wav`);
      const pcm=execFileSync('ffmpeg',['-v','error','-i',decoded,'-ss',String(start),'-t',String(end-start),'-f','f32le','-']);
      const samples=new Float32Array(pcm.length/4);let peak=0;
      for(let i=0;i<samples.length;i++){samples[i]=pcm.readFloatLE(i*4);peak=Math.max(peak,Math.abs(samples[i]));}
      if(!peak)throw Error(`Silent recording: ${file}`);
      // Keep headroom; cap amplification so quiet fricatives do not become loud hiss.
      const gainDb=Math.min(12,-6-20*Math.log10(peak)),gain=10**(gainDb/20);
      for(let i=0;i<samples.length;i++)samples[i]*=gain;
      await writeFile(output,encodePcm16(samples,24000));
      imported.push({file,author:'用户提供，录音者未注明',source:'./assets/audio/gk/source.mp3',provenance:'user-provided',license:'User-provided recording; redistribution rights not specified',sourceSha256:manifest.sourceSha256,sha256:sha(await readFile(output)),start,end,gainDb:Number(gainDb.toFixed(3)),changes:'Split on decoded 24 kHz mono timeline; kept three repetitions; peak target -6 dBFS, gain capped at +12 dB; no denoise, pitch change or time stretching',review:'Audio structure and waveform cuts checked; professional pronunciation review not performed'});
    }
  }
  const creditsPath=new URL('credits.json',assets),sourcesPath=new URL('audio/sources.json',assets);
  const credits=JSON.parse(await readFile(creditsPath)),sources=JSON.parse(await readFile(sourcesPath));
  const backup=await mkdtemp(join(tmpdir(),'abc-before-gk-'));
  await copyFile(creditsPath,join(backup,'credits.json'));await copyFile(sourcesPath,join(backup,'sources.json'));
  for(const item of imported)await copyFile(new URL(item.file,assets),join(backup,item.file.slice(6)));
  for(const item of imported)await copyFile(join(temp,item.file.slice(6)),new URL(item.file,assets));
  const files=new Set(imported.map(c=>c.file));
  const merged=[...credits.filter(c=>!files.has(c.file)),...imported];
  sources.recordingOverrides=merged.filter(c=>c.file.startsWith('audio/'));
  for(const clip of sources.clips){
    const cut=manifest.clips.find(c=>c.letter===clip.letter);
    if(cut){clip.nameDuration=Number((cut.split-cut.start).toFixed(3));clip.soundDuration=Number((cut.end-cut.split).toFixed(3));}
  }
  sources.notice='26 个名称和 26 个字母音来自用户提供的 GK 录音，保留每项三遍跟读。例词和合音等仍为原有素材。';
  await writeFile(creditsPath,JSON.stringify(merged,null,2)+'\n');
  await writeFile(sourcesPath,JSON.stringify(sources,null,2)+'\n');
  await writeFile(new URL('imported.json',base),JSON.stringify(imported,null,2)+'\n');
  console.log(`Installed ${imported.length} clips. Previous recordings saved in ${backup}`);
}finally{await rm(temp,{recursive:true,force:true});}
