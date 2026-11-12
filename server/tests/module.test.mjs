import test from 'node:test';
import assert from 'node:assert/strict';
import subject from '../index.js';
test('subject entry exports its own strict archive contract',()=>{
 assert.equal(subject.id,'abc');
 const snapshot={version:1,subject:subject.id,data:{}};
 assert.deepEqual(subject.validateArchive(snapshot),snapshot);
 assert.throws(()=>subject.validateArchive({...snapshot,subject:'other'}));
 assert.throws(()=>subject.validateArchive({...snapshot,data:{unknown:{}}}));
});
