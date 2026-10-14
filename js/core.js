'use strict';
/* =====================================================================
   core.js — ÇEKİRDEK FİZİK + ECU (DOM'suz)
   Birimler: SI (Pa, m, kg, s), açılar derece.
   Silindir yerel açısı φ: 0 = emme ÜÖN, 180 = AÖN (IVC olayı), 360 = ateşleme ÜÖN, 540 = EVO olayı.
   Motor değiştirmek: applyEngine(ENGINES[k]) sonra createSim().
   ===================================================================== */
const D2R=Math.PI/180, R2D=180/Math.PI;
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
const mod=(a,n)=>((a%n)+n)%n;
const P_AMB=101325, R_AIR=287, T_AMB=298;
const TR_RES=0.5, TR_N=721;              // kapalı çevrim izi: φ=180..540, 0.5° adım
const IVO=712, IVC_L=228, EVO=492, EVC=728; // supap zamanlaması (görsel + kam)
const HIST=10;

/* ---------- Motor kataloğu ----------
   firing: ateşleme sırası (silindir numaraları), eşit aralıklı.
   veh: bağlı araç. spec: fabrika dinamometre ölçümü (bu modelde ölçülmüş değerler). */
const ENGINES=[
  {id:'i3t',name:'1.0 Üç Silindir Turbo',short:'1.0 T3',tag:'Şehir',layout:'Sıralı 3',fuel:'benzin',bore:74.5,stroke:76.4,rod:140,cr:10.5,firing:[1,2,3],
   J:0.11,redline:6300,idle:850,vePk:3000,veMax:0.97,fric:1.0,turbo:{boost:1.2,lag:0.45,spool:0.55},
   snd:{res:115,lp:0.95,odd:0.25},sweep:[1500,300],price:0,
   veh:{name:'Kompakt hatchback',kind:'hatch',mass:1120,gears:[3.77,2.09,1.47,1.10,0.87,0.73],final:4.27,rw:0.30,cda:0.64,clutch:300,color:'#3d8fd0'},
   blurb:'Küçük hacim, erken devreden turbo. Düşük devirde dolgun, şehirde ekonomik. Üç silindirin kendine has titrek sesi.'},
  {id:'i4',name:'1.6 Dört Silindir',short:'1.6 R4',tag:'Klasik',layout:'Sıralı 4',fuel:'benzin',bore:79,stroke:81.5,rod:129,cr:10.5,firing:[1,3,4,2],
   J:0.16,redline:6800,idle:850,vePk:4800,veMax:0.97,fric:1.0,turbo:null,
   snd:{res:160,lp:1.0},sweep:[1500,350],price:0,
   veh:{name:'Aile sedanı',kind:'sedan',mass:1250,gears:[3.45,1.94,1.29,0.97,0.78],final:4.06,rw:0.30,cda:0.66,clutch:280,color:'#b9c2c9'},
   blurb:'Atmosferik, 16 supaplı, doğrusal güç. Ayar yapmayı öğrenmek için en dürüst motor.'},
  {id:'d4',name:'2.0 Dizel Turbo',short:'2.0 TDi',tag:'Tork',layout:'Sıralı 4 · dizel',fuel:'dizel',bore:81,stroke:95.5,rod:144,cr:16.5,firing:[1,3,4,2],
   J:0.24,redline:4800,idle:800,vePk:2600,veMax:0.94,fric:1.25,turbo:{boost:1.45,lag:0.6,spool:0.4},qMax:58,
   snd:{res:95,lp:0.75,clatter:1},sweep:[1100,250],price:0,
   veh:{name:'SUV',kind:'suv',mass:1640,gears:[3.77,2.05,1.29,0.92,0.72,0.60],final:3.65,rw:0.345,cda:0.92,clutch:480,color:'#5f7a5a'},
   blurb:'Sıkıştırmayla ateşlenir: buji yok, gaz kelebeği yok, pedal yakıt miktarını belirler. Soğukta kızdırma bujilerini bekleyin.'},
  {id:'i6',name:'3.0 Sıralı Altı Biturbo',short:'3.0 R6',tag:'Sport',layout:'Sıralı 6',fuel:'benzin',bore:84,stroke:89.6,rod:144,cr:10.2,firing:[1,5,3,6,2,4],
   J:0.24,redline:7000,idle:750,vePk:4500,veMax:0.98,fric:0.95,turbo:{boost:1.05,lag:0.55,spool:0.5},
   snd:{res:140,lp:1.15},sweep:[1500,350],price:0,
   veh:{name:'Sport sedan',kind:'sport',mass:1650,gears:[4.11,2.32,1.54,1.18,1.0,0.85],final:3.15,rw:0.33,cda:0.62,clutch:650,color:'#1d3557'},
   blurb:'Doğal dengeli sıralı altı: titreşimsiz, pürüzsüz. İki küçük turbo geniş bir tork platosu verir.'},
  {id:'v8',name:'5.0 V8 Atmosferik',short:'5.0 V8',tag:'Kas',layout:'V8 · 90°',fuel:'benzin',bore:92.2,stroke:92.7,rod:150,cr:11.0,firing:[1,5,4,8,6,3,7,2],
   J:0.34,redline:7000,idle:700,vePk:4900,veMax:1.05,fric:0.95,turbo:null,
   snd:{res:85,lp:0.85,burble:1},sweep:[1500,350],price:0,
   veh:{name:'Kas coupe',kind:'coupe',mass:1730,gears:[3.24,2.10,1.49,1.15,0.86,0.69],final:3.55,rw:0.345,cda:0.74,clutch:720,color:'#b3261e'},
   blurb:'Çapraz düzlemli krank, 90° V. Her devirde dört ateşleme ve o tanıdık gürleme. Büyük hacim, ani tepki.'},
  {id:'m4',name:'1.0 Motosiklet Dörtlüsü',short:'1.0 M4',tag:'Devir',layout:'Sıralı 4 · kısa strok',fuel:'benzin',bore:76,stroke:55.1,rod:105,cr:13.0,firing:[1,2,4,3],
   J:0.045,redline:14000,idle:1300,vePk:11500,veMax:1.08,fric:0.6,turbo:null,octane:98,
   snd:{res:260,lp:1.6},sweep:[3000,900],price:0,
   veh:{name:'Süper spor motosiklet',kind:'bike',mass:280,gears:[2.6,2.05,1.72,1.5,1.36,1.26],final:4.2,rw:0.31,cda:0.34,clutch:220,color:'#f2c230'},
   blurb:'Kısa strok, hafif krank, 14.000 d/d. Tork az, güç bol. Devir düşerse hiçbir şey olmaz, yukarıda hayat başlar.'},
];

