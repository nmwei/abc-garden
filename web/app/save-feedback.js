import {learningStorage} from './account-storage.js';
const pending = new WeakMap();
// A business edit is synchronous; durable acknowledgement is explicitly async.
// Ignore an old acknowledgement when the same control has since changed again.
export function showSaveResult(target, field, success, render=()=>{}, storage=learningStorage) {
  const token = Symbol();
  const fields=pending.get(target)||new Map();
  pending.set(target,fields); fields.set(field,token);
  target[field]='正在保存到本机…';
  const done = text => {
    if(fields.get(field)!==token) return;
    target[field]=text; render();
  };
  Promise.resolve().then(()=>storage.whenSaved?.()).then(
    ()=>done(success),
    ()=>done('本机保存失败，请保留页面并重试。'),
  );
}
