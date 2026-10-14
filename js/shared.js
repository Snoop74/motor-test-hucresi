'use strict';
/* =====================================================================
   shared.js — ortak yardımcılar, ses motoru, motor değiştirme, ana döngü.
   Görünümler (garaj / sürüş / laboratuvar) VIEWS'e kaydolur:
     VIEWS.x = {el, input(rdt), render(rdt), slow(), onEngine(), onShow()}
   ===================================================================== */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const CSSV=getComputedStyle(document.documentElement);
const tok=n=>CSSV.getPropertyValue('--'+n).trim();
const COL={bg:tok('bg'),panel:tok('panel'),panel2:tok('panel2'),face:tok('face'),line:tok('line'),line2:tok('line2'),ink:tok('ink'),mute:tok('mute'),dim:tok('dim'),
  amber:tok('amber'),cyan:tok('cyan'),flame:tok('flame'),violet:tok('violet'),steel:tok('steel'),ok:tok('ok'),warn:tok('warn'),crit:tok('crit')};
function hexA(h,a){const n=parseInt(h.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${clamp(a,0,1)})`;}
function mixHex(h1,h2,t){const a=parseInt(h1.slice(1),16),b=parseInt(h2.slice(1),16);const f=(s)=>Math.round(((a>>s)&255)*(1-t)+((b>>s)&255)*t);return `rgb(${f(16)},${f(8)},${f(0)})`;}
const MONO='"JetBrains Mono", ui-monospace, Consolas, monospace', DISP='"Chakra Petch", "Bahnschrift", "Segoe UI", sans-serif';
function fitCanvas(cv){const r=cv.getBoundingClientRect(), d=window.devicePixelRatio||1;
  const w=Math.max(10,Math.round(r.width*d)), h=Math.max(10,Math.round(r.height*d));
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
  const g=cv.getContext('2d'); g.setTransform(d,0,0,d,0,0); return [g,r.width,r.height];}
const fmtL=v=>(v*1000).toFixed(1).replace('.0','')+' L';

let sim=null, timeScale=1, soundOn=true;
const keys={};
const VIEWS={}; let curView='garage';
let curEngine=ENGINES[1];

/* Motoru değiştir, yeni simülasyon kur, sıcak rölantide başlat */
function switchEngine(id,opts){
  const def=ENGINES.find(e=>e.id===id)||ENGINES[1]; curEngine=def;
  applyEngine(def); configureModulesForEngine(); sim=createSim();
  if(!opts||opts.warm!==false) warmStart(opts&&opts.ect);
  try{localStorage.setItem('motor.engine',id);}catch(e){}
  for(const v of Object.values(VIEWS)) v.onEngine&&v.onEngine();
}
function warmStart(ect){
  const S=sim; S.key=true; S.ecuOn=true; S.primeT=0; S.ect=ect??62; S.oilT=(ect??62)-7; S.fuelP=ENG.diesel?700e5:3e5; S.railT=700e5;
  S.omega=ENG.idle*1.05*Math.PI/30; S.map=ENG.diesel?P_AMB:34000; S.ecu.o2t=20; S.batt=14; S.ecu.glowDone=true;
  for(let k=0;k<6500;k++) simStep(S,0.0004); S.events.length=0; S.fuelUsed=0; S.veh.odo=0;
}

/* ---------- Ses ---------- */
const AU={ctx:null};
function auInit(){
  if(AU.ctx){if(AU.ctx.state==='suspended') AU.ctx.resume(); return;}
  let ctx; try{ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
  AU.ctx=ctx;
  const comp=ctx.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=5; comp.connect(ctx.destination);
  AU.master=ctx.createGain(); AU.master.gain.value=soundOn?volume()*0.9:0; AU.master.connect(comp);
  AU.lp=ctx.createBiquadFilter(); AU.lp.type='lowpass'; AU.lp.frequency.value=900; AU.lp.Q.value=0.7;
  AU.res=ctx.createBiquadFilter(); AU.res.type='peaking'; AU.res.frequency.value=160; AU.res.Q.value=1.4; AU.res.gain.value=7;
  const sh=ctx.createWaveShaper(); const cur=new Float32Array(1024); for(let i=0;i<1024;i++){const x=i/512-1;cur[i]=Math.tanh(2.2*x);} sh.curve=cur;
  AU.lp.connect(AU.res); AU.res.connect(sh); sh.connect(AU.master);
  const sr=ctx.sampleRate;
  const mk=(dur,fn)=>{const b=ctx.createBuffer(1,Math.floor(sr*dur),sr),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=fn(i/sr);return b;};
  AU.thump=mk(0.11,t=>Math.exp(-t/0.016)*Math.sin(2*Math.PI*(70+260*Math.exp(-t/0.01))*t)*0.9+(Math.random()*2-1)*Math.exp(-t/0.005)*0.55);
  AU.ping=mk(0.05,t=>Math.exp(-t/0.008)*Math.sin(2*Math.PI*6300*t)*0.5);
  AU.clack=mk(0.03,t=>(Math.random()*2-1)*Math.exp(-t/0.0025)*0.8+Math.sin(2*Math.PI*2300*t)*Math.exp(-t/0.004)*0.5);
  AU.pop=mk(0.18,t=>(Math.random()*2-1)*Math.exp(-t/0.03)*0.9+Math.sin(2*Math.PI*55*t)*Math.exp(-t/0.05));
  AU.hiss=mk(0.6,t=>(Math.random()*2-1)*Math.exp(-t/0.18)*0.35);
  AU.crash=mk(0.7,t=>(Math.random()*2-1)*Math.exp(-t/0.12)*0.9+Math.sin(2*Math.PI*48*t)*Math.exp(-t/0.15));
  AU.blip=mk(0.12,t=>Math.sin(2*Math.PI*880*t)*Math.exp(-t/0.05)*0.4);
  const noise=mk(2,()=>Math.random()*2-1); AU.noise=noise;
  const ns=ctx.createBufferSource(); ns.buffer=noise; ns.loop=true;
  AU.bp=ctx.createBiquadFilter(); AU.bp.type='bandpass'; AU.bp.frequency.value=400; AU.bp.Q.value=0.9;
  AU.ng=ctx.createGain(); AU.ng.gain.value=0; ns.connect(AU.bp); AU.bp.connect(AU.ng); AU.ng.connect(AU.master); ns.start();
  // rüzgâr / lastik
  const ws=ctx.createBufferSource(); ws.buffer=noise; ws.loop=true; ws.playbackRate.value=0.7;
  AU.wf=ctx.createBiquadFilter(); AU.wf.type='lowpass'; AU.wf.frequency.value=700;
  AU.wg=ctx.createGain(); AU.wg.gain.value=0; ws.connect(AU.wf); AU.wf.connect(AU.wg); AU.wg.connect(AU.master); ws.start();
  const ts_=ctx.createBufferSource(); ts_.buffer=noise; ts_.loop=true;
  AU.sqf=ctx.createBiquadFilter(); AU.sqf.type='bandpass'; AU.sqf.frequency.value=1400; AU.sqf.Q.value=6;
  AU.sqg=ctx.createGain(); AU.sqg.gain.value=0; ts_.connect(AU.sqf); AU.sqf.connect(AU.sqg); AU.sqg.connect(AU.master); ts_.start();
  // marş motoru
  AU.st=ctx.createOscillator(); AU.st.type='sawtooth'; AU.st.frequency.value=110;
  AU.stf=ctx.createBiquadFilter(); AU.stf.type='lowpass'; AU.stf.frequency.value=900;
  AU.sg=ctx.createGain(); AU.sg.gain.value=0; AU.st.connect(AU.stf); AU.stf.connect(AU.sg); AU.sg.connect(AU.master); AU.st.start();
  // yakıt pompası
  AU.pu=ctx.createOscillator(); AU.pu.type='square'; AU.pu.frequency.value=180; AU.pg=ctx.createGain(); AU.pg.gain.value=0;
  const pf=ctx.createBiquadFilter(); pf.type='lowpass'; pf.frequency.value=500; AU.pu.connect(pf); pf.connect(AU.pg); AU.pg.connect(AU.master); AU.pu.start();
  // turbo ıslığı
  AU.tu=ctx.createOscillator(); AU.tu.type='sine'; AU.tu.frequency.value=2000; AU.tg=ctx.createGain(); AU.tg.gain.value=0;
  AU.tu.connect(AU.tg); AU.tg.connect(AU.master); AU.tu.start();
}
function volume(){const el=$('#rVol'); return el?+el.value/100:0.6;}
function setSound(on){soundOn=on; $$('.bSound').forEach(b=>b.firstChild.textContent=on?'Ses: açık ':'Ses: kapalı '); if(AU.master) AU.master.gain.value=on?volume()*0.9:0;}
function auPlay(buf,when,gain,rate,dest){const s=AU.ctx.createBufferSource(); s.buffer=buf; s.playbackRate.value=rate;
  const g=AU.ctx.createGain(); g.gain.value=gain; s.connect(g); g.connect(dest||AU.master); s.start(when);}
function auOneShot(name,gain){if(!AU.ctx||!soundOn) return; auPlay(AU[name],AU.ctx.currentTime+0.01,gain,1);}
function auFrame(events,frameStart,scale,extra){
  if(!AU.ctx) return;
  const c=AU.ctx, now=c.currentTime, base=now+0.06, S=sim, sd=ENG.def.snd||{};
  const tp=S.tps, r=S.rpm, rn=r*ENG.s;
  AU.lp.frequency.setTargetAtTime((500+2600*tp+rn*0.18)*(sd.lp||1),now,0.05);
  AU.res.frequency.setTargetAtTime((sd.res||120)+rn*0.02,now,0.1);
  let n=0;
  for(const ev of events){
    const when=base+Math.max(0,(ev.t-frameStart)/scale);
    if(ev.type==='fire'){ if(n++>110) continue;
      const a=clamp(ev.amp/12e5,0.05,1.3), bank=sd.burble&&ev.cyl>=4?0.86:1;
      auPlay(AU.thump,when,(0.10+0.32*Math.pow(a,0.8)*(0.55+0.6*tp))*(sd.burble&&ev.cyl>=4?1.15:1)*(ENG.n>6?0.8:1),(0.9+0.2*Math.random()+rn/9000)*bank*(sd.res>200?1.4:1),AU.lp);
      if(sd.clatter) auPlay(AU.clack,when+0.001,0.10+0.12*(1-tp*0.5),0.9+0.2*Math.random());}
    else if(ev.type==='knock') auPlay(AU.ping,when,0.25+ev.amp*1.2,0.95+0.1*Math.random());
    else if(ev.type==='pop') auPlay(AU.pop,when,0.55,0.8+0.4*Math.random());
    else if(ev.type==='bov') auPlay(AU.hiss,when,0.35+0.4*Math.min(ev.amp,1.4),1);
  }
  const slow=scale<0.3?0.25:1;
  AU.ng.gain.setTargetAtTime(S.rpm>50?(0.012+0.05*tp)*Math.min(1,rn/3000)*slow:0,now,0.05);
  AU.bp.frequency.setTargetAtTime(250+rn*0.25,now,0.05);
  const cr=S.key&&S.startBtn;
  AU.sg.gain.setTargetAtTime(cr?0.07:0,now,0.03);
  AU.st.frequency.setTargetAtTime((60+r*0.55)*Math.max(scale,0.05),now,0.03);
  AU.pg.gain.setTargetAtTime(S.pumpOn&&S.rpm<60?0.02:S.pumpOn?0.004:0,now,0.05);
  const ts=S.turboSpd||0;
  AU.tg.gain.setTargetAtTime(modOn('turbo')&&ts>0.1?0.012*ts*slow:0,now,0.08);
  AU.tu.frequency.setTargetAtTime(1500+ts*6500,now,0.08);
  const v=extra&&extra.wind?S.veh.v:0;
  AU.wg.gain.setTargetAtTime(Math.min(0.12,v*v*0.00012),now,0.1); AU.wf.frequency.setTargetAtTime(300+v*25,now,0.1);
  AU.sqg.gain.setTargetAtTime(extra&&extra.squeal?Math.min(0.09,extra.squeal*0.09):0,now,0.04);
}

/* ---------- Görünüm geçişi ---------- */
function showView(v){
  curView=v; $$('#viewNav button').forEach(b=>b.classList.toggle('act',b.dataset.v===v));
  for(const [k,V] of Object.entries(VIEWS)) V.el.hidden=k!==v;
  $('#pCL').hidden=v!=='lab'||ENG.diesel; $('#pRev').hidden=v!=='lab';
  VIEWS[v]&&VIEWS[v].onShow&&VIEWS[v].onShow();
  try{localStorage.setItem('motor.view',v);}catch(e){}
}

/* ---------- Ana döngü ---------- */
let lastTs=0, lastFrameWall=0, slowT=0;
function frame(ts,noRaf){
  lastFrameWall=performance.now();
  try{tick(ts);}catch(e){if(!frame.err){frame.err=1; console.error(e);} showFatal(e);}
  if(!noRaf) requestAnimationFrame(frame);
}
/* bir çizim/fizik hatası döngüyü öldürmesin; ekranda kısa bir uyarı göster */
function showFatal(e){let el=$('#fatal'); if(!el){el=document.createElement('div'); el.id='fatal';
  el.style.cssText='position:fixed;left:16px;bottom:16px;z-index:99;max-width:min(560px,calc(100vw - 32px));background:var(--crit);color:var(--bg);font:12px var(--f-mono);padding:8px 10px;border-radius:4px';
  document.body.appendChild(el);} el.textContent='Hata: '+(e&&e.message||e)+' — sayfayı yenileyin; sürerse bu metni bana iletin.';}
function tick(ts){
  const rdt=lastTs?clamp((ts-lastTs)/1000,0,0.05):0.016; lastTs=Math.max(ts,lastTs);
  const S=sim, V=VIEWS[curView];
  if(V&&V.input) V.input(rdt);
  const ts_=V&&V.timeScale?V.timeScale():timeScale;
  const simDt=rdt*ts_, t0=S.t;
  const steps=clamp(Math.ceil(Math.max(Math.abs(S.omega)*simDt/(1.2*D2R),simDt/0.0004)),1,4000), h=simDt/steps;
  for(let q=0;q<steps;q++){simStep(S,h); V&&V.sample&&V.sample();}
  if(V&&V.post) V.post(rdt);
  if(soundOn) auFrame(S.events,t0,ts_,V&&V.audio?V.audio():null);
  V&&V.events&&V.events(S.events);
  S.events.length=0;
  if(V&&V.render) V.render(rdt);
  slowT+=rdt; if(slowT>0.12){slowT=0; V&&V.slow&&V.slow(); updStatus();}
}
setInterval(()=>{if(performance.now()-lastFrameWall>250) frame(performance.now(),true);},100); // rAF durursa (arka plan) yedek
function updStatus(){const S=sim,e=S.ecu,p=$('#pState');
  let t='KAPALI',c='';
  if(S.key){ if(S.startBtn&&S.rpm<ENG.idle*0.7){t='MARŞ';c='warn';} else if(S.rpm>ENG.idle*0.45){t=e.limp?'KORUMA MODU':'ÇALIŞIYOR';c=e.limp?'crit':'on';} else if(S.runT>0){t='STOP ETTİ';c='crit';} else if(ENG.diesel&&e.glowT>0){t='KIZDIRMA';c='warn';} else t='KONTAK AÇIK';}
  p.textContent=t; p.className='pill '+c;
  const m=$('#pMIL'); m.className='pill '+(e.dtc.size&&S.key?'warn':''); m.textContent=e.dtc.size?`MOTOR ARIZA · ${e.dtc.size}`:'MOTOR ARIZA';
  $('#pEng').textContent=ENG.def.short+' · '+ENG.def.veh.name;
}
function setKey(on){sim.key=on; if(!on) sim.runT=0; $$('.bKey').forEach(b=>{b.classList.toggle('on',on); b.firstChild.textContent=on?'Kontak açık ':'Kontak kapalı ';});}
function startOn(){auInit(); sim.startBtn=true; $$('.bStart').forEach(b=>b.classList.add('held'));}
function startOff(){sim.startBtn=false; $$('.bStart').forEach(b=>b.classList.remove('held'));}
function holdButton(el,on,off){el.addEventListener('pointerdown',e=>{e.preventDefault(); el.setPointerCapture(e.pointerId); on();});
  el.addEventListener('pointerup',off); el.addEventListener('pointercancel',off); el.addEventListener('lostpointercapture',off);}
document.addEventListener('pointerdown',()=>auInit(),{once:true});
const typing=()=>{const a=document.activeElement; return a&&(a.tagName==='INPUT'&&a.type!=='range'&&a.type!=='checkbox'||a.tagName==='SELECT'||a.tagName==='TEXTAREA');};
document.addEventListener('keydown',e=>{if(typing()||e.ctrlKey||e.metaKey||e.altKey) return; const V=VIEWS[curView]; if(V&&V.key) V.key(e.key.toLowerCase(),true,e);});
document.addEventListener('keyup',e=>{const V=VIEWS[curView]; if(V&&V.key) V.key(e.key.toLowerCase(),false,e);});
window.addEventListener('blur',()=>{for(const k in keys) keys[k]=false; startOff(); if(sim) sim.nitroBtn=false;});