const ENG={};
let CYL_OFS=[0,540,180,360], NCYL=4;
const TR_V=new Float64Array(TR_N);
let LOAD_LIM=4000; // dyno/gösterge ölçekleri için
function round50(x){return Math.round(x/50)*50;}
function applyEngine(def){
  for(const k of Object.keys(ENG)) delete ENG[k];
  const n=def.firing.length, diesel=def.fuel==='dizel';
  Object.assign(ENG,{def,id:def.id,diesel,n,bore:def.bore/1000,stroke:def.stroke/1000,rod:def.rod/1000,cr:def.cr,J:def.J,redline:def.redline,idle:def.idle,
    afr:diesel?14.5:14.7,lhv:diesel?42.8e6:44e6,rhoF:diesel?0.835:0.745,fric:def.fric||1,s:7000/def.redline});
  ENG.r=ENG.stroke/2; ENG.Ap=Math.PI*ENG.bore*ENG.bore/4; ENG.Vdc=ENG.Ap*ENG.stroke; ENG.Vd=n*ENG.Vdc; ENG.Vc=ENG.Vdc/(ENG.cr-1);
  const sc=ENG.Vd/1.6e-3; ENG.sc=sc;
  ENG.Vman=0.0032*sc; ENG.thrD=0.05*Math.sqrt(sc*(def.redline/6800)); ENG.Ath=Math.PI*ENG.thrD*ENG.thrD/4;
  ENG.iacMax=4.0e-5*sc*(def.redline>9000?1.4:1); ENG.leak=1.5e-6*sc;
  CYL_OFS=new Array(n); def.firing.forEach((c,k)=>CYL_OFS[c-1]=k*720/n); NCYL=n;
  for(let k=0;k<TR_N;k++) TR_V[k]=cylVol(180+k*TR_RES);
  ENG.tachMax=Math.ceil(def.redline/1000)+1;
  ENG.boostMax=def.turbo?def.turbo.boost:0;
  // ECU eksenleri
  const R=round50(def.redline+700); ENG.rpmBins=[]; for(let i=0;i<16;i++) ENG.rpmBins.push(round50(500+(R-500)*Math.pow(i/15,1.15)));
  if(diesel){ENG.loadBins=[0,10,20,30,40,50,60,70,80,90,100]; ENG.qBins=[0,5,10,15,20,25,30,40,50,60,70];}
  else {const b=[20,30,40,50,60,70,80,90,100]; if(def.turbo){const mx=100+def.turbo.boost*100+25; for(let k=1;k<=4;k++) b.push(Math.round((100+(mx-100)*k/4)/5)*5);} ENG.loadBins=b;}
  // enjektör boyutu (benzin): tam yükte redline'da ~%75 doluluk
  if(!diesel){const mMax=1.0*(P_AMB+ENG.boostMax*1e5)*ENG.Vdc/(R_AIR*305)/(ENG.afr*0.85), cycT=120/def.redline;
    ENG.injCc=Math.round(mMax/(0.75*cycT)/(ENG.rhoF*1e-3)*60/10)*10;}
  else ENG.injCc=0;
  // ısıl kütle
  const pf=sc*(1+ENG.boostMax*0.9)*(diesel?0.75:def.redline/6800); ENG.pf=pf;
  ENG.Ccool=4400*Math.pow(pf,0.8); ENG.kRad=650*Math.pow(pf,0.95);
}
function pistonX(phi){const a=phi*D2R,s=Math.sin(a),c=Math.cos(a),r=ENG.r,l=ENG.rod;return r*(1-c)+l-Math.sqrt(l*l-r*r*s*s);}
function pistonDX(phi){const a=phi*D2R,s=Math.sin(a),c=Math.cos(a),r=ENG.r,l=ENG.rod;return r*s*(1+r*c/Math.sqrt(l*l-r*r*s*s));} // m/rad
function cylVol(phi){return ENG.Vc+ENG.Ap*pistonX(phi);}

/* Gerçek motorun hacimsel verimi (ECU bunu bilmez, kendi tablosunu kullanır) */
function veTrue(rpm,map){
  const d=ENG.def, s=ENG.s, n=Math.max(rpm,100)/1000*s, pk=d.vePk/1000*s;
  let v=d.veMax-0.019*(n-pk)*(n-pk)+0.025*Math.sin(n*1.45+0.6);
  const k=map/1e5; v*=0.70+0.30*Math.min(k,1)+(k>1?0.06*Math.min(k-1,1):0);
  return clamp(v,0.15,1.15);
}
/* Akış: sıkıştırılabilir orifis (kg/s), yön p1→p2 */
function orifice(A,p1,p2,T){
  if(A<=0) return 0; let s=1; if(p2>p1){const t=p1;p1=p2;p2=t;s=-1;}
  const g=1.4, pr=Math.max(p2/p1,0), crit=0.5283; let psi;
  if(pr<=crit) psi=Math.sqrt(g)*Math.pow(2/(g+1),(g+1)/(2*(g-1)));
  else psi=Math.sqrt(2*g/(g-1)*(Math.pow(pr,2/g)-Math.pow(pr,(g+1)/g)));
  return s*0.82*A*p1/Math.sqrt(R_AIR*T)*psi;
}
function knockLimit(rpm,octane,ect,iat){
  const of=octane>=98?1.07:octane>=95?1:0.9;
  return (6.0e6+0.35e6*rpm*ENG.s/1000)*of*(1-0.004*(ect-90))*(1-0.004*(iat-303))*Math.pow(0.079/ENG.bore,0.4);
}
function burnParams(rpm,lam,kpa,ect){
  const n=rpm*ENG.s/1000;
  const dur=(34+2.6*n)*(1+2.4*(lam-0.92)*(lam-0.92))*(1+0.45*clamp(1-kpa/100,0,1))*(1+0.25*clamp((60-ect)/60,0,1));
  const delay=(5+0.9*n)*(1+1.2*clamp(lam-1,0,1));
  return [delay,dur];
}
function dieselBurn(rpm,q,ect,glowOK,cranking){
  const delayMs=0.55+1.4*clamp((40-ect)/60,0,1)+(cranking&&!glowOK?1.1:0);
  return [6*rpm*delayMs/1000, 38+0.45*q+1.8*rpm/1000];
}
function combEff(lam){return ENG.diesel?0.98:(lam<1?0.97:0.97-0.6*Math.max(0,lam-1.15)*Math.max(0,lam-1.15));}
function heatFrac(rpm,ect){return 0.79+0.04*Math.min(rpm*ENG.s/6000,1.2)-0.06*clamp((70-ect)/50,0,1);}

/* Tek çevrim basınç izi: tek bölgeli ısı salınımı + politropik sıkıştırma/genişleme */
function cycleTrace(o,out){
  const fire=o.fire;
  const Q=fire?Math.min(o.mFuel,o.mAir/ENG.afr)*ENG.lhv*combEff(o.lam)*heatFrac(o.rpm,o.ect):0;
  let start,dur;
  if(o.start!=null){start=o.start+(o.covS||0);dur=o.dur*(1+(o.covD||0));}
  else {const bp=burnParams(o.rpm,o.lam,o.kpa,o.ect); dur=bp[1]*(1+(o.covD||0)); start=360-o.adv+bp[0]+(o.covS||0);}
  const wm=o.wm||3;
  let p=o.pBDC, xb0=0, pmax=p, thP=-180, W=0, mfb50=NaN;
  out[0]=p;
  for(let k=1;k<TR_N;k++){
    const phi=180+k*TR_RES, V0=TR_V[k-1], V1=TR_V[k];
    let xb1=0; if(Q>0&&phi>start){const z=(phi-start)/dur; xb1=1-Math.exp(-5*Math.pow(z,wm));}
    const g=1.33-0.07*xb0;
    const pn=p*Math.pow(V0/V1,g)+(g-1)*Q*(xb1-xb0)/V1;
    W+=0.5*(p+pn)*(V1-V0); p=pn; out[k]=p;
    if(p>pmax){pmax=p;thP=phi-360;}
    if(mfb50!==mfb50&&xb1>=0.5) mfb50=phi-360;
    xb0=xb1;
  }
  return {Q,start,dur,pmax,thP,W,mfb50,pEVO:p};
}

