// Reusable visual grammar; each vocabulary recipe explicitly selects its objects and relationship.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const credits=JSON.parse(await readFile(new URL('assets/credits.json',root),'utf8'));
const sources=new Map(credits.map(c=>[c.file,c])),cache=new Map();
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const ink='#526e7c',green='#8aa88a',blue='#91b5c1',orange='#d4a371',paper='#eee3cc';
const line=(x,y,xx,yy,color=ink,w=2)=>`<path d="M${x} ${y}L${xx} ${yy}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
const rect=(x,y,w,h,fill=paper)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${fill}"/>`;
const text=(s,x,y,max=110,size=9)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="600" font-size="${Math.min(size,max/Math.max(1,s.length*.58))}" fill="${ink}">${esc(s)}</text>`;
const wrapped=(s,x,y,width=80)=>{
 const rows=[''];for(const word of s.split(' ')){if((rows.at(-1)+' '+word).trim().length>21&&rows.at(-1))rows.push(word);else rows[rows.length-1]=(rows.at(-1)+' '+word).trim();}
 return rows.map((row,i)=>text(row,x,y+(i-(rows.length-1)/2)*10,width,8)).join('');
};
const arrow=(x,y,xx,yy)=>{const t=Math.atan2(yy-y,xx-x);return line(x,y,xx,yy,orange,3)+line(xx,yy,xx-7*Math.cos(t-.5),yy-7*Math.sin(t-.5),orange,3)+line(xx,yy,xx-7*Math.cos(t+.5),yy-7*Math.sin(t+.5),orange,3);};
const mark=(yes,x=85,y=20)=>yes?`<path d="M${x} ${y+8}l7 7l15 -17" fill="none" stroke="${green}" stroke-width="4" stroke-linecap="round"/>`:line(x,y,x+17,y+17,'#bc806f',4)+line(x+17,y,x,y+17,'#bc806f',4);
async function asset(id){
 if(cache.has(id))return cache.get(id);
 const file=`pictures/${id}.svg`,credit=sources.get(file);
 if(!credit)throw Error(`Uncredited context component: ${id}`);
 const bytes=await readFile(new URL(`assets/${file}`,root));
 const source=bytes.toString(),match=source.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/);
 if(!match||/<script\b|<image\b|<foreignObject\b|(?:href|src)=["'](?:https?:|\/\/)|url\(\s*["']?(?:https?:|\/\/)/.test(match[2]))throw Error(`Nonlocal SVG component: ${id}`);
 const viewBox=match[1].match(/viewBox="([^"]+)"/)?.[1]||'0 0 128 128';
 const {file:sourceFile,author,source:sourceUrl,license,licenseUrl}=credit;
 const result={body:match[2],viewBox,credit:{file:sourceFile,author,source:sourceUrl,license,licenseUrl,sha256:createHash('sha256').update(bytes).digest('hex')}};cache.set(id,result);return result;
}
const supported=new Set('single pair not-pair flow compare plus cross check talk thought document group many network centre scale sizes cycle focus bars timeline timeline-first timeline-last timeline-all timeline-weekend vertical on under forward backstep'.split(' '));
export async function renderContextRecipe(recipe){
 const {layout,left,right,label,caption}=recipe;
 if(!supported.has(layout)||!caption||!left)throw Error(`Incomplete context recipe: ${caption}`);
 const components=[];let serial=0;
 const icon=async(spec,x,y,w=45,h=w)=>{
  if(!spec||spec==='-')return '';
  const [name,annotation]=spec.split('~'),[id,modifier]=name.split('!');
  if(modifier&&!['flip','good','bad','small'].includes(modifier))throw Error(`Unknown icon modifier: ${modifier}`);
  const source=await asset(id);components.push(source.credit);
  // Namespacing prevents duplicate gradient/clip IDs when the same icon appears twice.
  const prefix=`part${++serial}-`;
  let body=source.body.replace(/\bid="([^"]+)"/g,(_,id)=>`id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix}${id})`).replace(/((?:xlink:)?href=")#([^"]+)"/g,(_,start,id)=>`${start}#${prefix}${id}"`);
  if(modifier==='small'){const [minX,minY,width,height]=source.viewBox.split(/\s+/).map(Number);body=`<g transform="translate(${(minX+width/2)*.4} ${(minY+height/2)*.4}) scale(.6)">${body}</g>`;}
  if(modifier==='flip'){const [minX,,width]=source.viewBox.split(/\s+/).map(Number);body=`<g transform="translate(${2*minX+width} 0) scale(-1 1)">${body}</g>`;}
  const rating=modifier==='good'?mark(true,x+21,y+h+15):modifier==='bad'?mark(false,x+21,y+h+15):'';
  return `<svg xmlns:xlink="http://www.w3.org/1999/xlink" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${source.viewBox}">${body}</svg>`+rating+(annotation?text(annotation,x+w/2,y+h+10,w+7,8):'');
 };
 let body='';
 if(['pair','not-pair','flow','compare','plus','cycle'].includes(layout)){
  body=await icon(left,5,35,43)+await icon(right,80,35,43);
  body+=layout==='flow'||layout==='cycle'?arrow(52,57,75,57):text(layout==='plus'?'+':layout==='compare'?'vs':'&',64,61,22,14);
  if(layout==='not-pair')body+=mark(false,25,96)+mark(false,94,96);
  if(layout==='cycle')body+=arrow(91,100,35,100);
 }else if(['single','cross','check','focus'].includes(layout)){
  body=await icon(left,22,23,84);
  if(layout==='cross'||layout==='check')body+=mark(layout==='check',96,95);
  if(layout==='focus')body+=arrow(6,26,39,49);
 }else if(layout==='talk'){
  body=await icon(left,4,54,43)+await icon(right,81,54,43)+rect(24,5,80,39)+wrapped(label,64,26,74);
 }else if(layout==='thought'){
  body=await icon(left,4,54,45)+rect(57,16,65,66,'#e2e9dc')+await icon(right,67,22,45)+`<circle cx="49" cy="52" r="4" fill="${paper}"/><circle cx="54" cy="44" r="5" fill="${paper}"/>`;
 }else if(layout==='document'){
  body=rect(17,8,94,102)+wrapped(label,64,23,82)+await icon(left,34,36,58)+line(30,98,99,98,blue,2)+line(30,105,87,105,blue,2);
 }else if(layout==='group'){
  body=await icon(left,2,32,39)+await icon(right==='-'?left:right,44,32,39)+await icon(left,86,32,39);
 }else if(layout==='many'){
  for(let i=0;i<12;i++)body+=await icon(left,4+i%4*31,27+Math.floor(i/4)*27,26);
 }else if(layout==='centre'){
  body=await icon(right,3,25,30)+await icon(right,95,25,30)+await icon(right,3,84,30)+await icon(right,95,84,30)+await icon(left,41,51,46)+`<circle cx="64" cy="74" r="29" fill="none" stroke="${orange}" stroke-width="2" stroke-dasharray="3 3"/>`;
 }else if(layout==='network'){
  body=line(26,45,101,45,blue)+line(26,45,26,95,blue)+line(101,45,101,95,blue)+line(26,95,101,95,blue)+await icon(left,6,28,34)+await icon(right,85,28,34)+await icon(right,6,79,34)+await icon(left,85,79,34);
 }else if(layout==='scale'){
  body=await icon(left,3,29,67)+await icon(right==='-'?left:right,89,63,29)+text(label,86,33,60,10);
 }else if(layout==='sizes'){
  body=await icon(left,1,64,25)+rect(30,40,48,63,'#e2e9dc')+await icon(left,35,52,37)+await icon(left,80,36,48)+text('small',14,106,27,8)+text('MEDIUM',54,106,47,8)+text('large',104,106,30,8);
 }else if(layout==='vertical'){
  body=await icon(left,40,20,45)+await icon(right,40,72,38)+arrow(104,45,104,93);
 }else if(layout==='on'){
  body=await icon(right,20,59,87,48)+await icon(left,47,34,35);
 }else if(layout==='under'){
  body=rect(6,38,116,19,'#c8ae88')+await icon(left,7,20,23)+await icon(right,47,72,37)+text('ground',95,36,40,8);
 }else if(layout==='forward'||layout==='backstep'){
  body=await icon(left,32,22,62)+(layout==='forward'?arrow(28,107,101,107):arrow(101,107,28,107));
 }else if(layout==='bars'){
  const values=label.split(',').map(Number);if(values.some(n=>!Number.isFinite(n)||n<0)||values.length>7)throw Error(`Invalid chart: ${label}`);
  const max=Math.max(1,...values),width=80/values.length;
  body=line(18,98,115,98)+line(18,98,18,28)+values.map((n,i)=>rect(25+i*width,94-n/max*56,width-6,n/max*56,i%2?blue:green)+text(String(n),25+i*width+(width-6)/2,88-n/max*56,30,8)).join('')+await icon(left,91,2,30);
 }else if(layout.startsWith('timeline')){
  const parts=label.split(';');if(parts.length!==3)throw Error(`Timeline needs three labels: ${label}`);
  body=arrow(12,77,115,77)+parts.map((s,i)=>rect(5+i*42,30,36,31,(layout==='timeline-all'?true:layout==='timeline-first'?i===0:layout==='timeline-last'?i===2:layout==='timeline-weekend'?i>0:i===1)?'#c1d4bb':paper)+text(s,23+i*42,49,32,8)).join('')+await icon(left,47,82,32);
 }
 if(!layout.startsWith('timeline')&&!['talk','document','bars','scale','sizes'].includes(layout)&&label)body+=text(label,64,16,115,10);
 body+=text(caption,64,124,117,9);
 const used=[...new Map(components.map(c=>[c.file,c])).values()];
 const apache=used.some(c=>c.license==='Apache-2.0');
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 128 132">${rect(0,0,128,132,'#faf6e9')}${body}</svg>\n`,components:used,license:apache?'Apache-2.0':'CC0-1.0'};
}
