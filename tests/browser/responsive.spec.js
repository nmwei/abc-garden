import {openParents,unlockParents,addPending} from './parent-helpers.js';
import {test,expect} from '@playwright/test';
test('main learning and parent screens fit the device and preserve usable word proportions',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fit=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/');await fit();await page.getByRole('button',{name:'看图学词',exact:true}).click();await page.locator('[data-filter=all]').click();await fit();
 await expect.poll(()=>page.locator('.word-browser').evaluate(e=>e.querySelectorAll('.word-list [data-course=word]').length===Number(e.dataset.pageSize))).toBe(true);
 const browser=await page.locator('.word-browser').boundingBox(),workspace=await page.locator('.word-workspace').boundingBox();
 if(page.viewportSize().width>760){expect(browser.width/workspace.width).toBeGreaterThan(.6);expect(await page.locator('.word-topic-select').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
 else{await expect(page.locator('#word-topic')).toBeVisible();await page.locator('#word-topic').selectOption('animals');await expect(page.locator('.english-word')).toHaveText('cat');}
 expect(await page.locator('.word-browser .word-list').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
 await page.screenshot({path:`test-results/layout-words-${info.project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'听音找图',exact:true}).click();await expect(page.locator('.word-browser')).toBeHidden();await fit();
 await page.getByRole('button',{name:'拼一拼',exact:true}).click();await page.locator('#spell-input').fill(page.viewportSize().width>760?'apple':'cat');await page.getByRole('button',{name:'检查一下',exact:true}).click();await expect(page.locator('.feedback')).toContainText('拼出来啦');await fit();
 await openParents(page);await page.locator('#offline-settings>summary').click();await fit();await expect(page.locator('#offline-download')).toBeEnabled();await page.locator('#offline-download').click();await expect(page.locator('#offline-plan')).toContainText('本次需下载');await fit();await page.screenshot({path:`test-results/layout-parents-${info.project.name}.png`,fullPage:true});await page.getByRole('button',{name:'暂不下载',exact:true}).click();
 await page.locator('.nav [data-action="learn"]').click();await page.locator('[data-view="read"]').click();await fit();await page.screenshot({path:`test-results/layout-reading-${info.project.name}.png`,fullPage:true});
 await page.locator('[data-course="map"]').click();await page.locator('[data-view="talk"]').click();await fit();await page.locator('[data-course="map"]').click();await page.locator('[data-view="write"]').click();await fit();
 expect(errors).toEqual([]);
});
test('narrow phone and portrait tablet layouts have no horizontal overflow',async({page})=>{
 for(const viewport of [{width:320,height:740},{width:834,height:1194},{width:1024,height:768},{width:1100,height:834},{width:1099,height:834}]){await page.setViewportSize(viewport);for(const route of ['words','parents','letters','learn']){await page.goto('/#/'+route);await unlockParents(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}}
});

test('navigation stays readable and preserves the selected letter across tablet rotations',async({page})=>{
 await page.goto('/#/letters');await page.getByRole('button',{name:'查看字母 F 大小写',exact:true}).click();
 for(const viewport of [{width:1194,height:834},{width:834,height:1194},{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:320,height:740},{width:1440,height:1000},{width:1100,height:834},{width:1099,height:834}]){
  await page.setViewportSize(viewport);
  await expect(page.locator('.nav button')).toHaveCount(3);
  await expect(page.locator('.nav [data-action=library]')).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('button',{name:'查看字母 F 大小写',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'家长小角',exact:true})).toBeVisible();
  const wide=viewport.width>=1100;
  if(wide)await expect(page.locator('.parent-label')).toBeVisible();else await expect(page.locator('.parent-label')).toBeHidden();
  await expect(page.locator('.parent-nav svg')).toBeVisible();
  for(const button of await page.locator('.nav button,.parent-nav').all()){
   const rect=await button.boundingBox();expect(rect.width).toBeGreaterThanOrEqual(44);expect(rect.height).toBeGreaterThanOrEqual(44);
   await expect(button.locator('.nav-icon,svg').first()).toBeVisible();
  }
  await expect(page.locator('.nav-letter')).toHaveText('Aa');
  for(const button of await page.locator('.nav button').all()){
   const visual=await button.locator('.nav-icon').boundingBox(),label=await button.locator(':scope > span').last().boundingBox();
   expect(Math.abs(visual.y+visual.height/2-label.y-label.height/2)).toBeLessThan(1);
   expect(label.x-visual.x-visual.width).toBeGreaterThanOrEqual(5);
  }
  for(const svg of await page.locator('.nav svg').all())await expect(svg).toBeVisible();
  const header=await page.locator('.topbar').boundingBox(),main=await page.locator('#main').boundingBox();
  if(wide)expect(main.x).toBeGreaterThanOrEqual(header.x+header.width);else expect(main.y).toBeGreaterThanOrEqual(header.y+header.height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 // The icon-only parent entry must retain its name and the existing long-press gate.
 await page.setViewportSize({width:834,height:1194});
 await page.getByRole('button',{name:'家长小角',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.locator('#word-editor')).toHaveCount(0);
 await page.getByRole('button',{name:'取消',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await openParents(page);await expect(page.locator('#word-editor')).toBeVisible();
 await page.locator('.nav [data-action=words]').click();await expect(page.locator('.nav [data-action=words]')).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'家长小角',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
});

test('home cards follow the available width with and without a navigation rail',async({page},info)=>{
 await page.goto('/');
 for(const viewport of [{width:1440,height:1000},{width:1194,height:834},{width:834,height:1194},{width:1100,height:834},{width:390,height:844},{width:320,height:740}]){
  await page.setViewportSize(viewport);
  const contentWidth=await page.locator('.content-area').evaluate(el=>el.clientWidth-parseFloat(getComputedStyle(el).paddingLeft)-parseFloat(getComputedStyle(el).paddingRight));
  const cards=await page.locator('.entry-card').all();
  const first=await cards[0].boundingBox(),second=await cards[1].boundingBox();
  if(contentWidth<=900){expect(second.y).toBeGreaterThanOrEqual(first.y+first.height);expect(second.x).toBe(first.x);}
  else{
   expect(second.y).toBe(first.y);expect(second.x).toBeGreaterThan(first.x);
   const firstHeading=await cards[0].locator('h2').boundingBox(),firstLink=await cards[0].locator('.entry-link').boundingBox();
   for(const card of cards.slice(1)){
    expect(Math.abs((await card.locator('h2').boundingBox()).y-firstHeading.y)).toBeLessThan(1);
    expect(Math.abs((await card.locator('.entry-link').boundingBox()).y-firstLink.y)).toBeLessThan(1);
   }
  }
  for(const card of cards){
   const bounds=await card.boundingBox(),art=await card.locator('.entry-art').boundingBox(),heading=await card.locator('h2').boundingBox();
   expect(art.x).toBeGreaterThanOrEqual(bounds.x);expect(art.x+art.width).toBeLessThanOrEqual(bounds.x+bounds.width);
   if(contentWidth<=900)expect(heading.x+heading.width).toBeLessThanOrEqual(art.x);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if([1440,1194,834,390].includes(viewport.width))await page.screenshot({path:`test-results/navigation-home-${viewport.width}-${info.project.name}.png`,fullPage:true});
 }
});