/* ---------- ECU tabloları (eksenleri kendi içinde) ---------- */
function mkTable(x,y,fill){return {x,y,d:new Float32Array(x.length*y.length).fill(fill||0)};}
function binPos(b,v){const n=b.length;if(v<=b[0])return[0,0];if(v>=b[n-1])return[n-2,1];let i=0;while(v>b[i+1])i++;return[i,(v-b[i])/(b[i+1]-b[i])];}
function interp2(T,xv,yv){
  const NR=T.x.length,[i,fx]=binPos(T.x,xv),[j,fy]=binPos(T.y,yv), d=T.d;
  const a=d[j*NR+i],b=d[j*NR+i+1],c=d[(j+1)*NR+i],e=d[(j+1)*NR+i+1];
  const lo=a+(b-a)*fx, hi=c+(e-c)*fx; return lo+(hi-lo)*fy;
}
function cellWeights(T,xv,yv){const NR=T.x.length,[i,fx]=binPos(T.x,xv),[j,fy]=binPos(T.y,yv);
  return [[j*NR+i,(1-fx)*(1-fy)],[j*NR+i+1,fx*(1-fy)],[(j+1)*NR+i,(1-fx)*fy],[(j+1)*NR+i+1,fx*fy]];}
function qMaxCurve(rpm){const d=ENG.def; const a=clamp((rpm-700)/900,0.42,1), b=rpm>2900?1-(rpm-2900)/3800:1; return d.qMax*a*clamp(b,0.3,1);}
function factoryVE(){
  if(ENG.diesel){const T=mkTable(ENG.rpmBins,ENG.loadBins); // pedal → yakıt miktarı (mg/strok)
    for(let j=0;j<T.y.length;j++)for(let i=0;i<T.x.length;i++){const p=T.y[j]/100; T.d[j*T.x.length+i]=Math.round(qMaxCurve(T.x[i])*Math.pow(p,1.25)*10)/10;}
    return T;}
  const T=mkTable(ENG.rpmBins,ENG.loadBins);
  for(let j=0;j<T.y.length;j++)for(let i=0;i<T.x.length;i++){const err=0.045*Math.sin(i*1.31+j*0.77)+0.025*Math.cos(i*0.53-j*1.9);
    T.d[j*T.x.length+i]=Math.round(veTrue(T.x[i],T.y[j]*1000)*(1+err)*1000)/10;}
  return T;
}
const _scratch=new Float64Array(TR_N);
function factoryIgn(){
  const ys=ENG.diesel?ENG.qBins:ENG.loadBins, T=mkTable(ENG.rpmBins,ys), NR=T.x.length;
  for(let j=0;j<ys.length;j++)for(let i=0;i<NR;i++){
    const rpm=T.x[i];
    if(ENG.diesel){
      const q=ys[j], bst=ENG.boostMax*clamp(q/40,0,1)*clamp((rpm-900)/900,0,1), map=P_AMB+bst*1e5;
      const mAir=veTrue(rpm,map)*map*ENG.Vdc/(R_AIR*318), mFuel=q*1e-6, lam=mFuel>0?mAir/(mFuel*ENG.afr):9;
      const [dl,du]=dieselBurn(rpm,q,90,true,false);
      let best=-1e9,soi=4;
      for(let a=0;a<=30;a+=1){const r=cycleTrace({pBDC:map,mAir,mFuel,lam,rpm,start:360-a+dl,dur:du,wm:2,ect:90,fire:q>0},_scratch);
        if(r.pmax<185e5&&r.W>best){best=r.W;soi=a;}}
      T.d[j*NR+i]=q<=0?2:soi; continue;
    }
    const kpa=ys[j], map=kpa*1000;
    const lam=kpa>=90?0.88:1, ve=veTrue(rpm,map), mAir=ve*map*ENG.Vdc/(R_AIR*303), mFuel=mAir/(ENG.afr*lam);
    const pk=knockLimit(rpm,ENG.def.octane||95,90,303)*0.93;
    let best=-1e9,mbt=10,safe=0;
    for(let a=0;a<=46;a+=1){const r=cycleTrace({pBDC:map*(1-0.07*(rpm*ENG.s/7000)**2),mAir,mFuel,lam,adv:a,rpm,kpa,ect:90,fire:true},_scratch);
      if(r.W>best){best=r.W;mbt=a;} if(r.pmax<pk) safe=a;}
    let adv=Math.min(mbt,safe);
    if(rpm<=ENG.idle*1.45&&kpa<=50) adv=Math.min(adv,rpm<ENG.idle*0.85?10:14);  // rölantide tork rezervi
    if(rpm<=500) adv=Math.min(adv,8);
    T.d[j*NR+i]=Math.round(adv*2)/2;
  }
  return T;
}

/* ---------- Arızalar ve DTC ---------- */
const FAULTS=[
  {id:'plug',  name:'Buji / kızdırma bujisi arızası · silindir 3', desc:'Benzinlide 3. silindirde kıvılcım yok: rölanti titrer, P0303. Dizelde kızdırma bujisi ölü: soğuk çalıştırmada 3. silindir yanmaz.'},
  {id:'inj',   name:'Tıkalı enjektör · silindir 2', desc:'2. enjektör %55 debi verir. Silindir fakir yanar, yüksek yükte tekler.'},
  {id:'vac',   name:'Vakum kaçağı', desc:'Emme portlarından ölçülmeyen hava girer. Rölantide fakir karışım, yakıt düzeltmesi artı yönde büyür. (Dizelde etkisiz.)'},
  {id:'o2',    name:'O2 sensörü ölü', desc:'Sensör sabit sinyal verir. ECU kapalı döngüden çıkar, P0134.'},
  {id:'map',   name:'MAP sensörü sapması (+15 kPa)', desc:'ECU olduğundan fazla hava sanar, karışım zenginleşir. Dizelde duman sınırı gevşer.'},
  {id:'batt',  name:'Zayıf akü', desc:'Marşta voltaj 8 V civarına düşer, motor yavaş döner, zor çalışır.'},
  {id:'pump',  name:'Yakıt pompası zayıf', desc:'Rampa basıncı düşük. Enjektörler az yakıt verir, yükte güç kaybı, P0087.'},
  {id:'fan',   name:'Radyatör fanı çalışmıyor', desc:'Yavaş trafikte ya da dinamometrede motor ısınır, 113 °C üstünde ECU koruma moduna geçer.'},
  {id:'thermo',name:'Termostat açık kalmış', desc:'Motor çalışma sıcaklığına ulaşamaz. Soğuk zenginleştirme sürer, P0128.'},
];
const DTC_DEF={P0300:'Rastgele/çoklu silindir teklemesi',P0171:'Sistem çok fakir (Bank 1)',P0172:'Sistem çok zengin (Bank 1)',P0134:'O2 sensörü tepki vermiyor (B1S1)',
  P0217:'Motor aşırı ısınma',P0128:'Termostat: soğutma suyu sıcaklığı düşük',P0087:'Yakıt rampası basıncı çok düşük',P0106:'MAP sensörü aralık/performans hatası',P0380:'Kızdırma bujisi devresi'};
for(let i=1;i<=8;i++) DTC_DEF['P030'+i]=`Silindir ${i} tekleme`;

