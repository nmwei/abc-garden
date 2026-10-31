import {test,expect} from '@playwright/test';
import {READY_WORDS as WORDS} from '../../app/course-content.js';
test('word pagination jumps directly, respects boundaries and survives search replacement',async({page},info)=>{
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 const pager=page.locator('.word-pagination'),input=page.getByRole('spinbutton',{name:'跳转页码'}),last=Math.ceil(WORDS.length/12);
 await expect(pager.getByRole('button',{name:'首页',exact:true})).toBeDisabled();
 await input.fill('123');await input.press('Enter');await expect(pager.getByRole('status')).toHaveText(`${WORDS.length} 个 · 123/${last}`);await expect(page.locator('.word-list button').first()).toHaveAttribute('data-word',WORDS[122*12].id);
 await pager.getByRole('button',{name:'末页',exact:true}).click();await expect(input).toHaveValue(String(last));await expect(page.locator('.word-list button')).toHaveCount(WORDS.length%12||12);await expect(pager.getByRole('button',{name:'下一页',exact:true})).toBeDisabled();await expect(pager.getByRole('button',{name:'末页',exact:true})).toBeDisabled();
 await pager.getByRole('button',{name:'首页',exact:true}).click();await expect(input).toHaveValue('1');
 for(const value of ['0',String(last+1),'1.5','']){await input.fill(value);await pager.getByRole('button',{name:'跳转',exact:true}).click();await expect(pager.getByRole('status')).toHaveText(`${WORDS.length} 个 · 1/${last}`);expect(await input.evaluate(el=>el.checkValidity())).toBe(false);}
 await page.locator('#word-search').fill('c');await expect(input).toHaveValue('1');const first=await page.locator('.word-list button').first().getAttribute('data-word');await input.fill('2');await pager.getByRole('button',{name:'跳转',exact:true}).click();await expect(input).toHaveValue('2');await expect(page.locator('.word-list button').first()).not.toHaveAttribute('data-word',first);
 await page.locator('#word-search').fill('zzzzunknown');await expect(input).toHaveValue('1');await expect(input).toBeDisabled();await expect(pager.getByRole('button',{name:'跳转',exact:true})).toBeDisabled();await expect(pager.getByRole('status')).toHaveText('0 个 · 1/1');
 await page.locator('#word-search').fill('');await input.fill('20');await input.press('Enter');await expect(input).toHaveValue('20');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await pager.screenshot({path:`test-results/word-pagination-${info.project.name}.png`});
});
