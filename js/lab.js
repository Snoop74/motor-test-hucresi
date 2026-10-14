'use strict';
/* =====================================================================
   lab.js — LABORATUVAR: kesit, silindir şeridi, göstergeler, osiloskop,
   p–θ, dinamometre, ECU sekmeleri. VIEWS.lab olarak kaydolur.
   ===================================================================== */
let strobe=false, selCyl=0, pvMode='pt', visTheta=0;

/* ---------- Kesit görünüm ---------- */
const cvE=$('#cvEngine'), cvS=$('#cvStrip');
function liftAt(phi,open,dur){const x=mod(phi-open,720); return x<dur?Math.pow(Math.sin(Math.PI*x/dur),2):0;}
function inLift(phi){return liftAt(phi,IVO,IVC_L+720-IVO);} function exLift(phi){return liftAt(phi,EVO,EVC-EVO);}
function strokeName(phi){return phi<180?'EMME':phi<360?'SIKIŞTIRMA':phi<540?'İŞ (GENİŞLEME)':'EGZOZ';}
function burnFrac(inf,phi){if(!inf.fired||phi<inf.start) return 0; const z=(phi-inf.start)/inf.dur; return 1-Math.exp(-5*Math.pow(z,inf.wm||3));}
function gasColor(c,phi,alpha){
  const inf=c.info;
  if(phi<180) return hexA(COL.cyan,0.18*alpha);
  if(phi<540){const xb=burnFrac(inf,phi);
    if(!inf.fired||xb<0.02) return hexA(COL.cyan,(0.18+0.35*clamp((phi-180)/180,0,1))*alpha);
    const cool=clamp((phi-380)/160,0,1);
    return mixHex(mixHex('#fff2b0',COL.flame,clamp(xb*1.2,0,1)),'#5a2316',cool);}
  const t=(phi-540)/180; return inf.fired?mixHex('#6a3a24',COL.panel2,t):hexA(COL.cyan,0.25*(1-t));
}
function label(g,x,y,tx,ty,txt,align){g.strokeStyle=COL.dim;g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(tx,ty);g.stroke();
  g.fillStyle=COL.mute;g.font=`10.5px ${MONO}`;g.textAlign=align||'left';g.textBaseline='middle';g.fillText(txt,tx+(align==='right'?-4:4),ty);}
