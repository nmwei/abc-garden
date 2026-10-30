import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const key='abc-garden-v1';
async function parents(page){
  await page.getByRole('button',{name:'家长小角'}).click();
  const hold=page.getByRole('button',{name:'按住 2 秒进入'});await hold.focus();await page.keyboard.down('Space');
  await expect(page.getByRole('heading',{name:'陪她，慢慢长大'})).toBeVisible();await page.keyboard.up('Space');
}
async function saved(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);}
test.beforeEach(async({page})=>{await page.goto('/');});
test('26 letters, same-device persistence, and touch layouts have no horizontal overflow',async({page},testInfo)=>{
  await page.getByRole('button',{name:'字母朋友',exact:true}).click();
  await expect(page.locator('.alphabet-card')).toHaveCount(26);
  for(const size of [{width:1194,height:834},{width:834,height:1194},{width:390,height:844}]){
    await page.setViewportSize(size);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:1194,height:834});await page.getByRole('button',{name:'今日小旅程'}).click();
  await expect(page.getByRole('heading',{name:/和字母，慢慢/})).toBeVisible();
  await page.screenshot({path:`test-results/home-${testInfo.project.name}.png`,fullPage:true,animations:'disabled'});
});
test('correct, assisted and spoken attempts stay separate through a complete round',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'开始今天的小旅程'}).click();
  for(let i=0;i<8;i++){
    const s=(await saved(page)).session;const task=s.queue[s.index];
    if(task.options){
      if(i===2)await page.getByRole('button',{name:'帮帮我',exact:true}).click();
      else await page.locator(`[data-action="answer"][data-answer="${task.letter}"]`).click();
    }
    await page.locator('[data-action="next"]').click();
  }
  await expect(page.getByRole('heading',{name:'小小旅程，轻轻完成。'})).toBeVisible();
  const data=await saved(page);expect(data.events).toHaveLength(8);expect(data.observations).toEqual({});
  expect(data.events.find(e=>e.skill==='name'&&e.assisted).correct).toBe(false);
  expect(data.events.filter(e=>e.skill==='recallName').every(e=>e.correct===null)).toBe(true);
  expect(errors).toEqual([]);
});
test('reload resumes the question and hint without recording duplicate evidence',async({page})=>{
  await page.getByRole('button',{name:'开始今天的小旅程'}).click();
  await page.locator('[data-action="next"]').click();await page.getByRole('button',{name:'帮帮我',exact:true}).click();
  await page.reload();await expect(page.locator('.choice.revealed')).toHaveCount(1);
  expect((await saved(page)).events).toHaveLength(2);
  await page.locator('[data-action="next"]').click();expect((await saved(page)).events).toHaveLength(2);
});
test('parent settings, sound confirmation, blending, and manual observations work',async({page})=>{
  await parents(page);
  await page.getByRole('button',{name:'全部26个',exact:true}).click();
  await page.locator('[data-setting="soundConfirmed"]').check();
  await page.getByLabel('本轮练习内容').selectOption('sound');await page.locator('[data-setting="blending"]').check();
  await page.getByLabel('每轮时长上限').selectOption('3');await page.getByRole('button',{name:'保存练习设置'}).click();
  await page.getByLabel('观察字母',{exact:true}).selectOption('A');
  await page.getByLabel('观察大小写').selectOption('lower');await page.getByLabel('观察能力').selectOption('recallName');
  await page.getByRole('button',{name:'记录本次观察'}).click();
  const data=await saved(page);expect(data.settings.letters).toHaveLength(26);expect(data.settings.mode).toBe('sound');
  expect(data.observations['A:lower:recallName'].value).toBe('independent');
  await page.getByRole('button',{name:'返回花园',exact:true}).click();await page.getByRole('button',{name:'开始今天的小旅程'}).click();
  expect((await saved(page)).session.queue.some(t=>t.kind==='blend')).toBe(true);
});
test('audio is decodable, offline assets are complete, and an offline reload remains usable',async({page,context})=>{
  await expect(page.locator('#offline-label')).toHaveText('离线素材已准备好',{timeout:30000});
  await page.getByRole('button',{name:'字母朋友',exact:true}).click();
  await page.getByRole('button',{name:'听名称',exact:true}).click();
  await page.getByRole('button',{name:'字母 A 大小写，听字母名称',exact:true}).click();
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
  const audio=await page.evaluate(async()=>{
    const a=new Audio('./assets/audio/name-A.wav');await new Promise((resolve,reject)=>{a.onloadedmetadata=resolve;a.onerror=reject;a.load();});
    return {duration:a.duration};
  });expect(audio.duration).toBeGreaterThan(.1);
  await context.setOffline(true);await page.reload();
  await expect(page.locator('.alphabet-card')).toHaveCount(26);
  await page.getByRole('button',{name:'今日小旅程'}).click();await page.getByRole('button',{name:'开始今天的小旅程'}).click();
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.src)).toContain('prompt-demo.wav');
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
  await page.locator('[data-action="next"]').click();await expect(page.locator('.choices button')).toHaveCount(2);
  await context.setOffline(false);
});
test('pause and the time limit end gently, with no extra completion or auto-passed question',async({page})=>{
  await page.getByRole('button',{name:'开始今天的小旅程'}).click();
  await page.getByRole('button',{name:'休息一下'}).click();
  await page.getByRole('button',{name:'今天先到这里',exact:true}).click();
  expect((await saved(page)).lastSession.completed).toBe(false);expect((await saved(page)).lastSession.letters).toEqual([]);
  await page.getByRole('button',{name:'回到小花园'}).click();await page.getByRole('button',{name:'再玩一小会儿'}).click();
  await page.clock.install();await page.reload();await page.clock.runFor(5*60000+1000);
  await expect(page.getByRole('heading',{name:'今天，先到这里。'})).toBeVisible();
  expect((await saved(page)).lastSession.completed).toBe(false);
});
test('backup export, invalid import, and confirmed restore preserve real observations',async({page})=>{
  await parents(page);await page.getByRole('button',{name:'记录本次观察'}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出学习备份'}).click();
  const file=await download;const stream=await file.createReadStream();let raw='';for await(const chunk of stream)raw+=chunk;
  expect(JSON.parse(raw).observations['A:lower:recallName'].value).toBe('independent');
  await page.locator('#import-backup').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":999}')});
  await expect(page.locator('#toast')).toContainText('不是可识别');
  const data=JSON.parse(raw);data.settings.letters=['X','Y','Z'];
  await page.locator('#import-backup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.getByRole('button',{name:'确认恢复',exact:true}).click();expect((await saved(page)).settings.letters).toEqual(['X','Y','Z']);
});
test('a teacher audio replacement is local, playable and restorable',async({page})=>{
  await parents(page);
  const buffer=await readFile(new URL('../../assets/audio/name-A.wav',import.meta.url));
  await page.locator('#course-audio').setInputFiles({name:'teacher-A.wav',mimeType:'audio/wav',buffer});
  await expect(page.locator('#custom-audio-status')).toContainText('已替换 1 段');
  expect((await saved(page)).customAudio['name-A']).toMatch(/^data:audio\/wav;base64,/);
  await page.getByRole('button',{name:'试听',exact:true}).click();
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
  await page.getByRole('button',{name:'恢复内置示范',exact:true}).click();
  expect((await saved(page)).customAudio['name-A']).toBeUndefined();
});
test('Mandarin instructions use cached clips and demo teaches name, sound and example without assigning sounds by letter case',async({page})=>{
  await page.addInitScript(()=>{
    window.playedClips=[];
    const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){window.playedClips.push(this.src.split('/').at(-1));return original.apply(this,arguments);};
    if(window.speechSynthesis)window.speechSynthesis.speak=()=>{throw new Error('Device speech must not be used');};
  });
  await page.reload();
  await page.getByRole('button',{name:'开始今天的小旅程'}).click();
  await expect(page.getByRole('heading',{name:'名字和声音，都听一听'})).toBeVisible();
  await expect(page.locator('.demo-glyph')).toHaveText('Aa');
  await expect(page.getByRole('button',{name:'听字母名称 A',exact:true})).toContainText('/eɪ/');
  await expect(page.getByRole('button',{name:'听字母音 A',exact:true})).toContainText('/æ/');
  await expect(page.getByRole('button',{name:'听示例词 apple',exact:true})).toBeVisible();
  await expect(page.locator('[data-action="next"]')).toBeInViewport({ratio:1});
  await expect.poll(()=>page.evaluate(()=>window.playedClips),{timeout:20000}).toEqual(['prompt-demo.wav','name-A.wav','prompt-letterSound.wav','sound-A.wav','example-A.wav']);
  const data=await saved(page);expect(data.settings.mode).toBe('name');expect(data.events).toHaveLength(0);expect(data.observations).toEqual({});
  await page.screenshot({path:'test-results/name-and-sound.png',fullPage:true,animations:'disabled'});
});
test('letter-sound and word previews are available without changing assessment mode',async({page})=>{
  await page.getByRole('button',{name:'字母朋友',exact:true}).click();
  await page.getByRole('button',{name:'听字母音 A',exact:true}).click();
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.src)).toContain('sound-A.wav');
  await page.getByRole('button',{name:'听示例词 apple',exact:true}).click();
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.src)).toContain('example-A.wav');
  await page.getByRole('button',{name:'听字母音',exact:true}).click();
  await page.getByRole('button',{name:'字母 B 大小写，听字母音',exact:true}).click();
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.src)).toContain('sound-B.wav');
  const data=await saved(page);expect(data?.settings?.mode||'name').toBe('name');
});
