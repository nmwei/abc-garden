import {pageUrl} from './routes.js';
export function watchSiteUpdates(registration,{beforeUpdate=()=>true,busy=()=>false,notify=()=>{},onState=()=>{},showBanner=true}={}){
 let returnHome=false,activationTimer;
 let checking=false,applying=false;
 let requested=false,reloading=false,changed=false,controlled=!!navigator.serviceWorker.controller;
 const banner=document.createElement('div');banner.className='site-update';banner.hidden=true;
 banner.innerHTML='<span role="status">新版已准备好，方便时点击更新。</span><button type="button" class="button secondary small">点击更新</button>';
 if(showBanner)document.body.append(banner);const button=banner.querySelector('button'),status=banner.querySelector('span');
 const report=text=>{status.textContent=text;notify(text);};
 const reloadPage=()=>{
  clearTimeout(activationTimer);reloading=true;
  if(returnHome)history.replaceState(null,'',pageUrl('home'));
  location.reload();
 };
 const publish=()=>onState({ready:Boolean(registration.waiting)||changed,busy:checking||applying||requested});
 const show=()=>{
  if(registration.waiting||changed)banner.hidden=false;
  publish();
 };
 const inspect=()=>{const worker=registration.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)show();});show();};
 registration.addEventListener('updatefound',inspect);inspect();
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!controlled){controlled=true;return;}
  if(requested&&!reloading){reloadPage();return;}
  // Another tab may have applied the update. Never reload this learner's page automatically.
  changed=true;show();
 });
 const apply=async(toHome=false)=>{
  if(checking||requested||applying)return;
  if(busy()){report('离线素材正在处理，请完成或暂停下载后再重新加载。');return;}
  applying=true;button.disabled=true;publish();
  try{
   const worker=navigator.serviceWorker.controller;
   if(worker){const state=await new Promise((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();reject(Error('暂时无法检查下载状态，请稍后重试。'));},5000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};worker.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);});if(state.error)throw Error(state.error);if(state.downloading)throw Error('另一个页面正在下载素材，请完成或暂停后再更新。');}
   if(!beforeUpdate()){button.disabled=false;return;}
   returnHome=toHome;requested=true;report('正在重新加载…');
   if(registration.waiting){
    activationTimer=setTimeout(()=>{
     requested=false;button.disabled=false;report('暂时无法启用新版，请稍后重试。');publish();
    },15000);
    registration.waiting.postMessage({type:'APPLY_UPDATE'});
   }else reloadPage();
  }catch(error){clearTimeout(activationTimer);requested=false;report(error.message);button.disabled=false;}finally{applying=false;publish();}
 };
 button.addEventListener('click',()=>apply());
 const checkNow=async()=>{
  if(checking||applying||requested)return;
  if(!navigator.onLine){report('当前未联网，请联网后检查更新。');return;}
  checking=true;publish();report('正在检查更新…');
  try{
   await registration.update();
   const worker=registration.installing;
   if(worker)await new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timer);worker.removeEventListener('statechange',inspectState);error?reject(error):resolve();};
    const inspectState=()=>{if(['installed','activated'].includes(worker.state))finish();else if(worker.state==='redundant')finish(Error('新版未能准备好，请稍后重试。'));};
    const timer=setTimeout(()=>finish(Error('检查更新超时，请稍后重试。')),30000);
    worker.addEventListener('statechange',inspectState);inspectState();
   });
   show();report(registration.waiting||changed?'新版已准备好，点击“重新加载并回首页”启用。':'当前已是最新版本。');
  }catch{report('暂时无法确认更新，请检查网络后重试。');}finally{checking=false;publish();}
 };
 const check=()=>{if(!document.hidden&&navigator.onLine)registration.update().catch(()=>{});};
 window.addEventListener('focus',check);window.addEventListener('online',check);
 return {check:checkNow,reload:apply};
}