function bankName(i){const d=ENG.def; if(d.layout.startsWith('V')) return i<ENG.n/2?'sol sıra':'sağ sıra'; return '';}
let dashIn=0,dashEx=0;
function drawEngine(rdt){
  const [g,W,H]=fitCanvas(cvE);
  g.fillStyle=COL.face; g.fillRect(0,0,W,H);
  if(W<160||H<160) return;
  g.strokeStyle=hexA(COL.line,0.5); g.lineWidth=1; g.beginPath();
  for(let x=0;x<W;x+=24){g.moveTo(x+0.5,0);g.lineTo(x+0.5,H);} for(let y=0;y<H;y+=24){g.moveTo(0,y+0.5);g.lineTo(W,y+0.5);} g.stroke();
  const S=sim, c=S.cyl[selCyl], th=strobe?visTheta:S.theta, phi=mod(th-CYL_OFS[selCyl],720), inf=c.info, D=ENG.diesel;
  const topBar=46;
  // çizim ölçeği strok/çap oranına göre: kısa strok motorlar daha geniş görünür
  const B=Math.min(W*0.2,(H-topBar-16)/(1.6+3.0*ENG.stroke/ENG.bore)), k=B/ENG.bore;
  const cx=W*0.5, rp=ENG.r*k, Lr=ENG.rod*k;
  const crankY=H-rp-B*0.42;
  const pinFromTop=B*0.30, pistH=B*0.62;
  const pistTopTDC=crankY-rp-Lr-pinFromTop;
  const deckY=pistTopTDC-B*0.05;
  const roofY=deckY-(D?B*0.06:B*0.2);
  const headTop=deckY-B*0.78;
  const pistTop=pistTopTDC+pistonX(phi)*k;
  const a=phi*D2R, cpx=cx+rp*Math.sin(a), cpy=crankY-rp*Math.cos(a), pinY=pistTop+pinFromTop;
  const blockW=B*0.36, linerBot=pistTopTDC+2*rp+pistH*0.55;
  g.strokeStyle=COL.line2; g.setLineDash([4,4]); g.beginPath(); g.arc(cx,crankY,rp+B*0.38,0,Math.PI*2); g.stroke(); g.setLineDash([]);
  g.fillStyle=COL.panel2; g.strokeStyle=COL.line2; g.lineWidth=1.2;
  g.fillRect(cx-B/2-blockW,deckY,blockW,linerBot-deckY); g.strokeRect(cx-B/2-blockW,deckY,blockW,linerBot-deckY);
  g.fillRect(cx+B/2,deckY,blockW,linerBot-deckY); g.strokeRect(cx+B/2,deckY,blockW,linerBot-deckY);
  const cool=clamp((S.ect-20)/90,0,1), jc=mixHex(COL.cyan,COL.crit,cool);
  g.fillStyle=jc; g.globalAlpha=0.45;
  g.fillRect(cx-B/2-blockW*0.72,deckY+4,blockW*0.36,Math.min(B*1.15,linerBot-deckY-8)); g.fillRect(cx+B/2+blockW*0.36,deckY+4,blockW*0.36,Math.min(B*1.15,linerBot-deckY-8));
  g.globalAlpha=1;
  // silindir içi gaz
  g.save(); g.beginPath();
  g.moveTo(cx-B/2,pistTop); g.lineTo(cx-B/2,deckY-B*0.03); g.lineTo(cx,roofY); g.lineTo(cx+B/2,deckY-B*0.03); g.lineTo(cx+B/2,pistTop); g.closePath();
  g.fillStyle=COL.face; g.fill(); g.clip();
  const xb=(phi>=180&&phi<540)?burnFrac(inf,phi):0;
  g.fillStyle=gasColor(c,phi,1); g.fillRect(cx-B,roofY-B*0.2,B*2,pistTop-roofY+B*0.3);
  if(xb>0.01&&xb<0.999){
    const oy=D?pistTop-B*0.08:roofY+B*0.04, rr=B*1.25*Math.cbrt(xb), gr=g.createRadialGradient(cx,oy,1,cx,oy,rr);
    gr.addColorStop(0,'#fff6d0'); gr.addColorStop(0.55,COL.flame); gr.addColorStop(0.92,hexA(COL.flame,0.85)); gr.addColorStop(1,hexA(COL.cyan,0.3));
    g.fillStyle=hexA(COL.cyan,0.45); g.fillRect(cx-B,roofY-B*0.2,B*2,pistTop-roofY+B*0.3);
    g.fillStyle=gr; g.beginPath(); g.arc(cx,oy,rr,0,Math.PI*2); g.fill();
  }
  if(inf.knock>0&&phi>360+inf.thP&&phi<360+inf.thP+25){g.strokeStyle=COL.crit;g.lineWidth=3;g.strokeRect(cx-B/2+2,roofY,B-4,pistTop-roofY-2);}
  g.restore();
  g.strokeStyle=COL.steel; g.lineWidth=1.5; g.beginPath(); g.moveTo(cx-B/2,deckY); g.lineTo(cx-B/2,linerBot); g.moveTo(cx+B/2,deckY); g.lineTo(cx+B/2,linerBot); g.stroke();
  // kafa + portlar
  const ivx=cx-B*0.24, evx=cx+B*0.24, seatY=deckY-B*0.11;
  g.fillStyle=COL.panel2; g.strokeStyle=COL.line2;
  g.beginPath(); g.moveTo(cx-B/2-blockW,deckY); g.lineTo(cx-B/2-blockW,headTop); g.lineTo(cx+B/2+blockW,headTop); g.lineTo(cx+B/2+blockW,deckY);
  g.lineTo(cx+B/2,deckY); g.lineTo(cx+B/2,deckY-B*0.03); g.lineTo(cx,roofY); g.lineTo(cx-B/2,deckY-B*0.03); g.lineTo(cx-B/2,deckY); g.closePath(); g.fill(); g.stroke();
  if(D){ // dizel piston çanağı
    g.strokeStyle=COL.steel; g.lineWidth=1; g.beginPath(); g.arc(cx,pistTop-B*0.02,B*0.2,0.15*Math.PI,0.85*Math.PI); g.stroke();}
  const portW=B*0.24;
  const inPath=[[ivx,seatY],[cx-B*0.5,deckY-B*0.42],[cx-B/2-blockW,deckY-B*0.5],[W*0.03,deckY-B*0.5]];
  const exPath=[[evx,seatY],[cx+B*0.5,deckY-B*0.42],[cx+B/2+blockW,deckY-B*0.5],[W*0.97,deckY-B*0.5]];
  const path=(P)=>{g.beginPath();g.moveTo(P[0][0],P[0][1]);g.quadraticCurveTo(P[1][0],P[1][1],P[2][0],P[2][1]);g.lineTo(P[3][0],P[3][1]);};
  g.lineCap='butt';
  path(inPath); g.strokeStyle=COL.line2; g.lineWidth=portW+4; g.stroke();
  path(inPath); g.strokeStyle=mixHex(COL.face,COL.cyan,0.18+0.25*(D?1:S.tps)+(S.boost>2e4?0.2:0)); g.lineWidth=portW; g.stroke();
  const egtc=clamp((S.egt-500)/600,0,1);
  path(exPath); g.strokeStyle=mixHex(COL.line2,COL.flame,egtc*0.8); g.lineWidth=portW+4; g.stroke();
  path(exPath); g.strokeStyle=mixHex(COL.face,'#7a3a20',0.4+0.5*egtc); g.lineWidth=portW; g.stroke();
  dashIn-=rdt*(8+S.mdotTh*1500/ENG.sc)*Math.min(1,timeScale*4); dashEx-=rdt*(8+S.mdotCyl*1500/ENG.sc)*Math.min(1,timeScale*4);
  g.setLineDash([5,9]); g.lineWidth=1.4;
  g.lineDashOffset=dashIn; path(inPath); g.strokeStyle=hexA(COL.cyan,inLift(phi)>0.05?0.9:0.35); g.stroke();
  g.lineDashOffset=-dashEx; path(exPath); g.strokeStyle=hexA('#d9b49a',exLift(phi)>0.05?0.85:0.25); g.stroke();
  g.setLineDash([]);
  // gaz kelebeği (dizelde yok: açık boğaz)
  const tbx=cx-B/2-blockW-B*0.95, tby=deckY-B*0.5, plate=(7+(D?1:S.tps)*83)*D2R;
  g.strokeStyle=COL.steel; g.lineWidth=2; g.beginPath(); g.arc(tbx,tby,portW*0.62,0,Math.PI*2); g.stroke();
  if(!D){g.lineWidth=3; g.strokeStyle=COL.amber; g.beginPath(); g.moveTo(tbx-Math.sin(plate)*portW*0.55,tby-Math.cos(plate)*portW*0.55); g.lineTo(tbx+Math.sin(plate)*portW*0.55,tby+Math.cos(plate)*portW*0.55); g.stroke();}
  // enjektör: benzinde portta, dizelde yanma odasının ortasında
  let pwDeg, inj;
  if(D){pwDeg=8+sim.ecu.q*0.35; inj=S.rpm>40&&sim.ecu.q>0.2&&mod(phi-(360-inf.adv),720)<pwDeg;}
  else {pwDeg=sim.ecu.pw*S.rpm*6/1000; inj=S.rpm>40&&pwDeg>0&&mod(650-phi,720)<pwDeg;}
  const ijx=D?cx:cx-B/2-blockW*0.35, ijy=D?headTop-B*0.05:deckY-B*0.86, ang=D?Math.PI/2:Math.atan2(seatY-ijy,ivx-ijx);
  g.save(); g.translate(ijx,ijy); g.rotate(ang);
  const il_=D?(roofY-ijy):B*0.22;
  g.fillStyle=COL.steel; g.fillRect(D?0:-B*0.22,-B*0.045,D?il_:B*0.22,B*0.09); g.fillStyle=COL.violet; g.fillRect(D?-B*0.12:-B*0.30,-B*0.06,B*0.09,B*0.12);
  if(inj){const L=D?B*0.45:B*0.42, x0=D?il_:0; const gr=g.createLinearGradient(x0,0,x0+L,0); gr.addColorStop(0,hexA(COL.violet,0.9)); gr.addColorStop(1,hexA(COL.violet,0));
    g.fillStyle=gr; g.beginPath(); g.moveTo(x0,0); g.lineTo(x0+L,-B*(D?0.3:0.09)); g.lineTo(x0+L,B*(D?0.3:0.09)); g.closePath(); g.fill();}
  g.restore();
  // supaplar
  const drawValve=(vx,lift,dir,col)=>{const L=B*0.115*lift;
    const stemTopX=vx+dir*B*0.20, stemTopY=headTop+B*0.02;
    const dx=stemTopX-vx, dy=stemTopY-seatY, len=Math.hypot(dx,dy), ux=dx/len, uy=dy/len;
    const bx=vx-ux*L, by=seatY-uy*L;
    g.strokeStyle=col; g.lineWidth=2.2; g.beginPath(); g.moveTo(bx,by); g.lineTo(bx+ux*len*1.05,by+uy*len*1.05); g.stroke();
    g.lineWidth=3.2; g.beginPath(); g.moveTo(bx-uy*B*0.13,by+ux*B*0.13); g.lineTo(bx+uy*B*0.13,by-ux*B*0.13); g.stroke();
    g.strokeStyle=COL.dim; g.lineWidth=1; g.beginPath();
    const s0x=bx+ux*len*0.62, s0y=by+uy*len*0.62;
    for(let q=0;q<=8;q++){const t=q/8*len*0.36, w=(q%2?1:-1)*B*0.06; const px=s0x+ux*t-uy*w, py=s0y+uy*t+ux*w; q?g.lineTo(px,py):g.moveTo(px,py);} g.stroke();
    return [bx+ux*len*1.05,by+uy*len*1.05];
  };
  const il=inLift(phi), el=exLift(phi);
  const iTop=drawValve(ivx,il,-1,COL.cyan), eTop=drawValve(evx,el,1,'#d9a07a');
  const drawCam=(x,y,offs)=>{const R=B*0.085; const ca=(phi/2+offs)*D2R;
    g.fillStyle=COL.panel; g.strokeStyle=COL.steel; g.lineWidth=1.3; g.beginPath();
    for(let q=0;q<=48;q++){const b=q/48*Math.PI*2; const rr=R+R*0.75*Math.pow(Math.max(0,Math.cos(b)),4); const pa=b+ca; const px=x+rr*Math.sin(pa), py=y+rr*Math.cos(pa); q?g.lineTo(px,py):g.moveTo(px,py);}
    g.closePath(); g.fill(); g.stroke(); g.fillStyle=COL.steel; g.beginPath(); g.arc(x,y,2,0,7); g.fill();};
  const camY=headTop-B*0.1;
  drawCam(iTop[0],camY,-((IVO+(IVC_L+720-IVO)/2)%720)/2); drawCam(eTop[0],camY,-((EVO+(EVC-EVO)/2)%720)/2);
  // buji (benzin) ya da kızdırma bujisi (dizel)
  const sparkPhi=360-inf.adv;
  if(D){const gx=cx+B*0.16, glow=sim.ecu.glowT>0;
    g.strokeStyle=glow?COL.flame:COL.steel; g.lineWidth=B*0.05; g.beginPath(); g.moveTo(gx+B*0.1,headTop+B*0.05); g.lineTo(gx,roofY+B*0.02); g.stroke();
    if(glow){g.fillStyle=COL.flame; g.shadowColor=COL.flame; g.shadowBlur=10; g.beginPath(); g.arc(gx,roofY+B*0.02,3,0,7); g.fill(); g.shadowBlur=0;}}
  else {
    g.fillStyle=COL.steel; g.fillRect(cx-B*0.035,headTop-B*0.18,B*0.07,roofY-headTop+B*0.16); g.fillStyle='#e9e2d0'; g.fillRect(cx-B*0.05,headTop-B*0.32,B*0.1,B*0.16);
    if(S.ecuOn&&mod(phi-sparkPhi,720)<7&&!(S.faults.plug&&selCyl===2)){g.fillStyle='#fff';g.shadowColor='#9fe8ff';g.shadowBlur=14;g.beginPath();g.arc(cx,roofY+2,4,0,7);g.fill();g.shadowBlur=0;}}
  // piston
  g.fillStyle='#7f8d98'; g.strokeStyle='#cfd8de'; g.lineWidth=1;
  g.fillRect(cx-B/2+2,pistTop,B-4,pistH); g.strokeRect(cx-B/2+2,pistTop,B-4,pistH);
  g.strokeStyle='#4b5862'; g.beginPath(); for(let q=1;q<=3;q++){g.moveTo(cx-B/2+2,pistTop+q*B*0.055);g.lineTo(cx+B/2-2,pistTop+q*B*0.055);} g.stroke();
  if(D){g.fillStyle=gasColor(c,phi,1); g.beginPath(); g.ellipse(cx,pistTop+1,B*0.2,B*0.06,0,0,Math.PI); g.fill();}
  // biyel + krank
  g.strokeStyle='#b3c0c9'; g.lineWidth=B*0.11; g.lineCap='round'; g.beginPath(); g.moveTo(cx,pinY); g.lineTo(cpx,cpy); g.stroke(); g.lineCap='butt';
  g.fillStyle=COL.face; g.beginPath(); g.arc(cx,pinY,B*0.05,0,7); g.fill(); g.strokeStyle='#cfd8de'; g.lineWidth=1.5; g.stroke();
  g.save(); g.translate(cx,crankY); g.rotate(a);
  g.fillStyle='#5d6a74'; g.strokeStyle='#9aa8b2'; g.lineWidth=1;
  g.beginPath(); g.arc(0,0,rp*1.55,Math.PI*0.2+Math.PI/2,Math.PI*0.8+Math.PI/2); g.lineTo(0,0); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-B*0.1,0); g.lineTo(-B*0.08,-rp); g.lineTo(B*0.08,-rp); g.lineTo(B*0.1,0); g.closePath(); g.fill(); g.stroke();
  g.restore();
  g.fillStyle='#8996a0'; g.beginPath(); g.arc(cx,crankY,B*0.09,0,7); g.fill();
  g.fillStyle=COL.face; g.beginPath(); g.arc(cpx,cpy,B*0.075,0,7); g.fill(); g.strokeStyle='#cfd8de'; g.lineWidth=2; g.stroke();
  // etiketler
  if(W>460){
    label(g,tbx,tby+portW*0.6,tbx+8,tby+B*0.75,D?'emme boğazı (kelebeksiz)':'gaz kelebeği '+Math.round(S.tps*100)+'%','left');
    if(D) label(g,cx-B*0.04,headTop-B*0.02,cx-B*0.45,headTop-B*0.4,'enjektör '+sim.ecu.q.toFixed(1)+' mg','right');
    else label(g,ijx-B*0.25,ijy-B*0.05,ijx-B*0.4,ijy-B*0.3,'enjektör '+sim.ecu.pw.toFixed(2)+' ms','right');
    label(g,iTop[0],camY,iTop[0]-B*0.5,camY-B*0.05,'emme kamı','right');
    label(g,eTop[0],camY,eTop[0]+B*0.5,camY-B*0.05,'egzoz kamı');
    if(D) label(g,cx+B*0.22,headTop+B*0.08,cx+B*0.42,headTop-B*0.36,'kızdırma bujisi'+(sim.ecu.glowT>0?' · ISINIYOR':''));
    else label(g,cx+B*0.05,headTop-B*0.25,cx+B*0.32,headTop-B*0.38,'buji '+inf.adv.toFixed(1)+'° öAÖN');
    label(g,cx+B/2-6,pistTop+pistH*0.5,cx+B/2+blockW+12,pistTop+pistH*0.5,'piston');
    label(g,(cx+cpx)/2,(pinY+cpy)/2,cx-B/2-blockW-12,(pinY+cpy)/2,'biyel','right');
    label(g,cx+rp*1.2,crankY+rp*0.6,cx+B/2+blockW+12,crankY+rp*0.9,'krank mili');
    label(g,cx+B/2+blockW*0.55,deckY+B*0.5,cx+B/2+blockW+12,deckY+B*0.32,'su ceketi '+S.ect.toFixed(0)+' °C');
    label(g,W*0.93,deckY-B*0.5,W*0.9,deckY-B*0.8,'egzoz '+Math.round(S.egt-273)+' °C','right');
  }
  // üst şerit: 720° faz çizelgesi
  const x0=12,x1=W-12, fx=(p)=>x0+(x1-x0)*p/720, y0=8;
  const segs=[[0,180,'EMME',COL.cyan],[180,360,'SIKIŞTIRMA',COL.steel],[360,540,'İŞ',COL.flame],[540,720,'EGZOZ','#b58a6e']];
  g.font=`600 10px ${DISP}`; g.textBaseline='middle'; g.textAlign='center';
  for(const [s0,s1,nm,cl] of segs){const on=phi>=s0&&phi<s1; g.fillStyle=hexA(cl,on?0.32:0.1); g.fillRect(fx(s0)+1,y0,fx(s1)-fx(s0)-2,14);
    g.fillStyle=on?COL.ink:COL.mute; g.fillText(nm,(fx(s0)+fx(s1))/2,y0+7.5);}
  const bar=(s,e,y,cl)=>{g.fillStyle=cl; if(e>720){g.fillRect(fx(s),y,fx(720)-fx(s),4);g.fillRect(fx(0),y,fx(e-720)-fx(0),4);} else g.fillRect(fx(s),y,fx(e)-fx(s),4);};
  bar(IVO,IVC_L+720,y0+17,hexA(COL.cyan,0.8)); bar(EVO,EVC,y0+25,hexA('#d9a07a',0.8));
  if(D){if(sim.ecu.q>0.2) bar(sparkPhi,sparkPhi+pwDeg,y0+33,hexA(COL.violet,0.9));}
  else {const ijS=mod(650-pwDeg,720); if(pwDeg>0) bar(ijS,ijS<650?650:650+720,y0+33,hexA(COL.violet,0.9));}
  if(!D){g.fillStyle='#fff'; g.fillRect(fx(sparkPhi)-1,y0+16,2,20);}
  g.fillStyle=COL.amber; g.beginPath(); g.moveTo(fx(phi),y0+16); g.lineTo(fx(phi)-5,y0+38); g.lineTo(fx(phi)+5,y0+38); g.closePath(); g.fill();
  g.textAlign='left'; g.textBaseline='middle'; g.font=`8.5px ${MONO}`; g.fillStyle=COL.mute;
  if(W>420){g.fillText('emme supabı',fx(262),y0+19); g.fillText('egzoz supabı',fx(250),y0+27); g.fillText(D?'doğrudan enjeksiyon →':'port enjeksiyon',fx(D?236:262),y0+35);}
  // sol alt bilgi
  g.textAlign='left'; g.textBaseline='alphabetic';
  g.fillStyle=COL.amber; g.font=`700 ${Math.round(clamp(W/30,14,22))}px ${DISP}`; g.fillText(strokeName(phi),14,H-46);
  g.fillStyle=COL.mute; g.font=`11px ${MONO}`;
  g.fillText(`φ ${phi.toFixed(0).padStart(3)}° · krank ${Math.round(mod(th,360))}°${bankName(selCyl)?' · '+bankName(selCyl):''}`,14,H-30);
  g.fillText(`${inf.fired?'yandı':inf.mis?'TEKLEDİ':'yakıt yok'} · λ ${inf.lam>9?'—':inf.lam.toFixed(2)}${inf.knock?' · VURUNTU':''}`,14,H-15);
  // sağ: silindir basıncı sütunu
  const pb=c.p/1e5, pmaxS=Math.max(20,Math.ceil(Math.max(pb,inf.pmax/1e5)/10)*10);
  const bx=W-28, by0=topBar+14, by1=H-24, hh=by1-by0;
  g.fillStyle=COL.panel; g.fillRect(bx-7,by0,14,hh); g.strokeStyle=COL.line2; g.strokeRect(bx-7,by0,14,hh);
  const fh=clamp(pb/pmaxS,0,1)*hh; g.fillStyle=pb>15?COL.flame:COL.cyan; g.fillRect(bx-6,by1-fh,12,fh);
  g.fillStyle=COL.mute; g.font=`10px ${MONO}`; g.textAlign='right';
  g.fillText(pmaxS+' bar',bx+12,by0-4); g.fillText(pb.toFixed(1),bx-10,by1-fh+3);
}
function drawStrip(){
  const [g,W,H]=fitCanvas(cvS); g.fillStyle=COL.face; g.fillRect(0,0,W,H);
  const S=sim, th=strobe?visTheta:S.theta, n=NCYL, cw=W/n, V=ENG.def.layout.startsWith('V');
  for(let i=0;i<n;i++){const c=S.cyl[i], phi=mod(th-CYL_OFS[i],720), x=i*cw+cw/2, bw=Math.min(cw*0.42,44), top=14, sh=H-44, sel=i===selCyl;
    const pt=top+pistonX(phi)/ENG.stroke*sh*0.62;
    if(sel){g.fillStyle=hexA(COL.amber,0.08);g.fillRect(i*cw+2,2,cw-4,H-4);}
    if(V&&i===n/2){g.strokeStyle=COL.line2;g.beginPath();g.moveTo(i*cw,6);g.lineTo(i*cw,H-6);g.stroke();}
    g.fillStyle=gasColor(c,phi,1.3); g.fillRect(x-bw/2,top,bw,pt-top);
    g.fillStyle='#7f8d98'; g.fillRect(x-bw/2+1,pt,bw-2,sh*0.3);
    g.strokeStyle=sel?COL.amber:COL.line2; g.lineWidth=sel?1.5:1; g.strokeRect(x-bw/2,top,bw,sh*0.62+sh*0.3);
    g.fillStyle=sel?COL.amber:COL.ink; g.font=`600 ${n>6?10:11}px ${DISP}`; g.textAlign='center'; g.textBaseline='alphabetic';
    g.fillText(n>6?`${i+1}`:`SİL. ${i+1}`,x,H-18);
    if(cw>56){g.fillStyle=COL.mute; g.font=`9.5px ${MONO}`; g.fillText(strokeName(phi).split(' ')[0]+' '+Math.round(phi)+'°',x,H-6);}
    if(c.info.knock&&phi>360&&phi<420){g.fillStyle=COL.crit;g.font=`9px ${MONO}`;g.fillText('VURUNTU',x,top-3);}
    else if(c.info.mis&&phi>360&&phi<540){g.fillStyle=COL.warn;g.font=`9px ${MONO}`;g.fillText('TEKLEME',x,top-3);}
  }
}

