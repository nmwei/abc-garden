// A semantic revision is deliberately separate from the build/content fingerprint.
// Punctuation and spacing do not change a sense; changed wording is conservative.
const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu,'');
export const guidedSense=word=>JSON.stringify([normalize(word.zh),normalize(word.pos)]);

export function reconcileGuidedSenses(data,revisions,at){
 const changed=[];
 for(const {id,sense,baseline=sense} of revisions){
  const known=Object.hasOwn(data.contentRevisions,id);
  const previous=known?data.contentRevisions[id]:baseline;
  if(previous!==sense){
   changed.push(id);
   if(Object.hasOwn(data.entries,id)){
    data.archivedEntries.push({id,sense:known?previous:'legacy:unknown',archivedAt:at,entry:structuredClone(data.entries[id])});
    delete data.entries[id];
   }
  }
  Object.defineProperty(data.contentRevisions,id,{value:sense,enumerable:true,writable:true,configurable:true});
 }
 if(data.session?.words.some(id=>changed.includes(id)))data.session=null;
 if(data.parked?.session?.words.some(id=>changed.includes(id)))data.parked.session=null;
 return changed;
}
