import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '../../garden-platform/packages/account/browser/client.js';
test('cross-site session refresh preserves unsynced retained data and guest edits during the fetch',async t=>{
 const names=['fetch','location','navigator','addEventListener','dispatchEvent','setInterval'];
 const original=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]));
 t.after(()=>{for(const [n,d]of original)d?Object.defineProperty(globalThis,n,d):delete globalThis[n];});
 let snapshot={version:1,subject:'reading',data:{}},retained=null,activated=0,afterSession;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 Object.assign(globalThis,{location:{reload(){}},addEventListener(){},dispatchEvent(){},setInterval(){},fetch:async url=>{
  if(url.endsWith('/session'))return Response.json({account:{id:'a',profileId:'p'}});
  afterSession?.();return Response.json({revision:3,snapshot:{version:1,subject:'reading',data:{}},updatedAt:1});
 }});
 const storage={captureArchive:()=>snapshot,flushStorage:async()=>{},storageWritable:()=>true,localAccount:()=>({owner:'guest'}),retainedArchive:()=>retained,activateArchive:()=>activated++};
 const client=createClient({subject:'reading',storage,validateRestore:s=>s});
 retained={dirty:'pending',snapshot:{version:1,subject:'reading',data:{retained:true}}};
 await client.refreshAccount();assert.equal(activated,0);assert.equal(client.accountState.pending.local.data.retained,true);
 retained=null;client.accountState.pending=null;
 afterSession=()=>{snapshot={version:1,subject:'reading',data:{newEdit:true}};};
 await client.refreshAccount();assert.equal(activated,0);assert.equal(client.accountState.pending.local.data.newEdit,true);
});
