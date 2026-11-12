import {shuffle} from './core.js';

export const sameLetterSound=(a,b)=>a===b||('CK'.includes(a)&&'CK'.includes(b));
export class ListeningRound {
 constructor(letters,{mode='name',kind='practice'}={}){
  this.letters=[...letters];this.mode=mode;this.kind=kind;this.queue=shuffle(letters);
  this.index=0;this.found=0;this.firstTry=0;this.right=0;this.missed=new Set();this.finished=false;this.resetQuestion();
 }
 get target(){return this.queue[this.index];}
 correct(letter){return this.mode==='sound'?sameLetterSound(letter,this.target):letter===this.target;}
 resetQuestion(){this.wrong=new Set();this.hinted=false;this.done=false;this.selected=null;}
 hint(){if(!this.done)this.hinted=true;}
 answer(letter){
  if(this.done||!this.letters.includes(letter)||this.wrong.has(letter))return null;
  const correct=this.correct(letter);this.selected=letter;
  if(correct){this.found++;this.right++;if(!this.wrong.size&&!this.hinted)this.firstTry++;}
  else{this.wrong.add(letter);this.missed.add(this.target);}
  this.done=correct||this.kind==='game';return correct;
 }
 next(){
  if(!this.done)return;
  if(this.index+1===this.queue.length){
   if(this.kind==='game'){this.finished=true;return;}
   this.queue=shuffle(this.letters);this.index=-1;
  }
  this.index++;this.resetQuestion();
 }
}