/* ---------- Modül sistemi (genişletme noktası) ----------
   defineModule({id,name,desc,params:[{k,label,min,max,step,unit,v}],
     init(S,M), preStep(S,dt,M), ecu(S,dt,M), onCycle(S,i,o,M), status(S,M)})  */
const MODULES=[];
function defineModule(m){m.on=!!m.on;m.p={};(m.params||[]).forEach(q=>m.p[q.k]=q.v);m.st={};MODULES.push(m);return m;}
function modOn(id){const m=MODULES.find(x=>x.id===id);return m&&m.on?m:null;}

defineModule({id:'turbo',name:'Turbo şarj',desc:'Egzoz akışıyla dönen turbo, ara soğutucu ve wastegate. Gecikme (lag), blow-off sesi. Turbolu motorlarda fabrikadan takılı gelir; atmosferik motora sonradan takarsanız büyük enjektör seçin.',
  params:[{k:'boost',label:'Wastegate basıncı',min:0.3,max:2.0,step:0.05,unit:'bar',v:0.8},{k:'lag',label:'Gecikme sabiti',min:0.2,max:2,step:0.05,unit:'s',v:0.8}],
  init(S,M){M.st.spd=0;M.st.bov=false;},
  preStep(S,dt,M){const t=M.st; t.spd=t.spd||0;
    const sp=ENG.def.turbo?ENG.def.turbo.spool:0.6, m0=0.010*ENG.sc*sp, m1=0.045*ENG.sc*sp;
    let eq=clamp((S.mdotCyl-m0)/m1,0,1.35);
    let tgt=M.p.boost; if(ENG.diesel) tgt*=clamp(0.15+S.tps*1.1,0,1);
    eq=Math.min(eq,Math.sqrt(tgt/1.6)*1.02);
    t.spd+=(eq-t.spd)*dt/(eq>t.spd?M.p.lag:1.6);
    let b=1.6*t.spd*t.spd*1e5;
    if(!ENG.diesel){
      if(S.tps<0.08&&b>25000&&S.map<P_AMB+b-25000){if(!t.bov){t.bov=true;S.events.push({t:S.t,type:'bov',amp:b/1.2e5});}}
      if(S.tps>0.2) t.bov=false;
      if(t.bov) b*=0.12;}
    S.boostTgt=b; S.turboSpd=t.spd;},
  status(S,M){return `Turbo devri ${(M.st.spd*190|0)} bin d/d · basınç ${(S.boost/1e5).toFixed(2)} bar`;}});

defineModule({id:'launch',name:'Kalkış kontrolü',desc:'Araç modunda, araç dururken debriyaja basılı ve gaz > %60 iken devri sabitler. Kıvılcım kesilir, yanmamış yakıt egzozda patlar. (Benzinli)',
  params:[{k:'rpm',label:'Kalkış devri',min:2000,max:9000,step:100,v:4000},{k:'retard',label:'Gecikme',min:0,max:20,step:1,unit:'°',v:12}],
  ecu(S,dt,M){const v=S.veh; const act=!ENG.diesel&&S.load==='car'&&v.v<0.6&&v.clutch>0.6&&S.tps>0.6;
    M.st.act=act; S.ecu.launch=act; if(act){S.ecu.modSpark-=M.p.retard; S.ecu.launchCut=S.rpm>M.p.rpm;} else S.ecu.launchCut=false;},
  status(S,M){return M.st.act?'Etkin, devir sabitleniyor':'Bekliyor';}});

defineModule({id:'nitro',name:'Nitro (N₂O, ıslak kit)',desc:'X tuşu (ya da sürüşte NOS düğmesi) basılıyken, gaz > %85 iken silindire ek oksijen ve yakıt verir. ECU avansı geri çeker. Tüp biter.',
  params:[{k:'shot',label:'Ek güç oranı',min:0.1,max:0.6,step:0.05,unit:'',v:0.35},{k:'retard',label:'Avans geri çekme',min:0,max:12,step:1,unit:'°',v:6}],
  init(S,M){M.st.bottle=1;},
  ecu(S,dt,M){M.st.act=S.nitroBtn&&S.tps>0.85&&S.rpm>ENG.redline*0.35&&M.st.bottle>0; if(M.st.act){S.ecu.modSpark-=M.p.retard; M.st.bottle=Math.max(0,M.st.bottle-dt*M.p.shot/0.35/25);}},
  onCycle(S,i,o,M){if(M.st.act){o.mAir*=1+M.p.shot;o.mFuel*=1+M.p.shot;}},
  status(S,M){return `Tüp %${Math.round((M.st.bottle??1)*100)}${M.st.act?' · PÜSKÜRTÜYOR':''}`;}});

/* Fabrika dinamometre ölçümleri (bu modelle, stok ayarda ölçüldü; ayar değişince yeniden ölçün) */
const FACTORY_DYNO={"i3t":{"tq":[168,1750],"pw":[111,5850],"curve":[[1650,166],[1850,165],[2200,160],[2400,159],[2700,155],[2950,154],[3200,154],[3450,154],[3700,153],[3950,155],[4200,154],[4450,154],[4750,153],[5000,149],[5250,145],[5500,140],[5750,135],[6000,126],[6150,121]]},"i4":{"tq":[140,4550],"pw":[106,6050],"curve":[[1650,114],[1950,119],[2250,122],[2550,124],[2850,127],[3150,130],[3450,133],[3750,135],[4050,137],[4350,139],[4650,140],[4950,139],[5250,136],[5550,132],[5850,127],[6150,121],[6450,115],[6700,109]]},"d4":{"tq":[321,1750],"pw":[132,3150],"curve":[[1200,162],[1500,234],[1700,312],[1850,318],[2050,314],[2300,312],[2450,312],[2750,311],[2950,306],[3150,293],[3350,272],[3550,251],[3800,230],[4000,208],[4200,187],[4450,165],[4650,143],[4700,128]]},"i6":{"tq":[450,4750],"pw":[376,6900],"curve":[[1650,416],[1950,426],[2250,432],[2550,427],[2850,426],[3150,421],[3450,423],[3750,430],[4050,436],[4350,441],[4650,446],[4950,443],[5250,438],[5550,437],[5850,433],[6150,415],[6450,400],[6750,389],[6900,383]]},"v8":{"tq":[458,4700],"pw":[361,6400],"curve":[[1650,393],[1950,403],[2250,411],[2550,417],[2850,423],[3150,431],[3450,439],[3750,447],[4050,451],[4350,454],[4650,457],[4950,456],[5250,451],[5550,440],[5850,427],[6150,410],[6450,392],[6750,373],[6900,363]]},"m4":{"tq":[102,10000],"pw":[178,13700],"curve":[[3150,81],[3800,81],[4450,84],[5100,86],[5750,89],[6400,92],[7050,95],[7700,98],[8350,99],[8950,101],[9600,102],[10250,102],[10900,102],[11550,101],[12200,99],[12800,96],[13450,93],[13700,91]]}};
ENGINES.forEach(e=>{const f=FACTORY_DYNO[e.id]; if(f){e.spec={tq:f.tq,pw:f.pw}; e.curve=f.curve;}});

function configureModulesForEngine(){
  const t=MODULES.find(m=>m.id==='turbo'), d=ENG.def.turbo;
  t.on=!!d; if(d){t.p.boost=d.boost;t.p.lag=d.lag;}
  MODULES.forEach(m=>{m.st={};});
}

