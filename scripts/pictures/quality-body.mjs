import {r,p,l,c,e,g,a,t,cap,focus,face,human,ground,cat,ink,blue,green,red,gold,cream,skin,brown} from './quality-primitives.mjs';
const front=()=>face(64,64,42)+p('M29 44Q33 11 64 15Q96 12 100 45Q82 26 64 34Q45 22 29 44Z',brown);
const mouth=()=>p('M20 62Q42 33 64 49Q85 32 110 62Q91 90 64 83Q38 91 20 62Z',red)+p('M20 62Q64 71 110 62','none','#92544f',3);
const foot=()=>p('M30 12H66V65L82 75L113 83Q126 90 118 103Q107 115 78 112H31Q9 111 14 94L30 65Z',skin,ink,1.5)+p('M91 81L88 100M102 84L100 102M112 87L110 103','none','#b4876a',2);
const paw=()=>p('M26 17H91L101 82Q109 109 87 112H38Q14 110 20 86Z',brown)+[34,56,78,97].map((x,i)=>p(`M${x-5} ${95+i%2*3}L${x+1} 121L${x+8} ${94+i%2*3}Z`,cream,ink,1)).join('');
const hand=()=>p('M29 99L12 73Q6 61 17 59L31 72V31Q31 15 42 20V62H47V15Q51 1 59 12V60H65V19Q72 5 77 18V64L83 30Q93 19 96 34L91 88Q87 116 61 117Q38 118 29 99Z',skin,ink,1.5);
export const bodyScenes={
 beak:()=>focus(c(52,61,37,blue)+c(63,50,4,ink)+p('M87 57L119 70L87 82Z',gold),103,69,19),
 claw:()=>paw()+a(8,53,35,97,red),
 tail:()=>focus(cat(),15,49,22),
 whisker:()=>focus(face(64,62,39)+p('M32 39L32 13L53 29M78 29L100 13L97 44Z',brown)+p('M59 64H69L64 71Z',red)+p('M46 68L14 59M46 75L12 78M81 68L113 59M81 75L115 78','none',ink,2),30,71,20),
 fur:()=>g(c(45,25,14,brown)+c(85,25,14,brown)+face(64,66,39),0,12,.83)+a(66,56,92,47)+c(99,43,23,cream)+Array.from({length:12},(_,i)=>p(`M${83+i%4*9} ${34+Math.floor(i/4)*9}q4 -11 7 0`,'none',brown,2)).join('')+cap('fur: close-up'),
 wool:()=>[ [34,50],[57,36],[81,44],[93,65],[75,84],[46,83],[29,69] ].map(([x,y])=>c(x,y,19,cream)).join('')+e(99,57,15,21,brown)+c(105,51,2,ink)+l(38,91,35,112,brown,5)+l(78,91,81,112,brown,5)+[ [41,53],[63,47],[62,73] ].map(([x,y])=>p(`M${x} ${y}q-10 -13 -13 1q1 14 13 5q6 -9 -3 -9`,'none','#c0ad8b',2)).join('')+a(8,14,39,38),
 horn:()=>focus(p('M47 50Q21 23 34 9Q34 32 57 43M77 50Q105 23 93 9Q93 32 70 43Z','#c9b898')+e(63,78,28,35,cream)+p('M38 59L15 52L35 77M88 59L112 52L93 77Z',brown)+c(52,74,2,ink)+c(76,74,2,ink)+p('M57 99L65 106L71 99Z',brown),40,29,19),
 antler:()=>focus(e(65,86,23,29,brown)+p('M49 62L31 31L11 15M31 31L36 9M25 25L9 35M80 62L99 31L116 15M99 31L93 9M104 25L121 35','none','#826a4f',5)+c(57,82,2,ink)+c(74,82,2,ink),29,30,23),
 hoof:()=>p('M41 10H76L82 86L98 104Q101 115 89 118H31Q25 106 34 87Z',brown)+p('M34 87L82 87L98 104Q101 115 89 118H31Q25 106 34 87Z',ink)+a(8,44,37,94,red),
 lip:()=>mouth()+a(64,13,64,45,red),
 teeth:()=>p('M12 45Q64 8 116 45L110 94Q64 121 18 94Z',red)+[0,1].map(row=>Array.from({length:7},(_,i)=>r(23+i*12,39+row*32,11,25,'#fffdf4',3)).join('')).join('')+p('M21 69Q64 79 108 69','none','#a85650',3),
 feet:()=>g(foot(),3,36,.48)+g(foot(),62,36,.48)+cap('two feet'),
 knee:()=>focus(p('M42 12L68 59L100 87','none',skin,26)+p('M101 87L117 105','none',skin,17),68,59,19),
 elbow:()=>focus(p('M23 24L34 89L99 50','none',skin,22)+c(104,46,12,skin),34,89,19),
 toe:()=>focus(foot(),110,93,16),
 heel:()=>focus(foot(),26,101,17),
 skin:()=>g(hand(),-3,5,.88)+c(100,39,23,skin)+p('M82 35Q101 23 119 37M82 45Q101 33 119 47','none','#bd9172',2)+a(65,78,90,60)+cap('skin: close-up'),
 eyebrow:()=>focus(front()+p('M41 44L55 40M75 40L88 44','none',brown,5),48,42,15),
 cheek:()=>focus(front()+e(37,76,9,7,'#d9917e')+e(90,76,9,7,'#d9917e'),37,77,15),
 chin:()=>focus(front(),64,103,15),
 mustache:()=>face(64,63,41)+p('M64 70Q43 52 29 75Q31 91 64 77Q96 91 100 75Q84 52 64 70Z',brown)+a(64,9,64,63,red),
 handprint:()=>g(hand().replaceAll(skin,red).replaceAll(ink,red),4,-2,1)+[ [17,104],[102,78],[90,116] ].map(([x,y])=>c(x,y,2.5,red)).join(''),
 fingerprint:()=>e(64,65,39,51,cream)+[0,1,2,3,4].map(i=>p(`M${31+i*6} 86C${12+i*8} ${11+i*5} ${120-i*8} ${11+i*5} ${97-i*6} 85Q${90-i*4} ${113-i*5} ${62-i*2} ${102-i*6}`,'none',ink,2)).join('')+p('M60 84Q50 47 64 48Q80 50 70 79','none',ink,2),
 senses:()=>g(p('M10 64Q64 9 118 64Q64 118 10 64Z',cream)+c(64,64,23,blue)+c(64,64,10,ink),2,7,.36)+g(p('M39 96Q12 44 44 23Q91 2 98 53Q106 85 71 90L59 111','none',skin,12)+p('M48 73Q31 44 59 35Q90 29 80 58L61 68','none',brown,4),44,8,.34)+g(p('M56 19L29 91Q56 112 96 91L79 73','none',skin,15),85,7,.33)+g(mouth(),9,72,.42)+g(hand(),70,70,.38)+cap('see · hear · smell · taste · touch'),
 balance:()=>human(64,47,blue,1.12,'balance')+ground()+cap('balance on one foot'),
};
