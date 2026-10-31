export async function unlockParents(page){
 const hold=page.locator('#parent-hold');if(await hold.count()){
  await hold.focus();await page.keyboard.down('Space');await page.waitForTimeout(1100);await page.keyboard.up('Space');await page.locator('#word-editor').waitFor();
 }
}
export async function openParents(page,direct=false){
 if(direct)await page.goto('/#/parents');else await page.getByRole('button',{name:'家长小角',exact:true}).click();await unlockParents(page);
}
export async function addPending(page){
 const input=page.locator('#word-add-input');if((await input.inputValue()).trim())await input.press('Enter');
 await input.focus();await input.blur();
}
export async function prepareAudio(page){
 await addPending(page);const prepare=page.getByRole('button',{name:'准备缺少的发音',exact:true});if(await prepare.count())await prepare.click();
}
