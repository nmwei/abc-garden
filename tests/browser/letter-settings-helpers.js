export async function openLetterSettings(page,direct=false){
 if(direct)await page.goto('/#/letters');
 await page.getByRole('button',{name:'字母设置',exact:true}).click();
}
