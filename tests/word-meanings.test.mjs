import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanWordMeanings} from '../web/app/word-meanings.js';
import {wordLibrary} from '../web/app/word-library.js';
import {cleanWeekly} from '../web/app/module-content.js';
import {CATALOG_BY_ID} from '../web/app/course-content.js';
test('personal glosses survive sanitization and override every library view without modifying catalog or examples',()=>{
 const original=CATALOG_BY_ID.get('walk');
 const data=cleanWeekly({letters:'EF',wordMeanings:{walk:{zh:' 散步 '},unknown:{zh:'未知'},cat:{zh:''},apple:12,color:{zh:'a'.repeat(161)}}});
 assert.deepEqual({...data.wordMeanings},{walk:{zh:'散步'}});
 const library=wordLibrary([{word:'walk'}],data.wordMeanings);
 assert.equal(library.selected[0].zh,'散步');assert.equal(library.all.find(w=>w.id==='walk').zh,'散步');
 assert.equal(library.selected[0].sentence,original.sentence);assert.equal(library.selected[0].audio,original.audio);
 assert.equal(original.zh,'走');
 assert.equal(wordLibrary([{word:'walk'}],{}).selected[0].zh,'走');
 assert.deepEqual({...cleanWordMeanings({walk:{zh:'走'}})},{});
});
test('structured edits preserve identity, survive reload and are shared by both views',()=>{
 const data=cleanWeekly({wordMeanings:{walk:{zh:'散步',sentence:'We walk home.',sentenceZh:'我们走回家。',audio:'bad'}}});
 const reloaded=cleanWeekly(JSON.parse(JSON.stringify(data)));
 const lib=wordLibrary([{word:'walk'}],reloaded.wordMeanings);
 for(const w of [lib.selected[0],lib.all.find(w=>w.id==='walk')]){assert.equal(w.zh,'散步');assert.equal(w.sentence,'We walk home.');assert.equal(w.sentenceZh,'我们走回家。');assert.equal(w.audio,CATALOG_BY_ID.get('walk').audio);}
 assert.notEqual(CATALOG_BY_ID.get('walk').sentence,'We walk home.');
});
test('missing and blank translations fall back to the current sentence, never a different sentence',async()=>{
 const {withWordMeaning}=await import('../web/app/word-meanings.js');
 for(const sentenceZh of [undefined,'','   '])assert.equal(withWordMeaning({id:'apple',sentence:'I like apples.',sentenceZh},{}).sentenceZh,'我喜欢苹果。');
 assert.equal(withWordMeaning({id:'apple',sentence:'A completely custom sentence.',sentenceZh:''},{}).sentenceZh,'');
});

test('retired string glosses are not converted into current edits',()=>{assert.deepEqual({...cleanWordMeanings({walk:'散步'})},{});});
