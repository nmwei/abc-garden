import {mkdir,writeFile,mkdtemp,rm,access,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {WORDS} from '../app/course-content.js';
const base=new URL('../assets/',import.meta.url);await mkdir(new URL('pictures/',base),{recursive:true});
const credits=[];
async function get(url){let error;for(let attempt=0;attempt<4;attempt++){try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`${r.status}: ${url}`);return r;}catch(e){error=e;await new Promise(r=>setTimeout(r,500));}}throw error;}
const revision='v2.047';
for(const w of WORDS){
 if(['top','jam'].includes(w.id))continue;
 const source=`https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@${revision}/svg/emoji_u${w.emoji}.svg`;
 const target=new URL(`pictures/${w.id}.svg`,base);
 if(!await access(target).then(()=>true,()=>false)){const bytes=await (await get(source)).text();if(!bytes.includes('<svg'))throw new Error('Invalid SVG');await writeFile(target,bytes);}
 credits.push({file:`pictures/${w.id}.svg`,author:'Google Noto Emoji contributors',source,license:'Apache-2.0',licenseUrl:'https://www.apache.org/licenses/LICENSE-2.0',changes:'None'});
 console.log('Picture',w.id);
}
await writeFile(new URL('pictures/top.svg',base),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M62 18h8v30h-8z" fill="#805b42"/><path d="M22 59Q64 22 106 59L66 110Z" fill="#f4ad57"/><ellipse cx="64" cy="59" rx="42" ry="16" fill="#e06566"/><ellipse cx="64" cy="57" rx="24" ry="8" fill="#ffda86"/><path d="M43 86h43L66 110Z" fill="#6eab99"/></svg>`);
await writeFile(new URL('pictures/jam.svg',base),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="27" y="26" width="74" height="88" rx="17" fill="#c64e64"/><rect x="25" y="18" width="78" height="19" rx="7" fill="#edc978"/><rect x="31" y="51" width="66" height="42" rx="10" fill="#fff3d9"/><path d="M48 65Q64 51 80 65Q78 83 64 89Q50 83 48 65" fill="#ed5b60"/><path d="M55 61L64 54L73 61L64 65Z" fill="#5b925e"/><path d="M38 40v9" stroke="#f0a0ad" stroke-width="5" stroke-linecap="round"/></svg>`);
credits.push({file:'pictures/jam.svg',author:'ABC Garden',source:'Original vector illustration',license:'Project original',changes:'Original'});
credits.push({file:'pictures/top.svg',author:'ABC Garden',source:'Original vector illustration',license:'Project original',changes:'Original'});
await writeFile(new URL('pictures/LICENSE-NOTO.txt',base),await (await get(`https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@${revision}/svg/LICENSE`)).text());
const temp=await mkdtemp(join(tmpdir(),'garden-audio-'));
try{
 for(const [file,title,author] of [['name-B','En-us-b.ogg','Twocs'],['name-G','En-us-g.ogg','Twocs'],['sound-G','Voiced velar plosive 02.ogg','Peter Isotalo']]){
 const url=new URL('https://commons.wikimedia.org/w/api.php');url.search=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata|sha1',titles:`File:${title}`});
 const data=await (await get(url)).json();const info=Object.values(data.query.pages)[0].imageinfo[0];
 if(info.extmetadata.LicenseShortName.value!=='CC BY-SA 3.0')throw new Error('Review changed license');
 const input=join(temp,title);
 let bytes=process.env.ABC_AUDIO_CACHE_DIR?await readFile(join(process.env.ABC_AUDIO_CACHE_DIR,title)).catch(()=>null):null;
 if(!bytes){const download=new URL(info.url);download.search='';bytes=Buffer.from(await (await get(download)).arrayBuffer());}
 if(createHash('sha1').update(bytes).digest('hex')!==info.sha1)throw new Error('Recording hash does not match Commons source');
 await writeFile(input,bytes);
 execFileSync('ffmpeg',['-v','error','-y','-i',input,'-ac','1','-ar','24000','-c:a','pcm_s16le',fileURLToPath(new URL(`audio/${file}.wav`,base))]);
 credits.push({file:`audio/${file}.wav`,author,source:info.descriptionurl,license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',changes:'Converted OGG to mono PCM16 WAV at 24000 Hz; no phoneme editing',review:'Source and decoding verified; classroom listening review still required'});
 console.log('Human recording',file);
 }
}finally{await rm(temp,{recursive:true,force:true});}
await writeFile(new URL('credits.json',base),JSON.stringify(credits,null,2));

const sourcePath=new URL('audio/sources.json',base);
const source=JSON.parse(await readFile(sourcePath,'utf8'));
source.recordingOverrides=credits.filter(c=>c.file.startsWith('audio/'));
source.notice='内置声音混合合成与真人参考录音。recordingOverrides 和 assets/credits.json 记录替换来源，未完成专业逐条听觉验收。';
await writeFile(sourcePath,JSON.stringify(source,null,2));
