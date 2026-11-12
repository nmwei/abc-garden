import {DATA} from './learning-data.js';
import {cleanWeekly} from './module-content.js';
import {sanitizeState} from './core.js';
import {cleanMastery} from './mastery-records.js';
import {restoreGuidedProgress} from './guided-records.js';
import {restoreLetterLearning} from './letter-records.js';
import {CATALOG_BY_ID} from './course-content.js';
const ids=new Set(CATALOG_BY_ID.keys());
// Defaults may fill absent optional fields; saved values may never be erased,
// truncated or silently changed by a business reader after validation succeeds.
function preserved(source, loaded, path) {
  if (Array.isArray(source)) {
    if (!Array.isArray(loaded)||source.length!==loaded.length) throw Error(`${path} 无法完整恢复`);
  } else if (source && typeof source==='object') {
    if (!loaded || typeof loaded!=='object') throw Error(`${path} 无法完整恢复`);
  } else {
    if (source!==loaded) throw Error(`${path} 的值无法完整恢复`);
    return;
  }
  for (const key of Object.keys(source)) preserved(source[key],loaded[key],`${path}.${key}`);
}
export function validateBusinessValue(key, data) {
  let restored;
  if (key===DATA.content) {
    const fields=['title','letters','repeats','gap','blends','words','wordMeanings','sentenceTranslations','selectedWordIds'];
    if(Object.keys(data).some(k=>!fields.includes(k))) throw Error('学习内容包含未知字段');
    restored=cleanWeekly(data);
    if(data.selectedWordIds && (!Array.isArray(data.selectedWordIds)||new Set(data.selectedWordIds).size!==data.selectedWordIds.length||data.selectedWordIds.some(id=>!ids.has(id)))) throw Error('学习范围包含无效单词');
  } else if (key===DATA.preferences) {
    if(Object.keys(data).some(k=>!['version','settings'].includes(k))) throw Error('学习偏好包含未知字段');
    const state=sanitizeState(data);
    restored={version:1,settings:state.settings};
  } else if (key===DATA.mastery) restored=cleanMastery(data);
  else if (key===DATA.words || key===DATA.letters) {
    const result=key===DATA.words?restoreGuidedProgress(data,ids):restoreLetterLearning(data);
    if (result.issue) throw Error('陪学记录无法完整恢复：'+result.issue);
    restored=result.data;
  }
  if(restored) preserved(data,restored,key);
}
