// Course data is intentionally independent of game and scheduling code.
export const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const phonemes = ['a','b','k','d','E','f','g','h','I','dZ','k','l','m','n','A:','p','kw','r','s','t','V','v','w','ks','j','z'];
const ipa = ['æ','b','k','d','ɛ','f','ɡ','h','ɪ','dʒ','k','l','m','n','ɑ','p','kw','r','s','t','ʌ','v','w','ks','j','z'];
const examples = ['apple','ball','cat','dog','egg','fish','goat','hat','insect','jam','kite','leaf','moon','nest','ox','pig','queen','rabbit','sun','top','up','van','web','box','yes','zebra'];
const names=['eɪ','biː','siː','diː','iː','ɛf','dʒiː','eɪtʃ','aɪ','dʒeɪ','keɪ','ɛl','ɛm','ɛn','oʊ','piː','kjuː','ɑɹ','ɛs','tiː','juː','viː','dʌbəljuː','ɛks','waɪ','ziː'];
export const ALPHABET = LETTERS.map((upper, i) => ({
  upper, lower: upper.toLowerCase(), nameIpa:names[i], phoneme: phonemes[i], ipa: ipa[i], example: examples[i],
  nameAudio: `./assets/audio/name-${upper}.wav`,
  soundAudio: `./assets/audio/sound-${upper}.wav`,
  note: upper === 'Q' ? '这里示范 qu 常见的 /kw/，按课程确认后使用。' : upper === 'X' ? '这里示范 box 中 x 的 /ks/，不是字母名称。' : '这里只选一种基础读音；实际发音随单词和课程变化。',
}));
export const BLENDS = [
  { id:'ab', text:'ab', letters:['A','B'], phonemes:'ab', label:'两音组合', word:false },
  { id:'ba', text:'ba', letters:['B','A'], phonemes:'ba', label:'两音组合', word:false },
  { id:'de', text:'de', letters:['D','E'], phonemes:'dE', label:'两音组合', word:false },
  { id:'deb', text:'deb', letters:['D','E','B'], phonemes:'dEb', label:'三音组合', word:false },
  { id:'cat', text:'cat', letters:['C','A','T'], phonemes:'kat', label:'cat · 猫', word:true },
  { id:'mat', text:'mat', letters:['M','A','T'], phonemes:'mat', label:'mat · 垫子', word:true },
  { id:'sat', text:'sat', letters:['S','A','T'], phonemes:'sat', label:'sat · 坐下的过去式', word:true },
  { id:'pin', text:'pin', letters:['P','I','N'], phonemes:'pIn', label:'pin · 别针', word:true },
  { id:'sun', text:'sun', letters:['S','U','N'], phonemes:'sVn', label:'sun · 太阳', word:true },
];
export const byLetter = letter => ALPHABET.find(item => item.upper === letter);
export const audioPath = (letter, mode = 'name') => `./assets/audio/${mode}-${letter}.wav`;
export const SKILL_LABELS = { pair:'大小写配对', name:'听名称辨认', sound:'听字母音辨认', recallName:'独立读名称', recallSound:'独立读字母音' };
export const PROMPTS={welcome:'欢迎来到字母小花园。我们一起玩一小会儿。',demo:'来，先听字母的名字。',letterSound:'再听听它的字母音。',pairUpper:'它的小写朋友在哪里？找找看。',pairLower:'它的大写朋友在哪里？找找看。',chooseName:'听听名字，找找是哪一个。',chooseSound:'听听字母音，找找是哪一个。',recallName:'还记得它的名字吗？试着说说看。',recallSound:'它会发什么声音呢？试着说说看。',blend:'先听每个声音，再把它们连起来。',help:'没关系，我们一起听听。',correct:'对啦，找到它了。',finish:'今天先玩到这里，下次见。',pause:'先歇一会儿，准备好了再继续。'};
