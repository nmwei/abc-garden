import {test,expect} from '@playwright/test';
test('letter song is opt-in, playable, and pauses when leaving',async({page})=>{
 await page.goto('/#/letters');await page.getByRole('button',{name:'字母跟唱',exact:true}).click();
 const video=page.locator('#alphabet-song');await expect(video).toBeVisible();expect(await video.evaluate(v=>v.paused)).toBe(true);await expect(video).toHaveAttribute('preload','none');
 await video.evaluate(v=>v.play());await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(0);await expect.poll(()=>video.evaluate(v=>v.duration)).toBeGreaterThan(67);
 await video.evaluate(v=>{v.pause();v.currentTime=0;});await page.screenshot({path:`test-results/letter-song-${test.info().project.name}.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await video.evaluate(v=>{window.testSong=v;return v.play();});await page.getByRole('button',{name:'认识字母',exact:true}).click();expect(await page.evaluate(()=>window.testSong.paused)).toBe(true);await expect(video).toHaveCount(0);
});
