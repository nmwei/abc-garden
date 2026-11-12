// One inventory for persistence scope, current format and cloud projection.
// New learning data must be registered here before a business module can write it.
export const DATA = Object.freeze({
  content: 'abc-module-content-v1',
  mastery: 'abc-garden-mastery-v1',
  words: 'abc-garden-guided-words-v1',
  letters: 'abc-garden-guided-letters-v1',
  wordSettings: 'abc-garden-guided-settings-v1',
  letterSettings: 'abc-garden-guided-letters-settings-v1',
  preferences: 'abc-garden-preferences-v2',
  listening: 'abc-listen-game-options-v1',
  chineseVoice: 'abc-garden-chinese-voice-v1',
  englishVoice: 'abc-garden-english-voice-v1',
  englishRate: 'abc-garden-english-rate-v1',
});
const account = (version, excluded = []) => Object.freeze({scope:'account', version, excluded:Object.freeze(excluded)});
const device = Object.freeze({scope:'device'});
export const DATA_DEFINITIONS = Object.freeze({
  [DATA.content]: account(null, ['clips']),
  [DATA.mastery]: account(1),
  [DATA.words]: account(8),
  [DATA.letters]: account(1),
  [DATA.wordSettings]: account(1),
  [DATA.letterSettings]: account(1),
  [DATA.preferences]: account(1, ['customAudio']),
  [DATA.listening]: account(1),
  [DATA.chineseVoice]: device,
  [DATA.englishVoice]: device,
  [DATA.englishRate]: device,
});
export const ARCHIVE_KEYS = Object.freeze(Object.keys(DATA_DEFINITIONS).filter(key=>DATA_DEFINITIONS[key].scope==='account'));
export const WORD_SETTING_CHOICES = Object.freeze({newWordsPerGroup:Object.freeze([2,3,4,5,6]),breakAfterMinutes:Object.freeze([10,15,20])});
export const LETTER_SETTING_CHOICES = Object.freeze({newLettersPerGroup:Object.freeze([1,2,3,4]),breakAfterMinutes:Object.freeze([10,15,20])});
export const LISTEN_DEFAULTS = Object.freeze({mode:'name',letterCase:'upper',kind:'practice',vowels:true,effects:true});
export const LISTEN_CHOICES = Object.freeze({mode:Object.freeze(['name','sound']),letterCase:Object.freeze(['upper','lower']),kind:Object.freeze(['practice','game'])});
export function definition(key, scope='account') {
  const value=DATA_DEFINITIONS[key];
  if (!value || value.scope!==scope) throw Error('未注册的存储字段：'+key);
  return value;
}
export function projectLearningValue(key, value) {
  const {excluded}=definition(key);
  if(!value || typeof value!=='object' || Array.isArray(value)) throw Error('学习记录必须是对象');
  return Object.fromEntries(Object.entries(value).filter(([field])=>!excluded.includes(field)));
}