/* ---------- Göstergeler (laboratuvar ve sürüş paneli ortak) ---------- */
function gauge(g,cx,cy,r,v,min,max,o){
  if(!(r>4)) return;
  const a0=Math.PI*0.75, a1=Math.PI*2.25, tt=x=>a0+(clamp(x,min,max)-min)/(max-min)*(a1-a0);
  g.fillStyle=o.face||COL.panel; g.beginPath(); g.arc(cx,cy,r,0,Math.PI*2); g.fill(); g.strokeStyle=COL.line2; g.lineWidth=1; g.stroke();
  if(o.red!=null){g.strokeStyle=COL.crit; g.lineWidth=Math.max(2,r*0.07); g.beginPath(); g.arc(cx,cy,r*0.86,tt(o.red),tt(o.redTo??max)); g.stroke();}
  if(o.blue!=null){g.strokeStyle=COL.cyan; g.lineWidth=Math.max(2,r*0.07); g.beginPath(); g.arc(cx,cy,r*0.86,tt(min),tt(o.blue)); g.stroke();}
  if(o.green){g.strokeStyle=COL.ok; g.lineWidth=Math.max(2,r*0.05); g.beginPath(); g.arc(cx,cy,r*0.86,tt(o.green[0]),tt(o.green[1])); g.stroke();}
  const M=o.major, mi=o.minor||1;
  for(let q=0;q<=M*mi;q++){const val=min+(max-min)*q/(M*mi), an=tt(val), maj=q%mi===0;
    g.strokeStyle=maj?COL.ink:COL.dim; g.lineWidth=maj?1.6:1; g.beginPath();
    g.moveTo(cx+Math.cos(an)*r*(maj?0.74:0.8),cy+Math.sin(an)*r*(maj?0.74:0.8)); g.lineTo(cx+Math.cos(an)*r*0.92,cy+Math.sin(an)*r*0.92); g.stroke();
    if(maj&&o.fmt&&r>=46){const t=o.fmt(val,q/mi); if(t!==''){g.fillStyle=COL.mute; g.font=`${Math.max(9,r*0.13)}px ${MONO}`; g.textAlign='center'; g.textBaseline='middle';
      g.fillText(t,cx+Math.cos(an)*r*0.58,cy+Math.sin(an)*r*0.58);}}}
  g.fillStyle=COL.mute; g.font=`600 ${Math.max(9,r*0.12)}px ${DISP}`; g.textAlign='center'; g.textBaseline='middle';
  g.fillText(o.label,cx,cy-r*0.32);
  if(o.digital!=null){g.fillStyle=o.dcol||COL.ink; g.font=`600 ${Math.max(11,r*(o.big?0.24:0.2))}px ${MONO}`; g.fillText(o.digital,cx,cy+r*0.42);
    if(o.unit&&r>=40){g.fillStyle=COL.dim; g.font=`${Math.max(9,r*0.11)}px ${MONO}`; g.fillText(o.unit,cx,cy+r*0.64);}}
  const an=tt(v); g.strokeStyle=COL.amber; g.lineWidth=Math.max(2,r*0.035); g.lineCap='round'; g.beginPath();
  g.moveTo(cx-Math.cos(an)*r*0.12,cy-Math.sin(an)*r*0.12); g.lineTo(cx+Math.cos(an)*r*0.86,cy+Math.sin(an)*r*0.86); g.stroke(); g.lineCap='butt';
  g.fillStyle=COL.line2; g.beginPath(); g.arc(cx,cy,r*0.07,0,7); g.fill();
}
function lamp(g,x,y,w,txt,on,col){g.fillStyle=on?col:COL.panel; g.strokeStyle=on?col:COL.line2; g.lineWidth=1;
  g.beginPath(); g.roundRect?g.roundRect(x,y,w,18,3):g.rect(x,y,w,18); g.fill(); g.stroke();
  g.fillStyle=on?COL.bg:COL.dim; g.font=`600 ${Math.min(9.5,(w-4)/(txt.length*0.62)).toFixed(1)}px ${DISP}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,x+w/2,y+9.5);}
/* motor/araç ölçekleri (gösterge aralıkları) */
function scales(){const d=ENG.def, L=ENG.Vd*1000;
  const tq=Math.ceil(L*(ENG.diesel?175:92)*(1+(ENG.boostMax||0)*0.95)*1.15/50)*50;
  const kmh=Math.ceil(d.redline/60*2*Math.PI*d.veh.rw/(d.veh.gears[d.veh.gears.length-1]*d.veh.final)*3.6/20)*20;
  return {tq,kmh:Math.min(Math.max(kmh,160),320)};}
function lampItems(S){const e=S.ecu; return [['MOTOR',e.dtc.size>0&&(!e.misC.some(x=>x>=6)||blink%0.6<0.3)&&S.key,COL.warn],['YAĞ',S.key&&S.rpm<ENG.idle*0.4,COL.crit],['AKÜ',S.key&&S.rpm<ENG.idle*0.4,COL.crit],
    ['SICAKLIK',S.ect>110,COL.crit],ENG.diesel?['KIZDIRMA',e.glowT>0,COL.warn]:['VURUNTU',e.kr.some(x=>x>0.5),COL.warn],['LİMİT',e.revCut||e.launchCut,COL.crit],['YAKIT KESİK',e.dfco,COL.cyan],
    ENG.diesel?['TURBO',S.boost>0.3e5,COL.cyan]:['KAPALI DÖNGÜ',e.cl,COL.ok]];}
let blink=0;
const cvG=$('#cvGauge');
function drawGauges(rdt){
  const [g,W,H]=fitCanvas(cvG); g.fillStyle=COL.face; g.fillRect(0,0,W,H);
  if(W<160||H<100) return;
  const S=sim, e=S.ecu; blink+=rdt;
  const lampH=26, Hc=H-lampH-6;
  const R=Math.min(W*0.27,Hc*0.47);
  const tx=R+12, ty=Hc/2+4;
  const lim=e.limp?3500:e.set.revLimit, tm=ENG.tachMax, sc=scales();
  gauge(g,tx,ty,R,S.rpm/1000,0,tm,{label:'DEVİR ×1000',major:tm,minor:tm>10?2:5,fmt:(v,q)=>tm>10&&q%2?'':v.toFixed(0),red:lim/1000,digital:Math.round(S.rpm/10)*10+'',unit:'d/d',big:1,dcol:e.revCut?COL.crit:COL.ink});
  const gx0=tx+R+12, gw=W-gx0-8, r2=Math.min(gw/4.3,Hc/4.3);
  const cols=Math.max(2,Math.min(3,Math.floor(gw/(r2*2.2)))), cw=gw/cols;
  const kpa=S.map/1000, bar=(S.map-P_AMB)/1e5, bm=modOn('turbo')?Math.max(1,Math.ceil((modOn('turbo').p.boost+0.3)*2)/2):0.4;
  const L=[];
  L.push(()=>({v:bar,min:-1,max:bm,o:{label:ENG.diesel?'TURBO bar':'MANİFOLD bar',major:Math.round((bm+1)*2),minor:1,fmt:v=>v.toFixed(1),digital:kpa.toFixed(0),unit:'kPa mutlak'}}));
  L.push(()=>{const lm=S.lamSens; if(ENG.diesel) return {v:lm,min:1,max:5,o:{label:'LAMBDA λ',major:4,minor:2,fmt:v=>v.toFixed(0),red:1,redTo:1.15,digital:lm>19?'HAVA':lm.toFixed(lm>9.95?1:2),unit:lm<1.2?'duman sınırı':'fakir yanma',dcol:lm<1.2?COL.warn:COL.ink}};
    return {v:lm,min:0.6,max:1.4,o:{label:'LAMBDA λ',major:4,minor:2,fmt:v=>v.toFixed(1),green:[0.97,1.03],digital:S.faults.o2?'0.45 V':lm>3?'HAVA':lm.toFixed(3),unit:'AFR '+(lm>3?'—':(lm*ENG.afr).toFixed(1)),dcol:lm<0.8||lm>1.2?COL.warn:COL.ink}};});
  L.push(()=>({v:S.ect,min:40,max:130,o:{label:'SU °C',major:3,minor:3,fmt:v=>v.toFixed(0),blue:60,red:112,digital:S.ect.toFixed(0),unit:S.fan?'fan çalışıyor':'',dcol:S.ect>108?COL.crit:COL.ink}}));
  L.push(()=>{const op=oilP(S);return {v:op,min:0,max:6,o:{label:'YAĞ bar',major:6,minor:1,fmt:v=>v.toFixed(0),red:0,redTo:0.5,digital:op.toFixed(1),unit:'bar'}};});
  L.push(()=>({v:S.batt,min:8,max:16,o:{label:'AKÜ V',major:4,minor:2,fmt:v=>v.toFixed(0),red:8,redTo:11,digital:S.batt.toFixed(1),unit:'volt'}}));
  if(S.load==='car') L.push(()=>({v:S.veh.v*3.6,min:0,max:sc.kmh,o:{label:'HIZ km/h',major:sc.kmh/20,minor:1,fmt:(v,q)=>q%2?'':v.toFixed(0),digital:(S.veh.v*3.6).toFixed(0),unit:'vites '+(S.veh.gear||'N')}}));
  else L.push(()=>{const T=S.load==='dyno'?S.dyno.Tf:Math.max(0,S.Tbrake);return {v:T,min:0,max:sc.tq,o:{label:'TORK Nm',major:5,minor:2,fmt:v=>v.toFixed(0),digital:T.toFixed(0),unit:(T*S.omega/1000*1.36).toFixed(0)+' BG'}};});
  const rows=Math.ceil(L.length/cols), rh=Hc/rows, rr=Math.min(cw*0.44,rh*0.46);
  L.forEach((f,ix)=>{const d=f(); const cxg=gx0+cw*(ix%cols)+cw/2, cyg=rh*Math.floor(ix/cols)+rh/2+4; gauge(g,cxg,cyg,rr,d.v,d.min,d.max,d.o);});
  const items=lampItems(S);
  const lw=Math.min(84,(W-16)/items.length-4); let lx=8;
  for(const [t,on,c] of items){lamp(g,lx,H-lampH,lw,t,on,c); lx+=lw+4;}
}
function oilP(S){return S.rpm<30?0:Math.min(5.2,0.7+0.95*S.rpm*ENG.s/1000)*(1+0.4*clamp((60-S.oilT)/60,0,1));}

/* ---------- Veri kaydı (osiloskop) ---------- */
const CH=[
  {k:'rpm',n:'Devir',u:'d/d',min:0,max:8000,c:COL.amber,on:true,f:S=>S.rpm,fmt:v=>v.toFixed(0)},
  {k:'map',n:'MAP',u:'kPa',min:0,max:200,c:COL.cyan,on:true,f:S=>S.map/1000,fmt:v=>v.toFixed(0)},
  {k:'lam',n:'λ',u:'',min:0.6,max:1.4,c:COL.ok,on:true,f:S=>Math.min(S.lamSens,9),fmt:v=>v.toFixed(2)},
  {k:'adv',n:'Avans',u:'°',min:-10,max:50,c:COL.violet,on:false,f:S=>S.ecu.adv,fmt:v=>v.toFixed(1)},
  {k:'tps',n:'Gaz',u:'%',min:0,max:100,c:COL.steel,on:true,f:S=>S.tps*100,fmt:v=>v.toFixed(0)},
  {k:'tq',n:'Anlık tork',u:'Nm',min:-200,max:600,c:COL.flame,on:false,f:S=>S.Tg,fmt:v=>v.toFixed(0)},
  {k:'trim',n:'STFT+LTFT',u:'%',min:-25,max:25,c:COL.warn,on:false,f:S=>(S.ecu.stft+S.ecu.ltft)*100,fmt:v=>v.toFixed(1)},
  {k:'ect',n:'Su',u:'°C',min:0,max:130,c:COL.crit,on:false,f:S=>S.ect,fmt:v=>v.toFixed(0)},
];
function chScale(){const c=k=>CH.find(x=>x.k===k), sc=scales();
  c('rpm').max=ENG.tachMax*1000; c('map').max=Math.ceil((100+(ENG.boostMax||0)*100+40)/50)*50;
  const l=c('lam'); if(ENG.diesel){l.min=0.8;l.max=6;} else {l.min=0.6;l.max=1.4;}
  const t=c('tq'); t.max=sc.tq*4; t.min=-sc.tq; c('adv').n=ENG.diesel?'Enj. avansı':'Avans';
  c('trim').n=ENG.diesel?'Yakıt mg':'STFT+LTFT'; c('trim').f=ENG.diesel?(S=>S.ecu.q):(S=>(S.ecu.stft+S.ecu.ltft)*100); c('trim').min=ENG.diesel?0:-25; c('trim').max=ENG.diesel?ENG.def.qMax*1.2:25;
  $$('#chips .chip').forEach((b,i)=>{b.childNodes[1].textContent=CH[i].n;});}
const SC_N=600; const scBuf=CH.map(()=>new Float32Array(SC_N)); let scHead=0, scCount=0, scNext=0;
function scWindow(){return 8*timeScale;}
function scSample(){const S=sim; if(S.t<scNext) return; scNext=S.t+scWindow()/SC_N;
  CH.forEach((ch,i)=>scBuf[i][scHead]=ch.f(S)); scHead=(scHead+1)%SC_N; if(scCount<SC_N) scCount++;}
const chipBox=$('#chips');
CH.forEach((ch,i)=>{const b=document.createElement('button'); b.className='chip'+(ch.on?' on':''); b.type='button';
  b.innerHTML=`<i style="background:${ch.c}"></i>${ch.n}<b id="cv_${ch.k}">–</b>`; b.onclick=()=>{ch.on=!ch.on;b.classList.toggle('on',ch.on);}; chipBox.appendChild(b);});
const cvSc=$('#cvScope');
function drawScope(){
  const [g,W,H]=fitCanvas(cvSc); g.fillStyle=COL.face; g.fillRect(0,0,W,H);
  const pl=8,pr=8,pt=8,pb=18, w=W-pl-pr, h=H-pt-pb;
  g.strokeStyle=COL.line; g.lineWidth=1; g.beginPath();
  for(let q=0;q<=10;q++){const x=pl+w*q/10+0.5;g.moveTo(x,pt);g.lineTo(x,pt+h);} for(let q=0;q<=4;q++){const y=pt+h*q/4+0.5;g.moveTo(pl,y);g.lineTo(pl+w,y);} g.stroke();
  g.fillStyle=COL.dim; g.font=`10px ${MONO}`; g.textAlign='left'; g.textBaseline='alphabetic';
  const win=scWindow(); g.fillText(`−${win>=1?win.toFixed(0)+' s':(win*1000).toFixed(0)+' ms'}`,pl+2,H-5); g.textAlign='right'; g.fillText('şimdi',W-pr,H-5);
  CH.forEach((ch,ci)=>{ if(!ch.on||scCount<2) return; const b=scBuf[ci];
    g.strokeStyle=ch.c; g.lineWidth=1.4; g.beginPath();
    for(let q=0;q<scCount;q++){const ix=(scHead-scCount+q+SC_N)%SC_N; const x=pl+w*(q+SC_N-scCount)/(SC_N-1); const y=pt+h*(1-clamp((b[ix]-ch.min)/(ch.max-ch.min),0,1)); q?g.lineTo(x,y):g.moveTo(x,y);} g.stroke();
    const last=b[(scHead-1+SC_N)%SC_N], y=pt+h*(1-clamp((last-ch.min)/(ch.max-ch.min),0,1));
    g.fillStyle=ch.c; g.beginPath(); g.arc(pl+w,y,3,0,7); g.fill();
  });
}

/* ---------- Silindir basınç grafiği ---------- */
const cvC=$('#cvCyl'); const motTr=new Float64Array(TR_N);
function updateMotored(){const S=sim,c=S.cyl[selCyl]; const rpm=Math.max(S.rpm,200);
  cycleTrace({pBDC:c.tr[0],mAir:1e-4,mFuel:0,lam:1,adv:0,rpm,kpa:S.map/1000,ect:S.ect,fire:false},motTr);}
function drawCyl(){
  const [g,W,H]=fitCanvas(cvC); g.fillStyle=COL.face; g.fillRect(0,0,W,H);
  const S=sim, c=S.cyl[selCyl], inf=c.info;
  const pl=44,pr=10,pt=10,pb=26, w=W-pl-pr, h=H-pt-pb;
  g.font=`10px ${MONO}`; g.textBaseline='middle';
  if(pvMode==='pt'){
    let pm=0; for(let k=0;k<TR_N;k++) pm=Math.max(pm,c.tr[k]); for(const hb of c.hist) for(let k=0;k<TR_N;k+=4) pm=Math.max(pm,hb[k]);
    const ymax=Math.max(20,Math.ceil(pm/1e5/10)*10), X=d=>pl+w*(d+180)/360, Y=p=>pt+h*(1-p/1e5/ymax);
    const st=ymax>120?40:ymax>40?20:10;
    g.strokeStyle=COL.line; g.beginPath(); for(let d=-180;d<=180;d+=30){g.moveTo(X(d)+0.5,pt);g.lineTo(X(d)+0.5,pt+h);} for(let p=0;p<=ymax;p+=st){g.moveTo(pl,Y(p*1e5)+0.5);g.lineTo(pl+w,Y(p*1e5)+0.5);} g.stroke();
    g.fillStyle=COL.mute; g.textAlign='right'; for(let p=0;p<=ymax;p+=st) g.fillText(p,pl-6,Y(p*1e5));
    g.textAlign='center'; for(let d=-180;d<=180;d+=60) g.fillText(d===0?'ÜÖN':d+'°',X(d),H-12);
    g.save(); g.translate(11,pt+h/2); g.rotate(-Math.PI/2); g.fillText('basınç · bar',0,0); g.restore();
    g.strokeStyle=COL.steel; g.setLineDash([4,4]); g.lineWidth=1; g.beginPath(); for(let k=0;k<TR_N;k+=2){const x=X(k*TR_RES-180),y=Y(motTr[k]); k?g.lineTo(x,y):g.moveTo(x,y);} g.stroke(); g.setLineDash([]);
    for(let q=1;q<HIST;q++){const hb=c.hist[(c.hi-q+1+HIST*2)%HIST]; g.strokeStyle=hexA(COL.flame,0.13); g.beginPath(); for(let k=0;k<TR_N;k+=2){const x=X(k*TR_RES-180),y=Y(hb[k]); k?g.lineTo(x,y):g.moveTo(x,y);} g.stroke();}
    g.strokeStyle=COL.flame; g.lineWidth=1.8; g.beginPath(); for(let k=0;k<TR_N;k++){const x=X(k*TR_RES-180),y=Y(c.tr[k]); k?g.lineTo(x,y):g.moveTo(x,y);} g.stroke();
    g.strokeStyle='#fff'; g.lineWidth=1; g.beginPath(); g.moveTo(X(-inf.adv),pt); g.lineTo(X(-inf.adv),pt+h); g.stroke();
    g.fillStyle=COL.ink; g.textAlign='left'; g.fillText(ENG.diesel?'enjeksiyon':'kıvılcım',X(-inf.adv)+3,pt+8);
    if(inf.fired){g.fillStyle=COL.amber; g.beginPath(); g.arc(X(inf.thP),Y(inf.pmax),3.5,0,7); g.fill();}
    const phi=mod((strobe?visTheta:S.theta)-CYL_OFS[selCyl],720);
    if(phi>=180&&phi<=540){g.fillStyle=COL.cyan; g.beginPath(); g.arc(X(phi-360),Y(c.p),4,0,7); g.fill();}
    g.fillStyle=COL.steel; g.textAlign='right'; g.fillText('kesik: yanmasız (motorlu) iz',pl+w-4,pt+8);
  } else {
    const Vmin=ENG.Vc*0.9, Vmax=(ENG.Vc+ENG.Vdc)*1.05, pmin=0.1, pmaxL=ENG.diesel?300:100;
    const X=V=>pl+w*Math.log(V/Vmin)/Math.log(Vmax/Vmin), Y=p=>pt+h*(1-Math.log(Math.max(p/1e5,pmin)/pmin)/Math.log(pmaxL/pmin));
    const ticks=[0.1,0.3,1,3,10,30,100].concat(ENG.diesel?[300]:[]);
    g.strokeStyle=COL.line; g.beginPath(); for(const p of ticks){g.moveTo(pl,Y(p*1e5)+0.5);g.lineTo(pl+w,Y(p*1e5)+0.5);} g.stroke();
    g.fillStyle=COL.mute; g.textAlign='right'; for(const p of ticks) g.fillText(p,pl-6,Y(p*1e5));
    g.textAlign='center'; g.fillText('hacim (log) · ÜÖN ← → AÖN',pl+w/2,H-12);
    const loop=(tr,col,lw)=>{g.strokeStyle=col; g.lineWidth=lw; g.beginPath();
      for(let k=0;k<TR_N;k+=2){const x=X(TR_V[k]),y=Y(tr[k]); k?g.lineTo(x,y):g.moveTo(x,y);}
      for(let ph=540;ph<=720;ph+=4){const p=S.pexh+(tr[TR_N-1]-S.pexh)*Math.exp(-(ph-540)/14); g.lineTo(X(cylVol(ph)),Y(p));}
      for(let ph=0;ph<=180;ph+=4){g.lineTo(X(cylVol(ph)),Y(S.map));} g.lineTo(X(TR_V[0]),Y(tr[0])); g.stroke();};
    for(let q=1;q<HIST;q++) loop(c.hist[(c.hi-q+1+HIST*2)%HIST],hexA(COL.flame,0.13),1);
    loop(c.tr,COL.flame,1.8);
    g.fillStyle=COL.steel; g.textAlign='right'; g.fillText('üst döngü = iş, alt döngü = pompalama kaybı',pl+w-4,pt+8);
  }
  g.textAlign='left';
}
function updCylStats(){const c=sim.cyl[selCyl],i=c.info; const imepN=(i.W-(sim.pexh-sim.map)*ENG.Vdc)/ENG.Vdc;
  const cells=[['Pmax',(i.pmax/1e5).toFixed(1)+' bar'],['θ@Pmax',i.fired?i.thP.toFixed(1)+'°':'—'],['MFB50',i.fired&&i.mfb50===i.mfb50?i.mfb50.toFixed(1)+'°':'—'],
    ['IMEP net',(imepN/1e5).toFixed(2)+' bar'],[ENG.diesel?'Enj. avansı':'Avans',i.adv.toFixed(1)+'°'],['λ',i.lam>9?'—':i.lam.toFixed(3)],['Yanma',i.dur.toFixed(0)+'° KA'],['Durum',i.knock?'VURUNTU':i.fired?'normal':i.mis?'tekleme':'yakıt yok']];
  $('#cylStats').innerHTML=cells.map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');}

/* ---------- Dinamometre grafiği ---------- */
const cvD=$('#cvDyno'), RUNCOL=[COL.amber,COL.cyan,COL.violet,COL.ok];
function drawDyno(){
  const [g,W,H]=fitCanvas(cvD); g.fillStyle=COL.face; g.fillRect(0,0,W,H);
  const d=sim.dyno, runs=d.runs.slice(); if(d.sweep&&d.sweep.data.length) runs.push(d.sweep.data);
  const pl=46,pr=50,pt=14,pb=28,w=W-pl-pr,h=H-pt-pb;
  let tmax=100,pmax=50; for(const r of runs) for(const [n,T] of r){tmax=Math.max(tmax,T);pmax=Math.max(pmax,T*n*Math.PI/30/1000*1.36);}
  tmax=Math.ceil(tmax/50)*50; pmax=Math.ceil(pmax/50)*50;
  const xm=ENG.tachMax*1000, xs=xm>10000?2000:1000;
  const X=n=>pl+w*n/xm, YT=T=>pt+h*(1-T/tmax), YP=P=>pt+h*(1-P/pmax);
  g.strokeStyle=COL.line; g.beginPath(); for(let n=0;n<=xm;n+=xs){g.moveTo(X(n)+0.5,pt);g.lineTo(X(n)+0.5,pt+h);} for(let q=0;q<=5;q++){const y=pt+h*q/5+0.5;g.moveTo(pl,y);g.lineTo(pl+w,y);} g.stroke();
  g.font=`10px ${MONO}`; g.fillStyle=COL.mute; g.textBaseline='middle';
  g.textAlign='center'; for(let n=0;n<=xm;n+=xs) g.fillText(n,X(n),H-14);
  g.textAlign='right'; for(let q=0;q<=5;q++) g.fillText((tmax*(5-q)/5).toFixed(0),pl-6,pt+h*q/5);
  g.textAlign='left'; for(let q=0;q<=5;q++) g.fillText((pmax*(5-q)/5).toFixed(0),pl+w+6,pt+h*q/5);
  g.fillText('— tork Nm',pl+4,pt+6); g.textAlign='right'; g.fillText('güç BG (PS) - - -',pl+w-4,pt+6);
  if(!runs.length){g.textAlign='center'; g.fillStyle=COL.mute; g.font=`13px ${MONO}`; g.fillText('Henüz çekiş yok. “Tam gaz çekiş başlat” ile ilk eğriyi alın.',pl+w/2,pt+h/2); return;}
  const info=[];
  runs.forEach((r,ri)=>{const col=RUNCOL[ri%4]; if(r.length<2) return;
    g.strokeStyle=col; g.lineWidth=2; g.setLineDash([]); g.beginPath(); r.forEach(([n,T],q)=>q?g.lineTo(X(n),YT(T)):g.moveTo(X(n),YT(T))); g.stroke();
    g.setLineDash([5,4]); g.beginPath(); r.forEach(([n,T],q)=>{const P=T*n*Math.PI/30/1000*1.36; q?g.lineTo(X(n),YP(P)):g.moveTo(X(n),YP(P));}); g.stroke(); g.setLineDash([]);
    let bt=r[0],bp=r[0],bpv=0; for(const s of r){if(s[1]>bt[1])bt=s; const P=s[1]*s[0]*Math.PI/30/1000*1.36; if(P>bpv){bpv=P;bp=s;}}
    info.push(`<span style="color:${col}">●</span> ${bt[1].toFixed(0)} Nm @ ${Math.round(bt[0]/50)*50} · ${bpv.toFixed(0)} BG @ ${Math.round(bp[0]/50)*50}`);
  });
  $('#dynoInfo').innerHTML=info.join(' &nbsp; ');
}

/* ---------- ECU sekmeleri ---------- */
$$('#tabs button').forEach(b=>b.onclick=()=>showTab(b.dataset.t));
let curTab='live';
function showTab(t){curTab=t; $$('#tabs button').forEach(x=>x.classList.toggle('act',x.dataset.t===t)); $$('#v-lab .pane').forEach(p=>p.hidden=p.id!=='t-'+t);
  if(t==='ve'||t==='ign') paintTable(t);}
const ROWS_COMMON=[
  ['Devir','rpm',S=>S.rpm.toFixed(0)+' d/d'],['MAP','map',S=>(S.mapSens/1000).toFixed(1)+' kPa'],['Pedal / TPS','tps',S=>(S.tps*100).toFixed(1)+' %'],
  ['Emme havası (IAT)','iat',S=>(S.Tman-273.15).toFixed(1)+' °C'],['Soğutma suyu (ECT)','ect',S=>S.ect.toFixed(1)+' °C'],['Yağ sıcaklığı','oil',S=>S.oilT.toFixed(1)+' °C'],
];
const ROWS_PETROL=[
  ['λ hedef','lt',S=>S.ecu.lamT.toFixed(3)],['λ ölçülen','lm',S=>S.faults.o2?'0.450 V sabit':S.lamSens>3?'hava':S.lamSens.toFixed(3),S=>Math.abs(S.lamSens-S.ecu.lamT)>0.06?'y':''],
  ['Kısa dönem düzeltme (STFT)','stft',S=>(S.ecu.stft*100).toFixed(1)+' %',S=>Math.abs(S.ecu.stft)>0.12?'y':''],['Uzun dönem düzeltme (LTFT)','ltft',S=>(S.ecu.ltft*100).toFixed(1)+' %',S=>Math.abs(S.ecu.ltft)>0.15?'y':''],
  ['Döngü','cl',S=>S.ecu.cl?'KAPALI':'açık',S=>S.ecu.cl?'g':''],['Enjeksiyon süresi','pw',S=>S.ecu.pw.toFixed(2)+' ms'],
  ['Enjektör doluluk','duty',S=>(S.ecu.duty*100).toFixed(0)+' %',S=>S.ecu.duty>0.9?'r':S.ecu.duty>0.8?'y':''],['Ateşleme avansı','adv',S=>S.ecu.adv.toFixed(1)+' °'],
  ['Vuruntu geri çekme','kr',S=>S.ecu.kr.map(x=>x.toFixed(1)).join(' · ')+' °',S=>S.ecu.kr.some(x=>x>0.5)?'y':''],['Vuruntu olayları','kc',S=>S.ecu.knockCount],
  ['Rölanti hedefi','it',S=>S.ecu.idleTgt.toFixed(0)+' d/d'],['Rölanti valfi (IAC)','iac',S=>(S.ecu.iac*100).toFixed(0)+' %'],
  ['Yakıt rampası','fp',S=>(S.fuelP/1e5).toFixed(2)+' bar',S=>S.fuelP<2.5e5&&S.ecuOn?'r':''],
];
const ROWS_DIESEL=[
  ['λ ölçülen','lm',S=>S.lamSens>19?'hava':S.lamSens.toFixed(2),S=>S.lamSens<1.2?'y':''],['Enjeksiyon miktarı','q',S=>S.ecu.q.toFixed(1)+' mg/strok'],
  ['Rölanti regülatörü','qi',S=>S.ecu.qIdle.toFixed(1)+' mg'],['Duman sınırı λ','sl',S=>S.ecu.set.smokeLam.toFixed(2)],
  ['Enjeksiyon avansı','adv',S=>S.ecu.adv.toFixed(1)+' ° öÜÖN'],['Kızdırma','gl',S=>S.ecu.glowT>0?'ISINIYOR '+S.ecu.glowT.toFixed(1)+' s':'hazır',S=>S.ecu.glowT>0?'y':'g'],
  ['Rölanti hedefi','it',S=>S.ecu.idleTgt.toFixed(0)+' d/d'],['Common rail basıncı','fp',S=>(S.fuelP/1e5).toFixed(0)+' bar',S=>S.fuelP<0.8*(S.railT||3e7)&&S.ecuOn?'r':''],
];
const ROWS_TAIL=[
  ['Akü gerilimi','vb',S=>S.batt.toFixed(2)+' V'],['Hava debisi','maf',S=>(S.mdotTh*1000).toFixed(2)+' g/s'],
  ['Yakıt tüketimi','ff',S=>S.load==='car'&&S.veh.v>2?(S.fuelFlow/ENG.rhoF/S.veh.v*1e5).toFixed(1)+' L/100 km':(S.fuelFlow/ENG.rhoF*3600).toFixed(2)+' L/h'],
  ['Egzoz gazı (EGT)','egt',S=>(S.egt-273).toFixed(0)+' °C',S=>S.egt>1220?'r':''],['Motor torku (fren)','tb',S=>(S.load==='dyno'?S.dyno.Tf:S.Tbrake).toFixed(1)+' Nm'],
  ['Turbo basıncı','bst',S=>modOn('turbo')?(S.boost/1e5).toFixed(2)+' bar':'takılı değil'],
  ['Koruma modu','limp',S=>S.ecu.limp?'ETKİN (3500 d/d)':'yok',S=>S.ecu.limp?'r':''],
];
let liveRows=[];
function buildLive(){liveRows=ROWS_COMMON.concat(ENG.diesel?ROWS_DIESEL:ROWS_PETROL,ROWS_TAIL);
  $('#liveGrid').innerHTML=liveRows.map(r=>`<div><span>${r[0]}</span><b id="lv_${r[1]}">–</b></div>`).join('');}
function updLive(){const S=sim; for(const r of liveRows){const el=document.getElementById('lv_'+r[1]); if(!el) continue; el.textContent=r[2](S); el.className=r[3]?r[3](S):'';}}

/* harita tabloları (eksenler tablonun içinde) */
let selCell={ve:null,ign:null};
function heat(v,lo,hi){const t=clamp((v-lo)/(hi-lo),0,1); const stops=[[0,'#3b6fb6'],[0.35,'#45c1db'],[0.6,'#9be07a'],[0.8,'#f3c544'],[1,'#ff6a2b']];
  for(let q=1;q<stops.length;q++) if(t<=stops[q][0]){const [a,ca]=stops[q-1],[b,cb]=stops[q]; return mixHex(ca,cb,(t-a)/(b-a));} return stops[4][1];}
function tabOf(kind){return kind==='ve'?sim.ecu.ve:sim.ecu.ign;}
function tabMeta(kind){if(ENG.diesel) return kind==='ve'?{corner:'pedal % \\ d/d',lo:0,hi:ENG.def.qMax,u:' mg',y:'pedal %',yAt:S=>S.tps*100}:{corner:'mg \\ d/d',lo:0,hi:25,u:'°',y:'mg',yAt:S=>S.ecu.q};
  return kind==='ve'?{corner:'kPa \\ d/d',lo:40,hi:105,u:' %',y:'kPa',yAt:S=>S.mapSens/1000}:{corner:'kPa \\ d/d',lo:0,hi:45,u:'°',y:'kPa',yAt:S=>S.mapSens/1000};}
function buildTable(kind){const tb=kind==='ve'?$('#tblVe'):$('#tblIg'), T=tabOf(kind), m=tabMeta(kind), NR=T.x.length, NM=T.y.length;
  let h=`<thead><tr><th>${m.corner}</th>`+T.x.map(r=>`<th>${r}</th>`).join('')+'</tr></thead><tbody>';
  for(let j=NM-1;j>=0;j--){h+=`<tr><th>${T.y[j]}</th>`; for(let i=0;i<NR;i++) h+=`<td data-c="${j*NR+i}"></td>`; h+='</tr>';}
  tb.innerHTML=h+'</tbody>'; tb.tabIndex=0;
  tb.onclick=ev=>{const td=ev.target.closest('td'); if(!td) return; selCell[kind]=+td.dataset.c; paintTable(kind);};
  tb.onkeydown=ev=>{const T=tabOf(kind), NR=T.x.length, NM=T.y.length;
    if(ev.key==='+'||ev.key==='='){adjCell(kind,1);ev.preventDefault();} else if(ev.key==='-'){adjCell(kind,-1);ev.preventDefault();}
    else if(selCell[kind]!=null&&ev.key.startsWith('Arrow')){let c=selCell[kind],i=c%NR,j=(c/NR)|0; if(ev.key==='ArrowLeft')i=Math.max(0,i-1); if(ev.key==='ArrowRight')i=Math.min(NR-1,i+1);
      if(ev.key==='ArrowUp')j=Math.min(NM-1,j+1); if(ev.key==='ArrowDown')j=Math.max(0,j-1); selCell[kind]=j*NR+i; paintTable(kind); ev.preventDefault();}};}
function paintTable(kind){const tb=kind==='ve'?$('#tblVe'):$('#tblIg'), T=tabOf(kind), m=tabMeta(kind), NR=T.x.length;
  tb.querySelectorAll('td').forEach(td=>{const c=+td.dataset.c, v=T.d[c]; td.textContent=v.toFixed(1); td.style.background=heat(v,m.lo,m.hi); td.classList.toggle('sel',c===selCell[kind]);});
  const sc=selCell[kind], el=kind==='ve'?$('#veSel'):$('#igSel');
  if(sc!=null) el.textContent=`Seçili: ${T.x[sc%NR]} d/d · ${T.y[(sc/NR)|0]} ${m.y} = ${T.d[sc].toFixed(1)}${m.u}`; else el.textContent='Hücre seçin, sonra + / − veya düğmeler';
  markOp();}
function markOp(){const kind=curTab==='ve'?'ve':curTab==='ign'?'ign':null; if(!kind) return; const tb=kind==='ve'?$('#tblVe'):$('#tblIg');
  tb.querySelectorAll('td.op').forEach(td=>td.classList.remove('op'));
  if(sim.rpm<100) return;
  for(const [c,w] of cellWeights(tabOf(kind),sim.rpm,tabMeta(kind).yAt(sim))) if(w>0.12){const td=tb.querySelector(`td[data-c="${c}"]`); td&&td.classList.add('op');}}
function adjCell(kind,d){const c=selCell[kind]; if(c==null) return; const T=tabOf(kind);
  if(kind==='ve') T.d[c]=ENG.diesel?clamp(T.d[c]+d*0.5,0,120):clamp(T.d[c]*(1+d/100),5,130); else T.d[c]=clamp(T.d[c]+d,-10,50); paintTable(kind);}
$$('[data-ve]').forEach(b=>b.onclick=()=>adjCell('ve',+b.dataset.ve));
$$('[data-ig]').forEach(b=>b.onclick=()=>adjCell('ign',+b.dataset.ig));
$('#bVeReset').onclick=()=>{sim.ecu.ve=factoryVE(); sim.ecu.ltft=0; paintTable('ve');};
$('#bIgReset').onclick=()=>{sim.ecu.ign=factoryIgn(); paintTable('ign');};
$('#chkAuto').onchange=e=>{sim.ecu.set.autotune=e.target.checked; if(e.target.checked){sim.ecu.ltft=0;}};
function labelTabs(){const D=ENG.diesel;
  $('#tabs [data-t="ve"]').textContent=D?'Yakıt miktarı haritası':'VE haritası';
  $('#tabs [data-t="ign"]').textContent=D?'Enjeksiyon avansı':'Ateşleme haritası';
  $('#veNote').textContent=D?'Pedal konumuna göre istenen yakıt miktarı (mg/strok): satırlar pedal %, sütunlar devir. Dizelde gaz kelebeği yoktur; torku doğrudan bu tablo belirler. ECU bunu duman sınırıyla (hava miktarı) ve devir regülatörüyle kırpar. Beyaz çerçeve şu anki çalışma noktası.'
    :'Hacimsel verim (%) tablosu: satırlar emme manifoldu basıncı (kPa), sütunlar devir. ECU havayı bu tablodan tahmin eder, gerçek motor kendi VE\'sine göre hava çeker. Fark λ hatası olarak görünür ve kapalı döngü bunu düzeltmeye çalışır. Beyaz çerçeve şu anki çalışma noktası.';
  $('#ignNote').textContent=D?'Enjeksiyon başlangıcı (° ÜÖN öncesi): satırlar yakıt miktarı (mg), sütunlar devir. Fabrika haritası en yüksek tork için hesaplanır, tepe basınç 185 bar altında tutulur. Erken enjeksiyon daha sert, gürültülü yanma ve yüksek basınç demektir.'
    :'Ateşleme avansı (° ÜÖN öncesi). Fabrika haritası açılışta motor modelinden hesaplanır: her hücre için en iyi tork avansı (MBT) bulunur, vuruntu sınırının altında tutulur. Avans eklerseniz önce tork artar, sonra vuruntu başlar ve basınç eğrisinde titreşim görürsünüz.';
  $('#autoWrap').hidden=D;
  $('#veBtns').innerHTML=D?'<button class="btn small" data-ve="-1">−0.5 mg</button><button class="btn small" data-ve="1">+0.5 mg</button><button class="btn small" data-ve="-4">−2 mg</button><button class="btn small" data-ve="4">+2 mg</button>'
    :'<button class="btn small" data-ve="-1">−1 %</button><button class="btn small" data-ve="1">+1 %</button><button class="btn small" data-ve="-5">−5 %</button><button class="btn small" data-ve="5">+5 %</button>';
  $$('[data-ve]').forEach(b=>b.onclick=()=>adjCell('ve',+b.dataset.ve));
}

/* ayarlar */
function buildSettings(){const D=ENG.diesel, d=ENG.def, base=ENG.injCc;
  const SETS=[
    {k:'revLimit',l:'Devir limiti',min:round50(d.redline*0.6),max:round50(d.redline*1.12),step:100,u:'d/d'},
    {k:'idleTarget',l:'Rölanti devri (sıcak)',min:round50(d.idle*0.7),max:round50(d.idle*1.7),step:25,u:'d/d'},
    !D&&{k:'lamWOT',l:'Tam gaz λ hedefi',min:0.75,max:1.0,step:0.01,u:''},
    D&&{k:'smokeLam',l:'Duman sınırı λ (düşük = daha çok yakıt, kara duman)',min:1.0,max:1.5,step:0.01,u:''},
    {k:'advOffset',l:D?'Global enjeksiyon avansı ofseti':'Global avans ofseti',min:-10,max:10,step:0.5,u:'°'},
    !D&&{k:'injCc',l:'Enjektör debisi',sel:[[Math.round(base*0.75/10)*10,'küçük'],[base,base+' cc/dk (stok)'],[Math.round(base*1.35/10)*10,'büyük'],[Math.round(base*1.8/10)*10,'yarış']].map(([a,b])=>[a,b==='küçük'||b==='büyük'||b==='yarış'?`${a} cc/dk (${b})`:b])},
    !D&&{k:'octane',l:'Yakıt oktanı (RON)',sel:[[91,'91 (düşük)'],[95,'95'],[98,'98']]},
    !D&&{k:'closedLoop',l:'Kapalı döngü λ kontrolü',b:1},!D&&{k:'knockCtl',l:'Vuruntu kontrolü',b:1},!D&&{k:'dfco',l:'Yavaşlamada yakıt kesme',b:1},!D&&{k:'transComp',l:'Geçici yakıt (duvar filmi) telafisi',b:1},
  ].filter(Boolean);
  $('#setForm').innerHTML=SETS.map(s=>{const v=sim.ecu.set[s.k];
    if(s.b) return `<label class="check"><input type="checkbox" id="s_${s.k}" ${v?'checked':''}><span><b>${s.l}</b></span></label>`;
    if(s.sel) return `<div class="f"><label for="s_${s.k}">${s.l}</label><select id="s_${s.k}">${s.sel.map(([a,b])=>`<option value="${a}" ${a==v?'selected':''}>${b}</option>`).join('')}</select></div>`;
    return `<div class="f"><label for="s_${s.k}">${s.l}<b id="sv_${s.k}">${v} ${s.u}</b></label><input type="range" id="s_${s.k}" min="${s.min}" max="${s.max}" step="${s.step}" value="${v}"></div>`;}).join('')
    +(D?'':`<div class="f"><span class="note">Enjektör debisini değiştirince VE haritası aynı kalır, ECU yeni debiyle hesaplar. Atmosferik motora turbo takıp stok enjektörle yüksek devre çıkın: doluluk %97'ye dayanınca karışım fakirleşir.</span></div>`);
  SETS.forEach(s=>{const el=$('#s_'+s.k); el.oninput=el.onchange=()=>{const v=s.b?el.checked:+el.value; sim.ecu.set[s.k]=v; if(!s.b&&!s.sel) $('#sv_'+s.k).textContent=v+' '+s.u;};});
}
/* arızalar */
$('#faultList').innerHTML=FAULTS.map(f=>`<label class="check"><input type="checkbox" id="f_${f.id}"><span><b>${f.name}</b><small>${f.desc}</small></span></label>`).join('');
FAULTS.forEach(f=>$('#f_'+f.id).onchange=e=>{sim.faults[f.id]=e.target.checked; if(f.id==='o2'&&!e.target.checked){sim.ecu.o2fault=false;sim.ecu.timers.o2=0;}});
function syncFaults(){FAULTS.forEach(f=>{$('#f_'+f.id).checked=!!sim.faults[f.id];});}
/* DTC */
function renderDtc(){const e=sim.ecu, l=[...e.dtc].sort();
  $('#dtcList').innerHTML=l.length?l.map(c=>`<div class="dtc"><code>${c}</code><span>${DTC_DEF[c]||''}</span></div>`).join(''):'<div class="empty">Kayıtlı arıza kodu yok. MIL lambası sönük.</div>';
  const b=$('#dtcBadge'); b.hidden=!l.length; b.textContent=l.length;}
