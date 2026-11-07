// Share one viewport budget across activities; keep natural scrolling below
// their readable minimum sizes and when help is expanded.
let pickerStart=0,previousSelection='',previousRange='';
export function mountLetterLayout(){
 const page=document.querySelector('.letters-page');if(!page)return ()=>{};
 const stage=page.querySelector('.letter-detail,.practice-shell,.listen-game,.letter-song');
 if(!stage)return ()=>{};
 let frame;
 const list=page.querySelector('.letter-picker');
 const cards=list?[...list.children]:[];
 const pager=document.createElement('div');pager.className='letter-picker-pages';pager.hidden=true;
 pager.innerHTML='<button type="button" class="button secondary small" aria-label="上一组字母">上一组</button><span aria-live="polite"></span><button type="button" class="button secondary small" aria-label="下一组字母">下一组</button>';
 if(list)list.after(pager);
 let capacity=cards.length;
 pager.firstElementChild.onclick=()=>{pickerStart=Math.max(0,pickerStart-capacity);measure();};
 pager.lastElementChild.onclick=()=>{pickerStart=Math.min(cards.length-1,pickerStart+capacity);measure();};
 const measure=()=>{
  frame=null;if(!page.isConnected)return;
  const footer=document.querySelector('.letters-shell .footer');
  const sources=page.querySelector('.audio-sources');
  const summary=sources?.querySelector('summary');
  const bottom=parseFloat(getComputedStyle(page).paddingBottom)||0;
  const help=summary?summary.getBoundingClientRect().height+(parseFloat(getComputedStyle(sources).marginTop)||0):0;
  const viewport=Math.min(innerHeight,visualViewport?.height||innerHeight);
  if(list){
   const selection=list.querySelector('[aria-pressed="true"]')?.dataset.letter||'';
   const range=cards.map(card=>card.querySelector('[data-letter]').dataset.letter).join('');
   const style=getComputedStyle(list),columns=style.gridTemplateColumns.split(' ').length;
   const wide=page.getBoundingClientRect().width>=781;
   const tile=list.querySelector('.letter-picker-card:not([hidden])');
   const tileHeight=tile?.getBoundingClientRect().height||88,gap=parseFloat(style.rowGap)||0;
   const room=viewport-list.getBoundingClientRect().top-window.scrollY-(footer?.getBoundingClientRect().height||0)-bottom-help-200-24-52;
   const rows=Math.max(1,Math.min(2,Math.floor((room+gap)/(tileHeight+gap))));
   const oldCapacity=capacity;
   capacity=wide&&cards.length>columns*2?columns*rows:cards.length;
   if(selection!==previousSelection||range!==previousRange||capacity!==oldCapacity)pickerStart=Math.max(0,cards.findIndex(card=>card.querySelector('[data-letter]').dataset.letter===selection));
   previousSelection=selection;previousRange=range;
   pickerStart=Math.floor(Math.min(pickerStart,cards.length-1)/capacity)*capacity;
   cards.forEach((card,index)=>{card.hidden=index<pickerStart||index>=pickerStart+capacity;});
   pager.hidden=capacity>=cards.length;
   pager.firstElementChild.disabled=pickerStart===0;
   pager.lastElementChild.disabled=pickerStart+capacity>=cards.length;
   pager.querySelector('span').textContent=`${pickerStart+1}–${Math.min(cards.length,pickerStart+capacity)} / ${cards.length}`;
  }
  const height=Math.max(0,Math.floor(viewport-stage.getBoundingClientRect().top-window.scrollY-(footer?.getBoundingClientRect().height||0)-bottom-help));
  const value=`${height}px`;
  if(page.style.getPropertyValue('--letter-stage-height')!==value)page.style.setProperty('--letter-stage-height',value);
 };
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
 const observer=new ResizeObserver(schedule);observer.observe(page);
 for(const child of page.children)observer.observe(child);
 addEventListener('resize',schedule);visualViewport?.addEventListener('resize',schedule);
 measure();
 return ()=>{observer.disconnect();cancelAnimationFrame(frame);pager.remove();removeEventListener('resize',schedule);visualViewport?.removeEventListener('resize',schedule);};
}
