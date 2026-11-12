import {learningStorage} from './account-storage.js';
import {DATA} from './learning-data.js';
import {createLearningRepository,LearningProgressConflict} from './learning-repository.js';
export {freshGuided,restoreGuidedProgress,cleanGuided} from './guided-records.js';
export const GUIDED_KEY=DATA.words;

export {LearningProgressConflict as GuidedProgressConflict};
export const createGuidedRepository=({storage=()=>learningStorage,key=GUIDED_KEY}={})=>createLearningRepository({storage,key});
