import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {objectScenes} from './quality-objects.mjs';
import {bodyScenes} from './quality-body.mjs';
import {placeScenes} from './quality-places.mjs';
import {actionScenes} from './quality-actions.mjs';
import {contextQualityScenes} from './quality-context.mjs';
import {languageScenes} from './quality-language.mjs';
const root=new URL('../../',import.meta.url),groups=[objectScenes,bodyScenes,placeScenes,actionScenes,contextQualityScenes,languageScenes];
export const qualityScenes={};
for(const group of groups)for(const [id,draw] of Object.entries(group)){
 if(qualityScenes[id])throw Error(`Duplicate quality scene: ${id}`);
 qualityScenes[id]=draw;
}
// Reload source metadata per render pass; a preceding pass may have replaced a base image.
export async function renderQualityScene(id){
 if(!qualityScenes[id])throw Error(`Missing quality scene: ${id}`);
 const credits=new Map(JSON.parse(await readFile(new URL('assets/credits.json',root))).map(c=>[c.file,c]));
 const components=[];let serial=0;
 const icon=async(name,x,y,width,height=width)=>{
  const file=`pictures/${name}.svg`,credit=credits.get(file);
  if(!credit)throw Error(`Uncredited quality component: ${name}`);
  const bytes=await readFile(new URL(`assets/${file}`,root)),match=bytes.toString().match(/<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/);
  if(!match||/<script\b|<image\b|<foreignObject\b|(?:href|src)=["'](?:https?:|\/\/)/.test(match[2]))throw Error(`Nonlocal component: ${name}`);
  const prefix=`quality${++serial}-`;
  const body=match[2].replace(/\bid="([^"]+)"/g,(_,key)=>`id="${prefix}${key}"`).replace(/url\(#([^)]+)\)/g,(_,key)=>`url(#${prefix}${key})`).replace(/((?:xlink:)?href=")#([^"]+)"/g,(_,start,key)=>`${start}#${prefix}${key}"`);
  const {author,source,license,licenseUrl}=credit;
  components.push({file,author,source,license,licenseUrl,sha256:createHash('sha256').update(bytes).digest('hex')});
  const viewBox=match[1].match(/viewBox="([^"]+)"/)?.[1]||'0 0 128 128';
  return `<svg xmlns:xlink="http://www.w3.org/1999/xlink" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}">${body}</svg>`;
 };
 const body=await qualityScenes[id](icon);
 const used=[...new Map(components.map(c=>[c.file,c])).values()];
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 128 128"><rect x="0" y="0" width="128" height="128" rx="9" fill="#faf6e9"/>${body}</svg>\n`.replace(/[ \t]+$/gm,''),components:used,license:used.some(c=>c.license==='Apache-2.0')?'Apache-2.0':'CC0-1.0'};
}
