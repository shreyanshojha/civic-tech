import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.PW_EXE });
const p = await b.newPage();
await p.goto('http://127.0.0.1:4200/#' + process.argv[2], { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const hrefs = await p.$$eval('a[href]', as => [...new Set(as.map(a=>a.getAttribute('href')))]);
console.log(hrefs.join('\n'));
await b.close();
