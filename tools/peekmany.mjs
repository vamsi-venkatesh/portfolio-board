import { chromium, devices } from '.';
const [url, prefix, mobile, ...targets] = process.argv.slice(2);
const b=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext(mobile==='m'?{...devices['iPhone 13']}:{viewport:{width:1440,height:900},colorScheme:mobile==='dark'?'dark':'light'}); const p=await ctx.newPage(); const errs=[];
p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text())}); p.on('pageerror',e=>errs.push(String(e)));
await p.goto(url,{waitUntil:'load'}); await p.waitForTimeout(1200);
for (const t of targets){
  let y;
  if (t.startsWith('sc')) { const f=+t.slice(2); y=await p.evaluate(f=>{const s=document.querySelector('.showcase');const r=s.getBoundingClientRect();return r.top+scrollY+(r.height-innerHeight)*f},f); }
  else if (t.startsWith('#')||t.startsWith('.')) y=await p.evaluate(s=>document.querySelector(s).getBoundingClientRect().top+scrollY-70,t);
  else y=+t;
  // step-scroll to trigger observers
  const y0=await p.evaluate(()=>scrollY); for(let k=1;k<=6;k++){await p.evaluate(v=>scrollTo(0,v),y0+(y-y0)*k/6);await p.waitForTimeout(60);}
  await p.waitForTimeout(1400);
  await p.screenshot({path:`${prefix}-${t.replace(/[^a-z0-9.]/gi,'')}.jpg`,type:'jpeg',quality:72});
}
console.log('overflow',await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),'errs',errs);
await b.close();
