
"use strict";
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const FRIC=2.5, STRUC0=2.0;
let M=0, reform=0, phase=0;
const struc=()=>STRUC0*(1-reform/100);
const floorU=()=>FRIC+struc();
const cyc=m=>Math.max(0, 2.0-0.18*m);
const M_FULL=2.0/0.18;            // ≈11.1 — cyclical hits zero
const unemp=m=>floorU()+cyc(m);
const infl=m=>1 + 0.1*m + 0.6*Math.max(0, m-M_FULL);

const CW=640,L=46,R=18,T=18,B=42,pw=CW-L-R,ph=320-T-B;
const X=m=>L+m/30*pw, Y=v=>T+ph*(1-v/16);
function band(y0fn,y1fn,col,op){let top="",bot="";for(let m=0;m<=30;m+=0.5){top+=(top?"L":"M")+X(m).toFixed(1)+" "+Y(y1fn(m)).toFixed(1)+" ";}
  for(let m=30;m>=0;m-=0.5){bot+="L"+X(m).toFixed(1)+" "+Y(y0fn(m)).toFixed(1)+" ";}
  return `<path d="${top}${bot}Z" fill="${col}" opacity="${op}"/>`;}
function draw(){const sv=$("#chart");const S=struc(),fl=floorU();let s="";
  // zones
  s+=`<rect x="${L}" y="${T}" width="${(X(M_FULL)-L).toFixed(1)}" height="${ph}" fill="var(--good)" opacity=".05"/>`;
  s+=`<rect x="${X(M_FULL).toFixed(1)}" y="${T}" width="${(CW-R-X(M_FULL)).toFixed(1)}" height="${ph}" fill="var(--hot)" opacity=".05"/>`;
  s+=`<text x="${((L+X(M_FULL))/2).toFixed(1)}" y="${T+13}" font-size="9.5" text-anchor="middle" fill="var(--good)" font-weight="700">slack · printing buys JOBS</text>`;
  s+=`<text x="${((X(M_FULL)+CW-R)/2).toFixed(1)}" y="${T+13}" font-size="9.5" text-anchor="middle" fill="var(--hot)" font-weight="700">full · printing buys INFLATION</text>`;
  for(let v=0;v<=16;v+=4)s+=`<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${CW-R}" y2="${Y(v).toFixed(1)}" stroke="var(--faint)"/><text x="${L-6}" y="${(Y(v)+3).toFixed(1)}" font-size="9" text-anchor="end" fill="var(--mut)" font-family="var(--mono)">${v}%</text>`;
  // stacked unemployment bands
  s+=band(()=>0,()=>S,'var(--struc)',0.9);                 // structural
  s+=band(()=>S,()=>S+FRIC,'var(--fric)',0.9);             // frictional
  s+=band(()=>fl,m=>fl+cyc(m),'var(--cyc)',0.85);          // cyclical (shrinks)
  // floor line
  s+=`<line x1="${L}" y1="${Y(fl).toFixed(1)}" x2="${CW-R}" y2="${Y(fl).toFixed(1)}" stroke="var(--ink)" stroke-dasharray="4 3" opacity=".55"/><text x="${CW-R}" y="${(Y(fl)-4).toFixed(1)}" font-size="8.5" text-anchor="end" fill="var(--ink)">floor: frictional+structural = ${fl.toFixed(1)}% — money can't touch this</text>`;
  // inflation line
  let d="";for(let m=0;m<=30;m+=0.5)d+=(d?"L":"M")+X(m).toFixed(1)+" "+Y(clamp(infl(m),0,16)).toFixed(1)+" ";
  s+=`<path d="${d}" fill="none" stroke="var(--infl)" stroke-width="2.6"/>`;
  s+=`<text x="${X(23).toFixed(1)}" y="${(Y(infl(23))-7).toFixed(1)}" font-size="10" text-anchor="end" fill="var(--infl)">inflation</text>`;
  // current marker
  const u=unemp(M),i=infl(M),mx=X(M);
  s+=`<line x1="${mx.toFixed(1)}" y1="${T}" x2="${mx.toFixed(1)}" y2="${T+ph}" stroke="var(--acc)" stroke-width="1.5"/>`;
  s+=`<circle cx="${mx.toFixed(1)}" cy="${Y(u).toFixed(1)}" r="6" fill="#fff" stroke="var(--cyc)" stroke-width="2.5"/><circle cx="${mx.toFixed(1)}" cy="${Y(i).toFixed(1)}" r="6" fill="var(--infl)"/>`;
  for(let m=0;m<=30;m+=10)s+=`<text x="${X(m).toFixed(1)}" y="${T+ph+16}" font-size="9" text-anchor="middle" fill="var(--mut)" font-family="var(--mono)">${m}%</text>`;
  s+=`<text x="${(L+pw/2).toFixed(1)}" y="${T+ph+32}" font-size="11" text-anchor="middle" fill="var(--ink)">money printed (stimulus) →</text>`;
  s+=`<rect class="grab" x="${L}" y="${T}" width="${pw}" height="${ph}" fill="transparent" style="cursor:ew-resize"/>`;
  sv.innerHTML=s;
  $("#rU").textContent=u.toFixed(1)+'%';$("#rI").textContent=i.toFixed(1)+'%';
  const slack=cyc(M)>0.1,chip=$("#rState");
  if(slack){chip.textContent='idle workers → jobs';chip.style.background='#e7f1ea';chip.style.color='var(--good)';}
  else if(i>8){chip.textContent='no slack → wage-price spiral';chip.style.background='#f7e6e2';chip.style.color='var(--hot)';}
  else{chip.textContent='at the floor';chip.style.background='#f3edda';chip.style.color='var(--gold)';}
  if(phase>=1)renderA();if(phase>=2)renderB();if(phase>=3)renderC();
}
function drawReform(){const sv=$("#reform"),W=640,L2=210,R2=40,pw2=W-L2-R2,x=v=>L2+v/100*pw2;let s="";
  s+=`<text x="20" y="26" font-size="13" fill="var(--struc)" font-weight="700">Reform</text><text x="20" y="41" font-size="10.5" fill="var(--mut)">training · job-matching · mobility</text>`;
  s+=`<line x1="${L2}" y1="30" x2="${W-R2}" y2="30" stroke="var(--faint)" stroke-width="5" stroke-linecap="round"/>`;
  s+=`<rect x="${L2}" y="27.5" width="${(x(reform)-L2).toFixed(1)}" height="5" rx="2.5" fill="var(--struc)"/>`;
  s+=`<g class="kR" style="cursor:ew-resize"><circle cx="${x(reform).toFixed(1)}" cy="30" r="11" fill="var(--struc)"/></g>`;
  s+=`<text x="${W-R2}" y="16" font-size="12" text-anchor="end" font-family="var(--mono)" font-weight="700" fill="var(--struc)">${reform.toFixed(0)}%</text>`;
  sv.innerHTML=s;}

