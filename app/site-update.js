export function watchSiteUpdates(registration,{beforeUpdate=()=>true,busy=()=>false}={}){
 let requested=false,reloading=false,changed=false,controlled=!!navigator.serviceWorker.controller;
 const banner=document.createElement('div');banner.className='site-update';banner.hidden=true;
 banner.innerHTML='<span role="status">新版已准备好，方便时点击更新。</span><button type="button" class="button secondary small">点击更新</button>';
 document.body.append(banner);const button=banner.querySelector('button'),status=banner.querySelector('span');
 const show=()=>{if(registration.waiting||changed)banner.hidden=false;};
 const inspect=()=>{const worker=registration.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)show();});show();};
 registration.addEventListener('updatefound',inspect);inspect();
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!controlled){controlled=true;return;}
  if(requested&&!reloading){reloading=true;location.reload();return;}
  // Another tab may have applied the update. Never reload this learner's page automatically.
  changed=true;show();
 });
 button.addEventListener('click',async()=>{
  if(requested)return;
  if(busy()){status.textContent='离线素材正在下载，请完成或暂停下载后再更新。';return;}
  button.disabled=true;
  try{
   const worker=navigator.serviceWorker.controller;
   if(worker){const state=await new Promise((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();reject(Error('暂时无法检查下载状态，请稍后重试。'));},5000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};worker.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);});if(state.error)throw Error(state.error);if(state.downloading)throw Error('另一个页面正在下载素材，请完成或暂停后再更新。');}
   if(!beforeUpdate()){button.disabled=false;return;}
   requested=true;status.textContent='正在更新…';
   if(registration.waiting)registration.waiting.postMessage({type:'APPLY_UPDATE'});
   else{reloading=true;location.reload();}
  }catch(error){status.textContent=error.message;button.disabled=false;}
 });
 const check=()=>{if(!document.hidden&&navigator.onLine)registration.update().catch(()=>{});};
 window.addEventListener('focus',check);window.addEventListener('online',check);
}
