
"use strict";
const $=s=>document.querySelector(s);
const NEUTRAL=3.0;
const ST={rate:4.5};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const inflAt=r=>clamp(3-0.8*(r-NEUTRAL),0,12);
const unempAt=r=>clamp(4+0.7*(r-NEUTRAL),3,12);
const pct=v=>v.toFixed(2)+"%";

/* ===== HERO: rate dial + two gauges + temperature ===== */
function drawHero(){const sv=$("#hero"),W=1040;const r=ST.rate,infl=inflAt(r),unemp=unempAt(r);
  const L=60,R=60,axY=60,x=v=>L+v/8*(W-L-R);
  let s="";
  // rate axis
  s+=`<text x="${L}" y="26" font-size="12" fill="var(--mut)">Federal funds rate</text>`;
  s+=`<line x1="${L}" y1="${axY}" x2="${W-R}" y2="${axY}" stroke="var(--faint)" stroke-width="4" stroke-linecap="round"/>`;
  for(let v=0;v<=8;v+=2)s+=`<text x="${x(v).toFixed(1)}" y="${axY+18}" font-size="10" text-anchor="middle" fill="var(--mut)" font-family="var(--mono)">${v}%</text>`;
  // neutral marker
  s+=`<line x1="${x(NEUTRAL).toFixed(1)}" y1="${axY-10}" x2="${x(NEUTRAL).toFixed(1)}" y2="${axY+10}" stroke="var(--mut)" stroke-dasharray="2 2"/><text x="${x(NEUTRAL).toFixed(1)}" y="${axY-14}" font-size="9" text-anchor="middle" fill="var(--mut)">neutral ~3%</text>`;
  // knob
  s+=`<g class="knob" style="cursor:ew-resize"><circle cx="${x(r).toFixed(1)}" cy="${axY}" r="11" fill="var(--fed)"/><text x="${x(r).toFixed(1)}" y="${axY-16}" font-size="12" text-anchor="middle" font-weight="700" fill="var(--fed)" font-family="var(--mono)">${pct(r)}</text></g>`;
  // two gauges
  const gauge=(gx,label,val,target,band,unit,hotHigh)=>{const gw=380,x0=gx,y0=120,mx2=12;
    const gv=v=>x0+clamp(v,0,mx2)/mx2*gw;
    let g=`<text x="${x0}" y="${y0-8}" font-size="12" fill="var(--ink)">${label}</text>`;
    g+=`<rect x="${x0}" y="${y0}" width="${gw}" height="16" rx="8" fill="var(--faint)"/>`;
    const col=Math.abs(val-target)<0.7?'var(--good)':(hotHigh? (val>target?'var(--hot)':'var(--cold)') : (val>target?'var(--hot)':'var(--cold)'));
    g+=`<rect x="${x0}" y="${y0}" width="${(gv(val)-x0).toFixed(1)}" height="16" rx="8" fill="${col}"/>`;
    g+=`<line x1="${gv(target).toFixed(1)}" y1="${y0-4}" x2="${gv(target).toFixed(1)}" y2="${y0+20}" stroke="var(--ink)" stroke-width="2"/><text x="${gv(target).toFixed(1)}" y="${y0+33}" font-size="9" text-anchor="middle" fill="var(--ink)">${band}</text>`;
    g+=`<text x="${(gv(val)+8).toFixed(1)}" y="${y0+13}" font-size="12" font-family="var(--mono)" font-weight="700" fill="${col}">${pct(val)}</text>`;
    return g;};
  s+=gauge(L,'Inflation',infl,2,'target 2%','%',true);
  s+=gauge(560,'Unemployment',unemp,4.5,'~natural','%',true);
  // temperature chip
  const temp = infl>2.6?['overheating','var(--hot)']: (infl<1.4||unemp>5.8)?['too cold','var(--cold)']:['about right','var(--good)'];
  s+=`<text x="${W-R}" y="26" font-size="12" text-anchor="end" fill="var(--mut)">economy:</text><text x="${W-R}" y="44" font-size="15" text-anchor="end" font-weight="700" fill="${temp[1]}">${temp[0]}</text>`;
  sv.innerHTML=s;
  const dir = r>NEUTRAL+0.1?'cooling':r<NEUTRAL-0.1?'heating':'holding';
  $("#capHero").innerHTML=`At a ${SB('rate',pct(r))} federal funds rate the model runs <b class="${temp[1]==='var(--hot)'?'hot':temp[1]==='var(--cold)'?'cold':'good'}">${temp[0]}</b>: inflation ≈ <b>${pct(infl)}</b> (goal 2%), unemployment ≈ <b>${pct(unemp)}</b>. You're <b>${dir}</b> the economy — raise to cool prices (risking jobs), lower to boost jobs (risking inflation).`;
}

