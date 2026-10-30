import {test,expect} from '@playwright/test';
const key='abc-garden-v1';
const action=(page,value)=>page.locator(`[data-course="${value}"]`);
const state=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
test.beforeEach(async({page})=>{await page.goto('/#/learn');});
test('map, all word pictures and responsive layouts are available',async({page},info)=>{
 await expect(page.getByRole('heading',{name:'英语，一点点长成大树'})).toBeVisible();
 await page.locator('[data-view="words"]').click();await expect(page.locator('.word-list button')).toHaveCount(40);
 const images=await page.locator('.word-list img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().then(()=>true,()=>false))));expect(images.every(Boolean)).toBe(true);
 for(const size of [{width:1194,height:834},{width:834,height:1194},{width:390,height:844}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:1194,height:834});await page.screenshot({path:`test-results/words-${info.project.name}.png`,fullPage:true});
});
test('listening hides answer labels, tracks hints, and spelling does not turn a hint into independent evidence',async({page})=>{
 await page.locator('[data-view="words"]').click();await page.locator('[data-mode="listen"]').click();
 await expect(page.locator('.word-list')).toBeHidden();await expect(page.locator('.picture-choices')).not.toContainText('apple');
 await action(page,'hint').click();await page.locator('[data-course="choose"][data-word="apple"]').click();
 expect((await state(page)).learning.events.at(-1).result).toBe('assisted');
 await page.locator('[data-mode="spell"]').click();await page.getByLabel('输入单词').fill('Apple');await page.getByRole('button',{name:'检查一下',exact:true}).click();
 expect((await state(page)).learning.events.at(-1)).toMatchObject({skill:'spell',result:'independent'});
 await page.reload();expect((await state(page)).learning.events).toHaveLength(2);
});
test('reading comprehension and advanced content selection work',async({page})=>{
 await page.locator('[data-level="3"]').click();await page.locator('[data-view="read"]').click();
 await page.getByRole('button',{name:'一个小小的决定',exact:true}).click();await expect(page.locator('.story-lines li')).toHaveCount(7);
 await page.getByRole('button',{name:'They try both ideas.',exact:true}).click();expect((await state(page)).learning.events.at(-1)).toMatchObject({item:'library',skill:'read',result:'independent'});
 await action(page,'map').click();await page.locator('[data-view="talk"]').click();await page.getByRole('button',{name:'表达不同的想法',exact:true}).click();
 await expect(page.locator('.dialogue-bubble')).toHaveCount(5);await action(page,'attempt').click();expect((await state(page)).learning.events.at(-1).result).toBe('attempt');
});
test('writing persists, escapes user text, and canvas produces an export',async({page})=>{
 await page.locator('[data-view="write"]').click();await page.getByLabel('写作草稿').fill('My name is <Mia>.');await expect(page.locator('#draft-status')).toHaveText('草稿已保存在本机。');
 await page.getByRole('button',{name:'我喜欢',exact:true}).click();await page.getByRole('button',{name:'这是我',exact:true}).click();await expect(page.getByLabel('写作草稿')).toHaveValue('My name is <Mia>.');
 const box=await page.locator('#trace-canvas').boundingBox();await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+80,box.y+100);await page.mouse.up();
 const download=page.waitForEvent('download');await action(page,'save-canvas').click();expect((await download).suggestedFilename()).toBe('我的书写.png');
 await page.reload();await page.locator('[data-view="write"]').click();await expect(page.getByLabel('写作草稿')).toHaveValue('My name is <Mia>.');
});
test('microphone denial is graceful and a late permission grant is stopped on navigation',async({page})=>{
 await page.addInitScript(()=>{window.tracksStopped=0;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,writable:true,value:()=>Promise.reject(new Error('denied'))});});
 await page.reload();await page.locator('[data-view="words"]').click();await page.locator('[data-mode="speak"]').click();await action(page,'record').click();await expect(page.locator('#record-status')).toContainText('没有获得麦克风权限');
 await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.grantMic=()=>resolve({getTracks:()=>[{stop:()=>window.tracksStopped++}]});});});
 await action(page,'record').click();await action(page,'map').click();await page.evaluate(()=>window.grantMic());await expect.poll(()=>page.evaluate(()=>window.tracksStopped)).toBe(1);
});
test('new pictures and sentence audio remain available offline',async({page,context})=>{
 await expect(page.locator('#offline-label')).toHaveText('离线素材已准备好',{timeout:30000});await context.setOffline(true);await page.reload();
 await page.locator('[data-view="words"]').click();await expect(page.locator('.learning-panel>img')).toBeVisible();await page.getByRole('button',{name:'听句子',exact:true}).click();
 await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);await context.setOffline(false);
});
test('recording stops and releases tracks, produces a local replay, then deletes it',async({page})=>{
 await page.evaluate(()=>{
  window.stoppedTracks=0;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>window.stoppedTracks++}]})}});
  Object.defineProperty(window,'MediaRecorder',{configurable:true,value:class {constructor(){this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['recorded sample'],{type:this.mimeType})});queueMicrotask(()=>this.onstop?.());}}});
 });
 await page.locator('[data-view="talk"]').click();await action(page,'record').click();await expect(page.locator('#record-status')).toContainText('正在录音');
 await action(page,'stop-record').click();await expect(page.locator('#self-recording')).toBeVisible();expect(await page.evaluate(()=>window.stoppedTracks)).toBeGreaterThan(0);
 await action(page,'delete-record').click();await expect(page.locator('#self-recording')).toBeHidden();
 expect((await state(page))?.learning?.events||[]).toHaveLength(0);
});
test('switching words does not restart the five-minute rest reminder',async({page})=>{
 await page.clock.install();await page.locator('[data-view="words"]').click();await page.clock.runFor(4*60000);await action(page,'next-word').click();await page.clock.runFor(60001);await expect(page.locator('#toast')).toContainText('可以休息一下');
});
