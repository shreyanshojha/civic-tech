import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.PW_EXE });
const p = await b.newPage();
await p.goto('http://127.0.0.1:4200/#/reps', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
for (const q of ['31401','35801','Cullman']) {
  const box = p.locator('input').first();
  await box.fill(q);
  await p.getByRole('button', { name: /Look up/i }).click();
  await p.waitForTimeout(1200);
  const t = await p.locator('main').innerText();
  const i = t.indexOf('Look up');
  console.log('\n=== QUERY ' + q + ' ===');
  console.log(t.slice(i, i+1400));
}
await b.close();
