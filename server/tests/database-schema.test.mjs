import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDatabase} from '../database.mjs';

test('new databases directly use the current schema and unsupported versions remain untouched',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'garden-schema-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const current=openDatabase(join(dir,'current.sqlite'));
 assert.equal(current.pragma('user_version',{simple:true}),3);
 assert.ok(current.prepare("SELECT name FROM sqlite_master WHERE name='archive_checkpoints'").get());
 assert.equal(current.prepare("SELECT name FROM sqlite_master WHERE name='archive_history'").get(),undefined);
 current.close();
 for(const version of [1,2,4]){
  const path=join(dir,version+'.sqlite'),db=new Database(path);
  db.exec('CREATE TABLE original(value TEXT); INSERT INTO original VALUES (\'preserved\')');db.pragma('user_version = '+version);db.close();
  assert.throws(()=>openDatabase(path),/不受支持/);
  const after=new Database(path);assert.equal(after.pragma('user_version',{simple:true}),version);assert.equal(after.prepare('SELECT value FROM original').get().value,'preserved');after.close();
 }
});