function clearDtc(){const e=sim.ecu; e.dtc.clear(); e.misC.fill(0); e.cycC.fill(0); e.timers={}; e.o2fault=false; renderDtc();}
$('#bClearDtc').onclick=clearDtc;
/* modüller */
function renderMods(){$('#modList').innerHTML=MODULES.map(m=>`<div class="mod"><h3>${m.name}<label class="toggle"><input type="checkbox" id="m_${m.id}" ${m.on?'checked':''}> takılı</label></h3><p>${m.desc}</p>
  ${(m.params||[]).map(q=>`<div class="f"><label for="mp_${m.id}_${q.k}">${q.label}<b id="mpv_${m.id}_${q.k}">${m.p[q.k]} ${q.unit||''}</b></label><input type="range" id="mp_${m.id}_${q.k}" min="${q.min}" max="${q.max}" step="${q.step}" value="${m.p[q.k]}"></div>`).join('')}
  <span class="hint" id="ms_${m.id}"></span></div>`).join('');
  MODULES.forEach(m=>{$('#m_'+m.id).onchange=e=>{m.on=e.target.checked; if(m.on&&m.init) m.init(sim,m); if(!m.on){sim.turboSpd=0;}};
    (m.params||[]).forEach(q=>{const el=$(`#mp_${m.id}_${q.k}`); el.oninput=()=>{m.p[q.k]=+el.value; $(`#mpv_${m.id}_${q.k}`).textContent=el.value+' '+(q.unit||'');};});});}

