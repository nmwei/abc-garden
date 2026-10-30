// Recordings never leave this device and are discarded when leaving an activity.
export class LocalRecorder {
 constructor(onChange){this.onChange=onChange;this.generation=0;this.url=null;this.recording=false;this.pending=false;}
 async start(){
  this.dispose();const generation=this.generation;
  if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder){this.onChange('当前环境不支持录音。可以直接说给家人听；iPad 录音请用 HTTPS 网站。');return;}
  this.pending=true;this.onChange('请允许使用麦克风，录音不会上传。');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.recorder=new MediaRecorder(stream);const chunks=[];
   this.recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   this.recorder.onstop=()=>{
    stream.getTracks().forEach(t=>t.stop());clearTimeout(this.timer);
    if(generation!==this.generation)return;
    this.recording=false;this.pending=false;
    const blob=new Blob(chunks,{type:this.recorder.mimeType});
    if(blob.size){this.url=URL.createObjectURL(blob);this.onChange('录好了。听听自己，再和示范比较。');}
    else this.onChange('没有录到声音，可以再试一次。');
   };
   this.recorder.onerror=()=>{this.dispose();this.onChange('录音遇到问题，可以直接说给家人听。');};
   this.recorder.start();this.recording=true;this.pending=false;
   this.timer=setTimeout(()=>this.stop(),60000);this.onChange('正在录音… 最长 60 秒，点停止即可回听。');
  }catch(error){console.warn('Recording could not start:',error.name,error.message);if(generation===this.generation){this.dispose();this.onChange('没有获得麦克风权限。仍可以跟读，或说给家人听。');}}
 }
 stop(){if(this.recorder?.state==='recording')this.recorder.stop();}
 dispose(){
  this.generation++;clearTimeout(this.timer);
  if(this.recorder?.state==='recording')this.recorder.stop();
  this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.recorder=null;
  if(this.url)URL.revokeObjectURL(this.url);this.url=null;this.recording=false;this.pending=false;
 }
}
