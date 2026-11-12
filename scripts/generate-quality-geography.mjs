import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {t,c,p,l,cream,blue,green,gold,red} from './pictures/quality-primitives.mjs';
const root=new URL('../',import.meta.url),data=JSON.parse(await readFile(new URL('data/reference-maps/quality-geography.json',root)));
const credits=JSON.parse(await readFile(new URL('web/assets/credits.json',root)));
const shape=(geometry,project)=>{
 const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];
 return polygons.map(polygon=>polygon.map(ring=>ring.map((pt,i)=>{const [x,y]=project(pt);return `${i?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)}`}).join('')+'Z').join('')).join('');
};
const japan=([x,y])=>[12+(x-129)*6.2,99-(y-31)*6.2];
const [tx,ty]=japan([139.76,35.68]);
const japanBody=p(shape(data.japan[0].geometry,japan),green)+c(tx,ty,3.5,red)+l(tx-4,ty+1,tx-24,ty+10,red,1.5)+t('Tokyo',tx-31,ty+20,9)+t('JAPAN',65,14,12)+t('a capital city',64,122,9);
const us=([x,y])=>[8+(x+125)*1.9,100-(y-24)*2.7];
const lower48=data.usStates.filter(f=>!['Alaska','Hawaii','District of Columbia'].includes(f.properties.name));
const usBody=lower48.map(f=>p(shape(f.geometry,us),f.properties.name==='California'?gold:'#afc2b1',cream,.7)).join('')+t('UNITED STATES',65,13,11)+l(17,78,32,108,red,1.5)+t('California',53,122,12);
for(const [id,body,file] of [['scene-quality-japan-map',japanBody,'ne_110m_admin_0_countries.geojson'],['scene-quality-us-california',usBody,'ne_110m_admin_1_states_provinces.geojson']]){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${body}</svg>\n`,target=`pictures/${id}.svg`;
 await writeFile(new URL(`web/assets/${target}`,root),svg);
 const credit={file:target,author:'Natural Earth contributors; ABC Garden styling',source:data.sources[file].url,license:data.license,licenseUrl:data.licenseUrl,changes:'Selected and projected geographic boundaries; location labels added. US view shows the contiguous states.',sha256:createHash('sha256').update(svg).digest('hex')};
 const index=credits.findIndex(c=>c.file===target);if(index<0)credits.push(credit);else credits[index]=credit;
}
await writeFile(new URL('web/assets/credits.json',root),JSON.stringify(credits,null,2)+'\n');