/* ---------- Simülasyon durumu ---------- */
function createSim(){
  const n=NCYL, cyl=[];
  for(let i=0;i<n;i++){const tr=new Float64Array(TR_N); tr.fill(P_AMB);
    cyl.push({tr,hist:Array.from({length:HIST},()=>new Float32Array(TR_N)),hInfo:new Array(HIST).fill(null),hi:0,phiPrev:mod(-CYL_OFS[i],720),film:0,p:P_AMB,leak:1,
      info:{fired:false,lam:1,adv:10,start:360,dur:50,pmax:P_AMB,thP:0,W:0,mfb50:NaN,knock:0,mis:false,pEVO:P_AMB,mInj:0,egt:300}});}
  const def=ENG.def;
  const S={t:0,theta:0,omega:0,rpm:0,key:false,startBtn:false,nitroBtn:false,pedal:0,pedalOverride:null,tps:0,
    map:P_AMB,boost:0,boostTgt:0,turboSpd:0,Tman:303,Tup:T_AMB,pexh:P_AMB,mdotCyl:0,mdotTh:0,leakFlow:0,
    batt:12.6,ecuOn:false,primeT:0,pumpOn:false,fuelP:ENG.diesel?300e5:2.5e5,ect:20,oilT:20,fan:false,
    lamExh:1,lamSens:1,lamQ:[],Tg:0,TgF:0,Tf:0,Tbrake:0,fuelAcc:0,fuelAccT:0,fuelFlow:0,fuelUsed:0,egt:300,runT:0,
    cyl,events:[],faults:{},load:'free',
    dyno:{ctl:'speed',target:3000,torque:60,I:0,T:0,Tf:0,sweep:null,runs:[]},
    veh:{gear:0,clutch:0,clutchCmd:0,brake:0,v:0,Tc:0,grade:0,odo:0,def:def.veh},
    ecu:null,
  };
  S.ecu={ve:factoryVE(),ign:factoryIgn(),
    set:{revLimit:def.redline,idleTarget:def.idle,lamWOT:0.87,closedLoop:true,knockCtl:true,dfco:true,transComp:true,advOffset:0,injCc:ENG.injCc,octane:def.octane||95,autotune:false,smokeLam:1.18},
    stft:0,ltft:0,iac:0.25,iacI:0,idleSpark:0,idleTgt:def.idle,lamT:1,warmEnr:1,crankEnr:1,cranking:false,revCut:false,dfco:false,cl:false,o2t:0,o2fault:false,
    pw:0,duty:0,adv:0,q:0,qI:0,qIdle:0,glowT:0,kr:new Array(n).fill(0),film:new Array(n).fill(0),modSpark:0,launch:false,launchCut:false,limp:false,
    dtc:new Set(),dtcFresh:0,misC:new Array(n).fill(0),cycC:new Array(n).fill(0),timers:{},knockCount:0};
  MODULES.forEach(m=>m.on&&m.init&&m.init(S,m));
  return S;
}
function injFlow(cc){return cc/60*ENG.rhoF*1e-3;}   // kg/s
function deadTime(V){return 0.35+0.6*Math.pow(14/Math.max(V,6),1.5);} // ms
function crossed(a,b,x){return a<=b?(a<x&&b>=x):(x>a||x<=b);}

