import {readFile,writeFile,mkdtemp,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {encodePcm16} from './audio-pcm.mjs';
import {letterAudioPath} from '../web/app/letter-audio.js';

const assets=new URL('../web/assets/',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateLetterCuts(manifest,source){
  for(const mode of ['name','sound'])if(manifest.clips.filter(c=>c.mode===mode).map(c=>c.letter).join('')!=='ABCDEFGHIJKLMNOPQRSTUVWXYZ')throw Error(`Incomplete ${mode} alphabet`);
  if(manifest.clips.length!==52||manifest.repetitions!==1)throw Error('Expected 52 single readings');
  if(source==='gk'&&(!Number.isFinite(manifest.boundaryReview?.minimumGapMs)||manifest.boundaryReview.minimumGapMs<10))throw Error('GK requires reviewed onset clearance');
  for(const clip of manifest.clips){
    const key=`${clip.mode}-${clip.letter}`,end=clip.startMs+clip.durationMs;
    if(!Number.isFinite(clip.startMs)||!Number.isFinite(clip.durationMs)||clip.startMs<0||clip.durationMs<=0)throw Error(`Invalid cut: ${key}`);
    if(source==='gk'){
      const groupEnd=clip.gainStartMs+clip.gainDurationMs;
      const reading=clip.reading??1;
      if(![1,2,3].includes(reading)||![undefined,'clip'].includes(clip.gainMode))throw Error(`Invalid GK reading: ${key}`);
      if(!Number.isFinite(clip.gainStartMs)||!Number.isFinite(clip.gainDurationMs)||clip.gainDurationMs<=0||clip.startMs<clip.gainStartMs||end>groupEnd)throw Error(`Invalid GK group: ${key}`);
      // The last repetition can be followed by the next group rather than another repetition.
      const nextLimit=reading===3?manifest.decodedDuration*1000:groupEnd;
      if(!Number.isFinite(nextLimit)||!Number.isFinite(clip.nextOnsetMs)||clip.nextOnsetMs>nextLimit||end+manifest.boundaryReview.minimumGapMs>clip.nextOnsetMs)throw Error(`GK cut reaches the next reading: ${key}`);
    }
  }
}
export async function importLetterAudio(source){
  if(!['edcreate','gk'].includes(source))throw Error('Expected edcreate or gk');
  const base=new URL(`audio/${source}/`,assets),manifest=JSON.parse(await readFile(new URL('cuts.json',base)));
  if(sha(await readFile(new URL(manifest.source,base)))!==manifest.sourceSha256)throw Error(`${source} source changed; review cut times first.`);
  validateLetterCuts(manifest,source);
  const temp=await mkdtemp(join(tmpdir(),`abc-${source}-`));
  try{
    let input=fileURLToPath(new URL(manifest.source,base));
    // Preserve the PCM16 timeline used by the historical GK importer.
    if(source==='gk'){
      const decoded=join(temp,'source.wav');
      execFileSync('ffmpeg',['-v','error','-y','-i',input,'-ac','1','-ar',String(manifest.sampleRate),decoded]);input=decoded;
    }
    const raw=join(temp,'source.f32');
    execFileSync('ffmpeg',['-v','error','-y','-i',input,'-ac','1','-ar',String(manifest.sampleRate),'-f','f32le',raw]);
    const pcm=await readFile(raw),count=ms=>Math.round(ms*manifest.sampleRate/1000);
    if(manifest.decodedDuration&&Math.abs(pcm.length/4/manifest.sampleRate-manifest.decodedDuration)>.001)throw Error('Decoded timeline changed');
    const slice=(startMs,durationMs)=>{
      const start=count(startMs),length=count(durationMs);
      if(start<0||length<=0||(start+length)*4>pcm.length)throw Error('Invalid cut');
      return Float32Array.from({length},(_,i)=>pcm.readFloatLE((start+i)*4));
    };
    const peak=samples=>samples.reduce((max,value)=>Math.max(max,Math.abs(value)),0);
    const segments=manifest.clips.map(clip=>({clip,samples:slice(clip.startMs,clip.durationMs)}));
    const globalPeak=Math.max(...segments.map(segment=>peak(segment.samples))),imported=[],outputs=[];
    for(const {clip,samples} of segments){
      if(peak(samples)<.001)throw Error(`Silent cut: ${clip.mode}-${clip.letter}`);
      const gainPeak=source==='gk'?(clip.gainMode==='clip'?peak(samples):peak(slice(clip.gainStartMs,clip.gainDurationMs))):globalPeak;
      const gainDb=Math.min(12,-6-20*Math.log10(gainPeak)),gain=10**(gainDb/20),fade=count(manifest.fadeMs||0);
      const render=trailingMs=>{
        const output=new Float32Array(count(manifest.leadingMs)+samples.length+count(trailingMs));
        for(let i=0;i<samples.length;i++)output[count(manifest.leadingMs)+i]=samples[i]*gain*(fade?Math.min(1,i/fade,(samples.length-1-i)/fade):1);
        return encodePcm16(output,manifest.sampleRate);
      };
      const key=`${clip.mode}-${clip.letter}`,file=letterAudioPath(key,source).slice('./assets/'.length),singleFile=letterAudioPath(key,source,{single:true}).slice('./assets/'.length);
      const trailingMs=manifest.trailingMs[clip.mode],bytes=render(trailingMs),singleBytes=render(manifest.singleTrailingMs);
      outputs.push([file,bytes],[singleFile,singleBytes]);
      imported.push({file,author:source==='gk'?'用户提供，录音者未注明':'EdCreate（录音者未注明）',source:manifest.sourcePage,sourceAudio:manifest.sourceUrl,
        sourceSha256:manifest.sourceSha256,sha256:sha(bytes),...clip,sampleRate:manifest.sampleRate,repetitions:1,
        leadingMs:manifest.leadingMs,trailingMs,duration:(bytes.length-44)/2/manifest.sampleRate,gainDb,
        singleTrailingMs:manifest.singleTrailingMs,singleFile,singleSha256:sha(singleBytes),singleDuration:(singleBytes.length-44)/2/manifest.sampleRate,
        license:source==='gk'?'User-provided recording; redistribution rights not specified':'Not verified; local audition requested by user',
        review:source==='gk'?'Waveform cuts checked; professional pronunciation review not performed':'Same speaker assessed by user; professional pronunciation review not performed',
        changes:source==='gk'?(clip.reading===3?`Third reading from original GK timeline, approved by user; ends ${clip.nextOnsetMs-clip.startMs-clip.durationMs} ms before reviewed following onset; selected-reading peak matched to -6 dBFS, 5 ms edge fades; no pitch or speed change`:`First reading from original GK timeline; ends ${clip.nextOnsetMs-clip.startMs-clip.durationMs} ms before reviewed second onset; historical per-group gain, 5 ms edge fades; no pitch or speed change`):`Official sprite cuts; one original reading with ${trailingMs} ms trailing silence; game clip padding unchanged; uniform gain capped at +12 dB, no pitch or speed change`});
    }
    const creditsPath=new URL('credits.json',assets),sourcesPath=new URL('audio/sources.json',assets);
    const credits=JSON.parse(await readFile(creditsPath)),sources=JSON.parse(await readFile(sourcesPath));
    const backup=await mkdtemp(join(tmpdir(),`abc-before-${source}-`));
    await copyFile(creditsPath,join(backup,'credits.json'));await copyFile(sourcesPath,join(backup,'sources.json'));
    // Every cut is validated before any output is installed; previous files remain in the backup.
    for(const [file,bytes] of outputs){
      try{await copyFile(new URL(file,assets),join(backup,file.replaceAll('/','-')));}catch(e){if(e.code!=='ENOENT')throw e;}
      await writeFile(new URL(file,assets),bytes);
    }
    const files=new Set(imported.map(c=>c.file)),merged=[...credits.filter(c=>!files.has(c.file)),...imported];
    sources.recordingOverrides=merged.filter(c=>c.file.startsWith('audio/'));
    if(source==='edcreate')for(const clip of sources.clips)for(const mode of ['name','sound'])clip[`${mode}Duration`]=imported.find(c=>c.letter===clip.letter&&c.mode===mode).duration;
    sources.notice='字母名称与字母音可在家长小角整套选择培训班录音（GK）或 EdCreate；每套包含完整 A–Z，不混用 L 等字母。点读和游戏每次一遍，循环听按所选遍数播放。例词与合音保持原有素材。';
    await writeFile(creditsPath,JSON.stringify(merged,null,2)+'\n');await writeFile(sourcesPath,JSON.stringify(sources,null,2)+'\n');
    await writeFile(new URL('imported.json',base),JSON.stringify(imported,null,2)+'\n');
    console.log(`Installed ${source}: ${imported.length} single readings and game clips. Backup: ${backup}`);
  }finally{await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const requested=process.argv[2]||'all';
  for(const source of requested==='all'?['edcreate','gk']:[requested])await importLetterAudio(source);
}
