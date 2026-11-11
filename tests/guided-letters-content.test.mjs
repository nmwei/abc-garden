import test from 'node:test';
import assert from 'node:assert/strict';
import {ALPHABET} from '../app/content.js';
import {WORD_BY_ID} from '../app/course-content.js';
import {getLetterActivity,getInitialSoundActivity,getLetterPlay} from '../app/guided-letters-content.js';

test('all 26 letters reuse the actual example, image and audio phoneme for each teaching skill',()=>{
 const teaches=new Set();
 for(const letter of ALPHABET){
  const word=WORD_BY_ID.get(letter.example);assert.ok(word);
  for(const skill of ['name','sound','case']){
   const activity=getLetterActivity(letter.lower,skill);
   for(const key of ['setup','teach','listen','recall','example','zh','image','ipa','nameIpa','note','play'])assert.ok(typeof activity[key]==='string'&&activity[key].length,key);
   assert.equal(activity.example,letter.example);assert.equal(activity.zh,word.zh);assert.equal(activity.image,word.image);
   assert.equal(activity.ipa,letter.ipa);assert.equal(activity.nameIpa,letter.nameIpa);
   assert.match(activity.note,/大小写是同一个字母/);
  }
  const sound=getLetterActivity(letter.upper,'sound');
  assert.match(sound.setup,/先用中文确认/);assert.match(sound.teach,new RegExp(letter.example));
  assert.notEqual(sound.teach,getLetterActivity(letter.upper,'name').teach);
  teaches.add(sound.teach);
 }
 assert.equal(teaches.size,26,'each letter receives its own meaningful sound cue');
 assert.equal(getLetterActivity('unknown','sound'),null);
 assert.equal(getLetterActivity('A','unsupported'),null);
});

test('Q explicitly teaches the qu combination, X uses word-final ks, and C/K preserve the same sound',()=>{
 const q=getInitialSoundActivity('Q'),x=getInitialSoundActivity('X');
 assert.equal(q.example,'queen');assert.equal(q.ipa,'kw');assert.match(q.listen,/qu.*\/k\/.*\/w\//);
 assert.match(getLetterActivity('Q','sound').teach,/两个声音连起来/);
 assert.equal(x.example,'box');assert.equal(x.ipa,'ks');assert.equal(x.position,'end');
 assert.match(x.listen,/词尾/);assert.match(x.teach,/不找首音/);
 assert.equal(getLetterActivity('C','sound').ipa,getLetterActivity('K','sound').ipa);
 assert.equal(getLetterActivity('A','sound').ipa,'æ');assert.equal(getLetterActivity('A','sound').example,'apple');
});

test('intervening play avoids demonstrating the upcoming target and single-letter play can leave the screen',()=>{
 const play=getLetterPlay({letter:'A',skill:'sound'},['A','M']);
 assert.equal(play.otherLetter,'M');assert.match(play.instruction,/两道拱/);assert.match(play.note,/不念名称或字母音/);
 const single=getLetterPlay({letter:'A'},['A']);
 assert.equal(single.letter,null);assert.equal(single.skill,'movement');assert.match(single.note,/不提示/);
 assert.equal(getLetterPlay({letter:'?'},['A']),null);
});

test('listening play connects a familiar meaning to its sound without awarding knowledge evidence',()=>{
 for(const letter of ALPHABET){
  const play=getLetterPlay({letter:letter.upper,activity:'listen'},['A','B']);
  assert.equal(play.example,letter.example);assert.equal(play.ipa,letter.ipa);
  assert.match(play.instruction,/先用中文确认/);assert.match(play.note,/不记录掌握/);
 }
 assert.match(getLetterPlay({letter:'X',activity:'listen'}).instruction,/词尾/);
 assert.match(getLetterPlay({letter:'Q',activity:'listen'}).instruction,/qu/);
});
