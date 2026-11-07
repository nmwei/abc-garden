export const LETTER_AUDIO_SOURCES = [
  {id:'gk',label:'培训班录音（GK）',description:'使用培训班的整套名称音和字母音。',original:'./assets/audio/gk/source.mp3'},
  {id:'edcreate',label:'EdCreate 录音',description:'使用 EdCreate 的整套名称音和字母音。',original:'./assets/audio/edcreate/source.mp3'},
];
export const normalizeLetterSource = value => value === 'gk' ? 'gk' : 'edcreate';
export const letterSourceInfo = value => LETTER_AUDIO_SOURCES.find(source=>source.id===normalizeLetterSource(value));

// All letter playback resolves here; unrelated word/example audio keeps its own path.
export function letterAudioPath(key,source='edcreate',{single=false}={}){
  if(!/^(name|sound)-[A-Z]$/.test(key))return null;
  source=normalizeLetterSource(source);
  const folder=source==='gk'?'gk/':single?'edcreate/':'';
  return `./assets/audio/${folder}${single?'single-':''}${key}.wav`;
}
