import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState,sanitizeState} from '../app/core.js';
import {letterAudioPath} from '../app/letter-audio.js';

test('old and invalid preferences default to EdCreate; GK survives reload sanitization',()=>{
  assert.equal(freshState().settings.letterAudioSource,'edcreate');
  for(const value of [undefined,null,'other'])assert.equal(sanitizeState({version:1,settings:{letterAudioSource:value}}).settings.letterAudioSource,'edcreate');
  assert.equal(sanitizeState({version:1,settings:{letterAudioSource:'gk'}}).settings.letterAudioSource,'gk');
});

test('both sources resolve complete alphabets including L and R, without affecting words',()=>{
  for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')for(const mode of ['name','sound']){
    const key=`${mode}-${letter}`;
    assert.equal(letterAudioPath(key,'edcreate'),`./assets/audio/${key}.wav`);
    assert.equal(letterAudioPath(key,'gk'),`./assets/audio/gk/${key}.wav`);
    for(const source of ['gk','edcreate'])assert.equal(letterAudioPath(key,source,{single:true}),`./assets/audio/${source}/single-${key}.wav`);
  }
  for(const key of ['example-R','word-apple','sentence-apple','sound-r','name-../R'])assert.equal(letterAudioPath(key,'gk'),null);
});
