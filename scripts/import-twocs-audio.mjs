import {readFile,writeFile,mkdtemp,rm,copyFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';

const assets=new URL('../assets/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('audio/twocs-names.json',assets),'utf8'));
const temp=await mkdtemp(join(tmpdir(),'abc-twocs-'));
const cache=process.env.ABC_AUDIO_CACHE_DIR;
if(cache)await mkdir(cache,{recursive:true});
const cachedOnly=process.argv.includes('--cached-only');
if(cachedOnly&&!cache)throw new Error('--cached-only requires ABC_AUDIO_CACHE_DIR');
const clips=[];
for(const clip of manifest.clips){
  if(!cachedOnly||await readFile(join(cache,`${clip.letter}.ogg`)).then(()=>true,()=>false))clips.push(clip);
}
if(!clips.length)throw new Error('No recordings available to import');
async function download(url){
  // Optional public-file mirror/transport; pinned SHA-1 is verified before use.
  const target=process.env.ABC_COMMONS_HTTP==='1'?url.replace(/^https:/,'http:'):url;
  for(let attempt=1;attempt<=4;attempt++){
    try{
      if(attempt%2===1){
        const response=await fetch(target,{signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
      }
      const {stdout}=await promisify(execFile)('curl',['-fsSL','--connect-timeout','10','--max-time','20',target],{encoding:'buffer',maxBuffer:1024*1024});
      return stdout;
    }catch(error){if(attempt===4)throw error;}
  }
}
try{
  // Prepare the entire batch before replacing any working audio.
  async function prepare(clip){
    const cached=cache?join(cache,`${clip.letter}.ogg`):null;
    const bytes=(cached?await readFile(cached).catch(()=>null):null)??await download(clip.originalUrl);
    if(createHash('sha1').update(bytes).digest('hex')!==clip.originalSha1)throw new Error(`Source changed: ${clip.letter}`);
    if(cached)await writeFile(cached,bytes);
    const original=join(temp,`${clip.letter}.ogg`),output=join(temp,`${clip.letter}.wav`);
    await writeFile(original,bytes);
    execFileSync('ffmpeg',['-v','error','-y','-i',original,'-ac','1','-ar','24000','-c:a','pcm_s16le',output]);
    execFileSync('ffmpeg',['-v','error','-i',output,'-f','null','-']);
    console.log(`Prepared ${clip.letter}`);
  }
  const failures=[];
  for(let i=0;i<clips.length;i+=4){
    const results=await Promise.allSettled(clips.slice(i,i+4).map(prepare));
    const failed=results.find(r=>r.status==='rejected');
    if(failed)failures.push(failed.reason);
  }
  if(failures.length)throw new AggregateError(failures,'Some downloads failed; cached clips can be reused on retry.');
  const creditsPath=new URL('credits.json',assets),sourcesPath=new URL('audio/sources.json',assets);
  const credits=JSON.parse(await readFile(creditsPath,'utf8'));
  const sources=JSON.parse(await readFile(sourcesPath,'utf8'));
  const files=new Set(clips.map(c=>c.file));
  for(const clip of clips)await copyFile(join(temp,`${clip.letter}.wav`),new URL(clip.file,assets));
  const merged=[...credits.filter(c=>!files.has(c.file)),...clips];
  sources.recordingOverrides=merged.filter(c=>c.file.startsWith('audio/'));
  const count=sources.recordingOverrides.filter(c=>c.author==='Twocs'&&c.file.startsWith('audio/name-')).length;
  sources.notice=`${count} 个字母名称使用 Twocs 真人录音，大小写共用；其余名称、字母音及例词仍按各自来源播放，未完成专业逐条听觉验收。`;
  await writeFile(creditsPath,JSON.stringify(merged,null,2)+'\n');
  await writeFile(sourcesPath,JSON.stringify(sources,null,2)+'\n');
  console.log(`Imported ${clips.length} letter names by Twocs.`);
}finally{await rm(temp,{recursive:true,force:true});}
