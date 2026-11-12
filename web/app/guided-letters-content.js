import {byLetter} from '../domain/content.js';
import {WORD_BY_ID} from '../domain/course-content.js';

// These cues support one relaxed demonstration. They are not pronunciation tests.
const cues={
 A:{shape:'对照 A 和 a，看看哪些笔画不同；两种样子都是这位朋友。',sound:'听 apple 开头短短的 /æ/，嘴自然张开，愿意的话跟一次。',play:'用手臂摆一个大大的 A，再用手指在空中画一次。'},
 B:{shape:'看看 B 的两个肚子，再找小写 b：高竖线旁边是右边的肚子。',sound:'双唇轻轻合上再放开，听 ball 开头短短的 /b/。',play:'用积木摆一条高竖线，再在右边摆一个小肚子。'},
 C:{shape:'C 和 c 都像没有合上的圆，开口朝右；找找一大一小。',sound:'听 cat 开头短促的 /k/，手指轻点一下，愿意的话跟一次。',play:'用绳子摆一个有开口的圆，手指沿着它走一遍。'},
 D:{shape:'大写 D 左边直、右边圆；小写 d 的圆肚子在左边，高竖线在右边。',sound:'听 dog 开头短短的 /d/；可以轻点一下手指，跟一次就好。',play:'用手指画一个圆肚子，再在它的右边添一条高竖线。'},
 E:{shape:'看看大写 E 的横线，再看看小写 e 中间的小横线，找出一对。',sound:'听 egg 开头短短的 /ɛ/，嘴自然微张，愿意的话跟一次。',play:'用三根短积木和一根长积木摆一摆大写 E。'},
 F:{shape:'对照 F 和 f 的竖线和横线；小写 f 的上方会弯一下。',sound:'上齿轻碰下唇，轻轻送气，听 fish 开头的 /f/。不用用力吹。',play:'手指从上往下画一条线，再添上横线，描一描 F。'},
 G:{shape:'先看看 G 和 g 各自的样子，再并排找一对；小写 g 在不同字体里会变样。',sound:'听 goat 开头短短的 /ɡ/，愿意的话跟一次，再指指山羊图片。',play:'在纸上画一个大圆弯，家长补上 G 的小横线，孩子沿线描一遍。'},
 H:{shape:'大写 H 是两条竖线连起来；小写 h 是高竖线旁边的一道拱。',sound:'手掌放在嘴前，轻轻呼一口气，听 hat 开头的 /h/。',play:'用两根长积木和一根短积木搭一座 H 小桥。'},
 I:{shape:'小写 i 上面有一点；对照它和大写 I，找出一对。',sound:'听 insect 开头短短的 /ɪ/，和字母名称 /aɪ/ 分开听，愿意的话跟一次。',play:'用手指画一条短竖线，在上方点一点，试试小写 i。'},
 J:{shape:'看看 J 和 j 向下弯的地方，小写 j 上方还有一点。',sound:'听 jam 开头的 /dʒ/，轻轻跟一次，不要求连读很多遍。',play:'在空中画一条向下弯的线，再给小写 j 点上一点。'},
 K:{shape:'K 和 k 都有一条竖线和两条斜线，找找它们相连的地方。',sound:'听 kite 开头短促的 /k/；这里和 cat 开头的声音一样。',play:'摆一根竖积木，再把两根斜积木接到它的中间。'},
 L:{shape:'看看大写 L 的转角，再找高高的小写 l；不要只凭大小猜。',sound:'听 leaf 开头的 /l/，舌尖轻轻抬起，愿意的话跟一次。',play:'用手臂摆一个转角，或用两根积木摆一个大写 L。'},
 M:{shape:'看看 M 的斜线，再看看小写 m 连着的两道拱。',sound:'双唇轻合，轻轻哼 /m/，听 moon 开头的声音。',play:'手指在纸上连续画两道拱，再对照小写 m 看一看。'},
 N:{shape:'看看 N 中间的斜线，再看看小写 n 的一道拱，找出一对。',sound:'听 nest 开头的 /n/，舌尖自然抬起，轻轻跟一次。',play:'用手指画一道拱，再找找它和小写 m 的两道拱有什么不同。'},
 O:{shape:'O 和 o 都是圆圈，一大一小仍是同一个字母。',sound:'听 ox 开头的 /ɑ/，嘴自然张开；这里不是字母名称 /oʊ/。',play:'用手臂或软绳围一个圆，再用手指画一个小圆。'},
 P:{shape:'看看 P 上方的肚子；小写 p 的竖线向下伸，肚子在右边。',sound:'双唇轻合再轻放开，听 pig 开头短短的 /p/。不必大口吹气。',play:'用积木摆一条竖线，再在它的右上边围一个小肚子。'},
 Q:{shape:'看看 Q 圆圈旁的小尾巴；小写 q 的圆肚子在左边，竖线在右边向下伸。',sound:'先指着 qu 一起听 queen 开头的 /kw/：这是两个声音连起来的示范。',play:'画一个圆圈，再给大写 Q 添一条小尾巴。'},
 R:{shape:'看看 R 的肚子和斜腿，再看看小写 r 的短弯，找出一对。',sound:'听 rabbit 开头的 /r/，愿意的话轻轻跟一次，不逐音挑错。',play:'家长画一个 R，孩子沿着竖线、肚子和斜腿慢慢描一遍。'},
 S:{shape:'S 和 s 都有上下两道弯，找找一大一小。',sound:'轻轻送气 /s/，手指像小蛇一样滑动，听 sun 开头的声音。',play:'用绳子摆一条弯弯的小路，手指沿着 S 小路走一遍。'},
 T:{shape:'看看 T 顶上的横线，再看看小写 t 中间的横线，找出一对。',sound:'听 top 开头短短的 /t/，手指轻点一下，愿意的话跟一次。',play:'用两根积木搭一个 T，摸摸横线和竖线相交的地方。'},
 U:{shape:'U 和 u 都在下面转弯；再看看小写 u 右边的短竖线。',sound:'听 up 开头短短的 /ʌ/，可以同时把手向上抬；不是字母名称 /juː/。',play:'用手指从上向下转个弯，再向上画，描一个 U。'},
 V:{shape:'V 和 v 都是两条斜线在下面相遇，找找一大一小。',sound:'上齿轻碰下唇，听 van 开头的 /v/，轻轻跟一次。',play:'两只手臂在下面相遇，摆一个 V，再用两根积木试试。'},
 W:{shape:'看看 W 和 w 连续的转角，和只有一个尖角的 V 比一比。',sound:'嘴唇先轻轻收圆再放开，听 web 开头的 /w/，不用念字母名称。',play:'把两个 V 并排接起来，找找哪里像大写 W。'},
 X:{shape:'X 和 x 都是两条斜线交叉，找找一大一小。',sound:'听 box 结尾的 /ks/：先 /k/，接着 /s/；这里要听词尾，不找首音。',play:'交叉摆两根积木，或让两只手臂轻轻交叉，摆一个 X。'},
 Y:{shape:'看看 Y 上方的两条分岔，再看看小写 y 向下伸的笔画。',sound:'听 yes 开头的 /j/，愿意的话轻轻跟一次；它和名称 /waɪ/ 不同。',play:'用三根积木摆一个分岔的 Y，让手指从上方走到下面。'},
 Z:{shape:'Z 和 z 都有横线和斜线，手指沿着一大一小各走一遍。',sound:'听 zebra 开头轻轻的 /z/，愿意的话发一次轻声嗡嗡音。',play:'手指先横着走、斜着走，再横着走，画一条 Z 小路。'},
};

