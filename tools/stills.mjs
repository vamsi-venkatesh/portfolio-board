// Builds a seamless loop from REAL product screenshots (slow push-in + crossfade). Used where no public UI exists.
import { chromium } from '.';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const FF='/opt/homebrew/bin/ffmpeg', FPS=25, SEG=3.6, X=0.6;
const ROOT='../13-board', SH='.';
const JOBS={ pitchradar:[['pitchradar-a',[0.3,0.35]],['pitchradar-b',[0.6,0.4]],['pitchradar-c',[0.45,0.6]]] };
const slug=process.argv[2]||'pitchradar', shots=JOBS[slug], T=SEG*shots.length;
const tmp=`/private/tmp/claude-501/-Users-vamsiv-vvdex-vault/d2822e25-8cee-41f0-9e24-47d3bd5732db/scratchpad/st_${slug}`;
fs.rmSync(tmp,{recursive:true,force:true}); fs.mkdirSync(tmp,{recursive:true});
const imgs=shots.map(([k,o])=>`<img data-ox="${o[0]}" data-oy="${o[1]}" src="data:image/jpeg;base64,${fs.readFileSync(`${SH}/${k}-1800.jpg`).toString('base64')}">`).join('');
const html=`<html><body style="margin:0;background:#111;overflow:hidden"><div id=s style="position:relative;width:1440px;height:900px;overflow:hidden">${imgs}</div>
<style>img{position:absolute;inset:0;width:1440px;height:900px;object-fit:cover}</style>
<script>const SEG=${SEG},X=${X},T=${T};const im=[...document.images];
window.render=t=>{im.forEach((el,i)=>{let u=((t-i*SEG+X)%T+T)%T-X;const vis=u>=-X&&u<=SEG;el.style.display=vis?'block':'none';
el.style.zIndex=u<0?10:1;el.style.opacity=u<0?String((u+X)/X):'1';const p=(u+X)/(SEG+X);const s=1.02+0.07*p;
el.style.transformOrigin=(el.dataset.ox*100)+'% '+(el.dataset.oy*100)+'%';el.style.transform='scale('+s+')';});};</script></body></html>`;
fs.writeFileSync(`${tmp}/r.html`,html);
const b=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1440,height:900}});
await p.goto('file://'+tmp+'/r.html'); await p.waitForTimeout(500);
const n=Math.round(T*FPS);
for(let f=0;f<n;f++){await p.evaluate(t=>window.render(t),f/FPS);await p.screenshot({path:`${tmp}/${String(f).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});}
await b.close();
const out=`${ROOT}/media/${slug}.mp4`;
execFileSync(FF,['-y','-loglevel','error','-framerate',String(FPS),'-i',`${tmp}/%04d.jpg`,'-vf','scale=in_range=pc:out_range=tv,format=yuv420p','-an','-c:v','libx264','-preset','slow','-crf','26','-maxrate','1.7M','-bufsize','3.4M','-movflags','+faststart',out]);
execFileSync(FF,['-y','-loglevel','error','-i',out,'-vf','scale=1200:-2','-frames:v','1','-q:v','4',`${ROOT}/media/${slug}.jpg`]);
console.log(slug,(fs.statSync(out).size/1e6).toFixed(2),'MB'); fs.rmSync(tmp,{recursive:true,force:true});
