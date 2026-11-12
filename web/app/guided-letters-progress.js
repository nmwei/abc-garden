import {learningStorage} from './account-storage.js';
import {DATA} from './learning-data.js';
import {createLearningRepository} from './learning-repository.js';
export {restoreLetterLearning} from './letter-records.js';
export const LETTER_GUIDED_KEY=DATA.letters;
export const createLetterRepository=({storage=()=>learningStorage,key=LETTER_GUIDED_KEY}={})=>createLearningRepository({storage,key});
