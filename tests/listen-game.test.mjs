import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ListeningRound} from '../app/listen-game-core.js';

test('practice keeps wrong choices disabled and hints exclude first-try credit',()=>{
 const r=new ListeningRound(['A','B']);r.queue=['A','B'];
 assert.equal(r.answer('B'),false);assert.equal(r.done,false);assert.equal(r.answer('B'),null);
 r.hint();assert.equal(r.answer('A'),true);assert.equal(r.found,1);assert.equal(r.firstTry,0);
 assert.equal(r.answer('A'),null);r.next();assert.equal(r.answer('B'),true);assert.equal(r.firstTry,1);
 r.next();assert.equal(r.finished,false);assert.equal(r.wrong.size,0);
});
test('challenge asks each letter once, ends after last feedback and keeps missed targets',()=>{
 const r=new ListeningRound(['A','B'],{kind:'game'});r.queue=['A','B'];
 r.answer('B');assert.equal(r.done,true);assert.equal(r.answer('A'),null);r.next();
 r.answer('B');assert.equal(r.finished,false);r.next();assert.equal(r.finished,true);
 assert.equal(r.right,1);assert.deepEqual([...r.missed],['A']);
});
test('C and K are equivalent only in sound mode; the alternate must be in the selected range',()=>{
 const r=new ListeningRound(['C','K','A'],{mode:'sound'});r.queue=['C','K','A'];
 assert.equal(r.answer('K'),true);r.next();assert.equal(r.answer('C'),true);
 const names=new ListeningRound(['C','K']);names.queue=['C','K'];assert.equal(names.answer('K'),false);
 const range=new ListeningRound(['C','A'],{mode:'sound'});range.queue=['C','A'];assert.equal(range.answer('K'),null);
});
