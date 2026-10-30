import test from 'node:test';import assert from 'node:assert/strict';
import {freshLearning,cleanLearning,recordLearning,reviewWords} from '../app/course-core.js';
import {freshState,sanitizeState} from '../app/core.js';
import {WORDS,READINGS,DIALOGUES,WRITING,COURSE_AUDIO} from '../app/course-content.js';
test('legacy backups acquire an empty learning record, new records and drafts survive restore',()=>{
 const old=freshState();delete old.learning;assert.deepEqual(sanitizeState(old).learning,freshLearning());
 old.learning={level:3,events:[{item:'apple',skill:'listen',result:'assisted',at:100}],drafts:{me:'My name is Mia.',unknown:'bad'}};
 const result=sanitizeState(old).learning;assert.equal(result.level,3);assert.equal(result.events.length,1);assert.equal(result.drafts.me,'My name is Mia.');assert.equal(result.drafts.unknown,undefined);
});
test('assisted and independent attempts drive review without assigning spoken mastery',()=>{
 const s=freshLearning();recordLearning(s,'apple','listen','assisted',100);recordLearning(s,'cat','speak','attempt',100);
 assert.deepEqual(reviewWords(s,200).map(w=>w.id),['apple']);recordLearning(s,'apple','listen','independent',200);
 assert.equal(reviewWords(s,201).length,0);assert.equal(reviewWords(s,200+4*86400000).length,1);
 assert.throws(()=>recordLearning(s,'apple','speak','mastered'));assert.equal(cleanLearning({events:[{item:'<script>',skill:'listen',result:'independent',at:1}]}).events.length,0);
});
test('all content is addressable and comprehension answers are valid',()=>{
 assert.equal(WORDS.length,40);assert.equal(new Set(WORDS.map(w=>w.id)).size,40);
 assert.equal(new Set(COURSE_AUDIO.map(a=>a.key)).size,COURSE_AUDIO.length);
 for(const x of [...READINGS,...DIALOGUES,...WRITING])assert.ok([1,2,3].includes(x.level));
 for(const r of READINGS)assert.ok(r.options[r.answer]);
});
