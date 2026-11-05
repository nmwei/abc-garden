import {readFile,writeFile,mkdtemp,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {encodePcm16} from './audio-pcm.mjs';

const assets=new URL('../assets/',import.meta.url),base=new URL('audio/edcreate/',assets);
const manifest=JSON.parse(await readFile(new URL('cuts.json',base)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(sha(await readFile(new URL(manifest.source,base)))!==manifest.sourceSha256)throw Error('EdCreate source changed; review cut times first.');
for(const mode of ['name','sound'])if(manifest.clips.filter(c=>c.mode===mode).map(c=>c.letter).join('')!=='ABCDEFGHIJKLMNOPQRSTUVWXYZ')throw Error(`Incomplete ${mode} alphabet`);
if(manifest.clips.length!==52||manifest.repetitions!==1)throw Error('Expected 52 clips with one reading each');
const temp=await mkdtemp(join(tmpdir(),'edcreate-cuts-'));
try{
  const decoded=join(temp,'decoded.f32');
  execFileSync('ffmpeg',['-v','error','-y','-i',fileURLToPath(new URL(manifest.source,base)),'-ac','1','-ar',String(manifest.sampleRate),'-f','f32le',decoded]);
  const pcm=await readFile(decoded),count=ms=>Math.round(ms*manifest.sampleRate/1000);
  const segments=manifest.clips.map(clip=>{
    const start=count(clip.startMs),length=count(clip.durationMs);
    if(start<0||length<=0||(start+length)*4>pcm.length)throw Error(`Invalid cut: ${clip.mode}-${clip.letter}`);
    const samples=new Float32Array(length);
    for(let i=0;i<length;i++)samples[i]=pcm.readFloatLE((start+i)*4);
    if(!samples.some(v=>Math.abs(v)>.001))throw Error(`Silent cut: ${clip.mode}-${clip.letter}`);
    return {clip,samples};
  });
  // Calculate the base gain before overrides so replacing L never changes other letters.
  let peak=0;for(const {samples} of segments)for(const value of samples)peak=Math.max(peak,Math.abs(value));
  const gainDb=Math.min(12,-6-20*Math.log10(peak)),imported=[];
  for(const segment of segments){
    let {clip,samples}=segment;
    let recording={author:'EdCreate（录音者未注明）',source:manifest.sourcePage,sourceAudio:manifest.sourceUrl,sourceSha256:manifest.sourceSha256,gainDb,
      license:'Not verified; local audition requested by user',review:'Same speaker assessed by user; professional pronunciation review not performed',
      changes:`Official sprite cuts; one original reading with ${manifest.trailingMs[clip.mode]} ms trailing silence; game clip padding unchanged; uniform gain capped at +12 dB, no pitch or speed change`};
    const override=manifest.overrides?.[`${clip.mode}-${clip.letter}`];
    if(override){
      const input=new URL(override.source,base),decodedOverride=join(temp,`override-${clip.mode}-${clip.letter}.f32`);
      if(sha(await readFile(input))!==override.sourceSha256)throw Error(`Override source changed: ${clip.mode}-${clip.letter}`);
      execFileSync('ffmpeg',['-v','error','-y','-i',fileURLToPath(input),'-ac','1','-ar',String(manifest.sampleRate),'-f','f32le',decodedOverride]);
      const bytes=await readFile(decodedOverride);
      samples=new Float32Array(bytes.length/4);
      for(let i=0;i<samples.length;i++)samples[i]=bytes.readFloatLE(i*4);
      if(!samples.some(v=>Math.abs(v)>.001))throw Error(`Silent override: ${clip.mode}-${clip.letter}`);
      clip={...clip,startMs:0,durationMs:samples.length/manifest.sampleRate*1000};
      recording={...override,source:override.sourcePage,sourceAudio:override.sourceUrl};
      delete recording.sourcePage;delete recording.sourceUrl;
    }
    const {gainDb:clipGainDb,license,review,changes,...sourceInfo}=recording;
    const gain=10**(clipGainDb/20);
    const trailingMs=manifest.trailingMs[clip.mode];
    const leading=count(manifest.leadingMs),trailing=count(trailingMs),singleTrailing=count(manifest.singleTrailingMs);
    const output=new Float32Array(leading+samples.length+trailing);
    for(let i=0;i<samples.length;i++)output[leading+i]=samples[i]*gain;
    const file=`audio/${clip.mode}-${clip.letter}.wav`,bytes=encodePcm16(output,manifest.sampleRate);
    await writeFile(join(temp,file.slice(6)),bytes);
    // Game clips keep their original single-reading padding, independently of follow-along timing.
    const single=new Float32Array(leading+samples.length+singleTrailing);
    for(let i=0;i<samples.length;i++)single[leading+i]=samples[i]*gain;
    const singleFile=`single-${clip.mode}-${clip.letter}.wav`,singleBytes=encodePcm16(single,manifest.sampleRate);
    await writeFile(new URL(singleFile,base),singleBytes);
    imported.push({file,...sourceInfo,sha256:sha(bytes),...clip,
      sampleRate:manifest.sampleRate,repetitions:1,leadingMs:manifest.leadingMs,trailingMs,duration:output.length/manifest.sampleRate,gainDb:clipGainDb,
      singleTrailingMs:manifest.singleTrailingMs,
      singleFile:`audio/edcreate/${singleFile}`,singleSha256:sha(singleBytes),singleDuration:single.length/manifest.sampleRate,
      license,review,changes:override?`${changes}; one reading with ${trailingMs} ms trailing silence; game clip padding unchanged`:changes});
  }
  const creditsPath=new URL('credits.json',assets),sourcesPath=new URL('audio/sources.json',assets);
  const credits=JSON.parse(await readFile(creditsPath)),sources=JSON.parse(await readFile(sourcesPath));
  const backup=await mkdtemp(join(tmpdir(),'abc-before-edcreate-'));
  await copyFile(creditsPath,join(backup,'credits.json'));await copyFile(sourcesPath,join(backup,'sources.json'));
  for(const item of imported)await copyFile(new URL(item.file,assets),join(backup,item.file.slice(6)));
  for(const item of imported)await copyFile(join(temp,item.file.slice(6)),new URL(item.file,assets));
  const files=new Set(imported.map(c=>c.file)),merged=[...credits.filter(c=>!files.has(c.file)),...imported];
  sources.recordingOverrides=merged.filter(c=>c.file.startsWith('audio/'));
  for(const clip of sources.clips)for(const mode of ['name','sound'])clip[`${mode}Duration`]=imported.find(c=>c.letter===clip.letter&&c.mode===mode).duration;
  sources.notice='26 个字母名称及除 L 外的 25 个字母音来自 EdCreate 公开点读音频；L 字母音使用用户选定的旧版录音，截取第一声。点读每次一遍，跟读按名称一遍、字母音一遍播放，需要时可再次点播；听音游戏保持单遍。例词和合音等仍为原有素材。';
  await writeFile(creditsPath,JSON.stringify(merged,null,2)+'\n');
  await writeFile(sourcesPath,JSON.stringify(sources,null,2)+'\n');
  await writeFile(new URL('imported.json',base),JSON.stringify(imported,null,2)+'\n');
  console.log(`Installed ${imported.length} letter clips (one reading each, ${Object.keys(manifest.overrides||{}).length} source override). Previous audio: ${backup}`);
}finally{await rm(temp,{recursive:true,force:true});}
