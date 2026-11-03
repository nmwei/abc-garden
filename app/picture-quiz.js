// Freeze the round: mastery changes must not reorder or skip remaining questions.
export class PictureQuiz {
 constructor(words,startId){const start=Math.max(0,words.findIndex(w=>w.id===startId));this.words=[...words.slice(start),...words.slice(0,start)];this.index=0;this.reset();}
 get current(){return this.words[this.index];}
 get done(){return this.index>=this.words.length;}
 reset(){this.wrong=[];this.result=null;this.selected=null;}
 answer(id){if(this.result||this.wrong.includes(id))return null;this.selected=id;if(id===this.current.id)this.result='correct';else{this.wrong.push(id);if(this.wrong.length>=2)this.result='revealed';}return this.result||'retry';}
 next(){this.index++;this.reset();}
}
