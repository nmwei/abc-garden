import {createStorage} from './account-runtime/storage.js';
import {definition,projectLearningValue} from '../domain/learning-data.js';
import {ARCHIVE_KEYS,validateArchive} from '../domain/archive-schema.js';
export const {blockStorage,storageWritable,storageNotice,canRetryStorage,retryStorage,flushStorage,learningStorage,localAccount,localSyncState,markSynced,captureArchive,captureSyncBatch,retainedArchive,activateArchive}=await createStorage({subject:'abc',definition,projectLearningValue,ARCHIVE_KEYS,validateArchive});
