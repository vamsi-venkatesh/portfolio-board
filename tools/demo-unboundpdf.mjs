// Real task demo on the PUBLIC UnboundPDF merge tool: two locally generated sample PDFs are selected
// (setInputFiles = the file picker), merged in the browser, result shown. Every request is logged; the run
// FAILS if any request carries a body or goes to a host other than unboundpdf.com (proof nothing is uploaded).
import { chromium } from '.';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const ROOT='../13-board', FF='/opt/homebrew/bin/ffmpeg';
const TMP='/private/tmp/claude-501/-Users-vamsiv-vvdex-vault/d2822e25-8cee-41f0-9e24-47d3bd5732db/scratchpad/demo';
fs.mkdirSync(`${TMP}/f`,{recursive:true}); for(const f of fs.readdirSync(`${TMP}/f`)) fs.rmSync(`${TMP}/f/${f}`);
const b=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--hide-scrollbars']});
const ctx=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:false}); const p=await ctx.newPage();
for (const [n,t,c] of [['quarterly-report','Quarterly report','#e5481c'],['appendix-tables','Appendix: tables','#1e9e58']]){
  await p.setContent(`<body style="font:20px Georgia;padding:60px"><h1 style="color:${c}">${t}</h1><p>Sample document generated locally for this demo. No real data.</p>${'<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.</p>'.repeat(10)}</body>`);
  await p.pdf({path:`${TMP}/${n}.pdf`,format:'A4'});
}
const log=[]; p.on('request',r=>log.push({m:r.method(),u:r.url(),body:(r.postData()||'').length}));
await p.goto('https://unboundpdf.com/tools/merge-pdf/',{waitUntil:'networkidle'});
await p.addStyleTag({content:'#demo-cur{position:fixed;z-index:99999;left:0;top:0;width:22px;height:22px;pointer-events:none;transition:transform .55s cubic-bezier(.22,1,.36,1)} #demo-cur.c svg{transform:scale(.85)}'});
await p.evaluate(()=>{const d=document.createElement('div');d.id='demo-cur';d.innerHTML='<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 8-6.5 1.8L8.6 18z" fill="#161513" stroke="#fff" stroke-width="1.4"/></svg>';d.style.transform='translate(1100px,700px)';document.body.appendChild(d);});
const cur=async(sel,dx=.5,dy=.5)=>{const bb=await p.locator(sel).first().boundingBox();await p.evaluate(([x,y])=>document.getElementById('demo-cur').style.transform=`translate(${x}px,${y}px)`,[bb.x+bb.width*dx,bb.y+bb.height*dy]);};
const click=async()=>{await p.evaluate(()=>{const c=document.getElementById('demo-cur');c.classList.add('c');setTimeout(()=>c.classList.remove('c'),180)});};
const cdp=await ctx.newCDPSession(p); const ts=[];
cdp.on('Page.screencastFrame',async f=>{fs.writeFileSync(`${TMP}/f/${String(ts.length).padStart(5,'0')}.jpg`,Buffer.from(f.data,'base64'));ts.push(f.metadata.timestamp);cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
const n0=log.length;
await cdp.send('Page.startScreencast',{format:'jpeg',quality:86,maxWidth:1440,maxHeight:900});
await p.waitForTimeout(900);
await p.evaluate(()=>{let e=document.querySelector('input[type=file]');while(e&&!(e.offsetWidth>200))e=e.parentElement;if(e)e.id='demo-drop';});await cur('#demo-drop'); await p.waitForTimeout(900); await click();
await p.setInputFiles('input[type=file] >> nth=0',[`${TMP}/quarterly-report.pdf`,`${TMP}/appendix-tables.pdf`]);
await p.waitForTimeout(1700);
await cur('button:has-text("↓") >> nth=0'); await p.waitForTimeout(800); await click();
await p.locator('button:has-text("↓")').first().click(); await p.waitForTimeout(1300);
await cur('button:has-text("Merge PDFs")'); await p.waitForTimeout(800); await click();
p.on('download',d=>d.cancel().catch(()=>{}));
await p.locator('button:has-text("Merge PDFs")').click();
await p.waitForTimeout(2600);
await p.evaluate(()=>scrollBy({top:260,behavior:'smooth'})); await p.waitForTimeout(1800);
await cdp.send('Page.stopScreencast');
await p.screenshot({path:`${TMP}/after-merge.jpg`});
const after=log.slice(n0);
const bad=after.filter(r=>r.body>0||!/^https:\/\/unboundpdf\.com\//.test(r.u)&&!/^(blob|data):/.test(r.u));
fs.writeFileSync(`${ROOT}/data/demo-unboundpdf-requests.json`,JSON.stringify({recorded_utc:new Date().toISOString(),requests_during_task:after,non_local_or_with_body:bad},null,1));
console.log('requests during task',after.length,'flagged',bad.length, bad.slice(0,5));
await b.close();
if(bad.length){console.log('ABORT: not encoding');process.exit(1);}
// encode with real timing, 25 fps, crossfade end->start for a seamless loop
let list=''; for(let i=0;i<ts.length;i++){const d=i<ts.length-1?Math.max(.001,ts[i+1]-ts[i]):.04;list+=`file '${TMP}/f/${String(i).padStart(5,'0')}.jpg'\nduration ${d.toFixed(4)}\n`;}
fs.writeFileSync(`${TMP}/list.txt`,list);
execFileSync(FF,['-y','-loglevel','error','-f','concat','-safe','0','-i',`${TMP}/list.txt`,'-vf','fps=25,format=yuv420p','-c:v','libx264','-crf','16','-an',`${TMP}/raw.mp4`]);
const dur=+execFileSync('/opt/homebrew/bin/ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',`${TMP}/raw.mp4`]).toString();
const D=0.6;
execFileSync(FF,['-y','-loglevel','error','-i',`${TMP}/raw.mp4`,'-i',`${TMP}/raw.mp4`,'-filter_complex',`[1:v]trim=duration=${D},setpts=PTS-STARTPTS[h];[0:v][h]xfade=transition=fade:duration=${D}:offset=${(dur-D).toFixed(3)}[s];[s]trim=start=${D},setpts=PTS-STARTPTS,scale=in_range=pc:out_range=tv,format=yuv420p[o]`,'-map','[o]','-an','-c:v','libx264','-preset','slow','-crf','27','-maxrate','1.7M','-bufsize','3.4M','-movflags','+faststart','-r','25',`${ROOT}/media/unboundpdf.mp4`]);
execFileSync(FF,['-y','-loglevel','error','-ss','4','-i',`${ROOT}/media/unboundpdf.mp4`,'-vf','scale=1200:-2','-frames:v','1','-q:v','4',`${ROOT}/media/unboundpdf.jpg`]);
console.log('dur',dur.toFixed(1),'size',(fs.statSync(`${ROOT}/media/unboundpdf.mp4`).size/1e6).toFixed(2),'MB');
