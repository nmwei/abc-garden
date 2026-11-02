// Original contextual illustrations for completion batch 01. All are teaching cues.
import {rect as r,path as p,line as l,circle as c,ellipse as e,group as g,person,arrow as a} from './direct-scenes.mjs';
const ink='#526e7c',blue='#86aeba',green='#8aa88a',orange='#d8a36f',paper='#efe4cd';
const text=(s,x=64,y=18,size=10)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${size}" font-weight="600" fill="${ink}">${s.replaceAll('&','&amp;').replaceAll('<','&lt;')}</text>`;
const human=(x=64,y=39,shirt=blue,scale=1,pose='stand')=>g(person(0,0,{shirt,pose}),x,y,scale);
const book=r(19,21,90,79,green,5)+l(64,25,64,96,paper,3)+[40,55,70].map(y=>l(28,y,53,y,paper,3)+l(75,y,99,y,paper,3)).join('');
const house=p('M9 53L64 13L119 53Z',blue)+r(20,53,88,51,paper,2)+r(54,74,22,30,green,1)+r(30,65,15,17,blue,1);
const ball=c(64,64,35,orange)+p('M34 47Q74 41 80 96M34 86Q67 57 96 51','none',ink,2);
const bird=e(64,68,33,22,blue)+c(88,51,17,blue)+p('M103 48L120 55L103 60Z',orange)+p('M34 65L10 43L16 78Z',blue)+c(93,48,2,ink)+p('M43 70Q63 43 78 68','none',ink,2);
const rabbit=e(57,78,31,22,'#c5baa6')+c(86,53,19,'#c5baa6')+e(77,24,6,23,'#c5baa6')+e(96,25,6,22,'#c5baa6')+c(93,50,2,ink)+c(25,77,9,paper);
const dog=e(56,71,32,20,orange)+c(87,50,19,orange)+p('M72 39L61 22L61 54Z','#ab8667')+c(93,47,2,ink)+p('M31 85V105M75 86V105M24 67L14 49','none',orange,7);
const apple=(x=64,y=64,s=1)=>g(p('M0 -10C-25 -24 -36 2 -23 21Q-10 36 0 27Q12 36 25 19C37 0 23 -25 0 -10Z','#c88d78')+p('M0 -10Q0 -27 11 -27','none',green,4),x,y,s);
const plant=p('M64 104V43','none',green,4)+p('M63 63Q25 56 35 36Q64 35 64 63M65 80Q102 71 97 49Q66 52 65 80Z',green)+p('M42 86H88L81 108H49Z',orange);
const sun=c(99,26,15,'#dfbc71')+[0,1,2,3,4,5,6,7].map(i=>{const t=i*Math.PI/4;return l(99+Math.cos(t)*19,26+Math.sin(t)*19,99+Math.cos(t)*24,26+Math.sin(t)*24,orange,2);}).join('');
const cloud=c(37,34,17,'#b6c7c7')+c(58,23,22,'#b6c7c7')+c(80,35,18,'#b6c7c7')+r(25,31,67,21,'#b6c7c7',7);
const rain=cloud+[32,54,76].map(x=>l(x,63,x-7,80,blue,3)).join('');
const snow=cloud+[31,60,85].map(x=>l(x-6,71,x+6,71,blue,2)+l(x,65,x,77,blue,2)).join('');
const clock=(hour=3,minute=0)=>c(64,62,39,paper)+c(64,62,33,'#faf6e9')+l(64,62,64+Math.sin(hour*Math.PI/6)*20,62-Math.cos(hour*Math.PI/6)*20,ink,4)+l(64,62,64+Math.sin(minute*Math.PI/30)*29,62-Math.cos(minute*Math.PI/30)*29,ink,2)+c(64,62,3,ink);
const calendar=(label,fill=paper)=>r(16,23,96,77,fill,5)+r(16,23,96,18,blue,3)+l(34,16,34,29,ink,4)+l(93,16,93,29,ink,4)+text(label,64,72,16);
const wash=p('M28 28H82V54','none',blue,11)+p('M56 15V28M43 18H69','none',ink,4)+[66,84].map(y=>p(`M82 ${y}q-7 10 0 13q7 -3 0 -13Z`,blue)).join('')+p('M23 91L57 101L78 96','none','#dcb18d',9);
const boat=p('M12 70H116L91 98H39Z',blue)+p('M21 70L64 30L106 70Z',paper)+p('M64 30V70L87 70Z',green);
const bus=r(9,38,110,53,orange,7)+[18,42,66,90].map(x=>r(x,47,17,22,'#bdd1cf',2)).join('')+c(32,94,10,ink)+c(97,94,10,ink);
const bag=r(30,40,69,63,orange,8)+p('M44 42V28Q64 7 85 28V42','none',ink,5)+r(42,66,45,27,paper,4);
const pencil=p('M29 94L83 21L98 31L44 104L21 116Z',orange)+p('M21 116L29 94L44 104Z',paper)+p('M21 116L24 104L30 109Z',ink);
const gift=r(20,45,87,56,green,3)+r(15,35,97,16,blue,3)+r(58,36,13,65,orange,0)+p('M64 35Q26 34 36 17Q46 5 64 35Q80 4 94 18Q102 34 64 35Z','none',orange,5);
const check=p('M10 20L19 29L36 9','none',green,4);
const cross=p('M13 12L32 31M32 12L13 31','none','#b87869',4);
const star=(x=64,y=30)=>p(Array.from({length:10},(_,i)=>{const t=i*Math.PI/5-Math.PI/2,z=i%2?6:13;return `${i?'L':'M'}${x+Math.cos(t)*z} ${y+Math.sin(t)*z}`;}).join('')+'Z',orange);
const screen=body=>r(10,19,108,77,ink,6)+r(17,26,94,62,'#e8eee0',2)+r(55,96,18,12,blue,2)+r(34,108,60,6,ink,2)+body;
const speech=(label,x=64,y=24)=>r(x-29,y-13,58,25,paper,7)+p(`M${x-13} ${y+10}l-6 10l16 -9Z`,paper)+text(label,x,y+4,10);
const pair=(left,right)=>g(left,1,21,.47)+g(right,67,21,.47);
const steps=(left,right)=>g(left,-1,24,.43)+a(53,63,75,63)+g(right,77,24,.43);
const wave=p('M14 99Q28 89 43 99T73 99T103 99T122 99','none',blue,3);
const school=house+text('SCHOOL',64,66,8);
const library=house+text('LIBRARY',64,66,8);
const plan=r(23,15,82,91,paper,3)+[28,52,76].map(y=>g(check,32,y,.45)+l(55,y+10,93,y+10,blue,3)).join('');
const face=c(64,61,34,'#e2bd8d')+c(52,53,2,ink)+c(77,53,2,ink)+p('M49 70Q64 85 79 70','none',ink,3);
const swimmer=p('M16 89Q29 78 43 89T71 89T99 89T121 89','none',blue,4)+c(83,63,10,'#dcb18d')+p('M37 78L67 67L51 50L31 60','none',green,9);
const ruler=r(16,55,96,25,orange,2)+[26,38,50,62,74,86,98].map((x,i)=>l(x,55,x,i%2?64:70,ink,2)).join('');
const bulbs=c(64,46,23,'#e1c783')+p('M50 65V82H78V65','none',ink,4)+l(52,90,76,90,ink,4)+p('M26 23L18 15M102 23L110 15M64 14V4','none',orange,3);
const frequency=n=>Array.from({length:7},(_,i)=>r(8+i*16,38,13,27,i<n?green:paper,2)+(i<n?g(check.replaceAll(green,paper),8+i*16,41,.31):'')).join('')+text('1  2  3  4  5  6  7',64,83,9);
const teacher=human(29,42,green,.85)+r(55,22,63,56,'#c1d0bc',3)+text('A B C',87,52,10)+l(42,57,75,45,ink,2);
const beach=sun+p('M7 87Q61 56 120 86V107H7Z',paper)+wave+human(42,49,green,.7);
const tree=p('M61 102V42','none','#aa8c68',7)+c(62,37,29,green)+c(36,53,22,green)+c(89,53,22,green);
const timerMinute=clock(3,0)+p('M64 24A38 38 0 0 1 68 24','none',orange,7)+text('1 min',64,106,10);
const candy=r(41,44,47,36,orange,5)+p('M41 46L16 35V89L41 77M88 46L113 35V89L88 77Z',blue)+l(53,47,73,77,paper,5);
const map=p('M29 37L50 30L75 41L97 32V76L75 87L50 76L29 84Z',paper)+p('M50 30V76M75 41V87M35 67Q62 39 89 63','none',blue,3)+c(72,58,5,orange);
// Each entry is a reviewed scene, not a generic picture with the headword pasted on it.
const cue=(body,caption,topic,note)=>({body,caption,topic,note});
export const contextScenes={
 after:cue(steps(school,g(ball,20,24,.7)),'school, then play','school','先上学再玩球；箭头强调放学后。'),
 again:cue(human(27,46,green,.8)+speech('Hello!',86,35)+p('M94 65A22 22 0 1 1 68 88','none',orange,3)+a(68,88,77,82),'say it once more','actions','说话气泡和回转箭头提示再说一遍。'),
 age:cue(human(26,52,green,.75)+r(61,60,53,32,paper,3)+[68,77,86,95,104].map(x=>l(x,48,x,60,orange,2)+c(x,44,2,orange)).join('')+text('5',87,84,20),'five years old','people','五根生日蜡烛和数字表示年龄。'),
 ago:cue(pair(calendar('2 days ago',green),calendar('TODAY'))+a(81,97,31,97),'two days ago','school','今天与两天前对照，箭头指向过去。'),
 also:cue(pair(apple(),p('M64 20Q46 30 44 49Q9 91 64 101Q119 91 84 49Q82 30 64 20Z',green))+text('+',64,67,19),'apples and pears too','food','苹果和梨以加号连接，对应也喜欢梨。'),
 always:cue(frequency(7)+g(wash,47,2,.28),'wash before lunch, daily','actions','连续七天均洗手，提示总是的频率。'),
 any:cue(human(25,47,green,.75)+human(104,47,blue,.75)+speech('Questions?'),'any questions?','school','向同学询问是否有问题，需要例句理解 any。'),
 bad:cue(pair(candy,p('M40 22Q23 22 23 50Q23 102 49 102L64 71L80 102Q106 102 106 50Q106 22 88 22Q66 33 40 22Z',paper))+g(cross,82,81,.7),'too much candy: bad','food','糖果与牙齿及叉号表示吃糖过多对牙齿不好。'),
 be:cue(human(64,40,green)+speech('Shh...'),'be quiet','school','安静的说话场景辅助 be quiet，be 本身依赖语法。'),
 beautiful:cue(plant+star(22,34)+star(106,60),'a beautiful flower','nature','花朵和欣赏标记提示美丽评价，不作唯一识图答案。'),
 because:cue(steps(snow,human(64,34,green)+r(49,45,30,40,orange,4)),'cold, so wear a coat','clothes','寒冷天气导致穿外套，图示原因关系。'),
 before:cue(steps(wash,apple()),'wash, then eat','actions','先洗手后吃东西；用顺序表达 before。'),
 begin:cue(g(ball,76,47,.32)+human(34,42,green,.85)+r(6,16,49,18,paper,3)+text('START',31,29,9)+a(49,78,85,78),'begin the game','play','开始线和向球前进的动作提示开始游戏。'),
 best:cue(beach+star(91,54)+text('1',91,57,9),'my best holiday day','feelings','海滩假日和第一名星标提示主观的最美好一天。'),
 busy:cue(human(27,41,green,.85,'reach')+r(57,80,64,23,blue,2)+r(64,62,44,17,orange,3)+e(86,62,22,6,paper)+l(58,68,64,68,ink,3)+l(108,68,116,68,ink,3)+p('M73 43Q66 34 73 24M89 43Q82 34 89 24','none',ink,2)+g(clock,88,1,.25),'busy cooking','actions','人物同时照看锅和计时器，表示忙着做饭。'),
 but:cue(g(bag,19,28,.65)+text('small',34,24)+text('heavy',96,24)+a(103,53,103,93),'small, but heavy','school','小包与向下的重量箭头提示转折，不能靠物体单独辨义。'),
 chinese:cue(human(27,47,green,.8)+human(103,47,blue,.8)+speech('你好'),'speaking Chinese','school','中文问候文字表示语言，不用国旗替代语言。'),
 cute:cue(rabbit+star(24,33),'a cute rabbit','animals','小兔场景提示可爱这一主观评价。'),
 dear:cue(r(12,21,104,80,paper,3)+text('Dear Grandma,',64,46,11)+text('Thank you!',64,69,11)+g(gift,45,72,.29),'a letter to Grandma','people','信件称呼 Dear Grandma 表达亲爱的用法。'),
 difficult:cue(human(27,45,green,.8)+r(59,38,60,52,paper,3)+text('7 + 8 = ?',89,65,9)+speech('Hmm...',66,20),'a difficult question','school','人物思考多步数字题表示相对困难。'),
 early:cue(g(clock(2.75,45),-5,4,.62)+human(96,43,green,.8)+text('2:45',29,24,10)+text('show 3:00',80,104,10),'arrive before the show','school','到达时间 2:45 早于开演 3:00。'),
 easy:cue(r(24,35,79,54,paper,4)+text('1 + 1 = 2',64,66,14)+g(check,84,78,.8),'easy to learn','school','简单算式和完成标记提示相对容易。'),
 english:cue(g(book,16,24,.75)+speech('Hello!'),'learning English','school','书本和英文问候文字表示学习英语。'),
 every:cue(frequency(7)+g(book,45,1,.3),'read every day','school','七天都读书，every 修饰每一天。'),
 famous:cue(p('M7 81L34 62L60 76L88 48L122 62','none','#b5a184',13)+[22,51,83,108].map((x,i)=>r(x,44-i%2*15,16,24,paper,1)+r(x,40-i%2*15,5,7,ink,0)+r(x+11,40-i%2*15,5,7,ink,0)).join('')+star(17,20)+star(111,18),'the famous Great Wall','places','长城城墙配公众熟知标记，说明 famous 需要背景知识。'),
 fine:cue(face+speech('I am fine.',64,13),'feeling well','feelings','健康表情和自我问候，不使用 fine 罚款义。'),
 free:cue(calendar('3 pm: free')+g(ball,81,78,.25),'free this afternoon','play','下午空白的日程表示有空，不表示免费。'),
 great:cue(bulbs+star(20,69)+star(108,71),'a great idea','feelings','主意灯泡和称赞星标表示很棒。'),
 helpful:cue(human(22,43,green,.8)+human(103,43,blue,.8)+g(bag,38,53,.43)+a(34,62,61,62),'help carry a bag','people','两个人合作搬包，突出帮助行为。'),
 him:cue(human(22,44,green,.8)+human(103,44,blue,.8)+g(ball,45,43,.30)+a(55,40,92,40),'give him the ball','people','球由说话者传给另一人物，提示宾格 him。'),
 hometown:cue(g(house,1,17,.55)+wave+human(98,43,green,.8)+speech('My home',63,17),'my hometown by the sea','places','海边的家与归属气泡说明家乡，不仅是任意房子。'),
 hour:cue(pair(clock(2),clock(3))+a(48,91,83,91)+text('60 min',64,20,12),'one hour','school','两点至三点的钟面表示一个小时。'),
 hurry:cue(human(24,43,green,.85,'reach')+g(bus,64,23,.46)+a(39,92,91,92)+p('M6 54H15M5 68H15','none',orange,3),'hurry to catch the bus','travel','朝公交车快步赶去，速度线提示匆忙。'),
 idea:cue(human(28,44,green,.85)+g(bulbs,66,5,.45)+g(ball,73,69,.27),'an idea for a game','play','人物想到球类游戏，灯泡表示想法。'),
 interesting:cue(g(book,26,26,.6)+human(23,45,green,.8)+speech('Tell me more',81,18),'an interesting story','school','人物专注故事并想听更多，提示兴趣。'),
 internet:cue(screen(g(map,19,6,.7))+c(23,12,6,orange)+c(111,107,6,orange)+p('M23 12H106V21M111 107H90','none',blue,2),'find a map online','school','电脑中的地图与网络连接点提示互联网。'),
 it:cue(g(bird,25,26,.65)+speech('It is a bird.')+a(15,90,56,77),'it refers to the bird','animals','箭头把 it 指向鸟，需要句子理解指代。'),
 its:cue(dog+a(13,20,23,60),'the dog and its tail','animals','箭头指向狗尾，强调所属关系。'),
 job:cue(teacher+text('teacher',64,107,10),'her job: teaching','people','教师工作场景提示 job 的职业义。'),
 last:cue(pair(calendar('LAST WEEK',green),calendar('THIS WEEK'))+a(82,99,30,99),'the previous week','school','本周与上周对照，表达上一个。'),
 late:cue(g(school,66,28,.45)+human(23,37,green,.85)+text('starts 8:00',63,16,10)+text('8:10',29,110,12),'arrive after school starts','school','8:10 到达晚于 8:00 上课，明确迟到关系。'),
 live:cue(g(house,48,7,.6)+human(24,44,green,.85)+g(tree,1,24,.34)+speech('My home',70,17),'live near the park','places','家在公园旁，表达居住而非现场的 live。'),
 lot:cue(Array.from({length:9},(_,i)=>g(book,8+i%3*38,20+Math.floor(i/3)*26,.24)).join(''),'a lot of books','school','多排书表示 a lot of 的大量义。'),
 lovely:cue(beach+star(18,24),'a lovely day','feelings','阳光海边活动表示美好的一天，不等同 cute 的动物图。'),
 make:cue(steps(r(19,27,90,65,paper,2),boat)+human(64,12,green,.27),'make a paper boat','actions','纸张变成纸船，箭头表达制作过程。'),
 meet:cue(g(library,43,4,.47)+human(26,48,green,.8)+human(103,48,blue,.8)+a(8,94,42,94)+a(120,94,86,94),'meet at the library','people','两人从两侧向图书馆会合。'),
 minute:cue(timerMinute,'wait one minute','school','钟面顶部高亮一分钟，配 1 min 单位。'),
 miss:cue(teacher+text('Miss Wang',64,107,11),'Miss Wang teaches us','people','以文字称呼老师，不从外貌推断婚姻。'),
 mr:cue(teacher+text('Mr Brown',64,107,11),'Mr Brown, our teacher','people','称呼 Mr Brown 对应先生，需文字背景。'),
 mrs:cue(g(book,68,41,.4)+human(28,43,green,.85)+text('Mrs Green',64,18,12),'Mrs Green is reading','people','Mrs 是称呼用法，图片不通过外观判断婚姻。'),
 ms:cue(g(library,65,24,.45)+human(25,42,green,.85)+text('Ms Lee',64,18,12),'Ms Lee at the library','people','Ms 不标明婚姻状况，借助名字说明称呼。'),
 much:cue(r(38,25,52,72,'#dbe5da',4)+r(41,49,46,44,blue,2)+text('?',64,42,16)+text('water',64,107,10),'how much water?','food','容器中的水量和问号提示不可数名词数量。'),
 must:cue(human(27,44,green,.85)+r(83,15,28,72,ink,5)+c(97,29,8,'#c68574')+c(97,51,8,'#b6ab8d')+c(97,73,8,'#9cae9c')+l(8,103,70,103,orange,3),'must stop at red','travel','人物停在红灯前，提示必须遵守的要求。'),
 name:cue(human(29,44,green,.85)+r(59,45,61,34,paper,3)+text('Mia',89,67,15),'my name is Mia','people','人物与姓名牌关联，表示名字。'),
 never:cue(frequency(0)+r(73,86,49,18,ink,0)+l(78,95,116,95,paper,1)+g(ball,75,78,.24)+g(cross,78,73,.9),'never play on the road','actions','七天均无此行为，并叉掉路上玩球。'),
 next:cue(pair(calendar('THIS WEEK'),calendar('NEXT WEEK',green))+a(31,98,89,98),'the following week','school','本周指向下周，表示下一个。'),
 nice:cue(human(25,44,green,.8,'wave')+human(102,44,blue,.8,'wave')+speech('Hello!'),'nice to see you','feelings','相遇问候的愉快情境。'),
 "o'clock":cue(clock(3)+text('3:00',64,111,13),"three o'clock",'school','时针指三、分针指十二，表示整点。'),
 off:cue(pair(bulbs,g(bulbs.replaceAll('#e1c783','#b6b8ab'),0,0,1))+a(51,98,80,98),'turn the light off','home','亮灯到熄灯；右侧删除光芒后表达关闭。'),
 often:cue(frequency(5)+g(ball,87,79,.25),'play often','play','七天有五天活动表示经常，与总是和有时区别。'),
 should:cue(human(25,45,green,.8)+human(102,45,blue,.8)+g(gift,43,51,.34)+speech('Be kind'),'we should be kind','people','友善相处作为建议情境，should 需要句子理解。'),
 so:cue(steps(rain,g(house,0,0,1)+human(64,62,green,.50)),'rain, so stay inside','home','下雨导致待在屋内，箭头表达结果。'),
 sometimes:cue(frequency(2)+g(school,77,73,.27),'sometimes walk to school','school','七天只有两天步行上学，提示有时。'),
 strong:cue(e(55,69,35,21,orange)+p('M72 58L78 33L92 25L104 38L118 44L115 55L97 51L91 78Z',orange)+p('M83 30L80 17L89 21L91 28Z',orange)+p('M78 35L73 43L71 52','none','#95795d',5)+p('M24 65Q8 53 12 88','none','#95795d',7)+p('M31 84V106M47 85V106M72 84V106M85 80V104','none','#a78765',7)+c(100,38,2,ink)+l(26,107,37,107,ink,3)+l(67,107,78,107,ink,3),'a big, strong horse','animals','大马和粗壮腿部提示强壮，需要语境评价。'),
 subject:cue(pair(g(book,0,0,1)+r(32,42,65,23,paper,2)+text('Math',64,59,15),g(book,0,0,1)+r(32,42,65,23,paper,2)+text('Art',64,59,15)),'school subjects','school','数学和美术两本学科书表达科目类别。'),
 sure:cue(human(24,45,green,.8)+g(bag,64,30,.46)+speech('Yes, mine.'),'sure it is my bag','feelings','认出自己的包并明确确认，表达确定。'),
 take:cue(human(27,42,green,.85,'reach')+p('M65 48Q90 13 116 48Z',blue)+p('M90 48V93Q90 106 78 98','none',ink,3)+a(100,23,54,40),'take an umbrella','actions','手伸向雨伞，表示拿上随身带走。'),
 tell:cue(human(25,45,green,.8)+human(104,45,blue,.8)+g(book,43,66,.33)+speech('Once upon...'),'tell me a story','actions','一人向另一人讲故事的场景。'),
 thank:cue(human(25,45,green,.8)+human(104,45,blue,.8)+g(gift,43,59,.32)+speech('Thank you!'),'thank you for helping','people','收到帮助后表达感谢。'),
 those:cue(human(20,43,green,.85)+[70,93,111].map(x=>g(bird,x-8,7,.15)).join('')+a(35,63,87,40),'those birds over there','animals','指向远处多只鸟，突出复数远指。'),
 time:cue(clock(10,10)+speech('What time?'), 'ask the time','school','钟面与询问时间气泡。'),
 try:cue(human(23,43,green,.85)+r(65,76,48,26,green,3)+g(cross,73,43,.65)+a(47,61,78,61)+speech('Try again',79,19),'try one more time','actions','未成功后再次尝试搭积木。'),
 us:cue(human(19,46,green,.75)+human(44,46,green,.75)+human(105,46,blue,.75)+g(ball,51,62,.29)+a(94,39,50,39),'come play with us','people','两位说话者邀请另一人加入，us 为宾格复数。'),
 use:cue(ruler+l(24,83,91,83,ink,2)+p('M91 83L108 51','none',orange,5)+p('M110 44L105 62L93 68','none','#dcb18d',6),'use a ruler','school','尺旁画线的手，强调使用工具。'),
 very:cue(r(43,20,43,76,paper,5)+r(46,53,37,39,blue,3)+text('cold',22,67,10)+text('VERY',64,110,12)+g(snow,2,3,.30),'very cold water','feelings','冷水和雪花强调程度，需要 very cold 的搭配。'),
 warm:cue(sun+human(44,42,green)+[51,66,81].map(x=>l(x,15,x-14,41,orange,2)).join(''),'warm sunshine','nature','阳光照在脸上的温暖情境。'),
 welcome:cue(g(school,37,0,.54)+human(20,44,green,.8,'wave')+human(108,44,blue,.8)+speech('Welcome!'),'welcome to our school','school','校门口挥手迎接。'),
 whose:cue(g(bag,36,35,.47)+human(17,48,green,.75)+human(108,48,blue,.75)+speech('Whose bag?'),'who owns this bag?','people','包与两个可能主人关联，通过提问表达谁的。'),
 why:cue(human(27,44,green,.85)+speech('Why?',88,37)+r(6,8,113,9,'#c3dbe0',2),'why is the sky blue?','school','抬头看蓝天并问为什么，表示原因提问。'),
 wish:cue(g(gift,23,35,.65)+speech('Happy birthday!'),'wish you a happy birthday','people','生日礼物与祝福气泡表达祝愿。'),
 wonderful:cue(beach+star(21,23)+star(100,68),'a wonderful beach day','feelings','开心的海滩一天，提示精彩美好的评价。'),
 young:cue(g(bird,38,50,.45)+p('M17 94Q64 115 112 94','none','#b29971',12)+speech('not flying yet'),'a young bird in its nest','animals','巢里尚不会飞的幼鸟，避免用小体型单独判断年龄。'),
 your:cue(human(22,44,green,.8)+human(105,44,blue,.8)+g(pencil,54,39,.46)+a(47,26,100,43),'is this your pencil?','people','铅笔归属指向对话的另一人，说明你的。'),
 abandon:cue(g(plan,5,14,.62)+human(101,43,green,.85)+a(82,99,26,99)+speech('Keep our plan'),'do not abandon our plan','actions','人物回到计划旁表示不放弃，配否定例句理解。'),
 ability:cue(swimmer+g(check,83,10,.9),'the ability to swim','sports','游泳动作表示一种能力，不以泛指人物头像代替。'),
 able:cue(swimmer+speech('I can swim',64,20),'able to swim','sports','游泳和能够表达结合，区别 ability 名词与 able 形容词。'),
 abnormal:cue(pair(sun,snow)+text('SUMMER',64,14,11)+text('unusual here',64,106,10),'snow in summer here','nature','本地夏天异常下雪，对比常见天气，避免给人物贴异常标签。'),
 aboard:cue(p('M9 70H119L98 101H32Z',blue)+r(24,40,40,30,paper,1)+r(33,22,24,19,green,1)+human(87,35,green,.52)+l(69,64,113,64,ink,2)+wave,'people aboard a ship','travel','人物位于船甲板上，而非岸上。'),
 abroad:cue(pair(map,map)+text('COUNTRY A',31,22,8)+text('COUNTRY B',98,22,8)+a(35,104,96,104),'travel to another country','travel','两国地图之间出行，表达国外而非单纯远处。'),
 absence:cue([27,99].map(x=>human(x,41,green,.8)).join('')+r(53,69,25,9,orange,1)+l(58,78,58,99,orange,3)+l(74,78,74,99,orange,3)+text('Tom?',65,46,10),'Tom is not here','school','同学间留着汤姆的空座位，表达缺席状态。'),
 absent:cue(g(school,39,2,.51)+r(41,71,39,8,orange,1)+l(46,79,46,102,orange,3)+l(75,79,75,102,orange,3)+speech('Tom is away'),'absent from class','school','教室背景与空座椅说明缺席。'),
 absolutely:cue(human(29,43,green,.85)+speech('Yes, 100%!',87,34)+g(check,67,67,1),'absolutely sure','feelings','确定回答和 100% 表达程度，仅用于 absolutely sure。'),
 abstract:cue(r(13,17,102,85,paper,3)+c(44,47,22,blue)+p('M55 92L78 30L108 92Z',orange)+l(21,88,97,38,green,7),'abstract art','music','几何色块画作为抽象艺术实例，不把所有抽象含义等同画作。'),
 academic:cue(g(book,17,12,.75)+r(35,32,23,40,paper,2)+g(plant,33,32,.20)+r(29,92,70,15,paper,2)+text('PLANT STUDY',64,102,8),'academic books','school','植物研究书籍表达学术内容属性，需文字说明。'),
 accent:cue(human(25,47,green,.8)+human(104,47,blue,.8)+speech('Hello!',64,18)+p('M14 88Q21 67 28 88T42 88M84 86Q87 77 91 86T99 86T107 86T115 86','none',orange,2),'same words, different sounds','school','同一句话配不同语音曲线；口音需通过听读辨别，图只辅助理解。'),
 accept:cue(human(24,44,green,.8,'reach')+human(104,44,blue,.8,'reach')+g(gift,45,51,.32)+a(38,31,91,31),'accept your gift','actions','礼物从赠送者传到接受者手中，对应肯定例句。'),
 access:cue(g(library,43,4,.54)+human(24,46,green,.8)+g(check,73,79,.85)+a(35,83,75,83),'allowed to use the library','school','图书馆入口和允许标记，突出使用权。'),
 accompany:cue(human(20,47,green,.75)+r(83,64,39,30,ink,2)+r(87,68,33,8,paper,0)+[91,100,109].map(x=>r(x,68,3,5,ink,0)).join('')+r(48,91,27,5,orange,1)+l(51,96,51,109,orange,3)+g(person(0,0,{shirt:blue,pose:'sit'}),61,51,.68)+p('M65 63L83 69L95 69','none','#dcb18d',4)+text('♪',20,25,20)+text('♪',104,30,20),'piano with a singer','music','钢琴演奏者为歌唱者伴奏，不使用陪同义。'),
 'according to':cue(steps(plan,plan+g(check,74,76,.9)),'follow the plan','school','从计划到逐项完成，表达按照计划。'),
 account:cue(screen(r(30,39,68,30,paper,3)+text('BANK',64,51,10)+text('account',64,65,9))+human(15,56,green,.55),'check a bank account','home','银行账户界面和人物查看动作，避免把 account 画成计算器。'),
};
// The unlit bulb must have no outgoing light rays.
contextScenes.off.body=pair(bulbs,r(50,65,28,17,paper,2)+c(64,46,23,'#b6b8ab')+p('M50 65V82H78V65','none',ink,4)+l(52,90,76,90,ink,4))+a(51,98,80,98);
// Add actual petals; leaves alone would not match the flower example.
contextScenes.beautiful.body=plant+[0,1,2,3,4].map(i=>e(64+Math.cos(i*Math.PI*2/5)*12,34+Math.sin(i*Math.PI*2/5)*12,9,9,'#c98e83')).join('')+c(64,34,7,orange)+star(22,34)+star(106,60);
export function renderContextScene(id){
 const scene=contextScenes[id];if(!scene)throw Error(`Missing batch 01 scene: ${id}`);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 128 128"><rect width="128" height="128" rx="10" fill="#faf6e9"/>${scene.body}${text(scene.caption,64,122,8)}</svg>\n`;
}
