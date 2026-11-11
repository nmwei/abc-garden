// Shared storage boundary: engines decide learning, repositories prevent stale writes.
export class LearningProgressConflict extends Error {}
export function createLearningRepository({storage=()=>globalThis.localStorage,key}={}){
 if(typeof key!=='string'||!key)throw Error('学习进度需要独立的保存位置');
 return {
  load(){const raw=storage().getItem(key);return {raw,value:raw?JSON.parse(raw):null};},
  save(data,expectedRaw){
   const target=storage();if(target.getItem(key)!==expectedRaw)throw new LearningProgressConflict('另一页更新了进度');
   const raw=JSON.stringify(data);target.setItem(key,raw);return raw;
  },
 };
}
