// Review snapshots detect drift; do not refresh stamps without reviewing changed content.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CATALOG_WORDS,COURSE_AUDIO} from '../web/app/course-content.js';
import {sentenceMeaning} from '../web/app/sentence-meanings.js';
const root=new URL('../',import.meta.url),json=async p=>JSON.parse(await readFile(new URL(p,root)));
const review=await json('data/vocabulary/content-refinements.json'),offline=await json('dist/precache.json');
const sources=new Map((await json('assets/audio/course-sources.json')).clips.map(c=>[c.key,c]));
const expected=new Map(COURSE_AUDIO.map(c=>[c.key,c])),credits=new Map((await json('assets/credits.json')).map(c=>[c.file,c]));
const pronunciations=await json('data/vocabulary/context-pronunciations.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
async function check(path,hash){const b=await readFile(new URL(path.startsWith('assets/')||path.startsWith('./assets/')?'web/'+path:path,root));if(sha(b)!==hash||offline.resources[path]?.sha256!==hash)throw Error(`Changed or stale resource: ${path}`);return b;}
for(const entry of review.entries){
 const w=CATALOG_WORDS.find(w=>w.id===entry.id);if(!w||entry.status!=='reviewed')throw Error(`Unreviewed card: ${entry.id}`);
 const now={zh:w.zh,pos:w.pos||'',sentence:w.sentence,sentenceZh:w.sentenceZh??sentenceMeaning(w.sentence),image:w.image,pictureCue:w.pictureCue};
 for(const [key,value]of Object.entries(entry.reviewedCard))if(now[key]!==value)throw Error(`Re-review ${w.id}/${key}`);
 if(w.pictureCue!==entry.before.pictureCue)throw Error(`Quiz semantics changed: ${w.id}`);
 await check(w.image,entry.imageSha256);
 if(credits.get(w.image.replace('./assets/',''))?.sha256!==entry.imageSha256)throw Error(`Stale credit: ${w.id}`);
 for(const [key,hash]of Object.entries(entry.audioSha256)){
  if(sources.get(key)?.text!==expected.get(key)?.text)throw Error(`Stale audio text: ${key}`);
  const override=pronunciations[key];
  if(override&&(override.text!==expected.get(key)?.text||sources.get(key)?.phonemes!==override.phonemes))throw Error(`Stale pronunciation: ${key}`);
  const b=await check(`./assets/audio/${key}.wav`,hash);if(b.toString('ascii',0,4)!=='RIFF'||b.readUInt16LE(34)!==16)throw Error(`Invalid audio: ${key}`);
  let peak=0;for(let n=44;n+1<b.length;n+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(n)));if(peak<10)throw Error(`Silent audio: ${key}`);
 }
}
console.log(JSON.stringify({reviewed:review.entries.length,newPictures:review.entries.filter(e=>e.newImage).length,offlineVersion:offline.version}));
