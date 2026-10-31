import test from 'node:test';
import assert from 'node:assert/strict';
import {wordLibrary,selectedWordIds} from '../app/word-library.js';
import {WORDS} from '../app/course-content.js';
test('selection migrates known words in order, excludes unknowns and keeps catalog canonical',()=>{
 assert.deepEqual(selectedWordIds({words:'cat | 改写 | Hello.\napple\nzzzzunknown'}),['cat','apple']);
 assert.deepEqual(selectedWordIds({selectedWordIds:['apple','cat','apple','bad'],words:'ball'}),['apple','cat']);
 assert.deepEqual(selectedWordIds({selectedWordIds:[],words:'ball'}),[]);
 const lib=wordLibrary([{word:'cat',sentence:'changed'},{word:'apple'},{word:'cat'}]);assert.equal(lib.all,WORDS);assert.deepEqual(lib.selected.map(w=>w.id),['cat','apple']);assert.notEqual(lib.selected[0].sentence,'changed');
});
