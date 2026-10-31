import {sentenceMeaning} from './sentence-meanings.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function sentenceCreditDetails(word){
 const match=word.sentenceCredit?.match(/#(\d+) \((.+)\) & #(\d+) \((.+)\)$/);
 if(!match)return '';
 return `<details class="sentence-credit micro"><summary>例句来源</summary><p><a href="https://tatoeba.org/en/sentences/show/${match[1]}" target="_blank" rel="noopener noreferrer">${esc(match[2])} · 英文原句</a> / <a href="https://tatoeba.org/en/sentences/show/${match[3]}" target="_blank" rel="noopener noreferrer">${esc(match[4])} · 中文原句</a>，由 <a href="https://www.manythings.org/anki/" target="_blank" rel="noopener noreferrer">ManyThings</a> 整理。<a href="https://creativecommons.org/licenses/by/2.0/fr/" target="_blank" rel="noopener noreferrer">CC BY 2.0 FR</a>。${word.sentenceAdapted?'本卡已转换简体、修订或改写。':''}发音为本地合成示范。</p></details>`;
}

// Both sources share the same presentation; each keeps its own audio actions.
export function wordCardBody({word,zh,pos,image,sentence,sentenceZh,action,listenWord,listenSentence}){
 const meaning=sentenceZh??sentenceMeaning(sentence);
 return `${image?`<img class="word-picture" src="${esc(image)}" alt="${esc(zh||'')}" width="128" height="128" decoding="async">`:''}<h2 class="english-word">${esc(word)}</h2>${pos?`<p class="micro">${esc(pos)} · 本例用法</p>`:''}${zh?`<p>${esc(zh)}</p>`:''}<div class="button-row centered">${listenWord}${sentence?listenSentence:''}</div>${sentence?`<p class="sentence">${esc(sentence)}</p>${meaning?`<p class="sentence-meaning">${esc(meaning)}</p>`:''}`:''}${action?`<p class="micro">${esc(action)}</p>`:''}`;
}
