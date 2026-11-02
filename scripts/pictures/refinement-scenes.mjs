// Follow-up illustrations use existing project primitives and no copied picture components.
import {r,p,l,c,e,g,a,t,face,human,book,openBook,plant,ground,ink,blue,green,red,gold,cream,skin,brown} from './quality-primitives.mjs';
const clock=()=>c(64,78,33,'#fffdf4')+p('M64 45a33 33 0 1 0 0 66a33 33 0 1 0 0 -66','none',ink,2)+Array.from({length:12},(_,i)=>{const v=i*Math.PI/6;return c(64+Math.sin(v)*27,78-Math.cos(v)*27,1.3,ink)}).join('')+l(64,78,64,56,ink,3)+c(64,78,3,ink);
const closedBook=()=>r(16,17,96,94,red,5)+r(24,18,82,86,cream,3)+p('M16 17H100V104H16Z',red,ink,1.5)+l(27,18,27,103,'#a75850',2)+l(32,108,105,108,'#c3b79b',2);
const tinyBook=(x,y,color)=>r(x,y,12,24,color,1)+l(x+3,y+2,x+3,y+22,cream,1);
const toy=()=>c(64,54,23,brown)+c(45,35,9,brown)+c(83,35,9,brown)+e(64,90,24,26,brown)+c(40,82,10,brown)+c(88,82,10,brown)+c(47,113,12,brown)+c(81,113,12,brown)+e(64,65,12,8,cream)+c(56,52,2,ink)+c(72,52,2,ink)+c(64,62,3,ink);
export const refinementScenes={
 fork:()=>p('M46 12V40Q46 54 64 56Q82 54 82 40V12M58 12V40M70 12V40','none','#9aa9ac',6)+p('M64 56V111','none','#8b9b9f',10)+l(61,62,61,106,'#c9d4d4',2),
 knife:()=>p('M65 12Q42 36 43 70H67V12Z','#bfcbce',ink,2)+r(50,70,19,44,brown,6)+c(60,80,2,cream)+c(60,102,2,cream),
 lamp:()=>e(64,111,31,7,ink)+r(60,48,8,60,brown,2)+p('M38 15H90L105 60H23Z',gold,ink,2)+e(64,60,41,7,'#f5d998')+l(87,61,87,82,ink,2)+c(87,84,3,ink)+p('M22 78L14 84M106 78L114 84','none',gold,2),
 grape:()=>e(65,73,30,39,'#8f64b0')+e(55,58,8,13,'#b995cf')+p('M65 34Q65 17 83 13','none',green,5)+p('M71 29Q40 7 38 30Q49 44 71 29Z',green),
 noon:()=>r(5,5,118,113,'#dceef1',8)+c(96,25,13,gold)+[0,1,2,3,4,5,6,7].map(i=>{const v=i*Math.PI/4;return l(96+Math.cos(v)*17,25+Math.sin(v)*17,96+Math.cos(v)*21,25+Math.sin(v)*21,gold,2)}).join('')+t('12:00 PM',42,28,10)+clock(),
 midnight:()=>r(5,5,118,113,'#34465e',8)+c(98,25,14,cream)+c(104,19,13,'#34465e')+[ [20,17],[72,13],[111,53],[14,69] ].map(([x,y])=>p(`M${x-3} ${y}h6m-3 -3v6`,'none',cream,1.5)).join('')+t('12:00 AM',46,31,10,cream)+clock(),
 jump:()=>ground()+e(64,108,23,4,'#d5ceba')+l(54,105,77,112,red,4)+face(62,28,10)+p('M54 22Q63 12 72 23',brown)+p('M62 42V61','none',blue,16)+p('M55 44L41 29L35 17M70 44L85 28L91 18','none',skin,5)+p('M58 65L43 76L54 86M68 65L83 76L73 86','none',ink,6)+l(51,86,60,86,red,5)+l(67,86,77,86,red,5)+p('M18 98Q20 65 36 52','none',gold,3)+a(28,66,36,52,gold),
 coach:()=>ground()+human(32,35,blue,1.15,'point')+p('M21 25Q32 14 43 25Z',red)+c(46,63,3,ink)+l(39,52,46,60,ink,1)+human(91,56,green,.75,'run')+c(102,108,9,cream)+p('M98 101L107 108L100 114','none',ink,2)+a(50,18,35,26,red)+t('coach',88,20,10),
 cover:()=>closedBook()+r(39,37,45,44,gold,3)+t('ABC',62,65,16)+a(115,21,88,48,ink)+t('cover',93,14,9),
 close:()=>g(openBook(),0,25,.44)+g(closedBook(),74,25,.42)+a(53,59,72,59,gold)+t('open',29,99,9)+t('closed',99,99,9)+p('M75 20Q105 13 117 35','none',gold,2),
 announce:()=>human(27,44,green,.96,'point','open')+r(52,12,69,29,cream,7)+t('The winner!',86,31,9)+human(93,57,blue,.8,'wave')+p('M65 74H79V86Q72 97 65 86Z',gold)+l(72,91,72,103,gold,3)+l(64,105,80,105,gold,3)+p('M48 40L54 29L55 39Z',cream)+ground(),
 charity:()=>human(27,36,blue,.95,'reach')+g(toy(),42,27,.3)+a(65,63,83,72,gold)+r(74,75,47,39,brown,3)+p('M74 75L80 66H116L121 75Z',gold)+t('CHARITY',98,91,7,cream)+p('M98 109Q81 100 88 96Q93 92 98 98Q104 92 108 96Q114 101 98 109Z',red),
 increase:()=>r(6,18,116,94,cream,5)+[0,1,2].map((i)=>tinyBook(12+i*13,60,[red,blue,green][i])).join('')+[0,1,2,3,4].map((i)=>tinyBook(78+(i%3)*13,35+Math.floor(i/3)*30,[red,blue,green,gold,brown][i])).join('')+a(54,70,73,70,gold)+t('3 books',31,99,9)+t('5 books',98,99,9),
 research:()=>human(27,36,blue,.95,'hold')+g(openBook(),4,62,.36)+g(plant(),58,32,.5)+c(86,51,14,'#dceee866')+p('M72 51a14 14 0 1 0 28 0a14 14 0 1 0 -28 0M76 62L61 78','none',ink,3)+t('plants',90,20,10)+ground(),
};
export function renderRefinement(id){
 const scene=refinementScenes[id];if(!scene)throw Error(`Missing refinement: ${id}`);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 128 128"><rect width="128" height="128" rx="9" fill="#faf6e9"/>${scene()}</svg>\n`;
}
