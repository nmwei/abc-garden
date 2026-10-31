import {test,expect} from '@playwright/test';
import {openParents} from './parent-helpers.js';
import {PENDING_WORDS} from '../../app/course-content.js';
import {matchesWord} from '../../app/word-aliases.js';

test('pending browser supports independent search and pagination without selecting words',async({page},info)=>{
 await openParents(page,true);
 await page.locator('#selection-query').fill('cat');await page.getByRole('button',{name:'选择 cat',exact:true}).click();
 const saved=await page.evaluate(()=>localStorage.getItem('abc-module-content-v1'));
 const browser=page.locator('#pending-browser'),input=page.locator('#pending-page-input'),query=page.locator('#pending-query'),cards=page.locator('[data-pending-word]'),last=Math.ceil(PENDING_WORDS.length/12);
 await expect(browser).not.toHaveAttribute('open','');await browser.locator('summary').click();
 await expect(browser).toContainText('暂时不能选入学习范围');await expect(cards).toHaveCount(12);
 await expect(browser.locator('[data-learning="select-word"],[data-learning="select-matches"]')).toHaveCount(0);
 await input.fill('100');await input.press('Enter');await expect(browser.getByRole('status')).toHaveText(`${PENDING_WORDS.length} 个 · 100/${last}`);await expect(cards.first()).toHaveAttribute('data-pending-word',PENDING_WORDS[99*12].id);
 await browser.getByRole('button',{name:'末页',exact:true}).click();await expect(input).toHaveValue(String(last));await expect(cards).toHaveCount(PENDING_WORDS.length%12||12);await expect(browser.getByRole('button',{name:'下一页',exact:true})).toBeDisabled();
 await browser.getByRole('button',{name:'首页',exact:true}).click();await expect(input).toHaveValue('1');
 for(const value of ['0',String(last+1),'1.5','']){await input.fill(value);await browser.getByRole('button',{name:'跳转',exact:true}).click();await expect(browser.getByRole('status')).toHaveText(`${PENDING_WORDS.length} 个 · 1/${last}`);}
 await query.fill('c');await expect(input).toHaveValue('1');await input.fill('2');await browser.getByRole('button',{name:'跳转',exact:true}).click();await expect(cards.first()).toHaveAttribute('data-pending-word',PENDING_WORDS.filter(w=>matchesWord(w,'c'))[12].id);
 for(const term of ['per cent','百分之']){await query.fill(term);await expect(cards).toHaveCount(1);await expect(cards.first()).toHaveAttribute('data-pending-word','percent');await expect(input).toBeDisabled();await expect(browser.getByRole('button',{name:'跳转',exact:true})).toBeDisabled();}
 await query.fill('zzzzunknown');await expect(cards).toHaveCount(0);await expect(browser.getByRole('status')).toHaveText('0 个 · 1/1');
 await query.fill('');await input.fill('2');await input.press('Enter');
 await expect(page.locator('#selection-query')).toHaveValue('cat');await expect(page.locator('#selection-page-input')).toHaveValue('1');
 await browser.locator('summary').click();await browser.locator('summary').click();await expect(input).toHaveValue('2');
 expect(await page.evaluate(()=>localStorage.getItem('abc-module-content-v1'))).toBe(saved);await expect(page.locator('[data-selected-word]')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await browser.screenshot({path:`test-results/pending-browser-${info.project.name}.png`});
});
