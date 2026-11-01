import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WORDS,WORD_BY_ID} from '../app/course-content.js';
import {CONTEXT_WORDS} from '../app/context-words.js';
import {sentenceCreditDetails} from '../app/word-card.js';
import {parseWords} from '../app/module-content.js';
test('new cards fill primary headwords without replacing the original catalog or inventing picture questions',async()=>{
 const mappings=JSON.parse(await readFile(new URL('../data/vocabulary/picture-mappings.json',import.meta.url)));
 const primary=JSON.parse(await readFile(new URL('../data/vocabulary/primary-2022.json',import.meta.url)));
 assert.equal(WORDS.filter(w=>!w.contentSource).length,1168);
 for(const row of primary)assert.ok(row.entry.split('/').some(id=>WORD_BY_ID.has(id.toLowerCase())),row.entry);
 for(const word of CONTEXT_WORDS){assert.ok(word.sentence&&word.sentenceZh&&word.zh&&word.pos);if(!word.image){assert.equal(word.pictureCue,true);assert.equal(word.topic,null);}else{assert.equal(word.pictureCue,mappings[word.id]?.pictureCue===true);assert.ok(word.topic&&word.emoji);}}
 assert.equal(WORD_BY_ID.get('i').display,'I');assert.equal(WORD_BY_ID.get('mr').spoken,'Mister');
});
test('expanded vocabulary has concrete paired examples, example-specific glosses and retained attribution',async()=>{
 const rows=JSON.parse(await readFile(new URL('../data/vocabulary/extended-context.json',import.meta.url)));
 assert.equal(rows.length,1646);
 assert.ok(WORDS.length>=3000);
 for(const row of rows){
  const word=WORD_BY_ID.get(row.id);
  assert.ok(word,row.id);
  assert.ok(new RegExp(`\\b${row.id}\\b`,'i').test(row.sentence),row.id);
  assert.match(row.sentenceZh,/[\u4e00-\u9fff]/,row.id);
  assert.equal(word.display.toLowerCase(),row.id);
  assert.equal(word.zh,row.zh);
  const completed=parseWords(`${row.id} | ${row.zh} | ${row.sentence}`)[0];
  assert.equal(completed.sentence,row.sentence,row.id);
  if(row.attribution){
   assert.ok(row.attribution.originalSentence&&row.attribution.originalTranslation);
   assert.match(sentenceCreditDetails(word),/creativecommons.org\/licenses\/by\/2.0\/fr/);
   for(const id of row.attribution.credit.matchAll(/#(\d+)/g))assert.ok(sentenceCreditDetails(word).includes(`/show/${id[1]}`));
  }
 }
 assert.equal(WORD_BY_ID.get('found').zh,'建立');
 assert.match(WORD_BY_ID.get('found').sentence,/found a new school/);
 assert.equal(WORD_BY_ID.get('lay').zh,'放置');
 assert.equal(WORD_BY_ID.get('according to').display,'according to');
 assert.equal(WORD_BY_ID.get('means').pos,'名词');
 assert.equal(WORD_BY_ID.get('herself').sentence,'She made the cake herself.');
});
