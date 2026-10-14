'use strict';
/* =====================================================================
   garage.js — GARAJ: motor seçimi. VIEWS.garage
   Kart başına fabrika dinamometre eğrisi (def.curve: [rpm, Nm] çiftleri) çizilir.
   ===================================================================== */
function dispL(d){return (Math.PI*(d.bore/2000)**2*(d.stroke/1000)*d.firing.length*1000);}
function renderGarage(){
  $('#garageGrid').innerHTML=ENGINES.map(d=>{const sel=d.id===curEngine.id, sp=d.spec;
    return `<article class="eng${sel?' sel':''}" data-id="${d.id}" style="--ec:${d.veh.color}">
      <div class="eng-top"><span class="eng-tag">${d.tag}</span><span class="eng-fuel">${d.fuel}</span></div>
      <h3>${d.name}</h3>
      <div class="eng-sub">${d.layout} · ${dispL(d).toFixed(1)} L${d.turbo?' · turbo '+d.turbo.boost.toFixed(1)+' bar':' · atmosferik'}</div>
      <canvas class="eng-curve" data-id="${d.id}" aria-label="${d.name} tork ve güç eğrisi"></canvas>
      <dl class="eng-nums">
        <div><dt>Tork</dt><dd>${sp?sp.tq[0]+' Nm':'—'}<small>${sp?'@ '+sp.tq[1]:''}</small></dd></div>
        <div><dt>Güç</dt><dd>${sp?sp.pw[0]+' BG':'—'}<small>${sp?'@ '+sp.pw[1]:''}</small></dd></div>
        <div><dt>Limit</dt><dd>${d.redline}<small>d/d</small></dd></div>
      </dl>
      <p class="eng-blurb">${d.blurb}</p>
      <div class="eng-veh"><span class="sw"></span>${d.veh.name} · ${d.veh.mass} kg · ${d.veh.gears.length} ileri</div>
      <div class="row"><button class="btn small ${sel?'':'pri'}" data-act="pick">${sel?'Seçili motor':'Bu motoru seç'}</button><button class="btn small" data-act="lab">Laboratuvarda aç</button></div>
    </article>`;}).join('');
  $$('#garageGrid .eng').forEach(card=>card.onclick=ev=>{const b=ev.target.closest('button'); if(!b) return; const id=card.dataset.id;
    if(id!==curEngine.id){switchEngine(id);}
    if(b.dataset.act==='lab') showView('lab'); else renderGarage();});
  drawCurves();
}
function drawCurves(){
  $$('#garageGrid canvas.eng-curve').forEach(cv=>{const d=ENGINES.find(e=>e.id===cv.dataset.id), [g,W,H]=fitCanvas(cv);
    g.fillStyle=COL.face; g.fillRect(0,0,W,H);
    g.strokeStyle=COL.line; g.lineWidth=1; g.beginPath(); for(let q=1;q<4;q++){const y=Math.round(H*q/4)+0.5; g.moveTo(0,y); g.lineTo(W,y);} g.stroke();
    if(!d.curve){g.fillStyle=COL.dim; g.font=`11px ${MONO}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText('eğri yok',W/2,H/2); return;}
    const xm=Math.ceil(d.redline/1000)*1000+500, tm=Math.max(...d.curve.map(c=>c[1]))*1.15, pm=Math.max(...d.curve.map(c=>c[1]*c[0]))*1.15;
    const X=n=>6+(W-12)*n/xm;
    const draw=(f,col,dash)=>{g.strokeStyle=col; g.lineWidth=2; g.setLineDash(dash); g.beginPath(); d.curve.forEach((c,i)=>{const x=X(c[0]),y=H-4-(H-10)*f(c); i?g.lineTo(x,y):g.moveTo(x,y);}); g.stroke(); g.setLineDash([]);};
    draw(c=>c[1]/tm,d.veh.color,[]); draw(c=>c[1]*c[0]/pm,COL.amber,[4,3]);
    g.fillStyle=COL.dim; g.font=`9.5px ${MONO}`; g.textAlign='left'; g.textBaseline='top'; g.fillText('tork',6,4); g.fillStyle=COL.amber; g.fillText('güç',40,4);
    g.fillStyle=COL.dim; g.textAlign='right'; g.fillText(xm/1000+'k d/d',W-6,4);
  });
}
VIEWS.garage={el:$('#v-garage'),
  timeScale:()=>1,
  input(rdt){sim.pedal+=clamp(0-sim.pedal,-rdt*5,rdt*5);},
  onShow(){renderGarage();},
  onEngine(){if(curView==='garage') renderGarage();},
};
window.addEventListener('resize',()=>{if(curView==='garage') drawCurves();});
