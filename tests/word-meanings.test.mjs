import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanWordMeanings} from '../app/word-meanings.js';
import {wordLibrary} from '../app/word-library.js';
import {cleanWeekly} from '../app/module-content.js';
import {CATALOG_BY_ID} from '../app/course-content.js';
test('personal glosses survive sanitization and override every library view without modifying catalog or examples',()=>{
 const original=CATALOG_BY_ID.get('walk');
 const data=cleanWeekly({letters:'EF',wordMeanings:{walk:' 散步 ',unknown:'未知',cat:'',apple:12,color:'a'.repeat(161)}});
 assert.deepEqual({...data.wordMeanings},{walk:'散步'});
 const library=wordLibrary([{word:'walk'}],data.wordMeanings);
 assert.equal(library.selected[0].zh,'散步');assert.equal(library.all.find(w=>w.id==='walk').zh,'散步');
 assert.equal(library.selected[0].sentence,original.sentence);assert.equal(library.selected[0].audio,original.audio);
 assert.equal(original.zh,'走');
 assert.equal(wordLibrary([{word:'walk'}],{}).selected[0].zh,'走');
 assert.deepEqual({...cleanWordMeanings({walk:'走'})},{});
});
