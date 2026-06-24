
"use strict";
const $=s=>document.querySelector(s);
const wk=n=>n+(n===1?" wk":" wks");
const cash=k=>k>=1000?"$"+(k/1000).toFixed(2)+"M":"$"+Math.round(k)+"k";
const T=[
  {id:'survey',name:'Survey',dur:2,rate:8,deps:[]},
  {id:'concept',name:'Concept design',dur:3,rate:12,deps:['survey']},
  {id:'detail',name:'Detailed design',dur:4,rate:18,deps:['concept']},
  {id:'consent',name:'Council consent',dur:6,rate:5,deps:['detail']},
  {id:'procure',name:'Procurement',dur:3,rate:10,deps:['detail']},
  {id:'earth',name:'Earthworks',dur:4,rate:30,deps:['consent','procure']},
  {id:'services',name:'Services',dur:3,rate:22,deps:['earth']},
  {id:'handover',name:'Handover',dur:1,rate:6,deps:['services']},
];
window.__N={T,cpm};
function cpm(){const EF={},ES={},LS={},LF={};
  for(const t of T){ES[t.id]=t.deps.length?Math.max(...t.deps.map(d=>EF[d])):0;EF[t.id]=ES[t.id]+t.dur;}
  const finish=Math.max(...T.map(t=>EF[t.id]));
  const succ={};T.forEach(t=>succ[t.id]=[]);T.forEach(t=>t.deps.forEach(d=>succ[d].push(t.id)));
  for(let i=T.length-1;i>=0;i--){const t=T[i];LF[t.id]=succ[t.id].length?Math.min(...succ[t.id].map(s=>LS[s])):finish;LS[t.id]=LF[t.id]-t.dur;}
  const m={};T.forEach(t=>m[t.id]={...t,cost:t.dur*t.rate,slack:LS[t.id]-ES[t.id],crit:(LS[t.id]-ES[t.id])<=0});
  return {m,finish,cost:T.reduce((a,t)=>a+t.dur*t.rate,0),critNames:T.filter(t=>m[t.id].crit).map(t=>t.name)};
}
const rank={};for(const t of T)rank[t.id]=t.deps.length?Math.max(...t.deps.map(d=>rank[d]))+1:0;
const maxR=Math.max(...Object.values(rank)),byRank={};
T.forEach(t=>{(byRank[rank[t.id]]=byRank[rank[t.id]]||[]).push(t.id);});
const W=900,Lm=20,Rm=20,NW=104,NH=46,midY=168,posX={},posY={};
T.forEach(t=>posX[t.id]=Lm+(maxR?rank[t.id]/maxR:0)*(W-Lm-Rm-NW));
Object.values(byRank).forEach(ids=>ids.forEach((id,k)=>posY[id]=midY+(k-(ids.length-1)/2)*86));
const hx=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const lerp=(a,b,t)=>{const A=hx(a),B=hx(b);return`rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')})`;};

function draw(){
  const k=cpm(),costs=T.map(t=>k.m[t.id].cost),cmin=Math.min(...costs),cmax=Math.max(...costs);
  const topId=T.reduce((a,b)=>k.m[b.id].cost>k.m[a.id].cost?b:a).id;
  let s="";
  // edges — critical path flows (steady, never flashes)
  T.forEach(t=>t.deps.forEach(d=>{const p=k.m[d],x1=posX[d]+NW,y1=posY[d],x2=posX[t.id],y2=posY[t.id],mx=(x1+x2)/2,red=p.crit&&k.m[t.id].crit;
    s+=`<path class="${red?'flow':''}" d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${(x2-7)} ${y2}" fill="none" stroke="${red?'var(--crit)':'var(--dep)'}" stroke-width="${red?2.6:1.5}"/>`+
       `<path d="M ${(x2-7)} ${(y2-4)} L ${x2} ${y2} L ${(x2-7)} ${(y2+4)} Z" fill="${red?'var(--crit)':'var(--dep)'}"/>`;}));
  // nodes — colour = $ (static); biggest cost gets a static ring (no animation)
  T.forEach(t=>{const n=k.m[t.id],x=posX[t.id],y=posY[t.id]-NH/2,tc=(n.cost-cmin)/((cmax-cmin)||1),fill=lerp('#e7d4bd','#9e3a25',tc),ring=t.id===topId;
    s+=`<text x="${x+NW/2}" y="${y-9}" font-size="11.5" text-anchor="middle" fill="var(--ink)">${t.name}</text>`+
       `<g class="node" data-id="${t.id}" style="cursor:ew-resize"><rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="10" fill="${fill}" ${ring?'stroke="var(--ring)" stroke-width="2.5"':''}/>`+
       `<text x="${x+NW/2}" y="${y+21}" font-size="14" text-anchor="middle" font-family="var(--mono)" font-weight="680" fill="#fff" pointer-events="none">${cash(n.cost)}</text>`+
       `<text x="${x+NW/2}" y="${y+35}" font-size="9.5" text-anchor="middle" font-family="var(--mono)" fill="#ffffffcc" pointer-events="none">${n.dur}w · $${n.rate}/wk</text></g>`;});
  $("#net").innerHTML=s;
  // cost-led prose, but mentions the time bottleneck too (fusing both)
  const top=k.m[topId],longest=T.reduce((a,b)=>k.m[b.id].dur>k.m[a.id].dur?b:a),avg=T.reduce((a,t)=>a+t.rate,0)/T.length;
  $("#doc").innerHTML=`Total <span class="num">${cash(k.cost)}</span>, finishing <span class="num">week ${k.finish}</span>. `+
    `The money is in <span class="mon">${top.name}</span> (<span class="num">${cash(top.cost)}</span>). `+
    `But the schedule is set by <span class="crit">${k.m.consent.name}</span> — the longest task — which is ${longest.id==='consent'&&longest.rate<avg?`one of the <span class="mon">cheapest</span>: slow ≠ costly.`:`its own story.`}`;
  $("#note").textContent="No flashing — the only motion is the red bottleneck line flowing steadily, and it stops entirely if your system prefers reduced motion. Cost is shown by colour; the schedule bottleneck by the flowing path. Drag any task's weeks and both update.";
}
(function(){const sv=$("#net");let d=null;
  const ux=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;return p.matrixTransform(sv.getScreenCTM().inverse()).x;};
  sv.addEventListener("pointerdown",e=>{const n=e.target.closest(".node");if(!n)return;const t=T.find(x=>x.id===n.dataset.id);d={t,x0:ux(e.clientX),sd:t.dur};sv.setPointerCapture(e.pointerId);});
  sv.addEventListener("pointermove",e=>{if(!d)return;d.t.dur=Math.max(1,Math.round(d.sd+(ux(e.clientX)-d.x0)/22));draw();});
  sv.addEventListener("pointerup",()=>d=null);sv.addEventListener("pointercancel",()=>d=null);
})();
draw();
