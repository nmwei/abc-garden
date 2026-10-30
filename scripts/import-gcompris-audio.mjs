import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const base=new URL('../assets/audio/gcompris/',import.meta.url);
const {clips}=JSON.parse(await readFile(new URL('manifest.json',base)));
await mkdir(new URL('originals/',base),{recursive:true});
async function get(url){
  for(let attempt=0;attempt<3;attempt++){
    const target=attempt>0?url.replace('https://cdn.jsdelivr.net/gh/KDE/gcompris-data@master/','https://raw.githubusercontent.com/KDE/gcompris-data/master/').replace('https://www.gnu.org/licenses/gpl-3.0.txt','https://raw.githubusercontent.com/spdx/license-list-data/main/text/GPL-3.0-or-later.txt'):url;
    try{const r=await fetch(target,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer());}
    catch(e){if(attempt===2)throw e;}
  }
}
async function prepare(clip){
  const original=new URL(`originals/${clip.original}`,base);
  const bytes=await readFile(original).catch(()=>get(clip.url));
  const hash=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if(hash!==clip.gitBlobSha1)throw Error(`Source mismatch: ${clip.letter}`);
  await writeFile(original,bytes);
  execFileSync('ffmpeg',['-v','error','-y','-i',fileURLToPath(original),'-ac','1','-ar','24000','-c:a','pcm_s16le',fileURLToPath(new URL(clip.file,base))]);
  console.log(`Prepared ${clip.letter}`);
}
for(let i=0;i<clips.length;i+=4){
  const results=await Promise.allSettled(clips.slice(i,i+4).map(prepare));
  const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
}
await writeFile(new URL('SOURCE-README.txt',base),await get('https://cdn.jsdelivr.net/gh/KDE/gcompris-data@master/voices/en_GB/alphabet/README'));
await writeFile(new URL('GPL-3.0.txt',base),await get('https://www.gnu.org/licenses/gpl-3.0.txt'));
console.log('26 candidate recordings prepared. Existing lesson audio untouched.');