function content(letter){
 const alphabet=byLetter(typeof letter==='string'?letter.toUpperCase():'');
 if(!alphabet)return null;
 const word=WORD_BY_ID.get(alphabet.example);
 return {alphabet,word,cue:cues[alphabet.upper]};
}
const noteFor=alphabet=>`大小写是同一个字母的两种写法，两种写法都有名称和字母音。${alphabet.note}示范后可以跟一次，不要求精确口型，也不反复纠正。`;

export function getLetterActivity(letter,skill='sound'){
 const item=content(letter);if(!item||!['name','sound','case'].includes(skill))return null;
 const {alphabet:a,word,cue}=item;
 const base={example:a.example,zh:word.zh,image:word.image,ipa:a.ipa,nameIpa:a.nameIpa,note:noteFor(a),play:cue.play};
 if(skill==='name')return {...base,
  setup:`准备 ${a.upper} 和 ${a.lower} 两种写法，可以用屏幕或两张字母卡。`,
  teach:`指着 ${a.upper} 和 ${a.lower}，告诉孩子这是同一个字母的两种写法。点「听示范」，先听它的名字，再听它在单词里的声音。`,
  listen:`把它和另一个学过的字母放在一起，播放名称，让孩子指一指。位置可以换一下。`,
  recall:'先不播放声音，问“它叫什么名字？”等几秒；能辨认出名称就好，卡住再示范。',
 };
 if(skill==='case')return {...base,
  setup:`把 ${a.upper} 和 ${a.lower} 并排放好，可以拿出字母卡或直接看屏幕。`,
  teach:cue.shape,
  listen:'家长指一种写法，让孩子找到同一个字母的另一种写法。先认样子，不要求读出来。',
  recall:'换一下卡片位置，再找一对；可以用不同的字母卡，先由家长确认字体仍能辨认。',
 };
 return {...base,
  setup:`准备 ${a.upper}${a.lower} 和 ${word.zh}的实物或图片。先用中文确认孩子明白“${word.zh}”；生词由家长解释，不考词义。`,
  teach:`${cue.sound}示范依次读字母名称、字母音和 ${a.example}。家长可以指着图片慢说一次。`,
  listen:`先听声音，再在两张学过的字母卡中指一张。${a.upper==='X'?'听的是 box 词尾的声音。':a.upper==='Q'?'听的是 qu 连起来的声音。':''}`,
  recall:'先不播放声音，问“这个字母在刚才的词里发什么声音？”愿意说就说一次；不会时示范，再换个活动。',
 };
}

