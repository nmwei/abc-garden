import {definition} from './learning-data.js';
// Device preferences never follow account switching or create cloud writes.
export const deviceStorage = {
  getItem(key) { definition(key, 'device'); return localStorage.getItem(key); },
  setItem(key, value) { definition(key, 'device'); localStorage.setItem(key, value); },
};