/* ===== CORRIDOR ===== */
function drawCorr(){const sv=$("#corr"),W=480,L=44,R=70,T=20,B=26,r=ST.rate;
  const lo=Math.max(0,r-0.05),hi=r+0.25,ff=r+0.08; // floor (IOR), ceiling (lending), effective ff inside
  const mn=Math.max(0,r-1.2),mx=r+1.2,y=v=>T+(150-T-B)*(1-(v-mn)/((mx-mn)||1));
  let s="";
  for(let i=0;i<=4;i++){const v=mn+(mx-mn)*i/4;s+=`<line x1="${L}" y1="${y(v).toFixed(1)}" x2="${W-R}" y2="${y(v).toFixed(1)}" stroke="var(--faint)"/><text x="${L-6}" y="${(y(v)+3).toFixed(1)}" font-size="9" text-anchor="end" fill="var(--mut)" font-family="var(--mono)">${v.toFixed(2)}</text>`;}
  // band between floor and ceiling
  s+=`<rect x="${L}" y="${y(hi).toFixed(1)}" width="${W-R-L}" height="${(y(lo)-y(hi)).toFixed(1)}" fill="var(--fed)" opacity=".12"/>`;
  s+=`<line x1="${L}" y1="${y(hi).toFixed(1)}" x2="${W-R}" y2="${y(hi).toFixed(1)}" stroke="var(--hot)" stroke-width="2"/><text x="${W-R+4}" y="${(y(hi)+3).toFixed(1)}" font-size="9.5" fill="var(--hot)">ceiling</text>`;
  s+=`<line x1="${L}" y1="${y(lo).toFixed(1)}" x2="${W-R}" y2="${y(lo).toFixed(1)}" stroke="var(--cold)" stroke-width="2"/><text x="${W-R+4}" y="${(y(lo)+3).toFixed(1)}" font-size="9.5" fill="var(--cold)">floor</text>`;
  s+=`<circle cx="${(L+(W-R-L)/2).toFixed(1)}" cy="${y(ff).toFixed(1)}" r="6" fill="var(--ink)"/><text x="${(L+(W-R-L)/2).toFixed(1)}" y="${(y(ff)-10).toFixed(1)}" font-size="10" text-anchor="middle" font-weight="700" fill="var(--ink)">fed funds ${pct(ff)}</text>`;
  // grab strip to drag rate
  s+=`<rect class="grab" x="${L}" y="${T}" width="${W-R-L}" height="${150-T-B}" fill="transparent" style="cursor:ns-resize"/>`;
  sv.innerHTML=s;
  $("#capCorr").innerHTML=`Target range <b>${pct(lo)}–${pct(hi)}</b>. Banks won't lend below the floor or borrow above the ceiling, so the overnight rate settles around <b>${pct(ff)}</b>. (Drag here or the dial.)`;
}

