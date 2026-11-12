import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {refinementScenes,renderRefinement} from './pictures/refinement-scenes.mjs';
const root=new URL('../',import.meta.url),credits=JSON.parse(await readFile(new URL('web/assets/credits.json',root)));
const mappings={};
for(const id of Object.keys(refinementScenes)){
 const file=`pictures/refined-${id}.svg`,svg=renderRefinement(id);mappings[id]=`./assets/${file}`;
 await writeFile(new URL(`web/assets/${file}`,root),svg);
 const credit={file,author:'ABC Garden project',source:'Project-authored follow-up SVG; scripts/pictures/refinement-scenes.mjs',license:'CC0-1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',changes:'Isolated teaching illustration; shared historical components remain unchanged.',sha256:createHash('sha256').update(svg).digest('hex')};
 const index=credits.findIndex(c=>c.file===file);if(index<0)credits.push(credit);else credits[index]=credit;
}
await writeFile(new URL('web/assets/credits.json',root),JSON.stringify(credits,null,2)+'\n');
await writeFile(new URL('domain/refined-pictures.js',root),'// Isolated illustrations: existing shared components remain unchanged.\nexport const REFINED_PICTURES='+JSON.stringify(mappings,null,1)+';\n');
console.log(`Generated ${Object.keys(mappings).length} isolated teaching illustrations.`);
