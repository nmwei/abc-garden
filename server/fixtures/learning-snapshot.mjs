import {DATA,LISTEN_DEFAULTS} from '../../domain/learning-data.js';
import {freshWeekly} from '../../domain/module-content.js';
import {freshState} from '../../domain/core.js';
import {freshGuided} from '../../domain/guided-records.js';
import {freshLetterLearning} from '../../domain/guided-letters-core.js';
export function learningSnapshot() {
  const {clips,...content}=freshWeekly();
  content.selectedWordIds=['book','apple'];
  content.wordMeanings={apple:{zh:'红苹果',sentence:'This is my apple.',sentenceZh:'这是我的苹果。'}};
  content.repeats=2;content.gap=3000;
  const words=freshGuided();words.scope=['book','apple'];
  words.entries.apple={days:['2026-11-12'],level:1,meaning:true,seenAt:100,dueAt:200,introducedAt:100,lastModelAt:100,lastCreditAt:100,transferAt:0,retryDay:'',result:'independent'};
  const letters=freshLetterLearning();letters.scope=['A','B'];
  letters.entries.A={name:{taught:true,days:['2026-11-12'],level:1,lastModelAt:100,lastRecallAt:100,lastCreditAt:100,independentAt:100,dueAt:200,lastOutcome:'independent'}};
  return {version:1,subject:'abc',data:{
    [DATA.content]:content,
    [DATA.mastery]:{version:1,entries:{apple:{mastered:true,source:'manual',dates:[]}}},
    [DATA.words]:words,[DATA.letters]:letters,
    [DATA.wordSettings]:{version:1,newWordsPerGroup:4,breakAfterMinutes:20},
    [DATA.letterSettings]:{version:1,newLettersPerGroup:3,breakAfterMinutes:10},
    [DATA.preferences]:{version:1,settings:{...freshState().settings,letterAudioSource:'gk'}},
    [DATA.listening]:{version:1,...LISTEN_DEFAULTS,mode:'sound',letterCase:'lower',kind:'game',vowels:false,effects:false},
  }};
}
