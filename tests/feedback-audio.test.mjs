import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../web/app/feedback-audio.js';

test('one feedback channel handles completion, rapid answers, mute and background cancellation',async t=>{
 const previous={Audio:globalThis.Audio,document:globalThis.document,window:globalThis.window},events={};
 const elements=[];let muted=false;
 globalThis.document={hidden:false,baseURI:'https://example.test/abc-garden/',body:{append(){}},addEventListener:(k,f)=>events[k]=f};
 globalThis.window={addEventListener:(k,f)=>events[k]=f};
 globalThis.Audio=class{constructor(){elements.push(this);}setAttribute(){}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){}play(){this.paused=false;return Promise.resolve();}};
 t.after(()=>{for(const [k,v] of Object.entries(previous))if(v===undefined)delete globalThis[k];else globalThis[k]=v;});
 const feedback=new globalThis.GardenFeedbackAudio({enabled:()=>!muted});
 const first=feedback.play(true);assert.match(elements[0].src,/abc-garden\/assets\/audio\/feedback-correct.wav$/);assert.equal(elements[0].volume,1);
 const second=feedback.play(false);assert.equal(await first,false);assert.equal(elements.length,1);elements[0].onended();assert.equal(await second,true);
 const pending=feedback.play(true);events.pagehide();assert.equal(await pending,false);assert.equal(elements[0].paused,true);
 muted=true;assert.equal(await feedback.play(true),false);assert.equal(elements[0].src,'');
 muted=false;const hidden=feedback.play(false);document.hidden=true;events.visibilitychange();assert.equal(await hidden,false);
});
