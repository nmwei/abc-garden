import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanMastery,recordMastery,setMastery,localDay} from '../app/mastery.js';
const evidence=day=>({day,independent:true,direct:true,heard:true});
test('mastery needs three unassisted first answers across local calendar days',()=>{
 const data=cleanMastery(null);for(let i=0;i<4;i++)assert.equal(recordMastery(data,'apple',evidence('2026-10-30')),false);
 assert.equal(recordMastery(data,'apple',evidence('2026-10-31')),true);assert.equal(data.entries.apple.source,'auto');
 assert.equal(localDay(new Date(2026,9,30,23,59)),'2026-10-30');
});
test('assistance, unseen audio and context pictures do not count; cancellation starts fresh',()=>{
 const data=cleanMastery(null);
 for(const override of [{independent:false},{direct:false},{heard:false}])recordMastery(data,'apple',{...evidence('2026-10-30'),...override});
 assert.equal(data.entries.apple,undefined);setMastery(data,'apple',true);setMastery(data,'apple',false);assert.deepEqual(data.entries.apple.dates,[]);
 assert.equal(recordMastery(data,'apple',evidence('2026-10-31')),false);assert.equal(recordMastery(data,'apple',evidence('2026-11-01')),false);assert.equal(recordMastery(data,'apple',evidence('2026-11-01')),true);
});
test('stored progress validates shape and preserves manual decisions',()=>{
 const data=cleanMastery({entries:{apple:{mastered:true,source:'manual',dates:['bad']},'<script>':{},cat:{dates:Array(20).fill('2026-10-30')}}});
 assert.equal(data.entries.apple.mastered,true);assert.equal(data.entries['<script>'],undefined);assert.equal(data.entries.cat.dates.length,3);
});
test('aliases preserve mastered and pending records without adding duplicate evidence',()=>{
 const data=cleanMastery({entries:{colour:{mastered:true,dates:['2026-10-30']},color:{mastered:false,dates:['2026-10-31']},'per cent':{mastered:true},because:{mastered:true},favourite:{dates:['2026-10-30','2026-10-30']},favorite:{dates:['2026-10-31']}}});
 assert.equal(data.entries.color.mastered,true);assert.equal(data.entries.percent.mastered,true);assert.equal(data.entries.because.mastered,true);assert.equal(data.entries.colour,undefined);
 assert.equal(data.entries.favorite.mastered,false);assert.equal(data.entries.favorite.dates.length,2);
 setMastery(data,'colour',false);assert.equal(data.entries.color.mastered,false);
 assert.equal(cleanMastery(data).entries.color.mastered,false);
});
