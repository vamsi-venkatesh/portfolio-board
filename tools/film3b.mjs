// ~41 s preview film of v3b (one stop per product, held until its numbers land): end-to-end board drag (live connectors) → homepage scroll → Work index page.
// Real-time CDP screencast at 1920×1080 → H.264. A drawn cursor follows the real pointer events.
// Note: the cross-document view transition is stripped for this run (Playwright's Chromium never finishes one).
import { chromium } from '.';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const BASE='http://127.0.0.1:4497/13-board/', ROOT='../13-board';
const TMP='/private/tmp/claude-501/-Users-vamsiv-vvdex-vault/d2822e25-8cee-41f0-9e24-47d3bd5732db/scratchpad/film3b';
fs.rmSync(TMP,{recursive:true,force:true}); fs.mkdirSync(TMP,{recursive:true});
const b=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--hide-scrollbars']});
const ctx=await b.newContext({viewport:{width:1920,height:1080}});
await ctx.route('**/assets/site.css',async rt=>{const r=await rt.fetch();rt.fulfill({response:r,body:(await r.text()).replace('@view-transition{navigation:auto}','')});});
await ctx.addInitScript(()=>{addEventListener('DOMContentLoaded',()=>{const c=document.createElement('div');c.style.cssText='position:fixed;z-index:99999;left:0;top:0;width:24px;height:24px;pointer-events:none;translate:-100px -100px';const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('width','24');s.setAttribute('height','24');s.setAttribute('viewBox','0 0 22 22');const pth=document.createElementNS('http://www.w3.org/2000/svg','path');pth.setAttribute('d','M3 2l15 8-6.5 1.8L8.6 18z');pth.setAttribute('fill','#161513');pth.setAttribute('stroke','#fff');pth.setAttribute('stroke-width','1.4');s.appendChild(pth);c.appendChild(s);document.body.appendChild(c);addEventListener('pointermove',e=>{c.style.translate=`${e.clientX-3}px ${e.clientY-2}px`},{capture:true,passive:true});});});
const p=await ctx.newPage();
const cdp=await ctx.newCDPSession(p); const frames=[]; const marks=[];
cdp.on('Page.screencastFrame',async f=>{const n=frames.length;fs.writeFileSync(`${TMP}/${String(n).padStart(5,'0')}.jpg`,Buffer.from(f.data,'base64'));frames.push(f.metadata.timestamp);cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
const start=()=>cdp.send('Page.startScreencast',{format:'jpeg',quality:86,maxWidth:1920,maxHeight:1080,everyNthFrame:1});
const glide=(to,ms)=>p.evaluate(([to,ms])=>new Promise(r=>{const y0=scrollY,t0=performance.now();const e=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;const f=n=>{const k=Math.min(1,(n-t0)/ms);scrollTo({top:y0+(to-y0)*e(k),behavior:'instant'});k<1?requestAnimationFrame(f):r()};requestAnimationFrame(f)}),[to,ms]);
const yOf=sel=>p.evaluate(s=>document.querySelector(s).getBoundingClientRect().top+scrollY-70,sel);
const scY=f=>p.evaluate(f=>{const s=document.querySelector('.showcase');const r=s.getBoundingClientRect();return r.top+scrollY+(r.height-innerHeight)*f},f);
const box=async s=>(await p.$(s)).boundingBox();
await p.goto('about:blank'); await start();
await p.goto(BASE,{waitUntil:'domcontentloaded'}); await p.mouse.move(1500,950); await p.waitForTimeout(2300);
// drag the Agents card: the connectors redraw live; then the Servers card; then reset
let s=await box('.fcard[data-drag="flow-agents"]');
await p.mouse.move(s.x+s.width*0.55,s.y+s.height*0.3,{steps:22}); await p.waitForTimeout(250); await p.mouse.down();
await p.mouse.move(s.x+s.width*0.55-120,s.y+s.height*0.3+90,{steps:34}); await p.mouse.move(s.x+s.width*0.55-60,s.y+s.height*0.3+150,{steps:26}); await p.waitForTimeout(350); await p.mouse.up(); await p.waitForTimeout(350);
s=await box('.fcard[data-drag="flow-servers"]');
await p.mouse.move(s.x+s.width*0.5,s.y+s.height*0.35,{steps:18}); await p.mouse.down();
await p.mouse.move(s.x+s.width*0.5+20,s.y+s.height*0.35+70,{steps:26}); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(500);
s=await box('[data-reset]'); await p.mouse.move(s.x+s.width/2,s.y+s.height/2,{steps:20}); await p.mouse.click(s.x+s.width/2,s.y+s.height/2); await p.waitForTimeout(1000);
await p.mouse.move(1880,1040,{steps:10});
// scroll the homepage: products (pinned showcase) → client work → index link → proof
await glide(await yOf('#work'),1300); await p.waitForTimeout(600);
const nSc=await p.$$eval('.sc-item',e=>e.length);
for(let j=0;j<nSc;j++){ await glide(await scY((j+0.5)/nSc),850); await p.waitForTimeout(1700); marks.push({t:+(frames[frames.length-1]-frames[0]).toFixed(2),...await p.evaluate(()=>{const it=document.querySelector('.sc-item.on');return{name:it?.querySelector('.sc-name')?.textContent.trim(),nums:[...(it?it.querySelectorAll('[data-count]'):[])].map(e=>({count:e.dataset.count,shown:e.textContent.trim()}))}})}); }
await glide(await yOf('#clients'),1100); await p.waitForTimeout(1300);
await glide(await yOf('.allwork')-420,900); await p.waitForTimeout(500);
// open the Work index from the "All nine in one list" link
s=await box('.allwork'); await p.mouse.move(s.x+s.width*0.4,s.y+s.height/2,{steps:22}); await p.waitForTimeout(500);
await p.mouse.click(s.x+s.width*0.4,s.y+s.height/2); await p.waitForLoadState('domcontentloaded'); await start().catch(()=>{});
await p.mouse.move(1880,1040); await p.waitForTimeout(1800);
await glide(await yOf('#wi-p')-40,1300); await p.waitForTimeout(900);
s=await box('.wi-list li:nth-child(4) .wi-row'); await p.mouse.move(s.x+s.width*0.3,s.y+s.height/2,{steps:20}); await p.waitForTimeout(900);
await glide(await yOf('#wi-c')-160,1300); await p.waitForTimeout(1500);
await cdp.send('Page.stopScreencast'); await b.close();
let list=''; for(let i=0;i<frames.length;i++){const d=i<frames.length-1?Math.max(0.001,frames[i+1]-frames[i]):0.04;list+=`file '${TMP}/${String(i).padStart(5,'0')}.jpg'\nduration ${d.toFixed(4)}\n`;}
list+=`file '${TMP}/${String(frames.length-1).padStart(5,'0')}.jpg'\n`; fs.writeFileSync(`${TMP}/list.txt`,list);
execFileSync('/opt/homebrew/bin/ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',`${TMP}/list.txt`,'-vf','scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf4f1ea,fps=30,scale=in_range=pc:out_range=tv,format=yuv420p','-c:v','libx264','-preset','slow','-crf','22','-movflags','+faststart','-an',`${ROOT}/preview-v3b.mp4`]);
console.log('frames',frames.length,'span',(frames.at(-1)-frames[0]).toFixed(1),'s',(fs.statSync(`${ROOT}/preview-v3.mp4`).size/1e6).toFixed(1),'MB');
fs.rmSync(TMP,{recursive:true,force:true});
fs.writeFileSync(`${ROOT}/verify3/film3b-marks.json`,JSON.stringify(marks,null,1)); console.log(JSON.stringify(marks));
