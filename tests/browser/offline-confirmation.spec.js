import {test,expect} from '@playwright/test';
import {openParents} from './parent-helpers.js';
test('confirmation is modal, stable on repeated preparation and restores focus on dismissal',async({page},info)=>{
 await openParents(page,true);const download=page.locator('[data-offline-category="pictures"] [data-action="offline-download"]');await expect(download).toBeEnabled();await download.click();
 const dialog=page.getByRole('dialog',{name:'确认离线下载'}),panel=dialog.locator('.offline-estimate');await expect(dialog).toBeVisible();await expect(panel).toBeFocused();await expect(dialog).toBeInViewport({ratio:.95});expect(await dialog.evaluate(el=>el.matches(':modal'))).toBe(true);
 await page.evaluate(()=>{window.confirmationNode=document.querySelector('#offline-plan .offline-estimate');});
 // A queued duplicate click must not destroy the visible confirmation or make it flash.
 await download.evaluate(el=>el.click());expect(await page.evaluate(()=>window.confirmationNode===document.querySelector('#offline-plan .offline-estimate'))).toBe(true);await expect(panel).toBeFocused();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.locator('#offline-progress')).toBeEmpty();await expect(download).toBeFocused();
 await page.locator('[data-offline-category="other"] [data-action="offline-download"]').click();await expect(dialog.locator('h3')).toHaveText('其他内容');await expect(dialog).toBeInViewport({ratio:.95});await expect(dialog.getByRole('button',{name:'确认下载',exact:true})).toBeInViewport();await dialog.screenshot({path:`test-results/offline-confirmation-${info.project.name}.png`});
 await dialog.getByRole('button',{name:'暂不下载',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('[data-offline-category="other"] [data-action="offline-download"]')).toBeFocused();
 await page.locator('#offline-download').click();await expect(dialog.getByRole('button',{name:'确认下载全部内容',exact:true})).toBeVisible();
});
