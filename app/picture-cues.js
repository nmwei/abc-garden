// A picture may identify an object directly or only supply context for a word.
// Context cards remain available for listening/speaking, but are not picture-quiz answers.
const directByTopic={
 people:new Set('person|people|child|children|baby|boy|girl|man|woman|adult|family|doctor|farmer|cook|chef|firefighter|police officer|pilot|astronaut|scientist|artist|singer|dancer|builder|mechanic|clown|king|queen|princess|prince|fairy|mermaid|superhero|robot'.split('|')),
 body:new Set('head|face|hair|nose|mouth|lip|tongue|tooth|teeth|foot|feet|leg|arm|finger|thumb|palm|fist|muscle|bone|brain|heart|lungs|eyes|beard|mustache|curly hair|red hair|white hair|footprints'.split('|')),
 colors:new Set('red|yellow|green|blue|purple|brown|black|white|pink|rainbow colors|circle|square|triangle|diamond shape|heart shape|star shape'.split('|')),
 feelings:new Set('happy|sad|angry|excited|surprised|scared|worried|sleepy|tired|calm|silly|confused|bored|sick|hot|cold|smile|laugh|cry|frown|wink|yawn|sneeze'.split('|')),
};
const cueWords=new Set('music|recycling|slice|ballet|theater|mix|clean|yes|up|grain|hot chocolate|cocoa|breakfast|lunch|dinner|snack|meal|dessert|picnic|pet|kitten|puppy|pony|lamb|piglet|duckling|beak|claw|tail|fur|wool|horn|antler|hoof|whisker|grasshopper|alligator|tortoise|animal|wild animal|farm animal|sea animal|pupil|classmate|textbook|storybook|dictionary|cover|number|letter|alphabet|word|sentence|story|list|homework|answer|school bus|art|science|math|reading|writing|drawing|lesson|break time|home|garden|armchair|lamp|bedroom|pillow|blanket|quilt|bathroom|brush|tissue|laundry|kitchen|bottle|rope|screw|nut|doorknob|handle|electricity|photo|stamp|collar|button|pocket|shoelace|sleeve|uniform|costume|sky|snowball|thunder|sunshine|world|space|moonlight|hill|lava|sand|lake|stream|woods|field|grass|seed|root|stem|branch|trunk|bark|twig|bamboo|pollen|soil|mud|pebble|reef|spring|summer|autumn|fall|winter|season|weather|temperature|day|night|morning|afternoon|evening|midnight|noon|today|tomorrow|yesterday|week|month|year|fuel|airport|takeoff|landing|paddle|oar|life jacket|camp|camping|passport|journey|trip|vacation|holiday|diving|running|walking|hiking|climbing|skating|skiing|snowboarding|sledding|exercise|stretch|yoga|balance|gymnastics|cartwheel|jump rope|net|prize|winner|race|finish line|score|player|coach|referee|practice|toy|board game|craft|origami|glitter|party|birthday|celebration|festival|musical note|melody|rhythm|beat|drumstick|piano key|instrument|concert|band|stage'.split('|'));
const directPlaces=new Set('building|office|hotel|hospital|shop|store|post office|bank|factory|stadium|cinema|circus|castle|tower|fountain|statue|church|mosque|temple|shrine|elevator'.split('|'));
export function isPictureCue(word,topic){
 if(topic==='actions')return true;
 if(topic==='places')return !directPlaces.has(word);
 if(directByTopic[topic])return !directByTopic[topic].has(word);
 return cueWords.has(word);
}
