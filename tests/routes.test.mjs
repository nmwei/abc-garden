import test from 'node:test';
import assert from 'node:assert/strict';
import {pageUrl} from '../web/app/routes.js';
test('home preserves root/subpath and query without a redundant hash',()=>{
 for(const pathname of ['/','/abc-garden/']){
  const location={pathname,search:'?offline-test=1'};
  assert.equal(pageUrl('home',location),pathname+'?offline-test=1');
  assert.equal(pageUrl('letters-together',location),pathname+'?offline-test=1#/letters-together');
 }
});
