
"use strict";
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const inflAt=o=>3.1-0.9*(o-2.25);
const unempAt=o=>5.3+0.6*(o-2.25);
let ocr=2.25, phase=0; const visited=new Set();
// dream corner
const DREAM={infl:[1.4,2.2], un:[4.0,5.0]};

/* dial */
function drawDial(){const sv=$("#dial"),W=620,L=46,R=46,y=40,x=v=>L+v/6*(W-L-R);let s="";
  s+=`<text x="${L}" y="16" font-size="12" fill="var(--mut)">cash rate (OCR)</text>`;
  s+=`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="var(--faint)" stroke-width="4" stroke-linecap="round"/>`;
  for(let v=0;v<=6;v++)s+=`<text x="${x(v).toFixed(1)}" y="${y+20}" font-size="10" text-anchor="middle" fill="var(--mut)" font-family="var(--mono)">${v}%</text>`;
  s+=`<g class="knob" style="cursor:ew-resize"><circle cx="${x(ocr).toFixed(1)}" cy="${y}" r="12" fill="var(--acc)"/><text x="${x(ocr).toFixed(1)}" y="${y-18}" font-size="13" text-anchor="middle" font-weight="700" fill="var(--acc)" font-family="var(--mono)">${ocr.toFixed(2)}%</text></g>`;
  sv.innerHTML=s;}

/* trade-off plot: x=inflation, y=unemployment (up = higher) */
function drawPlot(){const sv=$("#plot"),W=620,L=54,R=20,T=22,B=40,pw=W-L-R,ph=300-T-B;
  const xi=[0,6],yu=[3.5,7.5];
  const X=v=>L+(v-xi[0])/(xi[1]-xi[0])*pw, Y=v=>T+ph*(1-(v-yu[0])/(yu[1]-yu[0]));
  let s="";
  // grid + axes
  for(let v=0;v<=6;v+=1)s+=`<line x1="${X(v).toFixed(1)}" y1="${T}" x2="${X(v).toFixed(1)}" y2="${T+ph}" stroke="var(--faint)"/>`;
  for(let v=4;v<=7;v++)s+=`<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}" stroke="var(--faint)"/><text x="${L-6}" y="${(Y(v)+3).toFixed(1)}" font-size="9.5" text-anchor="end" fill="var(--mut)" font-family="var(--mono)">${v}%</text>`;
  for(let v=0;v<=6;v+=2)s+=`<text x="${X(v).toFixed(1)}" y="${T+ph+15}" font-size="9.5" text-anchor="middle" fill="var(--mut)" font-family="var(--mono)">${v}%</text>`;
  s+=`<text x="${X(3).toFixed(1)}" y="${T+ph+30}" font-size="11" text-anchor="middle" fill="var(--ink)">inflation →</text>`;
  s+=`<text x="14" y="${(T+ph/2).toFixed(1)}" font-size="11" text-anchor="middle" fill="var(--ink)" transform="rotate(-90 14 ${(T+ph/2).toFixed(1)})">unemployment →</text>`;
  // 2% target line
  s+=`<line x1="${X(2).toFixed(1)}" y1="${T}" x2="${X(2).toFixed(1)}" y2="${T+ph}" stroke="var(--good)" stroke-dasharray="4 3"/><text x="${X(2).toFixed(1)}" y="${T-6}" font-size="9.5" text-anchor="middle" fill="var(--good)">2% target</text>`;
  // dream box (bottom-left = low both)
  const dx=X(DREAM.infl[0]),dx2=X(DREAM.infl[1]),dy=Y(DREAM.un[1]),dy2=Y(DREAM.un[0]);
  s+=`<rect x="${Math.min(dx,dx2).toFixed(1)}" y="${dy.toFixed(1)}" width="${Math.abs(dx2-dx).toFixed(1)}" height="${Math.abs(dy2-dy).toFixed(1)}" fill="${phase>=2?'var(--hot)':'var(--good)'}" opacity="${phase>=2?.10:.14}" stroke="${phase>=2?'var(--hot)':'var(--good)'}" stroke-dasharray="5 4"/>`;
  s+=`<text x="${((dx+dx2)/2).toFixed(1)}" y="${(dy-7).toFixed(1)}" font-size="10" text-anchor="middle" fill="${phase>=2?'var(--hot)':'var(--good)'}" font-weight="700">${phase>=2?'✗ unreachable':'the dream'}</text>`;
  s+=`<text x="${((dx+dx2)/2).toFixed(1)}" y="${(dy2+13).toFixed(1)}" font-size="8.5" text-anchor="middle" fill="var(--mut)">low inflation + low unemployment</text>`;
  // attainable line (sweep o 0..6)
  let d="";for(let o=0;o<=6.001;o+=0.25)d+=(d?"L":"M")+X(clamp(inflAt(o),0,6)).toFixed(1)+" "+Y(clamp(unempAt(o),3.5,7.5)).toFixed(1)+" ";
  s+=`<path d="${d}" fill="none" stroke="var(--mut)" stroke-width="${phase>=2?2.4:1.6}" opacity="${phase>=2?0.9:0.45}"/>`;
  if(phase>=2)s+=`<text x="${X(inflAt(4.5)).toFixed(1)}" y="${(Y(unempAt(4.5))-8).toFixed(1)}" font-size="9.5" fill="var(--mut)" transform="rotate(-24 ${X(inflAt(4.5)).toFixed(1)} ${Y(unempAt(4.5)).toFixed(1)})">every rate lands on THIS line</text>`;
  // visited dots
  visited.forEach(o=>{const ov=+o;s+=`<circle cx="${X(clamp(inflAt(ov),0,6)).toFixed(1)}" cy="${Y(clamp(unempAt(ov),3.5,7.5)).toFixed(1)}" r="2.4" fill="var(--acc)" opacity=".34"/>`;});
  // current point
  const cx=X(clamp(inflAt(ocr),0,6)),cy=Y(clamp(unempAt(ocr),3.5,7.5));
  s+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="var(--acc)"/><text x="${cx.toFixed(1)}" y="${(cy-12).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="var(--acc)" font-family="var(--mono)">you</text>`;
  sv.innerHTML=s;}