/* ---------- ECU ---------- */
function ecuStep(S,dt){
  const e=S.ecu, st=e.set, F=S.faults, rpm=S.rpm;
  S.mapSens=S.map+(F.map?15000:0); S.ectSens=S.ect; S.iatSens=S.Tman;
  e.modSpark=0;
  if(!S.ecuOn){e.cl=false;e.o2t=0;e.stft=0;e.cranking=false;e.revCut=false;e.dfco=false;e.iac=0.25;e.idleSpark=0;e.pw=0;e.duty=0;e.q=0;e.glowT=0;e.glowDone=false;return;}
  e.cranking=rpm<400&&S.startBtn;
  e.limp=S.ect>110||(e.limp&&S.ect>100);
  const lim=e.limp?Math.min(3500,st.revLimit):st.revLimit;
  const tgt=st.idleTarget+(ENG.diesel?150:350)*clamp((60-S.ectSens)/60,0,1); e.idleTgt=tgt;
  if(ENG.diesel){
    // kızdırma bujileri
    if(e.glowT>0){e.glowT-=dt; if(e.glowT<=0) e.glowDone=true;}
    // rölanti regülatörü (yakıt miktarı)
    const err=tgt-rpm;
    if(rpm>200){e.qI=clamp(e.qI+0.0035*err*dt,-4,10);}
    e.qIdle=rpm<120?0:clamp(4.0+e.qI+0.010*err,0,18);
    e.revCut=rpm>lim+120;
    e.cl=false; e.dfco=S.tps<0.01&&e.qIdle<=0.05&&rpm>tgt+300;
    T_dtc(S,dt,lim); MODULES.forEach(m=>m.on&&m.ecu&&m.ecu(S,dt,m)); return;
  }
  const kpa=S.mapSens/1000;
  let lt=1; if(S.tps>0.55&&kpa>80) lt=st.lamWOT-(kpa>105?0.0006*(kpa-100):0);
  if(S.ectSens<40) lt=Math.min(lt,0.95);
  e.lamT+=(lt-e.lamT)*Math.min(1,dt/0.15);
  e.warmEnr=1+0.08*clamp((50-S.ectSens)/50,0,1);
  e.crankEnr=1.0+0.35*clamp((70-S.ectSens)/50,0,1);
  if(rpm>lim) e.revCut=true; else if(rpm<lim-150*(ENG.redline/7000)) e.revCut=false;
  const dfOn=tgt+850*(ENG.redline/7000), dfOff=tgt+450*(ENG.redline/7000);
  if(st.dfco&&S.tps<0.01&&rpm>dfOn&&S.ectSens>50&&!e.cranking) e.dfco=true; else if(S.tps>=0.01||rpm<dfOff) e.dfco=false;
  // rölanti kontrolü (IAC PI + avans)
  const inGear=S.load==='car'&&S.veh.gear>0&&S.veh.clutch<0.5;
  const ff=0.20+0.10*clamp((70-S.ectSens)/60,0,1)+(inGear?0.04:0);
  const rs=7000/ENG.redline;
  if(rpm<250){e.iac=ff+0.08;e.idleSpark=0;e.iacI*=0.98;}
  else if(S.tps<0.02&&!e.dfco){const err=tgt-rpm;
    if(rpm<tgt+700/rs){e.iacI=clamp(e.iacI+0.00010*rs*err*dt,-0.2,0.5);e.idleSpark=clamp(err*0.02*rs,-5,8);} else e.idleSpark=0;
    e.iac=clamp(ff+e.iacI+0.00025*rs*err,0.02,1);}
  else {e.idleSpark=0;e.iac=clamp(ff+e.iacI+0.06,0,1);}
  // lambda kapalı döngü
  e.o2t+=dt;
  if(F.o2&&e.o2t>12&&S.ectSens>40&&rpm>500){const T=e.timers;T.o2=(T.o2||0)+dt;if(T.o2>15){e.o2fault=true;setDTC(S,'P0134');}}
  e.cl=st.closedLoop&&!e.o2fault&&e.o2t>12&&S.ectSens>40&&!e.dfco&&!e.revCut&&rpm>500&&e.lamT>0.985&&!e.cranking&&!e.launchCut;
  if(e.cl){const err=clamp(S.lamSens-e.lamT,-0.3,0.3); e.stft=clamp(e.stft+0.9*err*dt,-0.25,0.25);
    if(st.autotune){const w=cellWeights(e.ve,rpm,kpa); const g=0.6*e.stft*dt; for(const [c,wt] of w) e.ve.d[c]=clamp(e.ve.d[c]*(1+g*wt),5,130); e.stft-=g*0.9;}
    else {const d=e.stft*0.06*dt; e.ltft=clamp(e.ltft+d,-0.25,0.25); e.stft-=d;}
  } else e.stft*=Math.max(0,1-dt*0.8);
  for(let i=0;i<NCYL;i++) e.kr[i]=Math.max(0,e.kr[i]-0.8*dt);
  const T=e.timers, tot=e.stft+e.ltft;
  T.lean=(e.cl&&tot>0.2)?(T.lean||0)+dt:0; if(T.lean>5) setDTC(S,'P0171');
  T.rich=(e.cl&&tot<-0.2)?(T.rich||0)+dt:0; if(T.rich>5) setDTC(S,'P0172');
  T_dtc(S,dt,lim);
  MODULES.forEach(m=>m.on&&m.ecu&&m.ecu(S,dt,m));
}
function T_dtc(S,dt,lim){
  const e=S.ecu,T=e.timers,rpm=S.rpm;
  if(S.ect>113) setDTC(S,'P0217');
  T.th=(rpm>500)?(T.th||0)+dt:0; if(T.th>150&&S.ect<70) setDTC(S,'P0128');
  const fpLow=ENG.diesel?S.fuelP<0.8*(S.railT||300e5):S.fuelP<2.5e5;
  T.fp=(S.pumpOn&&rpm>500&&fpLow)?(T.fp||0)+dt:0; if(T.fp>3) setDTC(S,'P0087');
  T.map=(rpm<1&&S.ecuOn)?(T.map||0)+dt:0; if(T.map>1.5&&Math.abs(S.mapSens-P_AMB)>8000) setDTC(S,'P0106');
}
function setDTC(S,c){const e=S.ecu;if(!e.dtc.has(c)){e.dtc.add(c);e.dtcFresh++;}}
function ecuInject(S,i,rpm,cycT){
  const e=S.ecu,st=e.set;
  if(!S.ecuOn||rpm<40||e.revCut||e.dfco){e.pw=0;e.duty=0;return 0;}
  const kpa=S.mapSens/1000, ve=interp2(e.ve,rpm,kpa)/100;
  let m=ve*S.mapSens*ENG.Vdc/(R_AIR*S.iatSens)/(ENG.afr*e.lamT)*e.warmEnr*(1+e.stft+e.ltft);
  if(e.cranking) m*=e.crankEnr;
  if(st.transComp){const cf=clamp((70-S.ectSens)/50,0,1),X=0.2*(1+0.8*cf),tau=0.22*(1+1.5*cf);
    const ev=e.film[i]*Math.min(1,cycT/tau); let inj=Math.max(0,(m-ev)/(1-X)); e.film[i]+=X*inj-ev; m=inj;}
  let pw=m/injFlow(st.injCc)*1000+deadTime(S.batt);
  pw=Math.min(pw,cycT*1000*0.97); e.pw=pw; e.duty=pw/(cycT*1000); return pw;
}
function ecuDieselQ(S,i,rpm){
  const e=S.ecu,st=e.set;
  if(!S.ecuOn||rpm<40){e.q=0;return 0;}
  let q=Math.max(interp2(e.ve,rpm,S.tps*100),e.qIdle);
  if(e.cranking) q=Math.max(q,16+10*clamp((30-S.ectSens)/40,0,1));
  const mAirEst=veTrue(rpm,S.mapSens)*0.98*S.mapSens*ENG.Vdc/(R_AIR*S.iatSens);
  const qSmoke=mAirEst/(ENG.afr*st.smokeLam)*1e6;
  if(!e.cranking) q=Math.min(q,qSmoke);
  const lim=e.limp?3500:st.revLimit;
  q*=clamp((lim+150-rpm)/300,0,1);
  e.q=q; e.pw=q; e.duty=q/(ENG.def.qMax*1.3); return q;
}
function ecuSpark(S,i,rpm,kpa){
  const e=S.ecu; if(e.cranking||rpm<400) return 8;
  return clamp(interp2(e.ign,rpm,kpa)+e.set.advOffset+e.idleSpark-e.kr[i]+e.modSpark,-10,50);
}

