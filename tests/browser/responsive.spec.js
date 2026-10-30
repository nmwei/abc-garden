import {test,expect} from '@playwright/test';
test('main learning and parent screens fit the device and preserve usable word proportions',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fit=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/');await fit();await page.getByRole('button',{name:'看图学词',exact:true}).click();await fit();
 await expect(page.locator('.word-list button')).toHaveCount(12);
 const browser=await page.locator('.word-browser').boundingBox(),workspace=await page.locator('.word-workspace').boundingBox();
 if(page.viewportSize().width>760){expect(browser.width/workspace.width).toBeGreaterThan(.6);expect(await page.locator('.word-topic-tabs').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
 else{await expect(page.locator('#word-topic')).toBeVisible();await page.locator('#word-topic').selectOption('animals');await expect(page.locator('.english-word')).toHaveText('cat');}
 expect(await page.locator('.word-browser .word-list').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
 await page.screenshot({path:`test-results/layout-words-${info.project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'听音找图',exact:true}).click();await expect(page.locator('.word-browser')).toBeHidden();await fit();
 await page.getByRole('button',{name:'拼一拼',exact:true}).click();await page.locator('#spell-input').fill(page.viewportSize().width>760?'apple':'cat');await page.getByRole('button',{name:'检查一下',exact:true}).click();await expect(page.locator('.feedback')).toContainText('拼出来啦');await fit();
 await page.getByRole('button',{name:'家长小角',exact:true}).click();await fit();await expect(page.locator('#offline-download')).toBeEnabled();await page.locator('#offline-download').click();await expect(page.locator('#offline-plan')).toContainText('本次需下载');await fit();await page.screenshot({path:`test-results/layout-parents-${info.project.name}.png`,fullPage:true});
 await page.locator('.nav [data-action="learn"]').click();await page.locator('[data-view="read"]').click();await fit();await page.screenshot({path:`test-results/layout-reading-${info.project.name}.png`,fullPage:true});
 await page.locator('[data-course="map"]').click();await page.locator('[data-view="talk"]').click();await fit();await page.locator('[data-course="map"]').click();await page.locator('[data-view="write"]').click();await fit();
 expect(errors).toEqual([]);
});
test('narrow phone and portrait tablet layouts have no horizontal overflow',async({page})=>{
 for(const viewport of [{width:320,height:740},{width:834,height:1194}]){await page.setViewportSize(viewport);for(const route of ['words','parents','letters','learn']){await page.goto('/#/'+route);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}}
});
