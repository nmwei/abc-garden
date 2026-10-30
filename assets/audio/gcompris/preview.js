const audio=document.querySelector('#preview');
const status=document.querySelector('#status');
let queue=[],generation=0;
function highlight(letter){for(const button of document.querySelectorAll('.letter'))button.setAttribute('aria-pressed',String(button.dataset.letter===letter));}
function stop(){generation++;queue=[];audio.pause();audio.removeAttribute('src');audio.load();highlight(null);}
function next(){
  const clip=queue.shift();
  if(!clip){highlight(null);status.textContent='播放结束，可以再点一个字母听听。';return;}
  const current=generation;
  highlight(clip.letter);status.textContent=`正在播放 ${clip.letter} ${clip.letter.toLowerCase()} 的名称`;
  audio.src=clip.file;
  audio.play().catch(()=>{if(current!==generation)return;stop();status.textContent='暂时无法播放，请联网后重试。';});
}
function start(clips){stop();queue=[...clips];next();}
audio.addEventListener('ended',next);
document.querySelector('#stop').onclick=()=>{stop();status.textContent='已停止。';};
window.addEventListener('pagehide',stop);
try{
  const response=await fetch('./manifest.json');if(!response.ok)throw Error('Manifest unavailable');
  const {clips}=await response.json();
  for(const clip of clips){
    const button=document.createElement('button');button.className='letter';button.dataset.letter=clip.letter;
    button.setAttribute('aria-label',`试听 ${clip.letter} ${clip.letter.toLowerCase()} 名称`);button.setAttribute('aria-pressed','false');
    const glyph=document.createElement('strong');glyph.textContent=clip.letter+clip.letter.toLowerCase();
    const caption=document.createElement('span');caption.textContent='听名称';button.append(glyph,caption);
    button.onclick=()=>start([clip]);document.querySelector('#letters').append(button);
    const item=document.createElement('li'),link=document.createElement('a');link.href=`originals/${clip.original}`;link.textContent=`${clip.letter} · 原始录音`;item.append(link);document.querySelector('#sources').append(item);
  }
  document.querySelector('#all').disabled=false;document.querySelector('#all').onclick=()=>start(clips);
  status.textContent='26 个字母已准备好，点击单个试听，或按顺序播放。';
}catch{status.textContent='试听清单加载失败，请联网后重试。';}
