import {test,expect} from '@playwright/test';
test('listening choices persist through the facade, follow the account and leave device preferences alone',async({page})=>{
 await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){queueMicrotask(()=>this.dispatchEvent(new Event('ended')));return Promise.resolve();};});
 await page.goto('/#/letters');
 await page.locator('[data-action=module-choose]').click();
 await page.locator('[data-listen=settings]').click();
 await page.locator('[name=listen-mode][value=sound]').check();
 await page.locator('[name=listen-letterCase][value=lower]').check();
 await page.locator('[data-listen-setting=vowels]').uncheck();
 await page.locator('[data-listen=start]').click();
 const saved=await page.evaluate(async()=>{
  const store=await import('/app/account-storage.js');await store.learningStorage.whenSaved();
  const archive=store.captureArchive();
  const {deviceStorage}=await import('/app/device-storage.js');deviceStorage.setItem('abc-garden-english-rate-v1','0.85');
  store.activateArchive('11111111-1111-4111-8111-111111111111',archive);await store.flushStorage();return archive;
 });
 expect(saved.data['abc-listen-game-options-v1']).toMatchObject({version:1,mode:'sound',letterCase:'lower',vowels:false});
 await page.reload();await page.locator('[data-action=module-choose]').click();await page.locator('[data-listen=settings]').click();
 await expect(page.locator('[name=listen-mode][value=sound]')).toBeChecked();
 await expect(page.locator('[name=listen-letterCase][value=lower]')).toBeChecked();
 await expect(page.locator('[data-listen-setting=vowels]')).not.toBeChecked();
 await page.evaluate(async()=>{const s=await import('/app/account-storage.js');s.activateArchive('guest',{version:1,subject:'abc',data:{}});await s.flushStorage();});
 await page.reload();await page.locator('[data-action=module-choose]').click();await page.locator('[data-listen=settings]').click();
 await expect(page.locator('[name=listen-mode][value=name]')).toBeChecked();
 expect(await page.evaluate(()=>localStorage.getItem('abc-garden-english-rate-v1'))).toBe('0.85');
 expect(await page.evaluate(()=>localStorage.getItem('abc-listen-game-options-v1'))).toBeNull();
});
