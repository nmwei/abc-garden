// Pure validation used by the compiler and regression tests.
export function validateGuidedPlans(words,document,scenes,profiles,meaning){
 if(document.version!==1||!Array.isArray(document.entries))throw Error('Invalid guided activity registry');
 const catalog=new Map(words.map(word=>[word.id,word])),plans={},stale=[];
 const fields=new Set(['focus','modelText','modelZh','scene','setup','teach','listen','recall','transfer','contextual','extension']);
 for(const entry of document.entries){
  const word=catalog.get(entry.id);
  if(!word||plans[entry.id]||!Object.hasOwn(profiles,entry.profile)||entry.sense!==word.zh||!entry.focus?.trim())throw Error('Invalid guided activity plan: '+entry.id);
  const current={zh:word.zh,pos:word.pos||'',sentence:word.sentence,sentenceZh:word.sentenceZh||meaning(word.sentence)};
  if(!Object.entries(current).every(([key,value])=>entry.snapshot?.[key]===value))stale.push(entry.id);
  const scene=scenes[entry.id]||{};
  if(!Object.entries(scene).every(([key,value])=>fields.has(key)&&(key==='contextual'||key==='extension'?typeof value==='boolean':typeof value==='string'&&value.trim())))throw Error('Invalid guided scene: '+entry.id);
  if(scene.modelText&&!scene.modelZh)throw Error('Missing Chinese model: '+entry.id);
  plans[entry.id]={profile:entry.profile,focus:entry.focus,...scene};
 }
 for(const id of Object.keys(scenes))if(!plans[id])throw Error('Orphan guided scene: '+id);
 const missing=[...catalog.keys()].filter(id=>!plans[id]);
 if(missing.length||stale.length)throw Error(`Guided activities require content review. Missing: ${missing.join(', ')}; changed meanings/examples: ${stale.join(', ')}`);
 return plans;
}