export function getInitialSoundActivity(letter){
 const item=content(letter);if(!item)return null;
 const {alphabet:a,word,cue}=item,position=a.upper==='X'?'end':'initial';
 const place=position==='end'?'词尾':'开头';
 return {letter:a.upper,example:a.example,zh:word.zh,image:word.image,ipa:a.ipa,position,
  setup:`先用中文确认孩子知道“${word.zh}”是什么意思；不熟就由家长解释或改天再玩。`,
  teach:cue.sound,
  listen:`家长慢说 ${a.example}，一起听${place}的声音。${a.upper==='Q'?'指着 qu，听 /k/ 和 /w/ 连起来，不把它说成 q 单独的一个音。':''}`,
  recall:'这一步只做示范和声音观察，孩子可以指、做动作或跟一次，不考陌生单词，也不计字母掌握。',
  note:noteFor(a),
 };
}

export function getLetterPlay(task,scope=[]){
 const letter=typeof task==='string'?task:task?.letter||task?.id;
 const item=content(letter);if(!item)return null;
 const target=item.alphabet.upper;
 if(task?.activity==='listen'){
  const activity=getInitialSoundActivity(target);
  return {...activity,title:'词里听一听',instruction:`${activity.setup}${activity.listen}愿意的话跟一次，或做${activity.zh}相关的小动作。`,note:`${activity.note}这段会示范声音，不记录掌握；换个活动后再回想。`};
 }
 const other=[...scope].map(value=>content(typeof value==='string'?value:value?.letter||value?.id)).find(value=>value&&value.alphabet.upper!==target);
 // Intervening shape play uses another letter when available, so it does not
 // reveal the answer to the target's upcoming recall question.
 if(other)return {title:'换个字母动一动',letter:other.alphabet.upper,otherLetter:other.alphabet.upper,skill:'case',
  instruction:other.cue.play,note:'家长只指给孩子看，不念名称或字母音。这个小游戏不考对错，也不计掌握。'};
 return {title:'离开屏幕动一动',letter:null,skill:'movement',
  instruction:'把屏幕放下，伸伸手、转转肩，再轮流轻拍两下手，接着回来。',note:'这一小段不提示刚才字母的答案，也不计掌握。'};
}
