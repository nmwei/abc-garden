import {createAccountUI} from './account-runtime/ui.js';
import * as storage from './account-storage.js';
import * as client from './account-client.js';
function archiveSummary(snapshot) {
  if (!snapshot) return "还没有云端存档";
  const mastery = snapshot.data?.["abc-garden-mastery-v1"]?.entries || {};
  const known = Object.values(mastery).filter((entry) => entry.mastered).length;
  const words = Object.keys(
    snapshot.data?.["abc-garden-guided-words-v1"]?.entries || {},
  ).length;
  const letters = Object.keys(
    snapshot.data?.["abc-garden-guided-letters-v1"]?.entries || {},
  ).length;
  return `已掌握 ${known} 个词 · 陪学 ${words} 个词、${letters} 个字母`;
}

export const {accountPanel,parentIdentity}=createAccountUI({subject:'abc',storage,client,archiveSummary});
