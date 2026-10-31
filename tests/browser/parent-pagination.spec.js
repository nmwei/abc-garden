import {test,expect} from '@playwright/test';
import {READY_WORDS as WORDS} from '../../app/course-content.js';
import {openParents,unlockParents} from './parent-helpers.js';

test('parent pagination jumps, follows filters and preserves selected words',async({page},info)=>{
 await openParents(page,true);
 const pager=page.locator('#selection-results .word-pagination'),input=page.locator('#selection-page-input'),cards=page.locator('.selection-grid button'),last=Math.ceil(WORDS.length/12);
 await expect(pager.getByRole('button',{name:'首页',exact:true})).toBeDisabled();
 await input.fill('123');await input.press('Enter');
 await expect(pager.getByRole('status')).toHaveText(`${WORDS.length} 个 · 123/${last}`);
 const selected=WORDS[122*12].id;
 await expect(cards.first()).toHaveAttribute('data-word',selected);
 await cards.first().click();await expect(cards.first()).toHaveAttribute('aria-pressed','true');
 const saved=await page.evaluate(()=>localStorage.getItem('abc-module-content-v1'));
 await input.fill('2');await pager.getByRole('button',{name:'跳转',exact:true}).click();await expect(input).toHaveValue('2');
 await pager.getByRole('button',{name:'末页',exact:true}).click();await expect(input).toHaveValue(String(last));await expect(cards).toHaveCount(WORDS.length%12||12);
 await expect(pager.getByRole('button',{name:'下一页',exact:true})).toBeDisabled();await expect(pager.getByRole('button',{name:'末页',exact:true})).toBeDisabled();
 await pager.getByRole('button',{name:'首页',exact:true}).click();await expect(input).toHaveValue('1');
 for(const value of ['0',String(last+1),'1.5','']){
  await input.fill(value);await pager.getByRole('button',{name:'跳转',exact:true}).click();
  await expect(pager.getByRole('status')).toHaveText(`${WORDS.length} 个 · 1/${last}`);
  expect(await input.evaluate(el=>el.checkValidity())).toBe(false);
 }
 await page.locator('#selection-query').fill('c');await expect(input).toHaveValue('1');
 const matches=WORDS.filter(w=>[w.id,w.zh,...w.aliases].some(v=>v.includes('c')));
 await input.fill('2');await input.press('Enter');await expect(cards.first()).toHaveAttribute('data-word',matches[12].id);
 await page.locator('#selection-query').fill('');await page.locator('#selection-topic').selectOption('music');await expect(input).toHaveValue('1');
 const music=WORDS.filter(w=>w.topic==='music');await expect(input).toHaveAttribute('max',String(Math.ceil(music.length/12)));
 await input.fill('2');await input.press('Enter');await expect(cards.first()).toHaveAttribute('data-word',music[12].id);
 await page.locator('#selection-query').fill('zzzzunknown');await expect(input).toBeDisabled();await expect(pager.getByRole('button',{name:'跳转',exact:true})).toBeDisabled();await expect(pager.getByRole('status')).toHaveText('0 个 · 1/1');
 await page.locator('#selection-query').fill('');await page.locator('#selection-topic').selectOption('all');await input.fill('123');await input.press('Enter');await expect(cards.first()).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>localStorage.getItem('abc-module-content-v1'))).toBe(saved);
 await expect(page.locator('[data-selected-word]')).toHaveCount(1);await expect(page.locator('[data-selected-word]')).toHaveAttribute('data-selected-word',selected);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await pager.screenshot({path:`test-results/parent-pagination-${info.project.name}.png`});
 await page.reload();await unlockParents(page);await expect(page.locator('[data-selected-word]')).toHaveAttribute('data-selected-word',selected);
});