/* ===== RIPPLE chain ===== */
function drawRipple(){const sv=$("#ripple"),W=480,r=ST.rate,tighten=r>NEUTRAL+0.1,ease=r<NEUTRAL-0.1;
  const chain=[['Rate',tighten?'up':ease?'down':'—'],['Loan cost',tighten?'up':ease?'down':'—'],['Buying',tighten?'down':ease?'up':'—'],['Spending',tighten?'down':ease?'up':'—'],['Inflation',tighten?'down':ease?'up':'—'],['Jobs',tighten?'down':ease?'up':'—']];
  const n=chain.length,bw=58,gap=(W-20-n*bw)/(n-1),y=54;let s="";
  chain.forEach((c,i)=>{const x=10+i*(bw+gap);const up=c[1]==='up',dn=c[1]==='down';
    const col=c[0]==='Jobs'? (dn?'var(--hot)':up?'var(--good)':'var(--mut)') : (dn?'var(--cold)':up?'var(--hot)':'var(--mut)');
    s+=`<rect x="${x}" y="${y}" width="${bw}" height="40" rx="7" fill="${col}" opacity="${c[1]==='—'?0.25:0.9}"/>`;
    s+=`<text x="${x+bw/2}" y="${y+18}" font-size="9.5" text-anchor="middle" fill="#fff">${c[0]}</text>`;
    s+=`<text x="${x+bw/2}" y="${y+33}" font-size="13" text-anchor="middle" fill="#fff">${c[1]==='up'?'▲':c[1]==='down'?'▼':'—'}</text>`;
    if(i<n-1){const ax=x+bw+2;s+=`<text x="${(ax+gap/2-2).toFixed(1)}" y="${y+26}" font-size="13" text-anchor="middle" fill="var(--mut)">→</text>`;}
  });
  sv.innerHTML=s;
  $("#capRipple").innerHTML=tighten?`Tightening: dearer loans → less buying → less spending → <b class="cold">inflation falls</b>, but <b class="hot">jobs are hit</b>.`:ease?`Easing: cheaper loans → more buying → more spending → <b class="hot">inflation rises</b>, and <b class="good">jobs grow</b>.`:`At neutral (~3%) the chain is balanced — nudge the dial to push it.`;
}

