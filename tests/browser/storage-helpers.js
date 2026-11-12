// Seed the current storage boundary, never a legacy localStorage import.
export async function seedLearning(page, data) {
  await page.goto('/');
  await page.evaluate(async data=>{
    const {learningStorage}=await import('/app/account-storage.js');
    for(const [key,value] of Object.entries(data))learningStorage.setItem(key,JSON.stringify(value));
    await learningStorage.whenSaved();
  },data);
  await page.reload();
}