/* ---------- Çevrim olayı: emme supabı kapanırken (φ=180) ---------- */
function onIVC(S,i){
  const c=S.cyl[i], e=S.ecu, F=S.faults, rpm=Math.max(S.rpm,1);
  c.hi=(c.hi+1)%HIST; c.hist[c.hi].set(c.tr); c.hInfo[c.hi]=c.info;
  const kpa=S.mapSens/1000, cycT=120/rpm;
  let mAir=veTrue(rpm,S.map)*S.map*ENG.Vdc/(R_AIR*S.Tman)+(ENG.diesel?0:S.leakFlow*cycT/NCYL);
  const pBDC=S.map*(1-0.07*(rpm*ENG.s/7000)**2);
  let o, mInj;
  if(ENG.diesel){
    const q=ecuDieselQ(S,i,rpm);
    mInj=q*1e-6*(F.inj&&i===1?0.55:1)*Math.sqrt(clamp(S.fuelP/(S.railT||300e5),0,1.1));
    const soi=clamp(interp2(e.ign,rpm,q)+e.set.advOffset+(e.cranking?4:0),-5,35); e.adv=soi;
    const glowOK=e.glowDone||S.ect>50, [dl,du]=dieselBurn(rpm,q,S.ect,glowOK&&!(F.plug&&i===2),e.cranking);
    o={pBDC,mAir,mFuel:mInj,lam:1,adv:soi,rpm,kpa:S.map/1000,ect:S.ect,fire:false,start:360-soi+dl,dur:du,wm:2,covD:0,covS:0};
  } else {
    const pw=ecuInject(S,i,rpm,cycT);
    mInj=Math.max(0,pw-deadTime(S.batt))*1e-3*injFlow(e.set.injCc)*Math.sqrt(Math.max(S.fuelP,0)/3e5)*(F.inj&&i===1?0.55:1);
    const cf=clamp((70-S.ect)/50,0,1), X=0.25*(1+0.8*cf), tau=0.25*(1+1.5*cf);
    const ev=c.film*Math.min(1,cycT/tau); c.film+=X*mInj-ev;
    o={pBDC,mAir,mFuel:(1-X)*mInj+ev,lam:1,adv:0,rpm,kpa:S.map/1000,ect:S.ect,fire:false,covD:0,covS:0};
  }
  MODULES.forEach(m=>m.on&&m.onCycle&&m.onCycle(S,i,o,m));
  o.lam=o.mFuel>1e-10?o.mAir/(o.mFuel*ENG.afr):99;
  let cut=false, fire;
  const lowLoad=clamp(1-o.kpa/60,0,1);
  if(ENG.diesel){
    fire=S.ecuOn&&o.mFuel>1e-9&&rpm>40;
    const glowOK=e.glowDone||S.ect>50;
    let pm=0; if(S.ect<30&&(!glowOK||(F.plug&&i===2))) pm=e.cranking?0.75:0.35*clamp((30-S.ect)/30,0,1);
    if(rpm<150) pm+=0.3;
    if(fire&&Math.random()<pm) fire=false;
    o.covS=(Math.random()-0.5)*1.5; o.covD=(Math.random()-0.5)*0.05;
  } else {
    o.adv=ecuSpark(S,i,rpm,kpa); e.adv=o.adv;
    cut=e.launchCut&&((e.cycC[i]+i)%3!==0);
    const spark=S.ecuOn&&rpm>40&&!(F.plug&&i===2)&&!cut;
    fire=spark&&o.mFuel>1e-9&&o.lam>0.45&&o.lam<1.75;
    if(fire){const pm=clamp((o.lam-1.32)*2.2,0,1)+clamp((0.62-o.lam)*3,0,1)+(rpm<250?0.25:0);if(Math.random()<pm) fire=false;}
    o.covS=(Math.random()-0.5)*(2+5*lowLoad+6*clamp(o.lam-1.1,0,1));
    o.covD=(Math.random()-0.5)*(0.06+0.12*lowLoad);
  }
  o.fire=fire;
  const r=cycleTrace(o,c.tr);
  // vuruntu (benzin)
  let knock=0;
  if(fire&&!ENG.diesel){const pk=knockLimit(rpm,e.set.octane,S.ect,S.Tman), inten=r.pmax/pk-1;
    if(inten>0&&Math.random()<clamp(0.15+inten*7,0,0.97)){
      knock=Math.min(0.3,0.05+inten*1.6); const amp=r.pmax*knock, k0=Math.round((r.thP+180)/TR_RES);
      const per=6*rpm/6300, dec=6*rpm*0.0011, ph=Math.random()*6.28;
      for(let k=Math.max(0,k0);k<TR_N;k++){const t=(k-k0)*TR_RES; c.tr[k]+=amp*Math.sin(6.2832*t/per+ph)*Math.exp(-t/dec);}
      if(e.set.knockCtl&&Math.random()<0.92){e.kr[i]=Math.min(12,e.kr[i]+2.5);}
      e.knockCount++;
      S.events.push({t:S.t,type:'knock',cyl:i,amp:knock});
    }}
  let egt;
  if(!fire) egt=S.Tman+40;
  else if(ENG.diesel) egt=273+110+1000/Math.max(o.lam,1)+0.02*rpm;
  else egt=273+330+0.06*rpm*ENG.s+260*Math.min(o.kpa/100,1.8)+9*Math.max(0,(r.mfb50===r.mfb50?r.mfb50:40)-8)-(o.lam<1?600*(1-o.lam):150*Math.max(0,o.lam-1.1));
  c.info={fired:fire,lam:o.lam,adv:o.adv,start:r.start,dur:r.dur,wm:o.wm||3,pmax:r.pmax,thP:r.thP,W:r.W,imep:r.W/ENG.Vdc,mfb50:r.mfb50,knock,mis:!fire&&o.mFuel>1e-9,
    pEVO:r.pEVO,mInj,mAir:o.mAir,egt,rpm,cut:cut&&o.mFuel>1e-9};
  S.fuelAcc+=mInj; S.fuelUsed+=mInj;
  if(S.ecuOn&&rpm>500&&!e.revCut&&!e.dfco&&!cut&&o.mFuel>1e-9){e.cycC[i]++; if(c.info.mis) e.misC[i]++;
    if(e.cycC[i]>=100){if(e.misC[i]>=6) setDTC(S,'P030'+(i+1));
      if(e.misC.filter(x=>x>=6).length>=2) setDTC(S,'P0300'); e.misC[i]=0; e.cycC[i]=0;}}
}
function onEVO(S,i){
  const c=S.cyl[i], inf=c.info;
  let l=inf.fired?inf.lam:(inf.mInj>0?inf.lam+0.8:19.9);
  S.lamQ.push([S.t+0.04+60/Math.max(S.rpm,200),Math.min(l,ENG.diesel?19.9:9.99)]);
  if(inf.fired) S.events.push({t:S.t,type:'fire',cyl:i,amp:inf.imep});
  else if(inf.cut&&Math.random()<0.45) S.events.push({t:S.t,type:'pop',cyl:i,amp:1});
}

