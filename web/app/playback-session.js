// Audio session type is page-wide. Players must not restore it while another
// recorded/synthesized playback sequence still owns the session.
const owners=new Set();
let session,previousType;
export function acquirePlaybackSession(){
 const owner={};
 if(!owners.size){
  session=globalThis.navigator?.audioSession;previousType=undefined;
  if(session)try{previousType=session.type;session.type='playback';}catch{}
 }
 owners.add(owner);
 return ()=>{
  if(!owners.delete(owner)||owners.size)return;
  if(previousType!==undefined)try{if(session.type==='playback')session.type=previousType;}catch{}
  session=null;previousType=undefined;
 };
}
