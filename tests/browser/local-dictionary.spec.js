import {test,expect} from '@playwright/test';
import {LOCAL_DICTIONARY,completionMeaning} from '../../app/local-dictionary.js';
import {WORD_BY_ID} from '../../app/course-content.js';
test('dictionary browsing is absent but word-only completion still uses the offline dictionary',async({page,context})=>{
 const entry=LOCAL_DICTIONARY.find(w=>!WORD_BY_ID.has(w.word));
 await page.goto('/#/parents');await expect(page.locator('#word-add-input')).toBeVisible();await expect(page.locator('#dictionary-query,#dictionary-tier,#dictionary-results,.word-picker')).toHaveCount(0);
 await page.locator('#word-add-input').fill(entry.word);await page.locator('#word-add-input').press('Enter');await expect(page.locator('[data-summary=zh]')).toHaveText(completionMeaning(entry));await expect(page.locator('[data-summary=sentence]')).toHaveText('暂无例句');
 await expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存');await context.setOffline(true);await page.reload();await page.locator('#word-add-input').fill(entry.word+', apple');await page.locator('#word-add-input').press('Enter');await expect(page.locator('[data-editor-word]')).toHaveCount(2);await expect(page.locator('[data-editor-word=apple] [data-summary=sentenceZh]')).toHaveText('我喜欢苹果。');
 await expect(page.locator('[data-summary=zh]').first()).toHaveText(completionMeaning(entry));
});
