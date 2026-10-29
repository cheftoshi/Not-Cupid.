import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.use({serviceWorkers:'block'});
test.beforeEach(async({page})=>{
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Synthetic failure'}}));
 await page.route('**/api/profile',r=>r.fulfill({status:401,json:{error:'Not signed in'}}));
});
test('onboarding keeps answers on back, labels controls, suppresses optional prompts and waits for save',async({page})=>{
 test.setTimeout(90000);
 await page.route('**/api/send-otp',r=>r.fulfill({json:{success:true}}));
 await page.route('**/api/verify-otp',r=>r.fulfill({json:{success:true,needsQuiz:true}}));
 let submits:any[]=[];let release:()=>void=()=>{};
 await page.route('**/api/submit',async r=>{submits.push(r.request().postDataJSON());await new Promise<void>(resolve=>{release=resolve});await r.fulfill({status:503,json:{error:'Synthetic save failure'}})});
 await page.goto('/quiz');await page.getByRole('radio',{name:/I want more people/}).click();await page.getByRole('button',{name:/continue with/}).click();
 await expect(page.getByText('Account details',{exact:true})).toBeVisible();
 await page.getByLabel('first name',{exact:true}).fill('QA');await page.getByLabel('age',{exact:true}).fill('30');await page.getByLabel('how do you describe yourself?').selectOption('m');await page.getByLabel('zip code',{exact:true}).fill('02116');await page.getByLabel('email',{exact:true}).fill('qa@example.invalid');
 await page.getByRole('button',{name:/change my path/}).click();await page.getByRole('button',{name:/continue with/}).click();await expect(page.getByLabel('first name',{exact:true})).toHaveValue('QA');
 await page.evaluate(()=>window.dispatchEvent(new Event('nc:show-install-prompt')));await expect(page.locator('[data-pwa-prompt]')).toHaveCount(0);
 await page.waitForTimeout(1000); // Measure stable colors after the existing entrance transition.
 const axe=await new AxeBuilder({page}).withRules(['label','select-name','color-contrast']).analyze();expect(axe.violations).toEqual([]);
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:/verify my email/}).click();for(let i=1;i<=6;i++)await page.getByLabel(`Verification code digit ${i}`).fill('1');await page.getByRole('button',{name:/confirm code/}).click();
 for(let i=0;i<80&&!submits.length;i++){
  const skip=page.getByRole('button',{name:/^(skip this one|no preference)$/});const start=page.getByRole('button',{name:/^(start →|let's go ⚡)$/});
  if(await skip.isVisible())await skip.click();else if(await start.isVisible())await start.click();else await page.waitForTimeout(100);
 }
 await expect.poll(()=>submits.length).toBe(1);await page.waitForTimeout(7000);await expect(page.getByText('Saving your profile',{exact:false})).toBeVisible();await expect(page.locator('[data-pwa-prompt]')).toHaveCount(0);release();await expect(page.getByRole('button',{name:/send a fresh code/})).toBeVisible();
 await page.getByRole('button',{name:/send a fresh code/}).click();for(let i=1;i<=6;i++)await page.getByLabel(`Verification code digit ${i}`).fill('2');await page.getByRole('button',{name:/confirm code/}).click();await expect.poll(()=>submits.length).toBe(2);expect(submits[1]).toEqual(submits[0]);release();
});