/* ---------- Kontroller ---------- */
$$('.bKey').forEach(b=>b.onclick=()=>{auInit(); setKey(!sim.key);});
$$('.bStart').forEach(b=>holdButton(b,startOn,startOff));
const rP=$('#rPedal'); rP.oninput=()=>{$('#oPedal').textContent=rP.value+' %';};
function seg(id,fn){const el=$(id); el.onclick=ev=>{const b=ev.target.closest('button'); if(!b||!el.contains(b)) return; el.querySelectorAll('button').forEach(x=>x.classList.toggle('act',x===b)); fn(b.dataset.v);};}
function segSet(id,v){$(id).querySelectorAll('button').forEach(x=>x.classList.toggle('act',x.dataset.v==String(v)));}
seg('#segCyl',v=>selectCyl(+v));
function selectCyl(i){selCyl=clamp(i,0,NCYL-1); segSet('#segCyl',selCyl); const b=bankName(selCyl); $('#hCyl').textContent=$('#hCyl2').textContent='Silindir '+(selCyl+1)+(b?' · '+b:''); updateMotored();}
seg('#segPV',v=>pvMode=v);
seg('#segLoad',v=>setLoad(v));
function setLoad(v){const S=sim; if(S.dyno.sweep){S.dyno.sweep=null;S.pedalOverride=null;}
  S.load=v; segSet('#segLoad',v); $('#ctlDyno').hidden=v!=='dyno'; $('#ctlCar').hidden=v!=='car';
  if(v==='dyno'){S.dyno.target=Math.max(1000,round50(S.rpm)); dynoSlider(); S.dyno.I=0;}
  if(v==='car'){S.veh.v=0; setGear(0);} }
