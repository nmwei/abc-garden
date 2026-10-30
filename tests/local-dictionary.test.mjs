import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {LOCAL_DICTIONARY,lookupLocalWord,searchLocalWords} from '../app/local-dictionary.js';
import {completeLocalWords,parseWords} from '../app/module-content.js';
test('pinned dictionary has reproducible counts, tier boundaries and valid completion output',()=>{
 const source=JSON.parse(readFileSync(new URL('../assets/dictionary/source.json',import.meta.url)));
 assert.equal(LOCAL_DICTIONARY.length,4979);assert.equal(source.count,LOCAL_DICTIONARY.length);assert.equal(new Set(LOCAL_DICTIONARY.map(w=>w.word)).size,4979);
 for(const w of LOCAL_DICTIONARY){assert.equal(w.tier,w.rank>0&&w.rank<=1000?1:w.rank>0&&w.rank<=3000?2:3);const row=parseWords(completeLocalWords(w.word).words)[0];assert.ok(row.zh);assert.ok(row.zh.length<=160);}
});
test('search and enrichment use real dictionary meanings, retain manual fields and never fabricate examples',()=>{
 assert.equal(searchLocalWords('clean')[0].word,'clean');assert.ok(searchLocalWords('干净').some(w=>w.word==='clean'));assert.ok(searchLocalWords('',1).every(w=>w.tier===1));
 assert.ok(lookupLocalWord(' MIX ').zh.includes('混合'));
 const result=completeLocalWords('mix\nclean | 打扫 | I can clean.\napple\nzzzzunknown');const rows=parseWords(result.words);
 assert.equal(rows[0].zh,'搅拌');assert.equal(rows[0].sentence,'I can mix.');assert.equal(rows[1].zh,'打扫');assert.equal(rows[1].sentence,'I can clean.');assert.equal(rows[2].sentence,'I like apples.');assert.deepEqual(result.missing,['zzzzunknown']);assert.deepEqual(result.incomplete,[]);
});