function step(n,t,done){$("#stepN").textContent=n;$("#stepT").innerHTML=t;$("#step").classList.toggle('done',!!done);}
function renderA(){$("#calloutA").style.display='block';$("#calloutA").className='callout';
  $("#calloutA").innerHTML=`<span class="lbl">⚡ why the floor exists</span>Unemployment stopped at <b>${floorU().toFixed(1)}%</b> — and now you can <em>see</em> why. The only band that shrank was <b style="color:var(--cyc)">cyclical</b> (people idled by weak demand — printing revived demand and rehired them). What's left is <b style="color:var(--fric)">frictional</b> (people between jobs, graduates still searching — normal churn) plus <b style="color:var(--struc)">structural</b> (workers whose skills or location don't match the open jobs). Neither is caused by too little money, so <b>money can't reach them</b>.`;}
function renderB(){$("#calloutB").style.display='block';$("#calloutB").className='callout reveal';
  $("#calloutB").innerHTML=`<span class="lbl">✦ so what happens instead</span>Past full employment there are <b>no idle workers left to hire</b>. Print more and employers just bid against each other for the same staff → wages jump → prices follow. Inflation is now <b>${infl(M).toFixed(1)}%</b>. Below the floor you don't buy jobs, you buy a <b>wage-price spiral</b>.`;}
function renderC(){$("#calloutC").style.display='block';$("#calloutC").className='callout';
  $("#calloutC").innerHTML=`<span class="lbl">↓ how to actually lower it</span>The floor isn't fixed at 4.5% — but the printing press can't move it. <b>Reform</b> (training, job-matching, mobility) shrinks the <b style="color:var(--struc)">structural</b> band, dropping the floor to <b>${floorU().toFixed(1)}%</b>. Real frictions need real fixes; money only ever cured the cyclical part.`;}
function litTakeaway(){$("#takeaway").className='takeaway lit';
  $("#takeaway").innerHTML=`<b>What you just learned:</b> unemployment isn't one number — it's a stack. The <b>cyclical</b> slice (weak demand) is the only part stimulus can cure, and only up to full employment. The <b>frictional + structural</b> floor comes from job-churn and mismatch — money can't touch it; lowering it takes <b>reform</b>, not printing. Push money past the floor and you don't get jobs, you get inflation. Same lever, opposite result — and now you can see exactly why.`;}

function setM(v){M=clamp(v,0,30);
  if(phase===0 && cyc(M)<=0.05){phase=1;step(2,'Unemployment stopped at the floor. <b>Why won\'t it go lower?</b> Keep printing and see what you get instead.');}
  if(phase>=1 && phase<2 && M>=18){phase=2;step(3,'So how DO you get below the floor? It isn\'t money — <b>drag the Reform slider</b> below.');}
  draw();}
function setReform(v){reform=clamp(v,0,100);
  if(phase>=2 && phase<3 && reform>=15){phase=3;litTakeaway();step('✓','You found it — printing cures cyclical unemployment; only reform lowers the floor.',true);}
  draw();drawReform();}

(function(){const sv=$("#chart");let on=false;const at=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const x=p.matrixTransform(sv.getScreenCTM().inverse()).x;return (x-L)/pw*30;};
  sv.addEventListener("pointerdown",e=>{if(!e.target.closest('.grab'))return;on=true;sv.setPointerCapture(e.pointerId);setM(Math.round(at(e.clientX)*2)/2);});
  sv.addEventListener("pointermove",e=>{if(on)setM(Math.round(at(e.clientX)*2)/2);});
  sv.addEventListener("pointerup",()=>on=false);sv.addEventListener("pointercancel",()=>on=false);})();
(function(){const sv=$("#reform");let on=false;const L2=210,R2=40,W=640,pw2=W-L2-R2;const at=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const x=p.matrixTransform(sv.getScreenCTM().inverse()).x;return clamp((x-L2)/pw2*100,0,100);};
  sv.addEventListener("pointerdown",e=>{if(!e.target.closest('.kR'))return;on=true;sv.setPointerCapture(e.pointerId);setReform(Math.round(at(e.clientX)));});
  sv.addEventListener("pointermove",e=>{if(on)setReform(Math.round(at(e.clientX)));});
  sv.addEventListener("pointerup",()=>on=false);})();
window.__J={get M(){return M},get reform(){return reform},get phase(){return phase},unemp,infl,floorU,cyc,setM,setReform};
draw();drawReform();