const TSCALES=[1,0.25,0.05,0.01];
seg('#segTime',v=>setScale(+v));
function setScale(v){timeScale=v; segSet('#segTime',v); const w=scWindow(); $('#hWin').textContent=w>=1?w.toFixed(0)+' s':(w*1000).toFixed(0)+' ms'; scCount=0; scNext=0;}
$('#chkStrobe').onchange=e=>{strobe=e.target.checked; visTheta=sim.theta;};
seg('#segDyno',v=>{sim.dyno.ctl=v; dynoSlider();});
function dynoSlider(){const r=$('#rDyno'), d=sim.dyno;
  if(d.ctl==='speed'){r.min=round50(ENG.idle*1.2);r.max=ENG.redline;r.step=50;r.value=d.target;} else {r.min=0;r.max=scales().tq;r.step=5;r.value=d.torque;} updDynoLabel();}
$('#rDyno').oninput=()=>{const v=+$('#rDyno').value; if(sim.dyno.ctl==='speed') sim.dyno.target=v; else sim.dyno.torque=v; updDynoLabel();};
function updDynoLabel(){$('#oDyno').textContent=sim.dyno.ctl==='speed'?sim.dyno.target+' d/d':sim.dyno.torque+' Nm';}
function startSweep(){auInit(); if(sim.load!=='dyno') setLoad('dyno'); if(sim.rpm<ENG.idle*0.5){flash('Önce motoru çalıştırın.');return;}
  segSet('#segDyno','speed'); sim.dyno.ctl='speed'; dynoSlider();
  sim.dyno.sweep={phase:'prep',t:0,data:[],ret:ENG.def.sweep[0]}; showTab('dyno');}
