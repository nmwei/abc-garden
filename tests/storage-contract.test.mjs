import test from 'node:test';
import assert from 'node:assert/strict';
import {learningSnapshot} from './fixtures/learning-snapshot.mjs';
import {validateArchive} from '../web/app/archive-schema.js';
import {DATA,ARCHIVE_KEYS,DATA_DEFINITIONS,projectLearningValue} from '../web/app/learning-data.js';
import {showSaveResult} from '../web/app/save-feedback.js';

test('every account domain has populated round-trip data and device settings stay outside the archive',()=>{
 const snapshot=learningSnapshot();
 assert.deepEqual(Object.keys(snapshot.data).sort(),[...ARCHIVE_KEYS].sort());
 assert.deepEqual(validateArchive(structuredClone(snapshot)),snapshot);
 for(const [key,definition] of Object.entries(DATA_DEFINITIONS)) if(definition.scope==='device')
   assert.throws(()=>validateArchive({...snapshot,data:{...snapshot.data,[key]:'voice'}}));
});
test('local projection rejects malformed roots before removing device media',()=>{
 for(const value of [null,[],1,'',true]) assert.throws(()=>projectLearningValue(DATA.content,value));
});

test('values that business readers would discard or default are rejected before storage',()=>{
 const cases=[
  [DATA.content,'repeats',99],[DATA.content,'gap',999],
  [DATA.content,'wordMeanings',{apple:'x'.repeat(200)}],
  [DATA.content,'selectedWordIds',['does-not-exist']],
  [DATA.preferences,'settings',{minutes:99}],
  [DATA.words,'observations',[{id:'apple',at:1,outcome:'unknown'}]],
  [DATA.wordSettings,'newWordsPerGroup',1],
  [DATA.listening,'letterCase','unknown'],
 ];
 for(const [key,field,value] of cases){const s=learningSnapshot();s.data[key][field]=value;assert.throws(()=>validateArchive(s),key+'.'+field);}
 const old=learningSnapshot();old.data[DATA.words].version=7;assert.throws(()=>validateArchive(old));
});
test('save feedback waits for durability and old completions cannot hide a new failure',async()=>{
 const target={status:''};let resolveOld,rejectNew;
 const old=new Promise(resolve=>resolveOld=resolve),next=new Promise((_,reject)=>rejectNew=reject);
 showSaveResult(target,'status','已保存',()=>{},{whenSaved:()=>old});
 assert.match(target.status,/正在保存/);
 showSaveResult(target,'status','已保存',()=>{},{whenSaved:()=>next});
 await new Promise(resolve=>setImmediate(resolve));
 rejectNew(Error('quota'));await new Promise(resolve=>setImmediate(resolve));assert.match(target.status,/失败/);
 resolveOld();await new Promise(resolve=>setImmediate(resolve));assert.match(target.status,/失败/);
});
