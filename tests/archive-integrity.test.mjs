import test from 'node:test';
import assert from 'node:assert/strict';
import {validateArchive} from '../web/app/archive-schema.js';
import {validateRestore} from '../web/app/account-restore.js';
const archive = entries => ({version:1,subject:'abc',data:{'abc-garden-mastery-v1':{version:1,entries}}});
test('corrupt mastery cannot be accepted as a successful empty restore', () => {
  for (const entries of ['damaged',[],null,{apple:{mastered:'yes'}},{apple:{mastered:true,dates:'bad'}}]) {
    assert.throws(()=>validateArchive(archive(entries)));
    assert.throws(()=>validateRestore(archive(entries)));
  }
  const snapshot=archive({apple:{mastered:false,source:'manual',dates:[]}});
  assert.deepEqual(validateRestore(snapshot),snapshot);
});

test('all seven archive sections validate without dropping their saved values', async () => {
  const {freshWeekly}=await import('../web/app/module-content.js');
  const {freshState}=await import('../web/app/core.js');
  const {freshGuided}=await import('../web/app/guided-progress.js');
  const {freshLetterLearning}=await import('../web/app/guided-letters-core.js');
  const {clips,...content}=freshWeekly();
  const snapshot={version:1,subject:'abc',data:{
    'abc-module-content-v1':content,
    'abc-garden-mastery-v1':{version:1,entries:{apple:{mastered:false,source:'manual',dates:[]}}},
    'abc-garden-guided-words-v1':freshGuided(),
    'abc-garden-guided-letters-v1':freshLetterLearning(),
    'abc-garden-guided-settings-v1':{version:1,newWordsPerGroup:2,breakAfterMinutes:10},
    'abc-garden-guided-letters-settings-v1':{version:1,newLettersPerGroup:2,breakAfterMinutes:10},
    'abc-garden-preferences-v2':{version:1,settings:freshState().settings},
  }};
  assert.deepEqual(validateRestore(JSON.parse(JSON.stringify(snapshot))),snapshot);
  for(const [key,field,value] of [
    ['abc-module-content-v1','wordMeanings',[]],
    ['abc-garden-guided-words-v1','entries',{apple:{dueAt:'bad',seenAt:0}}],
    ['abc-garden-guided-letters-v1','entries',[]],
    ['abc-garden-guided-settings-v1','newWordsPerGroup',99],
    ['abc-garden-guided-letters-settings-v1','breakAfterMinutes',-1],
    ['abc-garden-preferences-v2','settings','damaged'],
  ]) {
    const corrupt=structuredClone(snapshot);corrupt.data[key][field]=value;
    assert.throws(()=>validateRestore(corrupt));
  }
});
