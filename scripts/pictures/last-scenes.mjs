import{rect as r,path as p,line as l,circle as c,ellipse as e,group as g,person as person,arrow as a}from'./direct-scenes.mjs';
export const lastScenes={
 exhaust:r(33,42,87,43,'#a8c0c6',9)+p('M45 42L57 18H95L113 42Z','#a8c0c6')+r(63,24,28,17,'#d9e7de',2)+c(53,88,13,'#6f8997')+c(103,88,13,'#6f8997')+l(18,78,36,78,'#8e9ea2',5)+p('M17 81Q1 96 14 109M10 76Q-1 66 10 55','none','#b3c1bf',8),

 corner:r(14,14,100,100,'#d9dfcd',7)+p('M24 55V24H55','none','#c9a080',8)+a(84,83,38,38,'#9bb8bf'),
 surface:r(13,43,100,67,'#c6b491',2)+p('M13 43L44 17H122L113 43Z','#9bbcc2')+p('M13 43L44 17H122L113 43Z','none','#7d9da6',3),

 height:person(52,22,{shirt:'#9db5bd'})+a(101,115,101,12,'#cd9f7b')+l(19,117,111,117,'#c5c8b7',3),
 weight:r(21,79,88,37,'#a5bfc6',6)+r(35,89,59,17,'#e9e4ce',3)+p('M57 91L67 101','none','#c89e7d',3)+r(39,31,55,46,'#c7ad7e',2)+l(66,31,66,77,'#a78d63',3)+r(16,75,98,7,'#819faa',2),
 edge:r(14,15,101,100,'#d3dfd0',5)+l(14,15,14,115,'#ca9d7c',8)+a(83,63,30,63,'#98b5be'),
 bottom:r(17,12,94,104,'#b6c8c3',3)+[27,55].map(y=>r(25,y,78,19,'#dde5d4',2)).join('')+r(25,85,78,23,'#cfaa82',2),

 damage:r(18,12,93,106,'#b7a07c',3)+r(26,20,77,90,'#aecdd2',2)+p('M43 25L66 45L55 67L84 85L76 109M66 45L91 35M55 67L31 87','none','#6e919e',4),
 injury:person(64,30,{shirt:'#a4bbc2'})+p('M44 55L66 78L84 57Z','#e7e5d4')+l(45,55,83,55,'#a8b7af',3)+p('M54 60L61 72M66 60L72 67','none','#bbc7ba',2),
 parking:r(9,48,111,70,'#9aabae',3)+[17,48,79,110].map(x=>l(x,54,x,112,'#e8e4cf',2)).join('')+r(23,61,18,37,'#d0b589',6)+r(84,61,18,37,'#a8c3c7',6)+r(50,8,33,33,'#8aaab9',5)+'<text x="66" y="32" text-anchor="middle" font-size="25" font-family="sans-serif" fill="#f7f1dc">P</text>',
 donation:r(26,62,77,53,'#b8cbb6',5)+l(42,69,86,69,'#718b83',4)+p('M64 85C50 68 36 90 64 108C92 90 78 68 64 85Z','#c48f83')+c(64,42,12,'#d5b87c')+a(107,22,90,54),
 pollution:p('M4 84Q23 75 42 84T80 84T118 84V123H4Z','#9bb6b2')+r(12,20,50,47,'#b4b5a8',2)+r(21,6,12,15,'#9ca69f',1)+p('M62 50H92V83','none','#8c9d9e',15)+p('M92 83L87 104L110 117','none','#a19679',12)+[ [25,96],[56,110],[74,94] ].map(([x,y])=>e(x,y,7,3,'#a69a7d')).join(''),
 marriage:person(40,30,{shirt:'#7e98ac'})+person(87,30,{shirt:'#d6ccaf'})+p('M73 55H101L116 111H58Z','#e5ddc6')+p('M50 58L64 68L77 58','none','#dcb18b',6)+c(55,11,8,'none').replace('fill="none"','fill="none" stroke="#d3b576" stroke-width="3"')+c(68,11,8,'none').replace('fill="none"','fill="none" stroke="#d3b576" stroke-width="3"'),
 land:p('M10 44L57 33L60 8L69 10L76 35L117 51L114 61L75 51L65 80L57 79L59 49L12 53Z','#9bbfc9')+r(4,109,120,9,'#8da4aa',1)+[16,43,70,97].map(x=>l(x,113,x+14,113,'#ece7d4',2)).join('')+a(94,76,106,98),
 headphonedeaf:c(62,58,32,'#d4b58e')+p('M54 36Q83 28 84 53Q84 68 68 72Q54 77 57 92','none','#a0805d',7)+l(18,107,109,15,'#c49a83',7),
 housework:person(43,30,{shirt:'#9db6ab',pose:'reach'})+l(65,45,88,102,'#b59b6f',5)+p('M76 99H100L110 119H65Z','#d6bf8e')+p('M77 104L74 116M86 104V116M95 104L100 116','none','#b59a6a',2),
};
