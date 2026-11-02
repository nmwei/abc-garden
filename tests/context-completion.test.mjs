import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditCompletion} from '../scripts/audit-context-completion.mjs';
const plan=JSON.parse(await readFile(new URL('../data/vocabulary/context-completion-plan.json',import.meta.url)));
test('completion review rejects lost scope, duplicate entries and changes in the reviewed meaning',async()=>{
 const lost=structuredClone(plan);lost.baselineIds.pop();
 await assert.rejects(auditCompletion(lost),/Invalid completion baseline/);
 const changed=structuredClone(plan);changed.batches[0].cards[0].sentenceZh='不同的含义';
 await assert.rejects(auditCompletion(changed),/Re-review after: changed sentenceZh/);
 const duplicate=structuredClone(plan);duplicate.batches[0].cards.splice(1,0,duplicate.batches[0].cards[0]);
 await assert.rejects(auditCompletion(duplicate),/Duplicate or out-of-scope card: after/);
});
