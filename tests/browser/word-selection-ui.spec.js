import {test,expect} from '@playwright/test';
test('detail selection supports catalog removal and learning-only removal with persistence',async({page})=>{
 await page.goto('/#/words');
 await expect(page.locator('.empty-content')).toContainText('还没有正在学');
 await expect(page.locator('.word-pagination')).toBeHidden();
 await page.locator('[data-course=mastery-filter][data-filter=all]').click();
 await expect(page.locator('.word-list [data-course=add-selection],.word-list [data-course=remove-selection]')).toHaveCount(0);
 const add=page.getByRole('button',{name:'加入正在学 apple',exact:true});
 const remove=page.getByRole('button',{name:'移出正在学 apple',exact:true});
 await add.click();await expect(remove).toBeVisible();await expect(page.locator('[data-course=word][data-word=apple] .learning-badge')).toHaveText('正在学');
 await remove.click();await expect(add).toBeVisible();await expect(page.locator('[data-course=word][data-word=apple] .learning-badge')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-module-content-v1')).selectedWordIds)).toEqual([]);
 await page.reload();await expect(page.locator('.empty-content')).toContainText('还没有正在学');
 await page.locator('[data-course=mastery-filter][data-filter=all]').click();await add.click();
 await page.locator('.word-list img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
 await page.locator('.word-list').scrollIntoViewIfNeeded();
 await page.locator('.word-list').screenshot({path:`test-results/catalog-status-${test.info().project.name}.png`});
 await page.locator('#word-search').fill('zzzzzz');await expect(page.locator('.word-list')).toContainText('没有找到匹配');await expect(page.locator('.word-pagination')).toBeHidden();
 await page.reload();await expect(page.locator('.english-word')).toHaveText('apple');
 await expect(page.locator('[data-course=add-selection]')).toHaveCount(0);
 await remove.click();await expect(page.locator('.empty-content')).toContainText('还没有正在学');
 await expect(page.getByRole('button',{name:'撤销',exact:true})).toHaveCount(0);
 await page.reload();await expect(page.locator('.empty-content')).toContainText('还没有正在学');
});
test('relearning clears mastery and adds a word, survives reload',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('abc-garden-mastery-v1',JSON.stringify({entries:{apple:{mastered:true,source:'manual',dates:[]}}})));
 await page.goto('/#/words');await page.reload();await page.locator('[data-filter=mastered]').click();
 await page.getByRole('button',{name:'重新学习 apple',exact:true}).click();
 await page.locator('[data-filter=learning]').click();await expect(page.locator('.english-word')).toHaveText('apple');
 await expect(page.getByRole('button',{name:'移出正在学 apple',exact:true})).toBeVisible();
 await page.reload();await expect(page.locator('.english-word')).toHaveText('apple');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-garden-mastery-v1')).entries.apple)).toMatchObject({mastered:false,dates:[]});
});
test('remove selects successor then predecessor',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','ball','cat']})));await page.goto('/#/words');await page.reload();
 await page.locator('[data-course=word][data-word=ball]').click();
 await page.getByRole('button',{name:'移出正在学 ball',exact:true}).click();await expect(page.locator('.english-word')).toHaveText('cat');
 await page.getByRole('button',{name:'移出正在学 cat',exact:true}).click();await expect(page.locator('.english-word')).toHaveText('apple');
});
test('failed mastery write rolls selection back on relearn',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('abc-garden-mastery-v1',JSON.stringify({entries:{apple:{mastered:true,dates:[]}}})));await page.goto('/#/words');await page.reload();await page.locator('[data-filter=mastered]').click();
 await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='abc-garden-mastery-v1')throw Error('quota');return set.call(this,k,v);};});
 await page.getByRole('button',{name:'重新学习 apple',exact:true}).click();await expect(page.getByRole('button',{name:'重新学习 apple',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-module-content-v1')).selectedWordIds||[])).toEqual([]);
});
test('removal keeps a filtered sequence across a page boundary',async({page})=>{
 const {READY_WORDS}=await import('../../app/course-content.js');const rows=READY_WORDS.filter(w=>w.topic==='food').slice(0,15),ids=rows.map(w=>w.id);
 await page.goto('/');await page.evaluate(ids=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:ids})),ids);await page.goto('/#/words');await page.reload();
 await page.locator('#word-topic').isVisible().then(async visible=>{if(visible)await page.locator('#word-topic').selectOption('food');else await page.locator('[data-course=topic][data-topic=food]').click();});
 await page.getByRole('button',{name:'下一页',exact:true}).click();
 await page.locator('[data-course=remove-selection]').click();await expect(page.locator('.english-word')).toHaveText(rows[13].display||rows[13].id);
 await expect(page.locator('#word-page-input')).toHaveValue('2');await expect(page.locator('#word-topic')).toHaveValue('food');
});
