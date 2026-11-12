import {createClient} from './account-runtime/client.js';
import * as storage from './account-storage.js';
import {validateRestore} from './account-restore.js';
export const {accountState,accountApi,refreshAccount,prepareLogin,localFingerprint,archiveChoice,chooseArchive,syncArchive,leaveAccount,scheduleSync}=createClient({subject:'abc',storage,validateRestore});
