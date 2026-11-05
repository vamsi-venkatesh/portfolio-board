// Three read-only stills of the public Forecasting page for its case page (navigate + scroll only).
import { chromium } from '.';
import { execFileSync } from 'node:child_process';
const OUT='../13-board/assets/shots';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1.25});
await p.goto('https://lab.vvdexops.com/forecast',{waitUntil:'networkidle'});
const H=await p.evaluate(()=>document.documentElement.scrollHeight); for(let y=0;y<H;y+=500){await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(120);}
const find=t=>p.evaluate(t=>{const el=[...document.querySelectorAll('h1,h2,h3,p,div')].find(e=>e.children.length<6&&e.textContent.trim().startsWith(t));return el?el.getBoundingClientRect().top+scrollY-120:0},t);
const spots={a:0,b:await find('75,884 signals in'),c:await find('Rules written down')};
for(const [k,y] of Object.entries(spots)){await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(1400);
  await p.screenshot({path:`${OUT}/forecast-${k}-1800.jpg`,type:'jpeg',quality:82});
  execFileSync('/opt/homebrew/bin/ffmpeg',['-y','-loglevel','error','-i',`${OUT}/forecast-${k}-1800.jpg`,'-vf','scale=900:-2','-q:v','4',`${OUT}/forecast-${k}-900.jpg`]); console.log(k,y);}
await b.close();
