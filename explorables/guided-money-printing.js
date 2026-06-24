
"use strict";
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let print=0, produce=0, phase=0; let movedPrint=false;
// base economy
const W0=100, B0=4, L0=25;
const wallet=()=>W0*(1+print/100);
const bread=()=>B0*(1+print/100)/(1+produce/100);
const loaves=()=>wallet()/bread();           // = 25*(1+produce/100) — independent of printing
const inflation=()=>print-produce;
const money=v=>"$"+v.toFixed(v<10?2:0);

/* controls: two sliders */
function drawControls(){const sv=$("#controls"),W=620,L=200,R=40,pw=W-L-R;
  const xP=v=>L+v/100*pw, xQ=v=>L+v/6*pw;let s="";
  s+=`<text x="20" y="34" font-size="13" fill="var(--money)" font-weight="700">Print money</text><text x="20" y="49" font-size="10.5" fill="var(--mut)">new money created /yr</text>`;
  s+=`<line x1="${L}" y1="38" x2="${W-R}" y2="38" stroke="var(--faint)" stroke-width="5" stroke-linecap="round"/>`;
  s+=`<rect x="${L}" y="35.5" width="${(xP(print)-L).toFixed(1)}" height="5" rx="2.5" fill="var(--money)"/>`;
  s+=`<g class="kP" style="cursor:ew-resize"><circle cx="${xP(print).toFixed(1)}" cy="38" r="11" fill="var(--money)"/></g>`;
  s+=`<text x="${W-R}" y="22" font-size="13" text-anchor="end" font-family="var(--mono)" font-weight="700" fill="var(--money)">+${print.toFixed(0)}%</text>`;
  s+=`<text x="20" y="92" font-size="13" fill="var(--bread)" font-weight="700">Produce goods</text><text x="20" y="107" font-size="10.5" fill="var(--mut)">real output growth /yr</text>`;
  s+=`<line x1="${L}" y1="96" x2="${W-R}" y2="96" stroke="var(--faint)" stroke-width="5" stroke-linecap="round"/>`;
  s+=`<rect x="${L}" y="93.5" width="${(xQ(produce)-L).toFixed(1)}" height="5" rx="2.5" fill="var(--bread)"/>`;
  s+=`<g class="kQ" style="cursor:ew-resize"><circle cx="${xQ(produce).toFixed(1)}" cy="96" r="11" fill="var(--bread)"/></g>`;
  s+=`<text x="${W-R}" y="80" font-size="13" text-anchor="end" font-family="var(--mono)" font-weight="700" fill="var(--bread)">+${produce.toFixed(1)}%</text>`;
  sv.innerHTML=s;}

/* result: wallet, bread price, loaves meter */
function drawResult(){const sv=$("#result"),W=620;let s="";
  const wl=wallet(),br=bread(),lo=loaves(),inf=inflation();
  // wallet bar (nominal)
  const barX=170,barW=W-barX-120,wMax=220;
  s+=`<text x="20" y="34" font-size="13" fill="var(--ink)">Your wallet</text><text x="20" y="49" font-size="10.5" fill="var(--mut)">(the number)</text>`;
  s+=`<rect x="${barX}" y="22" width="${(wl/wMax*barW).toFixed(1)}" height="20" rx="4" fill="var(--money)" opacity=".85"/>`;
  s+=`<text x="${(barX+wl/wMax*barW+8).toFixed(1)}" y="37" font-size="14" font-family="var(--mono)" font-weight="700" fill="var(--money)">${money(wl)}</text>`;
  // bread price bar
  const pMax=9;
  s+=`<text x="20" y="84" font-size="13" fill="var(--ink)">Price of a loaf</text>`;
  s+=`<rect x="${barX}" y="72" width="${(br/pMax*barW).toFixed(1)}" height="20" rx="4" fill="var(--bread)" opacity=".85"/>`;
  s+=`<text x="${(barX+br/pMax*barW+8).toFixed(1)}" y="87" font-size="14" font-family="var(--mono)" font-weight="700" fill="var(--bread)">${money(br)}</text>`;
  // loaves meter (the punchline)
  s+=`<line x1="20" y1="116" x2="${W-20}" y2="116" stroke="var(--faint)"/>`;
  s+=`<text x="20" y="146" font-size="15" font-weight="700" fill="var(--ink)">Loaves you can actually afford</text>`;
  const lMax=32,mX=20,mW=W-40,mY=158;
  s+=`<rect x="${mX}" y="${mY}" width="${mW}" height="26" rx="6" fill="var(--faint)"/>`;
  const over=lo>L0+0.4;
  s+=`<rect x="${mX}" y="${mY}" width="${(lo/lMax*mW).toFixed(1)}" height="26" rx="6" fill="${over?'var(--good)':'var(--cold)'}"/>`;
  // baseline at 25
  const bx=mX+L0/lMax*mW;
  s+=`<line x1="${bx.toFixed(1)}" y1="${mY-6}" x2="${bx.toFixed(1)}" y2="${mY+32}" stroke="var(--ink)" stroke-dasharray="3 3"/><text x="${bx.toFixed(1)}" y="${mY+46}" font-size="10" text-anchor="middle" fill="var(--mut)">where you started: 25</text>`;
  s+=`<text x="${(mX+lo/lMax*mW+8).toFixed(1)}" y="${mY+18}" font-size="16" font-family="var(--mono)" font-weight="700" fill="#fff">${lo.toFixed(1)}</text>`;
  // inflation chip
  const ic=inf>20?'var(--hot)':inf>5?'var(--gold)':inf<-0.5?'var(--cold)':'var(--good)';
  s+=`<text x="${W-20}" y="146" font-size="12" text-anchor="end" fill="var(--mut)">inflation <tspan font-family="var(--mono)" font-weight="700" fill="${ic}">${inf>=0?'+':''}${inf.toFixed(1)}%</tspan>${inf>20?' ⚠ hyperinflation':''}</text>`;
  sv.innerHTML=s;}