/* ---------- Ana adım ---------- */
function simStep(S,dt){
  const F=S.faults, e=S.ecu;
  const rpm=Math.max(0,S.omega)*30/Math.PI; S.rpm=rpm;
  const cranking=S.key&&S.startBtn;
  const running=S.key&&rpm>Math.min(450,ENG.idle*0.55);
  const vb=!S.key?12.6:cranking?(F.batt?7.9:10.4)-rpm/1000:running?14.1:(e.glowT>0?11.6:12.3);
  S.batt+=(vb-S.batt)*Math.min(1,dt/0.12);
  const was=S.ecuOn; S.ecuOn=S.key&&S.batt>7.2;
  if(S.ecuOn&&!was){S.primeT=2; if(ENG.diesel){e.glowDone=S.ect>50; e.glowT=S.ect>50?0:0.6+3.2*clamp((50-S.ect)/50,0,1); if(F.plug&&S.ect<50) setDTC(S,'P0380');}}
  if(S.primeT>0) S.primeT-=dt;
  S.pumpOn=S.ecuOn&&(S.primeT>0||rpm>40);
  if(ENG.diesel){S.railT=rpm>40?Math.min(1600e5,300e5+rpm*0.6e5):300e5; const rail=S.pumpOn?S.railT*(F.pump?0.6:1):S.fuelP*0.995;
    S.fuelP+=(rail-S.fuelP)*Math.min(1,dt/0.2);}
  else {const fpT=S.pumpOn?(F.pump?2.1e5:3.0e5):S.fuelP*0.999; S.fuelP+=(fpT-S.fuelP)*Math.min(1,dt/(S.pumpOn?0.3:30));}
  // modüller
  S.boostTgt=0;
  MODULES.forEach(m=>m.on&&m.preStep&&m.preStep(S,dt,m));
  S.boost+=(S.boostTgt-S.boost)*Math.min(1,dt/0.08);
  S.Tup=T_AMB+6+S.boost/1e5*22;
  // pedal -> elektronik gaz kelebeği (dizelde pedal = yakıt isteği, kelebek açık)
  const ped=S.pedalOverride!=null?S.pedalOverride:S.pedal;
  S.tps+=(ped-S.tps)*Math.min(1,dt/0.035);
  const thr=ENG.diesel?1:S.tps;
  const plate=7+thr*83, Ath=ENG.Ath*(1-Math.cos(plate*D2R)/Math.cos(7*D2R));
  const Aiac=ENG.diesel?0:ENG.iacMax*e.iac;
  const pUp=P_AMB+S.boost;
  S.mdotTh=orifice(Ath+Aiac+ENG.leak,pUp,S.map,S.Tup);
  S.leakFlow=F.vac&&!ENG.diesel?Math.max(0,orifice(3e-6*ENG.sc,P_AMB,S.map,T_AMB)):0;
  S.Tman+=((S.Tup+5+0.06*(S.ect-20))-S.Tman)*Math.min(1,dt/4);
  S.mdotCyl=veTrue(rpm,S.map)*S.map/(R_AIR*S.Tman)*ENG.Vd*rpm/120;
  S.map+=R_AIR*S.Tman/ENG.Vman*(S.mdotTh-S.mdotCyl)*dt;
  S.map=clamp(S.map,3000,pUp*1.02+5000);
  S.pexh=P_AMB+1200*Math.pow(rpm*ENG.s/1000,1.5)*(0.2+0.8*Math.min(S.map/1e5,2))+S.boost*1.15;
  // lambda sensörü (taşıma gecikmesi + gecikme)
  while(S.lamQ.length&&S.lamQ[0][0]<=S.t){S.lamExh=S.lamQ.shift()[1];}
  if(S.lamQ.length>64) S.lamQ.splice(0,S.lamQ.length-64);
  const lamTarget=F.o2&&!ENG.diesel?1.0:S.lamExh;
  S.lamSens+=(lamTarget-S.lamSens)*Math.min(1,dt/0.08);
  ecuStep(S,dt);
  // silindir gaz torku
  let Tg=0;
  const fwd=S.omega>0;
  for(let i=0;i<NCYL;i++){
    const c=S.cyl[i], phi=mod(S.theta-CYL_OFS[i],720), pp=c.phiPrev;
    if(fwd&&pp!==phi){
      if(crossed(pp,phi,180)){onIVC(S,i);c.leak=1;}
      if(crossed(pp,phi,540)) onEVO(S,i);
    }
    c.phiPrev=phi;
    let p;
    if(phi>=180&&phi<=540){const f=(phi-180)/TR_RES; const k=Math.min(TR_N-2,f|0); p=c.tr[k]+(c.tr[k+1]-c.tr[k])*(f-k);
      if(rpm<400) c.leak*=Math.exp(-dt/0.6); p=P_AMB+(p-P_AMB)*c.leak;}   // segman kaçağı: yavaşta sıkışan gaz kaçar
    else if(phi>540) p=S.pexh+(c.tr[TR_N-1]-S.pexh)*Math.exp(-(phi-540)/14);
    else p=S.map*(1-0.05*Math.sin(phi*D2R)*(rpm*ENG.s/6000)*(rpm*ENG.s/6000));
    c.p=p; Tg+=(p-P_AMB)*ENG.Ap*pistonDX(phi);
  }
  // sürtünme, marş, yük
  const Sp=2*ENG.stroke*rpm/60, cold=1+0.7*clamp((80-S.oilT)/60,0,1);
  let Tf=ENG.fric*(0.75+0.0442*Sp+0.00406*Sp*Sp)*1e5*cold*ENG.Vd/(4*Math.PI)+(running?1.5*ENG.sc:0);
  const crankFree=(ENG.diesel?330:430)*Math.min(1,ENG.redline/7000*1.4);
  const Ts=cranking?125*ENG.sc*(ENG.diesel?1.4:1)*clamp(1-rpm/(F.batt?crankFree*0.7:crankFree),0,1)*(F.batt?0.6:1):0;
  const Tl=drivetrain(S,dt);
  let Tn=Tg+Ts-Tl;
  if(Math.abs(S.omega)<2){const Tf0=Tf*1.3; if(Math.abs(Tn)<=Tf0){S.omega*=Math.max(0,1-dt*60);Tn=0;} else Tn-=Math.sign(Tn)*Tf0;}
  else Tn-=Math.sign(S.omega)*Tf;
  const J=ENG.J+(S.load==='dyno'?0.25*ENG.sc:0);
  S.omega+=Tn/J*dt;
  if(S.omega<-30) S.omega=-30;
  S.theta=mod(S.theta+S.omega*dt*R2D,720);
  S.Tg=Tg; S.TgF+=(Tg-S.TgF)*Math.min(1,dt/0.25); S.Tf=Tf;
  S.Tbrake=S.TgF-Tf;
  // yakıt tüketimi
  S.fuelAccT+=dt; if(S.fuelAccT>=0.25){S.fuelFlow=S.fuelAcc/S.fuelAccT;S.fuelAcc=0;S.fuelAccT=0;}
  // termal
  const fanOn=!F.fan&&(S.ect>98||(S.fan&&S.ect>93)); S.fan=fanOn;
  const open=F.thermo?1:clamp((S.ect-86)/8,0,1), air=1+(fanOn?1.2:0)+S.veh.v/12;
  const Qin=S.fuelFlow*ENG.lhv*(ENG.diesel?0.22:0.27);
  const Qrad=ENG.kRad*open*(S.ect-25)*air+(F.thermo?0.3*ENG.kRad*(S.ect-25)*air:0)+25*ENG.sc*(S.ect-25);
  S.ect+=(Qin-Qrad)/ENG.Ccool*dt;
  S.oilT+=(S.ect-S.oilT)*dt/30;
  S.egt+=((rpm>100?S.cyl[0].info.egt:S.egt*0.999+0.001*T_AMB)-S.egt)*Math.min(1,dt/0.6);
  if(running) S.runT+=dt;
  S.t+=dt;
}

/* ---------- Yük: dinamometre / araç ---------- */
function drivetrain(S,dt){
  if(S.load==='dyno'){
    const d=S.dyno, Jt=ENG.J+0.25*ENG.sc; let T;
    const [from,rate]=ENG.def.sweep;
    if(d.sweep){const sw=d.sweep; S.pedalOverride=1; d.ctl='speed';
      if(sw.phase==='prep'){d.target=from;sw.t+=dt;if(sw.t>1.6&&Math.abs(S.rpm-from)<80){sw.phase='run';sw.next=from+50;}}
      else{d.target+=rate*dt;
        if(d.target>=sw.next){if(d.target>from+120) sw.data.push([S.rpm,d.Tf+Jt*rate*Math.PI/30]);sw.next+=rate/7;}
        if(d.target>=Math.min(S.ecu.set.revLimit,S.ecu.limp?3500:9e9)-100*(ENG.redline/7000)){d.runs.push(sw.data);if(d.runs.length>4)d.runs.shift();d.sweep=null;S.pedalOverride=null;d.target=sw.ret;S.events.push({t:S.t,type:'sweepDone'});}}}
    const kp=8*ENG.sc, ki=30*ENG.sc;
    if(d.ctl==='speed'){const err=S.omega-d.target*Math.PI/30; d.I=clamp(d.I+ki*err*dt,0,1200); T=clamp(kp*err+d.I,0,1200);}
    else {T=d.torque*clamp(S.rpm/500,0,1); d.I=T;}
    d.T=T; d.Tf+=(T-d.Tf)*Math.min(1,dt/0.12); return T;
  }
  if(S.load==='car'){
    const v=S.veh, V=v.def; v.clutch+=(v.clutchCmd-v.clutch)*Math.min(1,dt/0.08);
    const G=v.gear>0?V.gears[v.gear-1]*V.final:0; let Tc=0;
    if(G>0){const wIn=v.v/V.rw*G, cap=V.clutch*Math.pow(1-v.clutch,2.2); Tc=clamp(45*ENG.sc*(S.omega-wIn),-cap,cap);}
    const roll=v.v>0.05?0.012*V.mass*9.81:0, drag=0.5*1.2*V.cda*v.v*v.v, grade=V.mass*9.81*(v.grade||0);
    const brakeF=v.brake*V.mass*9.0*(v.v>0.01?1:0)+(v.brakeExt||0);
    const Fw=Tc*G*0.92/V.rw-drag-roll-grade-brakeF;
    v.v=Math.max(0,v.v+Fw/(V.mass*(1+0.04*(G/10)*(G/10)))*dt); if(v.v<0.02&&Fw<=0) v.v=0;
    v.odo+=v.v*dt; v.Tc=Tc; v.acc=Fw/V.mass; return Tc;
  }
  return 0;
}
