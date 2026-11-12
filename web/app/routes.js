// Keep the app mount path and query while giving the homepage one canonical URL.
export function pageUrl(page, current=location) {
 return current.pathname+current.search+(page==='home'?'':`#/${page}`);
}
