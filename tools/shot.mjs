import { chromium, devices } from '.';
const [,, url, sel, out, mobile] = process.argv;
const b=await chromium.launch(); const ctx=await b.newContext(mobile?{...devices['iPhone 13']}:{viewport:{width:1440,height:900}}); const p=await ctx.newPage();
await p.goto(url,{waitUntil:'load'}); await p.waitForTimeout(800);
if(sel!=='-'){await p.evaluate(s=>{const e=document.querySelector(s);scrollTo(0,e.getBoundingClientRect().top+scrollY-80)},sel);}
await p.waitForTimeout(1500); await p.screenshot({path:out,type:'jpeg',quality:80}); await b.close();