/* ===== HISTORY ===== */
const HY=[2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];
const HRATE={2015:0.25,2016:0.55,2017:1.1,2018:2.25,2019:1.75,2020:0.25,2021:0.1,2022:4.3,2023:5.3,2024:4.6};
const HINFL={2015:0.1,2016:1.3,2017:2.1,2018:2.4,2019:1.8,2020:1.2,2021:4.7,2022:7.0,2023:4.1,2024:2.9};
let histYear=2022;
function drawHist(){const sv=$("#hist"),W=1040,L=46,R=20,T=16,B=28,pw=W-L-R,ph=230-T-B;
  const x=y=>L+(y-2015)/(2024-2015)*pw,mx=8,yv=v=>T+ph*(1-v/mx);
  let s="";
  for(let v=0;v<=8;v+=2)s+=`<line x1="${L}" y1="${yv(v).toFixed(1)}" x2="${W-R}" y2="${yv(v).toFixed(1)}" stroke="var(--faint)"/><text x="${L-6}" y="${(yv(v)+3).toFixed(1)}" font-size="9.5" text-anchor="end" fill="var(--mut)" font-family="var(--mono)">${v}%</text>`;
  s+=`<line x1="${L}" y1="${yv(2).toFixed(1)}" x2="${W-R}" y2="${yv(2).toFixed(1)}" stroke="var(--good)" stroke-dasharray="5 4"/><text x="${W-R}" y="${(yv(2)-5).toFixed(1)}" font-size="9.5" text-anchor="end" fill="var(--good)">2% goal</text>`;
  HY.forEach(y=>s+=`<text x="${x(y).toFixed(1)}" y="${T+ph+15}" font-size="9.5" text-anchor="middle" fill="var(--mut)">${y}</text>`);
  const line=(D,col)=>{let d="";HY.forEach((y,i)=>d+=(i?"L":"M")+x(y).toFixed(1)+" "+yv(D[y]).toFixed(1)+" ");return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.6"/>`+HY.map(y=>`<circle cx="${x(y).toFixed(1)}" cy="${yv(D[y]).toFixed(1)}" r="2.4" fill="${col}"/>`).join("");};
  s+=line(HINFL,'var(--hot)')+line(HRATE,'var(--fed)');
  s+=`<text x="${x(2024)-4}" y="${(yv(HRATE[2024])-7).toFixed(1)}" font-size="10" text-anchor="end" fill="var(--fed)">fed funds</text>`;
  s+=`<text x="${x(2022)+4}" y="${(yv(HINFL[2022])-7).toFixed(1)}" font-size="10" fill="var(--hot)">inflation</text>`;
  const cx=x(histYear);s+=`<g class="hcur" style="cursor:ew-resize"><line x1="${cx.toFixed(1)}" y1="${T}" x2="${cx.toFixed(1)}" y2="${T+ph}" stroke="var(--ink)" stroke-width="1.5"/></g>`;
  sv.innerHTML=s;
  const notes={2020:'COVID hits — the Fed cuts to 0–0.25%.',2021:'Rates held near zero all year (no changes).',2022:'Inflation ~7% vs the 2% goal — the Fed hikes 7 times.',2023:'Rates peak (~5.3%) as inflation cools.'};
  $("#capHist").innerHTML=`In <b>${histYear}</b>: fed funds ≈ <b>${pct(HRATE[histYear])}</b>, inflation ≈ <b>${pct(HINFL[histYear])}</b>. ${notes[histYear]||'The two move together — hikes chase inflation, with a lag.'}`;
}

/* ===== OMO ===== */
let omo=0; // -100 sell .. +100 buy
function drawOmo(){const sv=$("#omo"),W=480,cx=W/2,y=66;
  const buy=omo>5,sell=omo<-5;let s="";
  s+=`<text x="${cx}" y="22" font-size="12" text-anchor="middle" fill="var(--ink)">Fed balance sheet</text>`;
  // reserves bar grows with buy
  const base=120,extra=omo/100*120,bw=base+extra;
  s+=`<rect x="${(cx-bw/2).toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="34" rx="6" fill="${buy?'var(--good)':sell?'var(--hot)':'var(--mut)'}" opacity=".85"/>`;
  s+=`<text x="${cx}" y="${y+22}" font-size="12" text-anchor="middle" fill="#fff" font-family="var(--mono)">bank reserves</text>`;
  // slider
  s+=`<line x1="60" y1="130" x2="${W-60}" y2="130" stroke="var(--faint)" stroke-width="4" stroke-linecap="round"/>`;
  s+=`<text x="60" y="146" font-size="9.5" fill="var(--hot)">◀ sell bonds</text><text x="${W-60}" y="146" font-size="9.5" text-anchor="end" fill="var(--good)">buy bonds ▶</text>`;
  const hx=cx+omo/100*((W-120)/2);
  s+=`<g class="oknob" style="cursor:ew-resize"><circle cx="${hx.toFixed(1)}" cy="130" r="9" fill="var(--ink)"/></g>`;
  sv.innerHTML=s;
  $("#capOmo").innerHTML=buy?`Buying bonds: the Fed pays banks (money it <b>creates electronically</b>) → reserves rise → banks can <b class="good">lend more</b> → downward pressure on rates.`:sell?`Selling bonds: banks pay the Fed → reserves fall → <b class="hot">less lending</b> → upward pressure on rates.`:`Neutral. Slide to buy bonds (ease) or sell (tighten) — the tool used heavily during COVID.`;
}

/* ===== FOMC seats ===== */
let fomcView='all';
function drawFomc(){const sv=$("#fomc"),W=480;
  // 7 governors (gov), NY Fed (always votes), 11 other regional (4 rotate)
  const seats=[];for(let i=0;i<7;i++)seats.push({k:'gov',v:true});
  seats.push({k:'ny',v:true});
  for(let i=0;i<11;i++)seats.push({k:'reg',v:i<4}); // 4 rotating voters (illustrative)
  const cols=19,r=9,gapx=(W-20)/cols,y=40;let s="",voters=0;
  seats.forEach((st,i)=>{const x=14+i*gapx;const isVoter=st.v;if(isVoter)voters++;
    const show=fomcView==='all'||isVoter;
    const fill=st.k==='gov'?'var(--gov)':st.k==='ny'?'var(--fed)':'var(--cold)';
    s+=`<circle cx="${x.toFixed(1)}" cy="${y}" r="${r}" fill="${show?fill:'#ddd'}" opacity="${show?0.95:0.3}"/>`;
    if(fomcView==='vote'&&isVoter)s+=`<text x="${x.toFixed(1)}" y="${y+3}" font-size="8" text-anchor="middle" fill="#fff">✓</text>`;
  });
  s+=`<text x="14" y="72" font-size="9.5" fill="var(--gov)">● 7 governors</text><text x="150" y="72" font-size="9.5" fill="var(--fed)">● NY Fed</text><text x="250" y="72" font-size="9.5" fill="var(--cold)">● regional (4 rotate)</text>`;
  sv.innerHTML=s;
  $("#capFomc").innerHTML=fomcView==='vote'?`<b>12 vote</b>: all 7 governors + the NY Fed president + 4 rotating regional presidents.`:`<b>19 in the room</b>, but only <b>12 vote</b> on the rate. Tap “the 12 voters”.`;
}

/* ===== wiring ===== */
function setRate(r){ST.rate=clamp(r,0,8);refreshScrub();drawHero();drawCorr();drawRipple();}
function refreshScrub(){document.querySelectorAll('.scrub').forEach(el=>{if(el.dataset.s==='rate')el.textContent=pct(ST.rate);});}
// hero knob + axis
(function(){const sv=$("#hero");let on=false;const rAt=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;return (X-60)/(1040-120)*8;};
  sv.addEventListener("pointerdown",e=>{if(!e.target.closest('.knob')&&e.clientY){/* allow knob or near-axis */}on=true;sv.setPointerCapture(e.pointerId);setRate(Math.round(rAt(e.clientX)*100)/100);});
  sv.addEventListener("pointermove",e=>{if(on)setRate(Math.round(rAt(e.clientX)*100)/100);});
  sv.addEventListener("pointerup",()=>on=false);sv.addEventListener("pointercancel",()=>on=false);})();
