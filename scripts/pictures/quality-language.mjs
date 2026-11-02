import {r,p,l,c,e,g,a,t,cap,human,face,book,openBook,paper,house,tree,plant,ink,blue,green,red,gold,cream,brown,chair} from './quality-primitives.mjs';
const schoolStage=active=>['PRIMARY','JUNIOR HIGH','SENIOR HIGH'].map((s,i)=>r(8,12+i*33,112,28,i===active?gold:cream,4)+t(s,64,31+i*33,12)).join('')+a(123,22,123,99);
export const languageScenes={
 ask:()=>human(25,43,blue,.9,'point')+human(104,32,green,1.1,'reach')+r(39,10,53,25,cream,7)+t('Help, please?',65,27,7.5)+g(paper('1 + ?'),43,74,.3),
 turn:()=>openBook()+p('M64 105L65 30Q82 41 98 33V93Q77 95 64 105Z','#d7e1ca',ink,1.5)+p('M110 14Q89 6 73 20','none',gold,3)+a(85,13,73,20)+cap('turn the page'),
 advantage:()=>human(22,49,blue,.77,'hold')+r(25,71,26,21,cream,2)+p('M29 86L34 76L43 82L47 76','none',blue,2)+human(107,49,green,.77)+t('?',108,28,23)+l(58,101,58,31,brown,3)+p('M58 32H88L78 53H58Z',gold)+cap('a map helps in the game'),
 characteristic:async icon=>await icon('giraffe',16,5,95)+a(115,25,48,40)+cap('a characteristic long neck'),
 dining:()=>g(chair(),-1,36,.5)+g(chair(),76,36,.5)+human(25,50,blue,.76,'sit')+human(101,50,green,.76,'sit')+r(8,80,112,10,brown,3)+l(21,90,21,114,brown,5)+l(107,90,107,114,brown,5)+[38,88].map(x=>e(x,77,19,5,cream)).join('')+cap('dining together'),
 ecology:async icon=>g(tree(),1,4,.53)+p('M7 83H121V113H7Z',brown)+e(87,90,32,13,blue)+await icon('fish',82,81,20)+await icon('bird',63,27,24)+p('M36 82V103M36 90L22 102M36 91L47 101','none',cream,2)+a(54,57,79,74)+a(82,109,46,108)+cap('living things and their environment'),
 kit:()=>r(12,36,105,75,blue,8)+p('M44 36V19H85V36','none',ink,5)+r(43,51,43,43,green,4)+r(59,57,11,31,cream,1)+r(49,67,31,11,cream,1)+cap('a first-aid kit'),
 junior:()=>schoolStage(1),
 senior:()=>schoolStage(2),
};
