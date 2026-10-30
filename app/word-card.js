import {sentenceMeaning} from './sentence-meanings.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Both sources share the same presentation; each keeps its own audio actions.
export function wordCardBody({word,zh,image,sentence,sentenceZh,action,listenWord,listenSentence}){
 const meaning=sentenceZh??sentenceMeaning(sentence);
 return `${image?`<img class="word-picture" src="${esc(image)}" alt="${esc(zh||'')}" width="128" height="128" decoding="async">`:''}<h2 class="english-word">${esc(word)}</h2>${zh?`<p>${esc(zh)}</p>`:''}<div class="button-row centered">${listenWord}${sentence?listenSentence:''}</div>${sentence?`<p class="sentence">${esc(sentence)}</p>${meaning?`<p class="sentence-meaning">${esc(meaning)}</p>`:''}`:''}${action?`<p class="micro">${esc(action)}</p>`:''}`;
}
