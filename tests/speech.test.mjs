import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSpeech} from '../scripts/speech-service.mjs';
import {speechId} from '../app/generated-audio.js';
test('generation input is bounded and source text is part of cache identity',()=>{
 assert.throws(()=>validateSpeech({kind:'blend',text:'../../tmp'}));
 assert.throws(()=>validateSpeech({kind:'name',text:'AA'}));
 assert.throws(()=>validateSpeech({kind:'word',text:'x'.repeat(161)}));
 assert.deepEqual(validateSpeech({kind:'zh',text:' 搅拌 '}),{kind:'zh',text:'搅拌'});
 assert.notEqual(speechId({kind:'sentence',text:'I can mix.'}),speechId({kind:'sentence',text:'I can ride.'}));
});
