export async function unlockParents(page){
 const hold=page.locator('#parent-hold');if(await hold.count()){
  await hold.focus();await page.keyboard.down('Space');await page.waitForTimeout(1100);await page.keyboard.up('Space');await page.locator('#word-editor').waitFor();
 }
}
export async function openParents(page,direct=false){
 if(direct)await page.goto('/#/parents');else await page.getByRole('button',{name:'家长小角',exact:true}).click();await unlockParents(page);
}
// Legacy letter tests use this after an already-immediate range change.
export async function addPending(page){await page.locator('#selection-query').focus();}
