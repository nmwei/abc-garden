import{rect as r,path as p,line as l,circle as c,ellipse as e,group as g,person as person,arrow as a}from'./direct-scenes.mjs';
function compass(dx,dy){return c(64,64,49,'#e0dcc3')+c(64,64,42,'#f4eedc')+l(64,17,64,110,'#b9bda9',2)+l(17,64,110,64,'#b9bda9',2)+p(`M${64+dx*34} ${64+dy*34}L${64-dy*10} ${64+dx*10}L${64+dy*10} ${64-dx*10}Z`,'#bc8b79')+p(`M${64-dx*28} ${64-dy*28}L${64-dy*10} ${64+dx*10}L${64+dy*10} ${64-dx*10}Z`,'#97b2b6')+c(64,64,4,'#e3c681')+'<g font-family="sans-serif" font-size="9" fill="#7e918f" text-anchor="middle"><text x="64" y="11">N</text><text x="64" y="126">S</text><text x="5" y="67">W</text><text x="123" y="67">E</text></g>';}
export const closingScenes={
 north:compass(0,-1),east:compass(1,0),south:compass(0,1),west:compass(-1,0),
 equator:c(64,64,48,'#a8cbd3')+p('M31 30L56 26L72 45L60 57L37 51L24 39ZM76 76L98 69L107 89L87 107L73 91Z','#9db893')+e(64,64,48,12,'none').replace('fill="none"','fill="none" stroke="#cc9b7c" stroke-width="5"')+p('M64 16Q32 64 64 112Q96 64 64 16','none','#d7e6dc',2),
 passenger:r(7,10,114,108,'#99b7c2',8)+r(14,17,100,82,'#d4e4df',3)+r(24,48,19,43,'#8ca8af')+g(person(0,0,{shirt:'#bb9e7c',pose:'sit'}),51,41,.8)+l(96,17,96,99,'#96b3bb',3),
 guide:person(35,30,{shirt:'#a1b8a4',pose:'reach'})+l(66,20,66,105,'#a58f6a',4)+p('M66 20H107L96 33L107 46H66Z','#bd9ba8')+g(person(0,0,{shirt:'#a1b6c0'}),90,70,.6)+g(person(0,0,{shirt:'#c0a788'}),112,76,.55),
 host:r(9,103,110,14,'#b7a17b',2)+person(48,27,{shirt:'#9ba7bb',pose:'reach'})+l(68,51,82,40,'#6f8c98',5)+c(85,37,7,'#5e7788')+r(74,8,45,20,'#bbd1c7',7)+p('M81 25L76 36L95 27Z','#bbd1c7'),
 champion:person(64,43,{shirt:'#94b3bc',pose:'armsup'})+r(49,6,30,23,'#dbbf7c',4)+p('M49 11H40Q39 26 53 25M79 11H88Q89 26 75 25','none','#cfb171',4)+r(61,28,7,8,'#bda167',1)+r(53,35,22,4,'#dbbf7c',1)+[ [18,23],[106,25],[16,80],[111,72] ].map(([x,y])=>r(x,y,5,9,'#c9af91',1)).join(''),
 alarm:r(24,100,80,14,'#8b9ea2',4)+p('M32 99V66Q32 36 64 36Q96 36 96 66V99Z','#c88f81')+p('M44 86V65Q44 51 56 49','none','#e3b6a3',6)+p('M64 8V24M13 31L29 42M115 31L99 42','none','#d7b77c',5),
 warning:p('M64 9L122 112H6Z','#e1c487','#b6a06a',4)+r(59,43,10,37,'#7c8073',4)+c(64,96,6,'#7c8073'),
 peace:c(64,64,47,'#d0dcca')+c(64,64,37,'none').replace('fill="none"','fill="none" stroke="#80a6a7" stroke-width="5"')+l(64,27,64,100,'#80a6a7',5)+l(64,63,37,89,'#80a6a7',5)+l(64,63,91,89,'#80a6a7',5),
 campus:r(15,45,97,57,'#ceb897',2)+p('M8 45L64 15L120 45Z','#93a9a8')+[29,52,75,98].map(x=>r(x,53,12,18,'#89aeb9',1)).join('')+r(55,78,20,24,'#93a9a8',1)+p('M6 119Q65 98 122 119','none','#a3bc91',7)+l(62,15,62,2,'#a59876',2),
 workhospital:r(68,15,49,100,'#c3d8d4',4)+r(88,22,10,31,'#c38e83',1)+r(78,32,30,10,'#c38e83',1)+person(29,33,{shirt:'#e4e6d8',pose:'reach'})+r(16,52,26,12,'#a5c4bc',2)+r(70,71,36,34,'#efe3c6',2)+l(77,81,99,81,'#a2b8b2',2),
 lightshine:c(64,52,28,'#e6ce8b')+r(50,78,28,18,'#a6b9bc',3)+r(55,96,18,10,'#8da3aa',2)+[ [64,3,64,14],[12,23,24,31],[116,23,104,31],[4,59,20,59],[124,59,108,59] ].map(q=>l(...q,'#dfc792',4)).join(''),
};