// corridor drag (vertical → rate)
(function(){const sv=$("#corr");let on=false;const rAt=cy=>{const p=sv.createSVGPoint();p.y=cy;p.x=0;const Y=p.matrixTransform(sv.getScreenCTM().inverse()).y;const mn=Math.max(0,ST.rate-1.2),mx=ST.rate+1.2;return mn+(1-(Y-20)/(150-46))*(mx-mn);};
  sv.addEventListener("pointerdown",e=>{if(!e.target.closest('.grab'))return;on=true;sv.setPointerCapture(e.pointerId);setRate(Math.round(rAt(e.clientY)*100)/100);});
  sv.addEventListener("pointermove",e=>{if(on)setRate(Math.round(rAt(e.clientY)*100)/100);});sv.addEventListener("pointerup",()=>on=false);})();
// history scrub
(function(){const sv=$("#hist");let on=false;const yAt=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;return 2015+(X-46)/(1040-66)*(2024-2015);};
  const set=e=>{histYear=clamp(Math.round(yAt(e.clientX)),2015,2024);drawHist();};
  sv.addEventListener("pointerdown",e=>{on=true;sv.setPointerCapture(e.pointerId);set(e);});sv.addEventListener("pointermove",e=>{if(on)set(e);});sv.addEventListener("pointerup",()=>on=false);})();
// omo knob
(function(){const sv=$("#omo");let on=false;const vAt=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;return clamp((X-240)/((480-120)/2)*100,-100,100);};
  sv.addEventListener("pointerdown",e=>{on=true;sv.setPointerCapture(e.pointerId);omo=Math.round(vAt(e.clientX));drawOmo();});sv.addEventListener("pointermove",e=>{if(on){omo=Math.round(vAt(e.clientX));drawOmo();}});sv.addEventListener("pointerup",()=>on=false);})();
$("#fomcSeg").onclick=e=>{const v=e.target.dataset.v;if(!v)return;[...e.currentTarget.children].forEach(b=>b.classList.toggle('on',b===e.target));fomcView=v;drawFomc();};
// rate text scrub
const SBmap={rate:{s:0.02}};
function SB(id,t){return `<span class="scrub" data-s="${id}">${t}</span>`;}
let ps=null;
document.addEventListener("pointerdown",e=>{const t=e.target.closest(".scrub");if(!t)return;e.preventDefault();t.classList.add("drag");ps={x:e.clientX,v:ST.rate,el:t};t.setPointerCapture(e.pointerId);});
document.addEventListener("pointermove",e=>{if(!ps)return;setRate(Math.round((ps.v+(e.clientX-ps.x)*0.02)*100)/100);});
document.addEventListener("pointerup",()=>{if(ps){ps.el.classList.remove("drag");ps=null;}});
window.__FED={ST,inflAt,unempAt,get histYear(){return histYear},get omo(){return omo}};
setRate(4.5);drawHist();drawOmo();drawFomc();