$('#bSweep').onclick=startSweep; $('#bSweep2').onclick=startSweep;
$('#bDynoClear').onclick=()=>{sim.dyno.runs=[]; $('#dynoInfo').textContent='Çekişler temizlendi.';};
seg('#segGear',v=>setGear(+v));
function setGear(g){sim.veh.gear=g; segSet('#segGear',g);}
$('#rClutch').oninput=()=>{$('#oClutch').textContent=$('#rClutch').value+' %';};
$$('.bSound').forEach(b=>b.onclick=()=>{auInit(); setSound(!soundOn);});
$('#rVol').oninput=()=>{if(AU.master&&soundOn) AU.master.gain.value=volume()*0.9;};
cvS.addEventListener('click',e=>{const r=cvS.getBoundingClientRect(); selectCyl(Math.floor((e.clientX-r.left)/r.width*NCYL));});
function flash(t){const h=$('#hintTop'); h.textContent=t; h.style.color='var(--warn)'; clearTimeout(flash.t); flash.t=setTimeout(()=>{h.innerHTML='Kontak <span class="kbd">I</span> · Marş basılı tut <span class="kbd">S</span> · Gaz <span class="kbd">W</span>';h.style.color='';},2500);}

/* ---------- Görünüm kaydı ---------- */
VIEWS.lab={el:$('#v-lab'),
  timeScale:()=>timeScale,
  input(rdt){const S=sim; const cmd=keys.w?1:+rP.value/100; S.pedal+=clamp(cmd-S.pedal,-rdt*5,rdt*5);
    S.veh.clutchCmd=keys.c?1:+$('#rClutch').value/100; S.veh.brake=keys.b?1:0; S.veh.brakeExt=0;},
  sample:scSample,
  post(rdt){if(strobe){const w=Math.abs(sim.omega)*timeScale; visTheta=mod(visTheta+Math.min(w,Math.PI*1.2)*rdt*R2D,720);} else visTheta=sim.theta;},
  events(evs){for(const ev of evs) if(ev.type==='sweepDone') flash('Çekiş tamamlandı.');},
  render(rdt){drawEngine(rdt); drawStrip(); drawGauges(rdt); drawScope(); drawCyl(); if(curTab==='dyno'&&sim.dyno.sweep) drawDyno();},
  slow(){const S=sim;
    if(curTab==='live') updLive(); else if(curTab==='ve'||curTab==='ign') markOp(); else if(curTab==='dyno') drawDyno();
    else if(curTab==='mod') MODULES.forEach(m=>{const el=$('#ms_'+m.id); if(el) el.textContent=m.on&&m.status?m.status(S,m):'';});
    updCylStats(); updateMotored();
    CH.forEach((ch,i)=>{const el=document.getElementById('cv_'+ch.k); el.textContent=ch.fmt(scBuf[i][(scHead-1+SC_N)%SC_N]);});
    if(S.ecu.dtcFresh!==VIEWS.lab.lastFresh){VIEWS.lab.lastFresh=S.ecu.dtcFresh; renderDtc();}
    const cl=$('#pCL'); cl.hidden=ENG.diesel; cl.textContent=S.ecu.cl?'KAPALI DÖNGÜ':'AÇIK DÖNGÜ'; cl.className='pill '+(S.ecu.cl?'on':'');
    const r=$('#pRev'); r.className='pill '+(S.ecu.revCut||S.ecu.launchCut?'crit':''); r.textContent=S.ecu.launchCut?'KALKIŞ KONTROLÜ':'DEVİR LİMİTİ';},
  onEngine(){const d=ENG.def;
    $('#segCyl').innerHTML=Array.from({length:NCYL},(_,i)=>`<button data-v="${i}">${i+1}</button>`).join('');
    $('#segGear').innerHTML='<button class="act" data-v="0">N</button>'+d.veh.gears.map((_,i)=>`<button data-v="${i+1}">${i+1}</button>`).join('');
    $('#labSpec').textContent=engineSpecLine(d);
    selectCyl(0); chScale(); scCount=0; scNext=0; buildLive(); labelTabs(); selCell={ve:null,ign:null}; buildTable('ve'); buildTable('ign');
    if(curTab==='ve'||curTab==='ign') paintTable(curTab);
    buildSettings(); renderMods(); renderDtc(); syncFaults(); setKey(sim.key); setLoad('free'); setScale(timeScale); drawDyno();
    $('#rPedal').value=0; $('#oPedal').textContent='0 %';},
  key(k,down,e){
    if(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('table.map')&&(k==='+'||k==='-'||k==='='||k.startsWith('arrow'))) return;
    if(down){
      if(e.repeat&&!['w','arrowup'].includes(k)){if(['s','c','b','x'].includes(k)) e.preventDefault(); return;}
      auInit();
      if(k==='w'||k==='arrowup'){keys.w=true;e.preventDefault();}
      else if(k==='i') setKey(!sim.key);
      else if(k==='s') startOn();
      else if(k==='c') keys.c=true;
      else if(k==='b') keys.b=true;
      else if(k==='x') sim.nitroBtn=true;
      else if(k==='m') setSound(!soundOn);
      else if(k==='t'){const ix=(TSCALES.indexOf(timeScale)+1)%TSCALES.length; setScale(TSCALES[ix]);}
      else if(sim.load==='car'&&/^[0-9]$/.test(k)&&+k<=ENG.def.veh.gears.length) setGear(+k);
    } else {
      if(k==='w'||k==='arrowup') keys.w=false; else if(k==='s') startOff(); else if(k==='c') keys.c=false; else if(k==='b') keys.b=false; else if(k==='x') sim.nitroBtn=false;
    }
  },
};
function engineSpecLine(d){return `${(ENG.Vd*1000).toFixed(1)} L · ${d.layout.toLowerCase()} · ${d.bore} × ${d.stroke} mm · ε ${d.cr}:1 · ${ENG.diesel?'common rail dizel':'port enjeksiyon'}${d.turbo?' · turbo':''} · ateşleme sırası ${d.firing.join('-')}`;}
