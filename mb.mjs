import { chromium } from 'playwright';
const routes = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.PW_EXE });
const p = await b.newPage();
for (const r of routes) {
  await p.goto('http://127.0.0.1:4200/#' + r, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  console.log('\n\n=================== ROUTE ' + r + ' ===================');
  try { console.log(await p.locator('main').innerText()); }
  catch(e) { console.log('ERR ' + e.message); console.log(await p.locator('body').innerText()); }
}
await b.close();
