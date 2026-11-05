import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {prepareFeedbackAudio} from '../scripts/prepare-feedback-audio.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'feedback-test-')),root=pathToFileURL(dir+'/');
 t.after(()=>rm(dir,{recursive:true,force:true}));
 await mkdir(new URL('assets/audio/',root),{recursive:true});
 const bytes=Buffer.from('approved audio'),clip={file:'audio/feedback-correct.wav',sha256:sha(bytes),sourceSha256:sha('original'),sourceAudio:'https://assets.mixkit.co/test.mp3',title:'Test recording'};
 await writeFile(new URL('assets/audio/feedback-sources.json',root),JSON.stringify({clips:[clip]}));
 return {root,bytes};
}
test('approved local audio works without network; damaged audio is never silently accepted',async t=>{
 const {root,bytes}=await fixture(t),target=new URL('assets/audio/feedback-correct.wav',root);
 t.mock.method(globalThis,'fetch',()=>{throw Error('Must remain offline');});
 await writeFile(target,bytes);assert.equal((await prepareFeedbackAudio(root)).length,1);
 await writeFile(target,'corrupt');await assert.rejects(prepareFeedbackAudio(root),/hash mismatch/);
 assert.equal(await readFile(target,'utf8'),'corrupt');
});
test('changed upstream audio is rejected before transcoding or creating a local file',async t=>{
 const {root}=await fixture(t);
 t.mock.method(globalThis,'fetch',async()=>new Response('unreviewed replacement'));
 await assert.rejects(prepareFeedbackAudio(root),/source changed/);
 await assert.rejects(readFile(new URL('assets/audio/feedback-correct.wav',root)),{code:'ENOENT'});
});
