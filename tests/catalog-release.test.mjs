import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WORDS,WORD_BY_ID,CATALOG_WORDS,CATALOG_BY_ID,READY_WORDS,PENDING_WORDS} from '../app/course-content.js';
import {WORD_ALIASES,canonicalWordId,matchesWord} from '../app/word-aliases.js';
test('release partitions canonical cards and retains every raw card through its canonical identity',()=>{
 assert.equal(READY_WORDS.length+PENDING_WORDS.length,CATALOG_WORDS.length);
 for(const w of WORDS)assert.ok(CATALOG_BY_ID.has(canonicalWordId(w.id)),w.id);
 assert.ok(READY_WORDS.every(w=>w.image));assert.ok(PENDING_WORDS.every(w=>!w.image));
 for(const [alias,id] of Object.entries(WORD_ALIASES)){
  assert.equal(canonicalWordId(id),id);
  if(!WORD_BY_ID.has(alias)&&!WORD_BY_ID.has(id))continue;
  assert.ok(matchesWord(CATALOG_BY_ID.get(id),alias),alias);
  assert.ok(!CATALOG_WORDS.some(w=>w.id===alias),alias);
 }
 for(const id of ['actor','actress','be','am','are','is','father','dad','ice cream'])assert.ok(CATALOG_BY_ID.has(id),id);
});
test('every multi-form import has an explicit review matching the alias registry',async()=>{
 const targets=JSON.parse(await readFile(new URL('../data/vocabulary/targets.json',import.meta.url)));
 const reviews=JSON.parse(await readFile(new URL('../data/vocabulary/import-variant-review.json',import.meta.url)));
 const groups={};for(const [id,v] of Object.entries(targets))for(const e of v.entries)(groups[e]??=[]).push(id);
 const multi=Object.values(groups).filter(ids=>ids.length>1);
 assert.equal(reviews.length,multi.length);
 for(const ids of multi){const review=reviews.find(r=>JSON.stringify(r.forms)===JSON.stringify(ids));assert.ok(review,ids.join(','));assert.deepEqual(review.canonicalIds,[...new Set(ids.map(canonicalWordId))]);}
});
