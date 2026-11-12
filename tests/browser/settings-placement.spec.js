import {test,expect} from '@playwright/test';
import {openParents} from './parent-helpers.js';

test('module settings share the letter scope and parent settings keep shared controls',async({page},info)=>{
 await page.goto('/#/letters');
 await page.getByRole('button',{name:'字母设置',exact:true}).click();
 await expect(page.getByRole('heading',{name:'字母设置'})).toBeVisible();
 await page.getByRole('button',{name:'E–H',exact:true}).click();
 await expect(page.locator('#letter-save-status')).toHaveText('已保存');
 await page.locator('[name="letter-audio-source"][value="gk"]').check();
 await expect(page.locator('.letter-source-status')).toContainText('已保存');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`.playwright-cli/settings-placement/letters-${info.project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'返回字母',exact:true}).click();
 await expect(page.locator('.letter-picker-card')).toHaveCount(4);
 await page.reload();
 await page.getByRole('button',{name:'字母设置',exact:true}).click();
 await expect(page.locator('[name="letter-audio-source"][value="gk"]')).toBeChecked();
 await expect(page.getByRole('button',{name:'学习字母 E',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'返回字母',exact:true}).click();
 await openParents(page);
 await expect(page.locator('.parent-setting-group')).toHaveCount(3);
 await expect(page.locator('.letter-settings,.letter-audio-settings')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'系统朗读声音'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`.playwright-cli/settings-placement/parents-${info.project.name}.png`,fullPage:true});
});
