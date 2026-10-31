// Hold activation is cancelled by release, dragging away, focus loss or tab hiding.
export function mountParentHold(button,onEnter){
 let timer=null,origin=null;
 const cancel=()=>{clearTimeout(timer);timer=null;origin=null;button.classList.remove('holding');};
 const start=()=>{if(timer)return;button.classList.add('holding');timer=setTimeout(()=>{cancel();if(button.isConnected&&!document.hidden)onEnter();},1000);};
 button.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;e.preventDefault();origin={x:e.clientX,y:e.clientY,id:e.pointerId};button.setPointerCapture(e.pointerId);start();});
 button.addEventListener('pointermove',e=>{if(!origin)return;const r=button.getBoundingClientRect();if(Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>12||e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cancel();});
 for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])button.addEventListener(event,cancel);
 button.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)start();}});
 button.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();cancel();}});
 button.addEventListener('contextmenu',e=>e.preventDefault());
 const hidden=()=>{if(document.hidden)cancel();};document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',cancel);
 return ()=>{cancel();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',cancel);};
}
