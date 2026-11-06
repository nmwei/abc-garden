import {test,expect} from '@playwright/test';
import {READY_WORDS as WORDS} from '../../app/course-content.js';
test('word pagination jumps directly, respects boundaries and survives search replacement',async({page},info)=>{
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 const expand=page.getByRole('button',{name:'展开列表',exact:true});if(await expand.isVisible())await expand.click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const size=Number(await page.locator('.word-browser').getAttribute('data-page-size'));
 const pager=page.locator('.word-pagination'),input=page.getByRole('spinbutton',{name:'跳转页码',includeHidden:true}),last=Math.ceil(WORDS.length/size);
 const jump=Math.min(123,last);
 await expect(pager.getByRole('button',{name:'首页',exact:true})).toBeDisabled();
 await input.fill(String(jump));await input.press('Enter');await expect(pager.getByRole('status',{includeHidden:true})).toHaveText(`${WORDS.length} 个 · ${jump}/${last}`);await expect(page.locator('.word-list button').first()).toHaveAttribute('data-word',WORDS[(jump-1)*size].id);
 await pager.getByRole('button',{name:'末页',exact:true}).click();await expect(input).toHaveValue(String(last));await expect(page.locator('.word-list button')).toHaveCount(WORDS.length%size||size);await expect(pager.getByRole('button',{name:'下一页',exact:true})).toBeDisabled();await expect(pager.getByRole('button',{name:'末页',exact:true})).toBeDisabled();
 await pager.getByRole('button',{name:'首页',exact:true}).click();await expect(input).toHaveValue('1');
 for(const value of ['0',String(last+1),'1.5','']){await input.fill(value);await pager.getByRole('button',{name:'跳转',exact:true,includeHidden:true}).click();await expect(pager.getByRole('status',{includeHidden:true})).toHaveText(`${WORDS.length} 个 · 1/${last}`);expect(await input.evaluate(el=>el.checkValidity())).toBe(false);}
 await page.locator('#word-search').fill('c');await expect(input).toHaveValue('1');const first=await page.locator('.word-list button').first().getAttribute('data-word');await input.fill('2');await pager.getByRole('button',{name:'跳转',exact:true,includeHidden:true}).click();await expect(input).toHaveValue('2');await expect(page.locator('.word-list button').first()).not.toHaveAttribute('data-word',first);
 await page.locator('#word-search').fill('zzzzunknown');await expect(input).toHaveValue('1');await expect(input).toBeDisabled();await expect(pager.getByRole('button',{name:'跳转',exact:true,includeHidden:true})).toBeDisabled();await expect(pager.getByRole('status',{includeHidden:true})).toHaveText('0 个 · 1/1');
 await page.locator('#word-search').fill('');await input.fill('20');await input.press('Enter');await expect(input).toHaveValue('20');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await pager.screenshot({path:`test-results/word-pagination-${info.project.name}.png`});
});
