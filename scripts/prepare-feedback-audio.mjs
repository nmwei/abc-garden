// Mixkit audio belongs to the built game, not the public source branch.
import {readFile,writeFile,mkdtemp,rm,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function prepareFeedbackAudio(root=new URL('../',import.meta.url)) {
  const {clips}=JSON.parse(await readFile(new URL('assets/audio/feedback-sources.json',root),'utf8'));
  for(const clip of clips) {
    if(!/^audio\/feedback-(correct|retry)\.wav$/.test(clip.file))throw Error(`Unexpected feedback path: ${clip.file}`);
    const target=new URL(`assets/${clip.file}`,root);
    try {
      if(hash(await readFile(target))!==clip.sha256)throw Error(`Feedback audio hash mismatch: ${clip.file}`);
      continue;
    }catch(error){if(error.code!=='ENOENT')throw error;}
    const source=new URL(clip.sourceAudio);
    if(source.origin!=='https://assets.mixkit.co')throw Error('Unexpected feedback download origin');
    const response=await fetch(source,{signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error(`Feedback download failed: HTTP ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(hash(bytes)!==clip.sourceSha256)throw Error(`Feedback source changed: ${clip.title}`);
    const temp=await mkdtemp(join(tmpdir(),'garden-feedback-'));
    try {
      const input=join(temp,'source.mp3'),output=join(temp,'sound.wav');
      await writeFile(input,bytes);
      try{execFileSync('ffmpeg',['-v','error','-y','-i',input,'-af','loudnorm=I=-16:TP=-2:LRA=7','-ar','24000','-ac','1','-c:a','pcm_s16le',output],{stdio:'pipe'});}
      catch(error){throw new Error('Feedback preparation requires FFmpeg (the approved files use FFmpeg 8.1.1).',{cause:error});}
      if(hash(await readFile(output))!==clip.sha256)throw Error(`Prepared audio differs from the approved recording: ${clip.title}. Use the documented FFmpeg version; do not replace the approved hash blindly.`);
      await mkdir(new URL('assets/audio/',root),{recursive:true});
      await copyFile(output,target);
      console.log(`Prepared licensed game audio: ${clip.file}`);
    }finally{await rm(temp,{recursive:true,force:true});}
  }
  return clips;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await prepareFeedbackAudio();