function step(n,t,done){$("#stepN").textContent=n;$("#stepT").innerHTML=t;$("#step").classList.toggle('done',!!done);}
// callout stays PERMANENTLY live — recomputed from the current rate on every drag
function renderA(){const infl=inflAt(ocr),un=unempAt(ocr);$("#calloutA").style.display='block';
  $("#calloutA").className='callout';$("#calloutA").innerHTML=`<span class="lbl">⚡ notice</span>Right now: inflation <b>${infl.toFixed(1)}%</b>, unemployment <b>${un.toFixed(1)}%</b>. Push inflation down toward the 2% target and unemployment climbs (from 5.3%) — you can't lower one without raising the other.`;}
function reveal(){phase=2;
  $("#calloutB").style.display='block';$("#calloutB").className='callout reveal';
  $("#calloutB").innerHTML=`<span class="lbl">✦ the point</span>See the dashed corner you were aiming for? <b>No setting of the dial ever lands inside it.</b> Every rate puts you somewhere on the same diagonal line — choose less inflation and you buy more unemployment, and vice-versa. The Reserve Bank can pick a <b>point on the line</b>; it cannot leave the line.`;
  $("#takeaway").className='takeaway lit';
  $("#takeaway").innerHTML=`<b>What you just learned:</b> the cash rate doesn't set inflation and unemployment independently — it <b>slides you along a trade-off</b>. "Low inflation AND low unemployment" isn't a setting that exists. Every rate decision is really a choice about <b>which one to hurt less right now</b> — which is exactly why the call is so contested.`;
  step('✓','You found it — the trade-off line, and the corner you can\'t reach.',true);}

function draw(){drawDial();drawPlot();const infl=inflAt(ocr),un=unempAt(ocr);
  $("#rInfl").textContent=infl.toFixed(1)+'%';$("#rInfl").style.color=Math.abs(infl-2)<.4?'var(--good)':infl>3?'var(--hot)':'var(--cold)';
  $("#rUn").textContent=un.toFixed(1)+'%';$("#rUn").style.color=un>5.8?'var(--hot)':'var(--ink)';
  if(phase>=1) renderA();}

function setOcr(o){ocr=clamp(o,0,6);visited.add(ocr.toFixed(2));
  // phase logic
  if(phase===0 && Math.abs(inflAt(ocr)-2)<0.12){phase=1;step(2,'Inflation\'s at target. <b>Now try to ALSO get unemployment under 5%</b> — drag anywhere you like.');}
  if(phase>=1 && phase<2){const vals=[...visited].map(Number),span=Math.max(...vals)-Math.min(...vals);
    if(span>=2.0) reveal();}
  draw();}

(function(){const sv=$("#dial");let on=false;const at=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;return (p.matrixTransform(sv.getScreenCTM().inverse()).x-46)/(620-92)*6;};
  sv.addEventListener("pointerdown",e=>{on=true;sv.setPointerCapture(e.pointerId);setOcr(Math.round(at(e.clientX)*20)/20);});
  sv.addEventListener("pointermove",e=>{if(on)setOcr(Math.round(at(e.clientX)*20)/20);});
  sv.addEventListener("pointerup",()=>on=false);sv.addEventListener("pointercancel",()=>on=false);})();
window.__G={get ocr(){return ocr},get phase(){return phase},inflAt,unempAt,reveal,setOcr};
draw();
