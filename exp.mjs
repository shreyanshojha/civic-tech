import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.PW_EXE });
const p = await b.newPage();
await p.goto('http://127.0.0.1:4200/#/patterns', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const dets = await p.$$('details, summary, button');
for (const d of dets) { try { await d.click({timeout:800}); await p.waitForTimeout(200);} catch(e){} }
await p.waitForTimeout(1000);
const t = await p.locator('main').innerText();
console.log(t.slice(t.indexOf('The rest of the search')));
await b.close();
