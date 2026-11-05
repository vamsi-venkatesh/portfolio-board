// ~30 s preview film: real-time CDP screencast of the local site, encoded to H.264 1920x1080.
import { chromium } from '.';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const BASE='http://127.0.0.1:4497/13-board/', ROOT='../13-board';
const TMP='/private/tmp/claude-501/-Users-vamsiv-vvdex-vault/d2822e25-8cee-41f0-9e24-47d3bd5732db/scratchpad/film';
fs.rmSync(TMP,{recursive:true,force:true}); fs.mkdirSync(TMP,{recursive:true});
const b=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--hide-scrollbars']});
const ctx=await b.newContext({viewport:{width:1920,height:1080}}); const p=await ctx.newPage();
const cdp=await ctx.newCDPSession(p); const frames=[];
cdp.on('Page.screencastFrame',async f=>{const n=frames.length;fs.writeFileSync(`${TMP}/${String(n).padStart(5,'0')}.jpg`,Buffer.from(f.data,'base64'));frames.push(f.metadata.timestamp);cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
const start=()=>cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1920,maxHeight:1080,everyNthFrame:1});
const glide=(to,ms)=>p.evaluate(([to,ms])=>new Promise(r=>{const y0=scrollY,t0=performance.now();const e=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;const f=n=>{const k=Math.min(1,(n-t0)/ms);scrollTo(0,y0+(to-y0)*e(k));k<1?requestAnimationFrame(f):r()};requestAnimationFrame(f)}),[to,ms]);
const yOf=sel=>p.evaluate(s=>document.querySelector(s).getBoundingClientRect().top+scrollY-70,sel);
await p.goto('about:blank'); await start();
await p.goto(BASE,{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3300);
await glide(await yOf("#work"),1500); await p.waitForTimeout(1400);
await glide(await yOf('#work .grid .card:nth-child(3)')-40,1400); await p.waitForTimeout(1500);
await glide(await yOf('#how'),1300); await p.waitForTimeout(1300);
await glide(await yOf('#proof'),1300); await p.waitForTimeout(1300);
await glide(await yOf('#contact')-60,1300); await p.waitForTimeout(2300);
await glide(await yOf('#work .grid .card:nth-child(4)')-40,1500); await p.waitForTimeout(600);
const card=await p.$('#work .grid .card:nth-child(4) .frame-link'); const bb=await card.boundingBox();
await p.mouse.move(bb.x+bb.width*0.4,bb.y+bb.height*0.5,{steps:12}); await p.waitForTimeout(900);
await p.mouse.click(bb.x+bb.width*0.4,bb.y+bb.height*0.5); await p.waitForLoadState('domcontentloaded');
await start().catch(()=>{}); await p.waitForTimeout(2000);
await glide(await yOf('.hero-media')-20,1500); await p.waitForTimeout(1800);
await glide(await yOf('.block.wide'),1500); await p.waitForTimeout(1200);
await glide(await yOf('.block.wide')+700,1300); await p.waitForTimeout(1300);
await glide(await yOf('.toolfilter')-40,1500); await p.waitForTimeout(1800);
await cdp.send('Page.stopScreencast'); await b.close();
// concat with real durations, then constant 30 fps
let list=''; for(let i=0;i<frames.length;i++){const d=i<frames.length-1?Math.max(0.001,frames[i+1]-frames[i]):0.04;list+=`file '${TMP}/${String(i).padStart(5,'0')}.jpg'\nduration ${d.toFixed(4)}\n`;}
list+=`file '${TMP}/${String(frames.length-1).padStart(5,'0')}.jpg'\n`; fs.writeFileSync(`${TMP}/list.txt`,list);
execFileSync('/opt/homebrew/bin/ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',`${TMP}/list.txt`,'-vf','scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf4f1ea,fps=30,scale=in_range=pc:out_range=tv,format=yuv420p','-c:v','libx264','-preset','slow','-crf','22','-movflags','+faststart','-an',`${ROOT}/preview.mp4`]);
console.log('frames',frames.length,'span',(frames.at(-1)-frames[0]).toFixed(1),'s', (fs.statSync(`${ROOT}/preview.mp4`).size/1e6).toFixed(1),'MB');
fs.rmSync(TMP,{recursive:true,force:true});