function step(n,t,done){$("#stepN").textContent=n;$("#stepT").innerHTML=t;$("#step").classList.toggle('done',!!done);}
// callouts stay PERMANENTLY live — recomputed from current state on every drag
function renderA(){$("#calloutA").style.display='block';$("#calloutA").className='callout';
  $("#calloutA").innerHTML=`<span class="lbl">⚡ notice</span>Your wallet is now <b>${money(wallet())}</b> and a loaf is <b>${money(bread())}</b> — they ballooned together, so <b>inflation is +${inflation().toFixed(0)}%</b>. The price rose right alongside your money: that's the catch.`;}
function renderB(){$("#calloutB").style.display='block';$("#calloutB").className='callout reveal';
  $("#calloutB").innerHTML=`<span class="lbl">✦ the point</span>You can afford <b>${loaves().toFixed(1)} loaves</b>. Printing (+${print.toFixed(0)}%) moved your wallet <em>and</em> the loaf by the same amount, so loaves barely shifted from 25 — only the <b>+${produce.toFixed(1)}%</b> you actually <b>produced</b> lifted them.`;}
function litTakeaway(){$("#takeaway").className='takeaway lit';
  $("#takeaway").innerHTML=`<b>What you just learned:</b> money is a <b>claim on goods</b>, not wealth itself. Print more claims without more goods and each one simply buys less — that's inflation, the “money illusion.” You can't print prosperity; only <b>making more stuff</b> (output, productivity) raises what people can actually afford. That's why “just print money” is never free.`;}

function setState(){drawControls();drawResult();
  if(phase===0 && movedPrint && print>=40){phase=1;step(2,'Your wallet ballooned — but can you buy more? <b>Now drag the orange slider</b> to <b>produce</b> more goods.');}
  if(phase>=1 && phase<2 && produce>=1.5){phase=2;litTakeaway();step('✓','You found it — printing fills wallets, not stomachs. Only producing does that.',true);}
  if(phase>=1) renderA();
  if(phase>=2) renderB();}

(function(){const sv=$("#controls");let on=null;const pt=e=>{const p=sv.createSVGPoint();p.x=e.clientX;p.y=0;return p.matrixTransform(sv.getScreenCTM().inverse()).x;};
  const L=200,R=40,W=620,pw=W-L-R;
  sv.addEventListener("pointerdown",e=>{if(e.target.closest('.kP'))on='P';else if(e.target.closest('.kQ'))on='Q';else return;sv.setPointerCapture(e.pointerId);});
  sv.addEventListener("pointermove",e=>{if(!on)return;const f=clamp((pt(e)-L)/pw,0,1);if(on==='P'){print=Math.round(f*100);movedPrint=true;}else produce=Math.round(f*6*10)/10;setState();});
  sv.addEventListener("pointerup",()=>on=null);sv.addEventListener("pointercancel",()=>on=null);})();
window.__P={get print(){return print},get produce(){return produce},get phase(){return phase},loaves,bread,wallet,inflation,
  set:(p,q)=>{print=p;produce=q;movedPrint=true;setState();}};
drawControls();drawResult();
