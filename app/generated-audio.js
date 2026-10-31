const dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('abc-generated-audio',1);req.onupgradeneeded=()=>req.result.createObjectStore('clips');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
// Attach an observer immediately; unavailable storage is surfaced when generation is requested.
dbPromise.catch(()=>{});
export const speechId=request=>JSON.stringify({version:1,...request});
export async function readClip(id){const db=await dbPromise;return new Promise((resolve,reject)=>{const req=db.transaction('clips').objectStore('clips').get(id);req.onsuccess=()=>{const value=req.result;resolve(value instanceof ArrayBuffer?new Blob([value],{type:'audio/wav'}):value);};req.onerror=()=>reject(req.error||new Error('无法读取音频存储'));});}
export async function storeClip(id,blob){const db=await dbPromise,bytes=await blob.arrayBuffer();return new Promise((resolve,reject)=>{const tx=db.transaction('clips','readwrite');tx.objectStore('clips').put(bytes,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('设备无法保存音频，请检查可用存储空间'));tx.onabort=()=>reject(tx.error||new Error('设备无法保存音频，请检查可用存储空间'));});}
export async function generateClip(request,signal){
 const response=await fetch('./api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});
 if(response.status===404||response.status===405||(response.ok&&!response.headers.get('content-type')?.includes('audio/wav'))){
  const error=new Error('当前站点未提供英文音频生成服务，重试无法补齐这些音频。');error.code='SPEECH_UNAVAILABLE';throw error;
 }
 if(!response.ok)throw Error('生成失败，请稍后重试。');
 const blob=await response.blob();await storeClip(speechId(request),blob);return blob;
}
