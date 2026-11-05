// Records a public page's own live demo in real time (no clicks, no input): vvdexops.com replays a real sealed
// agent run in its hero. Usage: node tools/demo-hold.mjs <slug> <url> <seconds>
import { chromium } from '.';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [slug,url,secs]=process.argv.slice(2); const ROOT='../13-board', FF='/opt/homebrew/bin/ffmpeg';
const TMP='/private/tmp/claude-501/-Users-vamsiv-vvdex-vault/d2822e25-8cee-41f0-9e24-47d3bd5732db/scratchpad/hold';
fs.rmSync(TMP,{recursive:true,force:true}); fs.mkdirSync(`${TMP}/f`,{recursive:true});
const b=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--hide-scrollbars']});
const ctx=await b.newContext({viewport:{width:1440,height:900}}); const p=await ctx.newPage();
await p.goto(url,{waitUntil:'networkidle'}); await p.waitForTimeout(600);
const cdp=await ctx.newCDPSession(p); const ts=[];
cdp.on('Page.screencastFrame',async f=>{fs.writeFileSync(`${TMP}/f/${String(ts.length).padStart(5,'0')}.jpg`,Buffer.from(f.data,'base64'));ts.push(f.metadata.timestamp);cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
await cdp.send('Page.startScreencast',{format:'jpeg',quality:86,maxWidth:1440,maxHeight:900});
await p.waitForTimeout(+secs*1000);
await cdp.send('Page.stopScreencast'); await b.close();
let list=''; for(let i=0;i<ts.length;i++){const d=i<ts.length-1?Math.max(.001,ts[i+1]-ts[i]):.04;list+=`file '${TMP}/f/${String(i).padStart(5,'0')}.jpg'\nduration ${d.toFixed(4)}\n`;}
fs.writeFileSync(`${TMP}/list.txt`,list);
execFileSync(FF,['-y','-loglevel','error','-f','concat','-safe','0','-i',`${TMP}/list.txt`,'-vf','fps=25,format=yuv420p','-c:v','libx264','-crf','16','-an',`${TMP}/raw.mp4`]);
const dur=+execFileSync('/opt/homebrew/bin/ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',`${TMP}/raw.mp4`]).toString(); const D=0.6;
execFileSync(FF,['-y','-loglevel','error','-i',`${TMP}/raw.mp4`,'-i',`${TMP}/raw.mp4`,'-filter_complex',`[1:v]trim=duration=${D},setpts=PTS-STARTPTS[h];[0:v][h]xfade=transition=fade:duration=${D}:offset=${(dur-D).toFixed(3)}[s];[s]trim=start=${D},setpts=PTS-STARTPTS,scale=in_range=pc:out_range=tv,format=yuv420p[o]`,'-map','[o]','-an','-c:v','libx264','-preset','slow','-crf','27','-maxrate','1.7M','-bufsize','3.4M','-movflags','+faststart','-r','25',`${ROOT}/media/${slug}.mp4`]);
execFileSync(FF,['-y','-loglevel','error','-ss',String(Math.min(5,dur/2)),'-i',`${ROOT}/media/${slug}.mp4`,'-vf','scale=1200:-2','-frames:v','1','-q:v','4',`${ROOT}/media/${slug}.jpg`]);
console.log(slug,'dur',dur.toFixed(1),(fs.statSync(`${ROOT}/media/${slug}.mp4`).size/1e6).toFixed(2),'MB');
fs.rmSync(TMP,{recursive:true,force:true});
