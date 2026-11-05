// Records seamless product loops from REAL public pages (read-only: navigate + scroll only).
// Frames are captured deterministically (scrollTo per frame) then encoded with ffmpeg.
import { chromium } from '.';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const FF='/opt/homebrew/bin/ffmpeg', FPS=25, D=0.6; // crossfade seconds
const ROOT='../13-board';
const TMP=process.env.TMPDIR_REC||'/private/tmp/claude-501/-Users-vamsiv-vvdex-vault/d2822e25-8cee-41f0-9e24-47d3bd5732db/scratchpad/rec';
const JOBS={
  'forecasting':[{url:'https://lab.vvdexops.com/forecast',dur:10.4,scroll:2600}],
  'vvdex-platform':[{url:'https://vvdexops.com/',dur:10.4,scroll:2600}],
  'vvdex-engine':[{url:'https://lab.vvdexops.com/',dur:10.4,scroll:2800}],
  'unboundpdf':[{url:'https://unboundpdf.com/',dur:5.6,scroll:1500},{url:'https://unboundpdf.com/tools/merge-pdf/',dur:5.6,scroll:1100}],
  'conxfolio':[{url:'https://conxfolio.com/',dur:10.4,scroll:2600}],
  'farmquick':[{url:'https://farmquick.in/',dur:10.4,scroll:2600}],
  'conxto':[{url:'https://conxto.com/',dur:10.4,scroll:2800}],
  'vvdex-trading':[{url:'https://trading.vvdexops.com/',dur:10.4,scroll:420}],
};
const only=process.argv.slice(2);
const ease=x=>x<0?0:x>1?1:0.5-0.5*Math.cos(Math.PI*x);
const b=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--hide-scrollbars']});
for (const [slug,segs] of Object.entries(JOBS)){
  if(only.length && !only.includes(slug)) continue;
  const dir=`${TMP}/${slug}`; fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  const segFiles=[];
  for (const [i,s] of segs.entries()){
    const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
    await p.goto(s.url,{waitUntil:'networkidle',timeout:45000}).catch(e=>console.log('nav',e.message.slice(0,60)));
    // warm: trigger lazy images / reveal-on-scroll, then back to top
    const H=await p.evaluate(()=>document.documentElement.scrollHeight);
    for(let y=0;y<Math.min(H,s.scroll+1800);y+=450){await p.evaluate(y=>window.scrollTo(0,y),y);await p.waitForTimeout(140);}
    await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(1500);
    const n=Math.round(s.dur*FPS), hold=0.7;
    const fdir=`${dir}/s${i}`; fs.mkdirSync(fdir);
    for(let f=0;f<n;f++){
      const t=f/FPS, x=(t-hold)/(s.dur-hold*2);
      await p.evaluate(y=>window.scrollTo(0,y),Math.round(s.scroll*ease(x)));
      await p.screenshot({path:`${fdir}/${String(f).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});
    }
    await p.close();
    segFiles.push({fdir,dur:n/FPS});
  }
  // ffmpeg: xfade chain between segments, then seam-crossfade into the first segment's head and drop the head.
  const args=['-y','-loglevel','error'];
  segFiles.forEach(s=>args.push('-framerate',String(FPS),'-i',`${s.fdir}/%04d.jpg`));
  args.push('-framerate',String(FPS),'-i',`${segFiles[0].fdir}/%04d.jpg`);
  let g='', last='[0:v]', T=segFiles[0].dur;
  for(let i=1;i<segFiles.length;i++){
    g+=`${last}[${i}:v]xfade=transition=fade:duration=${D}:offset=${(T-D).toFixed(3)}[x${i}];`; last=`[x${i}]`; T=T-D+segFiles[i].dur;
  }
  const k=segFiles.length;
  g+=`[${k}:v]trim=duration=${D},setpts=PTS-STARTPTS[head];${last}[head]xfade=transition=fade:duration=${D}:offset=${(T-D).toFixed(3)}[seam];[seam]trim=start=${D},setpts=PTS-STARTPTS,scale=in_range=pc:out_range=tv,format=yuv420p[out]`;
  const out=`${ROOT}/media/${slug}.mp4`;
  args.push('-filter_complex',g,'-map','[out]','-an','-c:v','libx264','-preset','slow','-crf','27','-maxrate','1.7M','-bufsize','3.4M','-pix_fmt','yuv420p','-movflags','+faststart','-r',String(FPS),out);
  execFileSync(FF,args);
  execFileSync(FF,['-y','-loglevel','error','-i',out,'-vf','scale=1200:-2','-frames:v','1','-q:v','4',`${ROOT}/media/${slug}.jpg`]);
  console.log(slug,(fs.statSync(out).size/1e6).toFixed(2),'MB');
  fs.rmSync(dir,{recursive:true,force:true});
}
await b.close();
