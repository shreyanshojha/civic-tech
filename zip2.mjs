import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.PW_EXE });
const p = await b.newPage();
await p.goto('http://127.0.0.1:4200/#/reps', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const inputs = await p.$$eval('input', is => is.map((i,n)=>({n, ph:i.placeholder, id:i.id, aria:i.getAttribute('aria-label'), type:i.type})));
console.log(JSON.stringify(inputs,null,1));
for (const q of ['31401','35801','Cullman','36104']) {
  const box = p.locator('#place-lookup').first();
  await box.click(); await box.fill('');
  await box.type(q, {delay:60});
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1500);
  const t = await p.locator('main').innerText();
  const i = t.indexOf('Nothing you type is sent anywhere');
  console.log('\n=== QUERY ' + q + ' ===');
  console.log(t.slice(i+34, i+1200));
}
await b.close();
