const mb=n=>(n/1024/1024).toFixed(1);
export class OfflineLibrary {
 constructor(toast){this.toast=toast;this.state={ready:false,packs:[],recentBytes:0};this.packs=[];this.busy=false;this.message='';this.failed=false;this.warmed=false;this.plan=null;this.progress=null;}
 get label(){return this.state.ready?(this.state.allReady?'全部学习内容已可离线':'页面已可离线 · 素材按需保存'):this.failed?'离线页面尚未准备好，可先联网使用':'正在准备轻量离线页面…';}
 editor(){return `<section class="panel parent-section" id="parent-tools" aria-labelledby="offline-title"><h2 id="offline-title">离线使用</h2><div><p>出门前下载全部学习内容，断网也能听和学。</p><p id="offline-stats" class="micro">${this.stats()}</p><div class="button-row"><button class="button primary" id="offline-download" data-action="offline-download" ${this.busy||this.state.allReady?'disabled':''}>${this.downloadLabel()}</button><button class="button secondary" id="offline-clear" data-action="offline-clear" ${this.busy?'disabled':''}>清理离线素材</button></div><div id="offline-plan">${this.planHtml()}</div><progress id="offline-bar" aria-label="离线下载进度" max="${this.progress?.totalBytes||1}" value="${this.progress?.doneBytes||0}" ${this.progress?'':'hidden'}></progress><p id="offline-progress" role="status">${this.message}</p><button class="button secondary small" id="offline-cancel" data-action="offline-cancel" ${this.busy&&this.progress?'':'hidden'}>暂停下载</button><p class="micro offline-note">下载时保持页面打开，中断后可以继续，不重复下载。清理素材不会删除掌握记录、添加的单词和自定义音频。</p><section class="offline-help" aria-labelledby="offline-help-title"><h3 id="offline-help-title">离线使用说明</h3><p class="micro">家长添加的词请先准备发音。浏览器清理网站数据或网站更新后，可能需要重新下载；出门前可以检查这里的下载状态。iPad可通过Safari分享菜单“添加到主屏幕”。</p></section></div></section>`;}
 downloadLabel(){return this.busy?'正在处理…':this.state.allReady?'全部内容已下载':this.state.pending?.includes('all')?'继续下载':'下载全部内容';}
 stats(){const total=this.packs.find(p=>p.id==='all');return `${total?`全部内容约 ${mb(total.bytes)} MiB · `:''}已保存 ${mb(this.state.mediaBytes||0)} MiB。`+(this.state.allReady?'已可完整离线使用。':'平时联网使用，不需要下载。');}
 planHtml(){
  const p=this.plan;if(!p)return '';
  return `<section class="offline-estimate" aria-label="下载空间评估"><h3>${p.title}</h3><p>内容总大小 ${mb(p.totalBytes)} MiB · 已保存 ${mb(p.savedBytes)} MiB · 本次需下载 ${mb(p.neededBytes)} MiB</p><p class="micro">${p.available===null?'浏览器未提供可用配额，无法预先确认是否足够。':`浏览器估算本站可用配额 ${mb(p.available)} MiB，下载后约剩 ${mb(Math.max(0,p.available-p.neededBytes))} MiB。` }这是本站存储配额估计，不是设备总剩余空间；实际占用含额外开销。</p>${p.insufficient?'<p role="alert">可用配额不足或余量过小，请先清理设备空间，或继续联网使用。</p>':''}<div class="button-row"><button class="button primary" data-action="offline-confirm" ${p.insufficient||this.busy?'disabled':''}>确认下载${p.id==='all'?'全部内容':''}</button><button class="button secondary" data-action="offline-dismiss" ${this.busy?'disabled':''}>暂不下载</button></div></section>`;
 }
 paint(){
  const label=document.querySelector('#offline-label');if(label)label.textContent=this.label;
  document.querySelector('.offline-dot')?.classList.toggle('ready',this.state.ready);
  const stats=document.querySelector('#offline-stats');if(stats)stats.textContent=this.stats();
  const progress=document.querySelector('#offline-progress');if(progress)progress.textContent=this.message;
  const plan=document.querySelector('#offline-plan');if(plan)plan.innerHTML=this.planHtml();
  const bar=document.querySelector('#offline-bar');if(bar){bar.hidden=!this.progress;bar.max=this.progress?.totalBytes||1;bar.value=this.progress?.doneBytes||0;}
  const cancel=document.querySelector('#offline-cancel');if(cancel)cancel.hidden=!(this.busy&&this.progress);
  for(const id of ['offline-download','offline-clear']){const button=document.getElementById(id);if(button)button.disabled=this.busy||!this.state.ready||(id==='offline-download'&&this.state.allReady);}
  const button=document.querySelector('#offline-download');if(button)button.textContent=this.downloadLabel();
 }
 async send(type,data={},onProgress){
  const registration=await navigator.serviceWorker.ready,worker=registration.active;if(!worker)throw Error('离线页面尚未准备好，请稍后再试。');
  return new Promise((resolve,reject)=>{
   const channel=new MessageChannel();let timer;
   const close=()=>{clearTimeout(timer);channel.port1.close();};
   const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{close();reject(Error('等待离线操作超时，请检查网络后再试。'));},60000);};arm();
   channel.port1.onmessage=event=>{const result=event.data;if(result.progress!==undefined){arm();onProgress?.(result);return;}close();if(result.error)reject(Error(result.error));else resolve(result);};
   worker.postMessage({type,...data},[channel.port2]);
  });
 }
 async check(){try{const result=await this.send('CHECK_OFFLINE');this.state=result;this.failed=false;this.paint();}catch{this.failed=true;this.paint();}}
 async warmVisiblePictures(){
  if(this.warmed||!navigator.serviceWorker.controller)return;this.warmed=true;
  // First-page images can finish before the new worker takes control. Save only those already displayed.
  const urls=[...new Set([...document.images].filter(img=>img.complete&&img.naturalWidth>0&&new URL(img.src).origin===location.origin&&new URL(img.src).pathname.includes('/assets/pictures/')).map(img=>img.src))];
  await Promise.allSettled(urls.map(url=>fetch(url)));
 }
 async init(){
  if(!('serviceWorker' in navigator)){this.failed=true;this.message='当前浏览器不支持设备离线，可以联网使用。';this.paint();return;}
  const wasControlled=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{this.check();this.warmVisiblePictures();});
  try{
   await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
   this.packs=await fetch('./offline-packs.json').then(r=>r.json());
   await this.check();if(!wasControlled)await this.warmVisiblePictures();
  }catch{this.failed=true;this.message='离线页面尚未准备好，可以先联网使用。';this.paint();}
 }
 async prepare(id){
  if(this.busy)return;this.busy=true;this.plan=null;this.progress=null;this.message='正在检查已保存内容与可用空间…';this.paint();
  try{
   const plan=await this.send('PLAN_PACK',{id});let estimate;
   try{estimate=await navigator.storage?.estimate?.();}catch{}
   const available=Number.isFinite(estimate?.quota)&&Number.isFinite(estimate?.usage)?Math.max(0,estimate.quota-estimate.usage):null;
   const margin=Math.max(10*1024*1024,plan.neededBytes*.1);
   this.plan={...plan,available,insufficient:plan.neededBytes>0&&available!==null&&available<plan.neededBytes+margin};
   this.message=plan.neededBytes===0?'所选素材已齐全；确认后会保留供离线使用，不重复下载。':'核对空间后，点击确认开始下载。';
  }catch(error){this.message=error.message;}finally{this.busy=false;this.paint();}
 }
 async download(){
  if(this.busy||!this.plan||this.plan.insufficient)return;const plan=this.plan;
  this.busy=true;this.progress={doneBytes:plan.savedBytes,totalBytes:plan.totalBytes};this.message='正在准备下载…';this.paint();
  try{
   // Persistence is best effort; lack of permission never masquerades as a guarantee.
   try{Promise.resolve(navigator.storage?.persist?.()).catch(()=>{});}catch{}
   this.state=await this.send('DOWNLOAD_PACK',{id:plan.id},p=>{this.progress=p;this.message=`${plan.title}：${Math.floor(p.doneBytes/p.totalBytes*100)}% · ${mb(p.doneBytes)}/${mb(p.totalBytes)} MiB · ${p.progress}/${p.total} 份`;this.paint();});
   this.message=this.state.cancelled?'下载已暂停，已完成部分保留，下次可继续。':`${plan.title}已下载并校验，可以断网练习。`;this.plan=null;
  }catch(error){this.message=error.message;await this.check();}finally{this.busy=false;this.paint();}
 }
 async cancel(){try{await this.send('CANCEL_DOWNLOAD');this.message='正在暂停，请稍候…';this.paint();}catch(error){this.toast(error.message);}}
 async clear(){
  if(this.busy)return;this.busy=true;this.plan=null;this.progress=null;this.paint();
  try{this.state=await this.send('CLEAR_MEDIA');this.message='已清理素材缓存；掌握状态、家长设置和自定义音频已保留。';}
  catch(error){this.message=error.message;}finally{this.busy=false;this.paint();}
 }
}
