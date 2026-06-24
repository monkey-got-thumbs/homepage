(function(){
const root=document.getElementById('c-waterfall'); const sv=document.getElementById('s-waterfall'); const cap=document.getElementById('cap-waterfall');
const plan=100;
const items=[{n:'Labor',v:+14},{n:'Materials',v:-6},{n:'Travel',v:+9},{n:'Tools',v:-3},{n:'Permits',v:+5}];
const X0=44,X1=312,Y0=14,Y1=120;
let drag=null;
function pt(e){const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(sv.getScreenCTM().inverse());}
function draw(){
while(sv.firstChild)sv.removeChild(sv.firstChild);
const n=items.length;
// cumulative levels
let cum=plan; const bars=[]; 
bars.push({type:'total',label:'Plan',base:0,top:plan});
for(let i=0;i<n;i++){const start=cum;cum+=items[i].v;bars.push({type:'c',i:i,from:start,to:cum,v:items[i].v});}
const actual=cum; bars.push({type:'total',label:'Actual',base:0,top:actual});
const maxv=Math.max(plan,actual,...bars.map(b=>b.type==='c'?Math.max(b.from,b.to):b.top))*1.08;
const Y=v=>Y1-(v/maxv)*(Y1-Y0);
const slot=(X1-X0)/(bars.length);
const bw=slot*0.62;
// baseline
const ax=document.createElementNS('http://www.w3.org/2000/svg','line');
ax.setAttribute('x1',X0-4);ax.setAttribute('x2',X1);ax.setAttribute('y1',Y1);ax.setAttribute('y2',Y1);ax.setAttribute('stroke','var(--faint)');sv.appendChild(ax);
let big=0;for(let i=0;i<n;i++)if(Math.abs(items[i].v)>Math.abs(items[big].v))big=i;
bars.forEach((b,bi)=>{
 const cx=X0+slot*bi+slot/2; const x=cx-bw/2;
 let yTop,yBot,col;
 if(b.type==='total'){yTop=Y(b.top);yBot=Y1;col=b.label==='Plan'?'var(--mut)':'var(--ink)';}
 else{const hi=Math.max(b.from,b.to),lo=Math.min(b.from,b.to);yTop=Y(hi);yBot=Y(lo);col=b.v>=0?'var(--c1)':'var(--c3)';}
 // connector
 if(bi>0){const prev=bars[bi-1];const lvl=prev.type==='total'?prev.top:prev.to;const cn=document.createElementNS('http://www.w3.org/2000/svg','line');cn.setAttribute('x1',X0+slot*(bi-1)+slot/2);cn.setAttribute('x2',cx);cn.setAttribute('y1',Y(lvl));cn.setAttribute('y2',Y(lvl));cn.setAttribute('stroke','var(--faint)');cn.setAttribute('stroke-dasharray','2 2');sv.appendChild(cn);}
 const r=document.createElementNS('http://www.w3.org/2000/svg','rect');
 r.setAttribute('x',x);r.setAttribute('y',yTop);r.setAttribute('width',bw);r.setAttribute('height',Math.max(1,yBot-yTop));
 r.setAttribute('fill',col);r.setAttribute('rx',1.5);
 if(b.type==='c'){r.style.cursor='ns-resize';if(b.i===big)r.setAttribute('stroke','var(--hot)'),r.setAttribute('stroke-width',1.6);r.addEventListener('pointerdown',ev=>{drag={i:b.i,maxv:maxv};r.setPointerCapture(ev.pointerId);ev.preventDefault();});r.addEventListener('pointermove',ev=>{if(!drag||drag.i!==b.i)return;const m=pt(ev);const sign=items[b.i].v>=0?1:-1;let nv=(Y1-m.y)/(Y1-Y0)*drag.maxv;nv=Math.max(0,Math.min(60,nv));items[b.i].v=sign*Math.round(nv);draw();});r.addEventListener('pointerup',ev=>{drag=null;});}
 sv.appendChild(r);
 const lb=document.createElementNS('http://www.w3.org/2000/svg','text');
 lb.setAttribute('x',cx);lb.setAttribute('y',Y1+11);lb.setAttribute('text-anchor','middle');lb.setAttribute('font-size','6.5');lb.setAttribute('fill','var(--mut)');
 lb.textContent=b.type==='total'?b.label:items[b.i].n;sv.appendChild(lb);
 const vt=document.createElementNS('http://www.w3.org/2000/svg','text');
 vt.setAttribute('x',cx);vt.setAttribute('y',yTop-2.5);vt.setAttribute('text-anchor','middle');vt.setAttribute('font-size','6.5');vt.setAttribute('fill','var(--ink)');
 vt.textContent=b.type==='total'?b.top:(b.v>=0?'+'+b.v:b.v);sv.appendChild(vt);
});
const diff=actual-plan;
cap.innerHTML='Biggest mover <b>'+items[big].n+' ('+(items[big].v>=0?'+':'')+items[big].v+')</b>; actual lands at '+actual+', <b>'+(diff>=0?diff+' over':Math.abs(diff)+' under')+'</b> plan.';
}
draw();
})();

/* ---- merged inline block ---- */
(function(){
const root=document.getElementById('c-bump'); const sv=document.getElementById('s-bump'); const cap=document.getElementById('cap-bump');
const Q=['Q1','Q2','Q3','Q4','Q5'];
const cols=['var(--c1)','var(--c2)','var(--c3)','var(--c4)'];
const names=['Alpha','Bravo','Cobra','Delta'];
// ranks[team][q] : 1=top..4=bottom
const ranks=[[1,1,2,3,2],[2,3,1,1,1],[3,2,3,2,4],[4,4,4,4,3]];
const N=4, M=5;
const L=34,R=300,T=22,B=120;
const xOf=i=>L+(R-L)*i/(M-1);
const yOf=r=>T+(B-T)*(r-1)/(N-1);
const rOf=y=>Math.max(1,Math.min(N,Math.round((y-T)/((B-T)/(N-1))+1)));
let drag=null, prev=JSON.parse(JSON.stringify(ranks));
function pt(e){const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const m=p.matrixTransform(sv.getScreenCTM().inverse());return m;}
function svgEl(t,a){const e=document.createElementNS('http://www.w3.org/2000/svg',t);for(const k in a)e.setAttribute(k,a[k]);return e;}
function overtakes(){
// compare current vs prev: who moved past whom across whole timeline (final standings vs prior snapshot)
const msgs=[];
for(let q=0;q<M;q++){
for(let a=0;a<N;a++)for(let b=a+1;b<N;b++){
const wasA=prev[a][q],wasB=prev[b][q],nowA=ranks[a][q],nowB=ranks[b][q];
if((wasA<wasB)!==(nowA<nowB)){
const lead = nowA<nowB?a:b, beh=nowA<nowB?b:a;
msgs.push(names[lead]+' overtook '+names[beh]+' in '+Q[q]);
}
}
}
return msgs;
}
function draw(){
while(sv.firstChild)sv.removeChild(sv.firstChild);
// rank gridlines + labels
for(let r=1;r<=N;r++){
sv.appendChild(svgEl('line',{x1:L,y1:yOf(r),x2:R,y2:yOf(r),stroke:'var(--faint)','stroke-width':1}));
sv.appendChild(svgEl('text',{x:L-8,y:yOf(r)+3,'text-anchor':'end','font-size':8,fill:'var(--mut)'})).textContent='#'+r;
}
Q.forEach((q,i)=>{const t=svgEl('text',{x:xOf(i),y:B+13,'text-anchor':'middle','font-size':8,fill:'var(--mut)'});t.textContent=q;sv.appendChild(t);});
// lines per team
for(let t=0;t<N;t++){
let d='';
for(let q=0;q<M;q++){d+=(q?'L':'M')+xOf(q)+' '+yOf(ranks[t][q]);}
sv.appendChild(svgEl('path',{d:d,fill:'none',stroke:cols[t],'stroke-width':2.4,'stroke-linejoin':'round','stroke-linecap':'round',opacity:0.9}));
}
// points (handles)
for(let t=0;t<N;t++)for(let q=0;q<M;q++){
const c=svgEl('circle',{cx:xOf(q),cy:yOf(ranks[t][q]),r:5,fill:cols[t],stroke:'var(--ink)','stroke-width':drag&&drag.t===t&&drag.q===q?1.8:0.6,style:'cursor:ns-resize'});
c.addEventListener('pointerdown',ev=>{ev.preventDefault();drag={t,q};c.setPointerCapture(ev.pointerId);draw();});
c.addEventListener('pointermove',ev=>{if(!drag||drag.t!==t||drag.q!==q)return;const m=pt(ev);ranks[t][q]=rOf(m.y);draw();});
c.addEventListener('pointerup',ev=>{if(drag){drag=null;c.releasePointerCapture(ev.pointerId);draw();}});
sv.appendChild(c);
}
// team labels at last quarter
for(let t=0;t<N;t++){
const tx=svgEl('text',{x:R+3,y:yOf(ranks[t][M-1])+3,'font-size':8,fill:cols[t]});tx.textContent=names[t];sv.appendChild(tx);
}
// caption
const ms=overtakes();
if(ms.length){cap.innerHTML='<b>'+ms[0]+'</b>'+(ms.length>1?' (+'+(ms.length-1)+' more swap'+(ms.length>2?'s':'')+')':'');}
else{const lead=ranks.findIndex(r=>r[M-1]===1);cap.innerHTML='<b>'+names[lead]+'</b> leads after '+Q[M-1]+' — drag a dot to reshuffle ranks';}
}
draw();
})();

/* ---- merged inline block ---- */
(function(){
const root=document.getElementById('c-slope'); const sv=document.getElementById('s-slope'); const cap=document.getElementById('cap-slope');
const items=[{n:"Latency",a:120,b:65},{n:"Cost",a:80,b:95},{n:"Errors",a:45,b:18},{n:"Churn",a:30,b:52},{n:"Backlog",a:70,b:40}];
const cols=["--c1","--c2","--c3","--c4","--hot"];
const LX=92,RX=228,T=24,B=132;
function cv(v){return getComputedStyle(root).getPropertyValue(v).trim()||"#888";}
function scale(){let mx=0;items.forEach(it=>{mx=Math.max(mx,it.a,it.b);});mx=Math.max(mx,10);return v=>B-(v/mx)*(B-T);}
function pt(e){const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const m=p.matrixTransform(sv.getScreenCTM().inverse());return m;}
let drag=null;
function draw(){
 while(sv.firstChild)sv.removeChild(sv.firstChild);
 const y=scale();
 [["Before",LX],["After",RX]].forEach(([t,x])=>{const e=document.createElementNS(sv.namespaceURI,"text");e.setAttribute("x",x);e.setAttribute("y",16);e.setAttribute("text-anchor","middle");e.setAttribute("font-size","9");e.setAttribute("fill",cv("--mut"));e.textContent=t;sv.appendChild(e);});
 [LX,RX].forEach(x=>{const l=document.createElementNS(sv.namespaceURI,"line");l.setAttribute("x1",x);l.setAttribute("x2",x);l.setAttribute("y1",T);l.setAttribute("y2",B);l.setAttribute("stroke",cv("--faint"));l.setAttribute("stroke-width",1);sv.appendChild(l);});
 let bestR={d:-1e9},bestF={d:1e9};
 items.forEach((it,i)=>{
  const c=cv(cols[i]);const ya=y(it.a),yb=y(it.b);const d=it.b-it.a;
  if(d>bestR.d)bestR={d:d,n:it.n};if(d<bestF.d)bestF={d:d,n:it.n};
  const ln=document.createElementNS(sv.namespaceURI,"line");ln.setAttribute("x1",LX);ln.setAttribute("y1",ya);ln.setAttribute("x2",RX);ln.setAttribute("y2",yb);ln.setAttribute("stroke",c);ln.setAttribute("stroke-width",2);sv.appendChild(ln);
  const la=document.createElementNS(sv.namespaceURI,"text");la.setAttribute("x",LX-8);la.setAttribute("y",ya+3);la.setAttribute("text-anchor","end");la.setAttribute("font-size","8");la.setAttribute("fill",cv("--mut"));la.textContent=it.n;sv.appendChild(la);
  [["a",LX,ya,it.a],["b",RX,yb,it.b]].forEach(([k,x,yy,val])=>{
   const g=document.createElementNS(sv.namespaceURI,"circle");g.setAttribute("cx",x);g.setAttribute("cy",yy);g.setAttribute("r",5);g.setAttribute("fill",c);g.setAttribute("stroke",cv("--ink"));g.setAttribute("stroke-width",0.5);g.style.cursor="ns-resize";
   g.addEventListener("pointerdown",ev=>{ev.preventDefault();drag={i:i,k:k};g.setPointerCapture(ev.pointerId);});
   sv.appendChild(g);
   const vt=document.createElementNS(sv.namespaceURI,"text");vt.setAttribute("x",x+(k==="a"?9:9));vt.setAttribute("y",yy-7);vt.setAttribute("text-anchor","middle");vt.setAttribute("font-size","7.5");vt.setAttribute("fill",c);vt.textContent=Math.round(val);sv.appendChild(vt);
  });
 });
 cap.innerHTML='Biggest riser <b>'+bestR.n+' (+'+Math.round(bestR.d)+')</b>; biggest faller <b>'+bestF.n+' ('+Math.round(bestF.d)+')</b>.';
}
sv.addEventListener("pointermove",e=>{if(!drag)return;const m=pt(e);const y=scale();let mx=0;items.forEach(it=>{mx=Math.max(mx,it.a,it.b);});mx=Math.max(mx,10);let v=(B-m.y)/(B-T)*mx;v=Math.max(0,Math.min(mx*1.15,v));items[drag.i][drag.k]=v;draw();});
sv.addEventListener("pointerup",e=>{drag=null;});
sv.addEventListener("pointercancel",e=>{drag=null;});
draw();
})();

/* ---- merged inline block ---- */
(function(){
const root=document.getElementById('c-calendar');
const sv=document.getElementById('s-calendar');
const cap=document.getElementById('cap-calendar');
const SVGNS='http://www.w3.org/2000/svg';
const days=['Mon','Tue','Wed','Thu','Fri'];
const wk=['W1','W2','W3','W4','W5'];
// hours grid [week][day]
const seed=[[4,6,3,5,2],[7,8,5,6,4],[3,4,9,7,5],[6,5,4,8,3],[5,7,6,4,9]];
const grid=seed.map(r=>r.slice());
const x0=34,y0=24,cw=52,ch=20,gap=3;
function maxv(){let m=1;for(const r of grid)for(const v of r)if(v>m)m=v;return m;}
function lerp(a,b,t){return Math.round(a+(b-a)*t);}
// resolve css colors to rgb
function rgb(name){const d=document.createElement('div');d.style.color=getComputedStyle(root).getPropertyValue(name);document.body.appendChild(d);const c=getComputedStyle(d).color;d.remove();const m=c.match(/\d+/g)||[230,230,230];return[+m[0],+m[1],+m[2]];}
const cFaint=rgb('--faint'),cHot=rgb('--c1');
function ramp(t){return'rgb('+lerp(cFaint[0],cHot[0],t)+','+lerp(cFaint[1],cHot[1],t)+','+lerp(cFaint[2],cHot[2],t)+')';}
const cells=[];
function build(){
 while(sv.firstChild)sv.removeChild(sv.firstChild);
 cells.length=0;
 // day labels
 days.forEach((d,j)=>{const t=document.createElementNS(SVGNS,'text');t.setAttribute('x',x0+j*(cw+gap)+cw/2);t.setAttribute('y',y0-7);t.setAttribute('text-anchor','middle');t.setAttribute('font-size','8');t.setAttribute('fill','var(--mut)');t.textContent=d;sv.appendChild(t);});
 wk.forEach((w,i)=>{const t=document.createElementNS(SVGNS,'text');t.setAttribute('x',x0-7);t.setAttribute('y',y0+i*(ch+gap)+ch/2+3);t.setAttribute('text-anchor','end');t.setAttribute('font-size','8');t.setAttribute('fill','var(--mut)');t.textContent=w;sv.appendChild(t);});
 const m=maxv();
 for(let i=0;i<5;i++)for(let j=0;j<5;j++){
  const r=document.createElementNS(SVGNS,'rect');
  r.setAttribute('x',x0+j*(cw+gap));r.setAttribute('y',y0+i*(ch+gap));
  r.setAttribute('width',cw);r.setAttribute('height',ch);r.setAttribute('rx',2);
  r.setAttribute('fill',ramp(grid[i][j]/m));
  r.setAttribute('stroke','var(--faint)');r.setAttribute('stroke-width',0.5);
  r.style.cursor='ns-resize';r.dataset.i=i;r.dataset.j=j;
  sv.appendChild(r);cells.push(r);
 }
}
function recolor(){const m=maxv();for(const r of cells){r.setAttribute('fill',ramp(grid[+r.dataset.i][+r.dataset.j]/m));}}
function report(){
 let bi=0,bj=0,bv=-1;const wt=[0,0,0,0,0];
 for(let i=0;i<5;i++)for(let j=0;j<5;j++){const v=grid[i][j];wt[i]+=v;if(v>bv){bv=v;bi=i;bj=j;}}
 cap.innerHTML='Busiest: '+days[bj]+' '+wk[bi]+' at <b>'+bv.toFixed(0)+'h</b> — '+wk[bi]+' total <b>'+wt[bi]+'h</b>.';
}
let drag=null,sy=0,sv0=0;
function pt(e){const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(sv.getScreenCTM().inverse());}
sv.addEventListener('pointerdown',e=>{const t=e.target;if(t.tagName!=='rect'||t.dataset.i===undefined)return;drag=t;sy=pt(e).y;sv0=grid[+t.dataset.i][+t.dataset.j];t.setPointerCapture(e.pointerId);e.preventDefault();});
sv.addEventListener('pointermove',e=>{if(!drag)return;const dy=sy-pt(e).y;let nv=sv0+dy/4;nv=Math.max(0,Math.min(12,nv));grid[+drag.dataset.i][+drag.dataset.j]=Math.round(nv*10)/10;recolor();report();});
sv.addEventListener('pointerup',e=>{if(drag){drag.releasePointerCapture(e.pointerId);drag=null;}});
build();report();
})();

/* ---- merged inline block ---- */
(function(){
const root=document.getElementById('c-tornado'); const sv=document.getElementById('s-tornado'); const cap=document.getElementById('cap-tornado');
const SVGNS='http://www.w3.org/2000/svg';
const base=1000; // baseline outcome ($k)
// each driver: low/high swing magnitudes (impact on outcome, $k)
let D=[
 {n:'Scope',lo:140,hi:260,c:'var(--c1)'},
 {n:'Labor rate',lo:90,hi:120,c:'var(--c2)'},
 {n:'Schedule',lo:70,hi:160,c:'var(--c3)'},
 {n:'Adoption',lo:40,hi:200,c:'var(--c4)'},
 {n:'Risk buf',lo:30,hi:55,c:'var(--hot)'}
];
const X0=148, top=26, rowH=20, axW=150;
function span(d){return d.lo+d.hi;}
function maxSpan(){return Math.max.apply(null,D.map(span));}
let drag=null;
function draw(){
 D.sort((a,b)=>span(b)-span(a));
 const ms=Math.max(maxSpan(),40); const half=axW/2; const sc=half/ms;
 while(sv.firstChild)sv.removeChild(sv.firstChild);
 // baseline axis
 const ax=document.createElementNS(SVGNS,'line');
 ax.setAttribute('x1',X0);ax.setAttribute('x2',X0);ax.setAttribute('y1',top-8);ax.setAttribute('y2',top+D.length*rowH);
 ax.setAttribute('stroke','var(--mut)');ax.setAttribute('stroke-width','1');sv.appendChild(ax);
 const bl=document.createElementNS(SVGNS,'text');bl.setAttribute('x',X0);bl.setAttribute('y',14);bl.setAttribute('text-anchor','middle');bl.setAttribute('font-size','8');bl.setAttribute('fill','var(--mut)');bl.textContent='baseline $'+base+'k';sv.appendChild(bl);
 D.forEach((d,i)=>{
  const y=top+i*rowH+rowH/2;
  const xl=X0-d.lo*sc, xr=X0+d.hi*sc;
  // bar
  const r=document.createElementNS(SVGNS,'rect');
  r.setAttribute('x',xl);r.setAttribute('y',y-6);r.setAttribute('width',Math.max(xr-xl,1));r.setAttribute('height',12);
  r.setAttribute('fill',d.c);r.setAttribute('opacity',i===0?'0.95':'0.6');sv.appendChild(r);
  // label
  const t=document.createElementNS(SVGNS,'text');t.setAttribute('x',6);t.setAttribute('y',y+3);t.setAttribute('font-size','8.5');t.setAttribute('fill','var(--ink)');t.textContent=d.n;sv.appendChild(t);
  // value
  const v=document.createElementNS(SVGNS,'text');v.setAttribute('x',314);v.setAttribute('y',y+3);v.setAttribute('text-anchor','end');v.setAttribute('font-size','7.5');v.setAttribute('fill','var(--mut)');v.textContent='±'+Math.round(span(d))+'k';sv.appendChild(v);
  // drag handles (both ends)
  [['lo',xl,'lo'],['hi',xr,'hi']].forEach(h=>{
   const hd=document.createElementNS(SVGNS,'rect');
   hd.setAttribute('x',h[1]-3);hd.setAttribute('y',y-7);hd.setAttribute('width',6);hd.setAttribute('height',14);
   hd.setAttribute('fill','var(--ink)');hd.setAttribute('rx',1.5);hd.style.cursor='ew-resize';
   hd.addEventListener('pointerdown',ev=>{ev.preventDefault();hd.setPointerCapture(ev.pointerId);drag={d:d,end:h[2],sc:sc};});
   sv.appendChild(hd);
  });
 });
 const dom=D[0];
 cap.innerHTML='<b>'+dom.n+'</b> dominates: it swings the outcome by <b>±'+Math.round(span(dom))+'k</b> vs '+Math.round(span(D[D.length-1]))+'k for the least.';
}
function pt(ev){const p=sv.createSVGPoint();p.x=ev.clientX;p.y=ev.clientY;return p.matrixTransform(sv.getScreenCTM().inverse());}
sv.addEventListener('pointermove',ev=>{
 if(!drag)return; ev.preventDefault();
 const x=pt(ev).x; const dist=Math.abs(x-X0)/drag.sc;
 const v=Math.max(10,Math.min(400,dist));
 if(drag.end==='lo')drag.d.lo=v; else drag.d.hi=v;
 draw();
});
sv.addEventListener('pointerup',()=>{drag=null;});
sv.addEventListener('pointercancel',()=>{drag=null;});
draw();
})();

/* ---- merged inline block ---- */
(function(){
const root=document.getElementById('c-bullet');
const sv=document.getElementById('s-bullet');
const cap=document.getElementById('cap-bullet');
const rows=[
 {name:'Revenue',unit:'k',val:78,target:90,max:120},
 {name:'Uptime',unit:'%',val:97,target:95,max:100},
 {name:'Tickets',unit:'',val:42,target:30,max:60,lowGood:true}
];
const X0=70,X1=300,top=24,rh=38,bh=12;
function sx(r,v){return X0+(v/r.max)*(X1-X0);}
function pt(e){const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const m=p.matrixTransform(sv.getScreenCTM().inverse());return m;}
let drag=-1;
function rowY(i){return top+i*rh;}
function onTarget(r){return r.lowGood? r.val<=r.target : r.val>=r.target;}
function draw(){
 while(sv.firstChild)sv.removeChild(sv.firstChild);
 rows.forEach((r,i)=>{
  const y=rowY(i);
  // qualitative bands (3 zones)
  const zones=[0.5,0.8,1.0],cols=['var(--faint)','var(--c4)','var(--c2)'];
  let prev=0;
  zones.forEach((z,zi)=>{
   const x1=sx(r,prev*r.max),x2=sx(r,z*r.max);
   const rect=document.createElementNS(sv.namespaceURI,'rect');
   rect.setAttribute('x',x1);rect.setAttribute('y',y);rect.setAttribute('width',Math.max(0,x2-x1));rect.setAttribute('height',bh);
   rect.setAttribute('fill',cols[zi]);rect.setAttribute('opacity',0.45);sv.appendChild(rect);
   prev=z;
  });
  // label
  const lab=document.createElementNS(sv.namespaceURI,'text');
  lab.setAttribute('x',X0-6);lab.setAttribute('y',y+bh-1);lab.setAttribute('text-anchor','end');
  lab.setAttribute('font-size','9');lab.setAttribute('fill','var(--ink)');lab.textContent=r.name;sv.appendChild(lab);
  // value bar
  const ok=onTarget(r);
  const bar=document.createElementNS(sv.namespaceURI,'rect');
  bar.setAttribute('x',X0);bar.setAttribute('y',y+3);bar.setAttribute('width',Math.max(0,sx(r,r.val)-X0));
  bar.setAttribute('height',bh-6);bar.setAttribute('fill',ok?'var(--c1)':'var(--hot)');
  bar.style.cursor='ew-resize';bar.dataset.i=i;sv.appendChild(bar);
  // hit handle at bar end
  const grip=document.createElementNS(sv.namespaceURI,'rect');
  grip.setAttribute('x',sx(r,r.val)-4);grip.setAttribute('y',y-1);grip.setAttribute('width',12);grip.setAttribute('height',bh+2);
  grip.setAttribute('fill','transparent');grip.style.cursor='ew-resize';grip.dataset.i=i;sv.appendChild(grip);
  // target tick
  const tk=document.createElementNS(sv.namespaceURI,'line');
  const tx=sx(r,r.target);
  tk.setAttribute('x1',tx);tk.setAttribute('x2',tx);tk.setAttribute('y1',y-2);tk.setAttribute('y2',y+bh+2);
  tk.setAttribute('stroke','var(--ink)');tk.setAttribute('stroke-width',2);sv.appendChild(tk);
  // value text
  const vt=document.createElementNS(sv.namespaceURI,'text');
  vt.setAttribute('x',X1+2);vt.setAttribute('y',y+bh-1);vt.setAttribute('font-size','8');
  vt.setAttribute('fill','var(--mut)');vt.textContent=Math.round(r.val)+r.unit;sv.appendChild(vt);
 });
 const hit=rows.filter(onTarget).length;
 cap.innerHTML='<b>'+hit+'</b> of '+rows.length+' on target ('+rows.filter(r=>!onTarget(r)).map(r=>r.name).join(', ')+(hit<rows.length?' lagging':' \u2014 all clear')+').';
}
function setVal(e){
 if(drag<0)return;const r=rows[drag];const m=pt(e);
 let v=((m.x-X0)/(X1-X0))*r.max;v=Math.max(0,Math.min(r.max,v));
 r.val=r.val*0.4+v*0.6;draw();
}
sv.addEventListener('pointerdown',e=>{
 const i=e.target.dataset&&e.target.dataset.i;if(i===undefined)return;
 drag=+i;sv.setPointerCapture(e.pointerId);setVal(e);
});
sv.addEventListener('pointermove',setVal);
sv.addEventListener('pointerup',e=>{drag=-1;try{sv.releasePointerCapture(e.pointerId);}catch(x){}});
draw();
})();

/* ---- merged inline block ---- */
(function(){
  const root=document.getElementById('c-dumbbell');
  const sv=document.getElementById('s-dumbbell');
  const cap=document.getElementById('cap-dumbbell');
  const NS='http://www.w3.org/2000/svg';
  const rows=[
    {name:'Design',  a:20, b:34},
    {name:'Build',   a:55, b:48},
    {name:'Test',    a:30, b:62},
    {name:'Deploy',  a:40, b:44}
  ];
  const L=70, R=308, top=24, dy=28;
  function mk(t,at){const e=document.createElementNS(NS,t);for(const k in at)e.setAttribute(k,at[k]);return e;}
  function pt(ev){const p=sv.createSVGPoint();p.x=ev.clientX;p.y=ev.clientY;return p.matrixTransform(sv.getScreenCTM().inverse());}
  let drag=null;
  function scale(){
    let mx=0; rows.forEach(r=>{mx=Math.max(mx,r.a,r.b);});
    mx=Math.max(10,mx*1.1);
    return v=>L+(R-L)*(v/mx);
  }
  function draw(){
    while(sv.firstChild)sv.removeChild(sv.firstChild);
    const x=scale();
    // axis baseline
    sv.appendChild(mk('line',{x1:L,y1:top-10,x2:L,y2:top+dy*4-6,stroke:'var(--faint)','stroke-width':1}));
    let widest=-1,wi=0;
    rows.forEach((r,i)=>{if(Math.abs(r.a-r.b)>widest){widest=Math.abs(r.a-r.b);wi=i;}});
    rows.forEach((r,i)=>{
      const y=top+dy*i;
      const hot=i===wi;
      sv.appendChild(mk('text',{x:L-8,y:y+4,'text-anchor':'end','font-size':9,fill:hot?'var(--hot)':'var(--mut)'})).textContent=r.name;
      sv.appendChild(mk('line',{x1:x(r.a),y1:y,x2:x(r.b),y2:y,stroke:hot?'var(--hot)':'var(--faint)','stroke-width':hot?3:2,'stroke-linecap':'round'}));
      [['a','var(--c1)'],['b','var(--c2)']].forEach(([k,col])=>{
        const c=mk('circle',{cx:x(r[k]),cy:y,r:6,fill:col,stroke:'#fff','stroke-width':1.5,style:'cursor:ew-resize'});
        c.addEventListener('pointerdown',ev=>{drag={i,k};c.setPointerCapture(ev.pointerId);ev.preventDefault();});
        c.addEventListener('pointermove',ev=>{
          if(!drag||drag.i!==i||drag.k!==k)return;
          let mx=0;rows.forEach(rr=>{mx=Math.max(mx,rr.a,rr.b);});mx=Math.max(10,mx*1.1);
          const px=pt(ev).x;
          let v=(px-L)/(R-L)*mx;
          v=Math.max(0,Math.min(mx,v));
          // smooth blend to avoid spikes
          r[k]=r[k]+(v-r[k])*0.6;
          draw();
        });
        c.addEventListener('pointerup',ev=>{if(drag){c.releasePointerCapture(ev.pointerId);drag=null;say();}});
        sv.appendChild(c);
      });
    });
    // legend
    sv.appendChild(mk('circle',{cx:L+6,cy:142,r:4,fill:'var(--c1)'}));
    sv.appendChild(mk('text',{x:L+14,y:145,'font-size':8,fill:'var(--mut)'})).textContent='Plan';
    sv.appendChild(mk('circle',{cx:L+50,cy:142,r:4,fill:'var(--c2)'}));
    sv.appendChild(mk('text',{x:L+58,y:145,'font-size':8,fill:'var(--mut)'})).textContent='Actual';
    say();
  }
  function say(){
    let widest=-1,wi=0;
    rows.forEach((r,i)=>{if(Math.abs(r.a-r.b)>widest){widest=Math.abs(r.a-r.b);wi=i;}});
    const r=rows[wi];
    const dir=r.b>r.a?'over':'under';
    cap.innerHTML='Widest gap is <b>'+r.name+'</b>: '+dir+' by <b>'+Math.abs(r.b-r.a).toFixed(0)+'</b> (plan '+r.a.toFixed(0)+' vs actual '+r.b.toFixed(0)+'). Drag a dot.';
  }
  draw();
})();

/* ---- merged inline block ---- */
(function(){
const root=document.getElementById('c-quadrant');
const sv=document.getElementById('s-quadrant');
const cap=document.getElementById('cap-quadrant');
const SVGNS='http://www.w3.org/2000/svg';
// plot area
const X0=42,X1=296,Y0=14,Y1=120;
// items: effort & value 0..100
const items=[
 {n:'Auth',e:25,v:80},{n:'Logs',e:20,v:35},{n:'Search',e:70,v:85},
 {n:'Theme',e:60,v:25},{n:'Cache',e:30,v:70},{n:'Export',e:80,v:55},{n:'Docs',e:45,v:45}
];
const sx=v=>X0+(v/100)*(X1-X0);
const sy=v=>Y1-(v/100)*(Y1-Y0);
function el(t,a){const e=document.createElementNS(SVGNS,t);for(const k in a)e.setAttribute(k,a[k]);return e;}
// static frame
function frame(){
 // quadrant fill labels
 const mx=(X0+X1)/2,my=(Y0+Y1)/2;
 const labs=[['Quick-win',(X0+mx)/2,(Y0+my)/2,'var(--c1)'],['Do-now',(X0+mx)/2,(my+Y1)/2,'var(--hot)'],
   ['Plan',(mx+X1)/2,(Y0+my)/2,'var(--c2)'],['Drop',(mx+X1)/2,(my+Y1)/2,'var(--mut)']];
 // wait: high value top, low effort left => top-left is Quick-win? define: y=value(up high), x=effort(right high)
 labs.length=0;
 labs.push(['Quick-win',(X0+mx)/2,(Y0+my)/2,'var(--c1)']); // low effort high value
 labs.push(['Do-now? ',0,0,'']);
 // simpler explicit placement below
}
// explicit quadrant labels: TL=Quick-win(low eff,high val) ★, TR=Plan(high eff,high val), BL=Drop?? 
// Standard: high value+low effort = Do-now/Quick-win. We'll use: TL=Do-now, TR=Plan, BL=Quick-win? No.
// Decision: x=effort right, y=value up. Top=high value, Left=low effort.
// TL (low eff,high val)=Do-now (best). TR(high eff,high val)=Plan(big bets). BL(low eff,low val)=Quick-win(easy filler). BR(high eff,low val)=Drop.
const mx=(X0+X1)/2,my=(Y0+Y1)/2;
sv.appendChild(el('line',{x1:mx,y1:Y0,x2:mx,y2:Y1,stroke:'var(--faint)','stroke-dasharray':'4 3'}));
sv.appendChild(el('line',{x1:X0,y1:my,x2:X1,y2:my,stroke:'var(--faint)','stroke-dasharray':'4 3'}));
sv.appendChild(el('line',{x1:X0,y1:Y0,x2:X0,y2:Y1,stroke:'var(--mut)'}));
sv.appendChild(el('line',{x1:X0,y1:Y1,x2:X1,y2:Y1,stroke:'var(--mut)'}));
function qlab(t,x,y,c){const e=el('text',{x:x,y:y,fill:c,'font-size':'8','text-anchor':'middle','font-weight':'700',opacity:'.55'});e.textContent=t;sv.appendChild(e);}
qlab('DO-NOW',(X0+mx)/2,Y0+9,'var(--hot)');
qlab('PLAN',(mx+X1)/2,Y0+9,'var(--c2)');
qlab('QUICK-WIN',(X0+mx)/2,Y1-4,'var(--c1)');
qlab('DROP',(mx+X1)/2,Y1-4,'var(--mut)');
// axis labels
const axe=el('text',{x:(X0+X1)/2,y:Y1+16,fill:'var(--mut)','font-size':'8','text-anchor':'middle'});axe.textContent='effort \u2192';sv.appendChild(axe);
const axv=el('text',{x:11,y:(Y0+Y1)/2,fill:'var(--mut)','font-size':'8','text-anchor':'middle',transform:'rotate(-90 11 '+((Y0+Y1)/2)+')'});axv.textContent='value \u2192';sv.appendChild(axv);
// dots layer
const layer=el('g',{});sv.appendChild(layer);
const nodes=items.map(it=>{
 const g=el('g',{cursor:'move'});
 const c=el('circle',{r:6,fill:'var(--c3)',stroke:'var(--ink)','stroke-width':'1'});
 const t=el('text',{'font-size':'7',fill:'var(--ink)','text-anchor':'middle',dy:'-8'});t.textContent=it.n;
 g.appendChild(c);g.appendChild(t);layer.appendChild(g);
 return {it,g,c,t};
});
function classify(it){const hiV=it.v>=50,loE=it.e<50;return hiV?(loE?'do':'plan'):(loE?'qw':'drop');}
const col={do:'var(--hot)',plan:'var(--c2)',qw:'var(--c1)',drop:'var(--mut)'};
function render(){
 let dn=0,dnames=[];
 nodes.forEach(o=>{
  const x=sx(o.it.e),y=sy(o.it.v),cl=classify(o.it);
  o.g.setAttribute('transform','translate('+x+','+y+')');
  o.c.setAttribute('fill',col[cl]);
  if(cl==='do'){dn++;dnames.push(o.it.n);}
 });
 cap.innerHTML='<b>'+dn+'</b> in Do-now (high value, low effort)'+(dnames.length?': '+dnames.join(', '):'.');
}
// drag
const pt=sv.createSVGPoint();
function loc(ev){pt.x=ev.clientX;pt.y=ev.clientY;const p=pt.matrixTransform(sv.getScreenCTM().inverse());return p;}
let drag=null;
nodes.forEach(o=>{
 o.g.addEventListener('pointerdown',ev=>{drag=o;o.g.setPointerCapture(ev.pointerId);ev.preventDefault();});
 o.g.addEventListener('pointermove',ev=>{
  if(drag!==o)return;const p=loc(ev);
  let e=(p.x-X0)/(X1-X0)*100, v=(Y1-p.y)/(Y1-Y0)*100;
  o.it.e=Math.max(0,Math.min(100,e));o.it.v=Math.max(0,Math.min(100,v));
  render();
 });
 const end=ev=>{if(drag===o){try{o.g.releasePointerCapture(ev.pointerId);}catch(e){}drag=null;}};
 o.g.addEventListener('pointerup',end);o.g.addEventListener('pointercancel',end);
});
render();
})();

/* ---- merged inline block ---- */
(function(){ const root=document.getElementById('c-map'); const sv=document.getElementById('s-map'); const cap=document.getElementById('cap-map');
const names=['North','Central','East','West','Midlands','Coast','South','Delta','Highlands'];
const vals=[42,58,31,67,90,25,49,73,38];
const gx=40,gy=18,cw=64,ch=34,gap=4;
function ramp(t){t=Math.max(0,Math.min(1,t));const stops=[getCSS('--c1'),getCSS('--c2'),getCSS('--c4'),getCSS('--hot')];const seg=t*(stops.length-1);const i=Math.min(stops.length-2,Math.floor(seg));return mix(stops[i],stops[i+1],seg-i);}
function getCSS(v){return getComputedStyle(root).getPropertyValue(v).trim();}
function hex(c){c=c.replace('#','');if(c.length===3)c=c.split('').map(x=>x+x).join('');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
function mix(a,b,t){const A=hex(a),B=hex(b);return'rgb('+A.map((x,i)=>Math.round(x+(B[i]-x)*t)).join(',')+')';}
const cells=[];
function pt(e){const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(sv.getScreenCTM().inverse());}
function build(){
 for(let i=0;i<9;i++){const r=Math.floor(i/3),c=i%3;
  const x=gx+c*(cw+gap),y=gy+r*(ch+gap);
  const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
  rect.setAttribute('x',x);rect.setAttribute('y',y);rect.setAttribute('width',cw);rect.setAttribute('height',ch);
  rect.setAttribute('rx',3);rect.setAttribute('stroke',getCSS('--faint'));rect.setAttribute('stroke-width',0.7);
  rect.style.cursor='ns-resize';rect.setAttribute('data-i',i);
  const tx=document.createElementNS('http://www.w3.org/2000/svg','text');
  tx.setAttribute('x',x+cw/2);tx.setAttribute('y',y+ch/2-2);tx.setAttribute('text-anchor','middle');
  tx.setAttribute('font-size',6.5);tx.style.pointerEvents='none';
  const vv=document.createElementNS('http://www.w3.org/2000/svg','text');
  vv.setAttribute('x',x+cw/2);vv.setAttribute('y',y+ch/2+8);vv.setAttribute('text-anchor','middle');
  vv.setAttribute('font-size',7);vv.setAttribute('font-weight','bold');vv.style.pointerEvents='none';
  sv.appendChild(rect);sv.appendChild(tx);sv.appendChild(vv);
  cells.push({rect,tx,vv});
  rect.addEventListener('pointerdown',ev=>{ev.preventDefault();rect.setPointerCapture(ev.pointerId);drag={i,startY:pt(ev).y,startV:vals[i]};});
 }
 sv.addEventListener('pointermove',ev=>{if(!drag)return;const dy=pt(ev).y-drag.startY;let nv=drag.startV-dy*1.4;nv=Math.max(0,Math.min(100,nv));vals[drag.i]=vals[drag.i]*0.4+nv*0.6;render();});
 sv.addEventListener('pointerup',ev=>{if(drag){try{cells[drag.i].rect.releasePointerCapture(ev.pointerId);}catch(e){}}drag=null;});
}
let drag=null;
function render(){
 let total=0,hot=0,hi=-1;
 for(let i=0;i<9;i++){total+=vals[i];if(vals[i]>hi){hi=vals[i];hot=i;}}
 for(let i=0;i<9;i++){const v=vals[i];const col=ramp(v/100);cells[i].rect.setAttribute('fill',col);
  const dark=v/100>0.45;cells[i].tx.setAttribute('fill',dark?'#fff':getCSS('--ink'));cells[i].vv.setAttribute('fill',dark?'#fff':getCSS('--ink'));
  cells[i].tx.textContent=names[i];cells[i].vv.textContent=Math.round(v);
  cells[i].rect.setAttribute('stroke',i===hot?getCSS('--ink'):getCSS('--faint'));
  cells[i].rect.setAttribute('stroke-width',i===hot?2:0.7);}
 cap.innerHTML='Hotspot <b>'+names[hot]+'</b> ('+Math.round(hi)+'); total demand <b>'+Math.round(total)+'</b> across 9 regions.';
}
build();render();
})();

/* ---- merged inline block ---- */
(function(){
const root=document.getElementById('c-allocator');
const sv=document.getElementById('s-allocator');
const cap=document.getElementById('cap-allocator');
const NS='http://www.w3.org/2000/svg';
const names=['Engineering','Design','Marketing','Ops'];
const cols=['var(--c1)','var(--c2)','var(--c3)','var(--c4)'];
let vals=[40,22,23,15]; // sums to 100
const X0=20,X1=300,Y=58,H=42,W=X1-X0;
let drag=-1,lastFrom=-1;
function clear(){while(sv.firstChild)sv.removeChild(sv.firstChild);}
function el(t,a){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;}
function pt(ev){const p=sv.createSVGPoint();p.x=ev.clientX;p.y=ev.clientY;return p.matrixTransform(sv.getScreenCTM().inverse());}
function cum(){const c=[0];for(let i=0;i<vals.length;i++)c.push(c[i]+vals[i]);return c;}
function draw(){
clear();
const c=cum();
for(let i=0;i<vals.length;i++){
const x=X0+W*c[i]/100,w=W*vals[i]/100;
sv.appendChild(el('rect',{x,y:Y,width:Math.max(0,w),height:H,fill:cols[i],stroke:'var(--ink)','stroke-width':.5}));
if(vals[i]>=7){
const t=el('text',{x:x+w/2,y:Y+H/2+1,'text-anchor':'middle','font-size':8,fill:'var(--ink)'});t.textContent=names[i];sv.appendChild(t);
const v=el('text',{x:x+w/2,y:Y+H/2+11,'text-anchor':'middle','font-size':8.5,fill:'var(--ink)','font-weight':'bold'});v.textContent=Math.round(vals[i])+'%';sv.appendChild(v);
}
}
// dividers (handles between neighbours)
for(let i=0;i<vals.length-1;i++){
const x=X0+W*c[i+1]/100;
const hit=el('rect',{x:x-6,y:Y-8,width:12,height:H+16,fill:'transparent',style:'cursor:ew-resize'});
hit.dataset.d=i;sv.appendChild(hit);
sv.appendChild(el('line',{x1:x,y1:Y-6,x2:x,y2:Y+H+6,stroke:'var(--ink)','stroke-width':drag===i?2.5:1.5,style:'cursor:ew-resize'}));
sv.appendChild(el('circle',{cx:x,cy:Y-9,r:3,fill:'var(--hot)',style:'cursor:ew-resize'}));
sv.appendChild(el('circle',{cx:x,cy:Y+H+9,r:3,fill:'var(--hot)',style:'cursor:ew-resize'}));
}
const tt=el('text',{x:X0,y:28,'font-size':8.5,fill:'var(--mut)'});tt.textContent='drag a divider to shift budget between neighbours';sv.appendChild(tt);
updateCap();
}
function updateCap(){
let bi=0;for(let i=1;i<vals.length;i++)if(vals[i]>vals[bi])bi=i;
let txt='<b>'+names[bi]+'</b> holds the largest share at <b>'+Math.round(vals[bi])+'%</b>';
if(lastFrom>=0&&lastFrom!==bi)txt+=', taking from '+names[lastFrom];
txt+='.';
cap.innerHTML=txt;
}
function setDivider(i,frac){
const c=cum();
let target=frac*100;
const lo=c[i]+3,hi=c[i+2]-3; // keep both neighbours >=3
target=Math.max(lo,Math.min(hi,target));
const total=vals[i]+vals[i+1];
const left=target-c[i];
// blend toward target to avoid spikes
vals[i]=left;vals[i+1]=total-left;
lastFrom=vals[i]>=vals[i+1]?i+1:i;
}
sv.addEventListener('pointerdown',function(ev){
const d=ev.target.dataset?ev.target.dataset.d:undefined;
if(d!==undefined){drag=+d;sv.setPointerCapture(ev.pointerId);ev.preventDefault();draw();}
});
sv.addEventListener('pointermove',function(ev){
if(drag<0)return;
const p=pt(ev);
setDivider(drag,(p.x-X0)/W);
draw();
});
function end(ev){if(drag>=0){drag=-1;draw();}}
sv.addEventListener('pointerup',end);
sv.addEventListener('pointercancel',end);
draw();
})();

/* ---- merged inline block ---- */
(function(){
const root=document.getElementById('c-matrix');
const sv=document.getElementById('s-matrix');
const cap=document.getElementById('cap-matrix');
const SVGNS='http://www.w3.org/2000/svg';
const phases=['Discover','Design','Build','Ship'];
const disc=['UX','Eng','Data','QA'];
// rows=phases, cols=disciplines; effort person-days
const V=[[5,4,2,1],[6,8,3,2],[3,12,7,6],[1,5,4,9]];
const gx=58,gy=22,cw=56,ch=24;
function mk(t,a){const e=document.createElementNS(SVGNS,t);for(const k in a)e.setAttribute(k,a[k]);return e;}
function maxv(){let m=1;for(let r=0;r<4;r++)for(let c=0;c<4;c++)m=Math.max(m,V[r][c]);return m;}
// color blend faint->hot via c1,hot
function col(t){
// t 0..1 -> faint to hot using mix of vars not possible; interpolate alpha + warm ramp
return null;}
const cells=[];
function render(){
const M=maxv();
// find hottest cell + heaviest row
let hr=0,hc=0,hv=-1;for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(V[r][c]>hv){hv=V[r][c];hr=r;hc=c;}
let brow=0,bsum=-1;for(let r=0;r<4;r++){let s=0;for(let c=0;c<4;c++)s+=V[r][c];if(s>bsum){bsum=s;brow=r;}}
for(let r=0;r<4;r++)for(let c=0;c<4;c++){
const cell=cells[r*4+c];const t=V[r][c]/M;
cell.rect.setAttribute('fill','var(--hot)');
cell.rect.setAttribute('fill-opacity',(0.12+0.88*t).toFixed(3));
cell.rect.setAttribute('stroke',(r===hr&&c===hc)?'var(--ink)':'var(--faint)');
cell.rect.setAttribute('stroke-width',(r===hr&&c===hc)?1.6:0.6);
cell.txt.textContent=V[r][c].toFixed(0);
cell.txt.setAttribute('fill',t>0.55?'#fff':'var(--ink)');
}
cap.innerHTML='Hottest: <b>'+phases[hr]+'\u00d7'+disc[hc]+'</b> ('+hv.toFixed(0)+'pd) \u2014 heaviest phase '+phases[brow]+' ('+bsum.toFixed(0)+'pd). Drag a cell up/down to retune effort.';
}
// labels
for(let c=0;c<4;c++)sv.appendChild(mk('text',{x:gx+c*cw+cw/2,y:gy-7,'text-anchor':'middle','font-size':9,fill:'var(--mut)'})).textContent=disc[c];
for(let r=0;r<4;r++)sv.appendChild(mk('text',{x:gx-6,y:gy+r*ch+ch/2+3,'text-anchor':'end','font-size':9,fill:'var(--mut)'})).textContent=phases[r];
for(let r=0;r<4;r++)for(let c=0;c<4;c++){
const x=gx+c*cw,y=gy+r*ch;
const rect=mk('rect',{x:x+1,y:y+1,width:cw-2,height:ch-2,rx:2,style:'cursor:ns-resize'});
const txt=mk('text',{x:x+cw/2,y:y+ch/2+3,'text-anchor':'middle','font-size':9,'pointer-events':'none','font-weight':600});
sv.appendChild(rect);sv.appendChild(txt);
cells.push({rect,txt});
rect.addEventListener('pointerdown',function(ev){
ev.preventDefault();rect.setPointerCapture(ev.pointerId);
const pt=sv.createSVGPoint();
function loc(e){pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(sv.getScreenCTM().inverse());}
let last=loc(ev).y;
function mv(e){
const p=loc(e);const dy=last-p.y;last=p.y;
let nv=V[r][c]+dy*(maxv()/40);
nv=Math.max(0,Math.min(40,nv));
// smooth blend to avoid spikes
V[r][c]=V[r][c]*0.4+nv*0.6;
render();
}
function up(e){rect.releasePointerCapture(ev.pointerId);sv.removeEventListener('pointermove',mv);sv.removeEventListener('pointerup',up);}
sv.addEventListener('pointermove',mv);sv.addEventListener('pointerup',up);
});
}
render();
})();

/* ---- merged inline block ---- */
(function(){
const root=document.getElementById('c-influence');
const sv=document.getElementById('s-influence');
const cap=document.getElementById('cap-influence');
const SVGNS='http://www.w3.org/2000/svg';
const nodes=[
 {id:'PM',x:160,y:30,r:22},
 {id:'Eng',x:70,y:65,r:18},
 {id:'Design',x:250,y:60,r:14},
 {id:'Sales',x:90,y:120,r:12},
 {id:'Ops',x:230,y:120,r:13},
 {id:'Exec',x:160,y:95,r:16}
];
const links=[['PM','Eng'],['PM','Design'],['PM','Exec'],['Eng','Sales'],['Eng','Exec'],['Design','Ops'],['Exec','Ops'],['Exec','Sales']];
const COL={PM:'--c1',Eng:'--c2',Design:'--c3',Sales:'--c4',Ops:'--hot',Exec:'--c1'};
const byId=id=>nodes.find(n=>n.id===id);
let edgeEls=[],nodeG=[];
function pt(e){const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const m=p.matrixTransform(sv.getScreenCTM().inverse());return m;}
function build(){
 while(sv.firstChild)sv.removeChild(sv.firstChild);
 edgeEls=[];nodeG=[];
 links.forEach(l=>{const ln=document.createElementNS(SVGNS,'line');ln.setAttribute('stroke','var(--faint)');ln.setAttribute('stroke-width','1.5');sv.appendChild(ln);edgeEls.push({el:ln,a:l[0],b:l[1]});});
 nodes.forEach(n=>{
  const c=document.createElementNS(SVGNS,'circle');
  c.setAttribute('fill','var('+COL[n.id]+')');c.setAttribute('fill-opacity','0.55');
  c.setAttribute('stroke','var('+COL[n.id]+')');c.setAttribute('stroke-width','1.5');
  c.style.cursor='move';c.style.touchAction='none';
  const t=document.createElementNS(SVGNS,'text');
  t.setAttribute('text-anchor','middle');t.setAttribute('font-size','8');
  t.setAttribute('fill','var(--ink)');t.setAttribute('pointer-events','none');
  t.textContent=n.id;
  sv.appendChild(c);sv.appendChild(t);
  nodeG.push({n:n,c:c,t:t});
  c.addEventListener('pointerdown',e=>{e.preventDefault();c.setPointerCapture(e.pointerId);drag={n:n,c:c};});
 });
}
let drag=null;
sv.addEventListener('pointermove',e=>{
 if(!drag)return;
 const m=pt(e);
 const dist=Math.hypot(m.x-drag.n.x,m.y-drag.n.y);
 // smooth radial resize toward pointer distance
 drag.n.r+=(Math.max(7,Math.min(34,dist))-drag.n.r)*0.5;
 render();
});
function endDrag(e){if(drag){drag=null;}}
sv.addEventListener('pointerup',endDrag);
sv.addEventListener('pointercancel',endDrag);
function central(){
 // load-bearing = degree-weighted by own radius + neighbour radii
 let best=null,bs=-1;
 nodes.forEach(n=>{
  let s=n.r;let deg=0;
  links.forEach(l=>{if(l[0]===n.id){s+=byId(l[1]).r*0.5;deg++;}if(l[1]===n.id){s+=byId(l[0]).r*0.5;deg++;}});
  s*=(1+deg*0.25);
  if(s>bs){bs=s;best=n;}
 });
 return best;
}
function render(){
 edgeEls.forEach(o=>{const a=byId(o.a),b=byId(o.b);o.el.setAttribute('x1',a.x);o.el.setAttribute('y1',a.y);o.el.setAttribute('x2',b.x);o.el.setAttribute('y2',b.y);});
 const hub=central();
 nodeG.forEach(g=>{
  g.c.setAttribute('cx',g.n.x);g.c.setAttribute('cy',g.n.y);g.c.setAttribute('r',g.n.r);
  g.c.setAttribute('stroke-width',g.n===hub?'3':'1.5');
  g.c.setAttribute('fill-opacity',g.n===hub?'0.7':'0.45');
  g.t.setAttribute('x',g.n.x);g.t.setAttribute('y',g.n.y+3);
 });
 cap.innerHTML='Most load-bearing node: <b>'+hub.id+'</b> (influence radius '+Math.round(hub.r)+'). Drag any node to resize its influence.';
}
build();render();
})();

/* ---- merged inline block ---- */
(function(){
const root=document.getElementById('c-sankey'); const sv=document.getElementById('s-sankey'); const cap=document.getElementById('cap-sankey');
const NS='http://www.w3.org/2000/svg';
// 2 sources -> 3 buckets. flow[src][bucket] = $k
const srcN=['Eng','Ops'], bkN=['Build','Run','Risk'];
const cols=['var(--c1)','var(--c2)','var(--c3)'];
let flow=[[40,20,10],[15,30,25]]; // each row conserved on its own total
const SX=70, BX=250, W=14;
function tot(r){return flow[r][0]+flow[r][1]+flow[r][2];}
function mk(t,a){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;}
function render(){
 while(sv.firstChild)sv.removeChild(sv.firstChild);
 const srcTot=[tot(0),tot(1)], grand=srcTot[0]+srcTot[1];
 const bkTot=[0,1,2].map(b=>flow[0][b]+flow[1][b]);
 const PT=20, PB=18, H=150-PT-PB; const gap=10;
 const sc=(H-gap)/grand; // px per $k for source side
 const bsc=(H-gap)/grand;
 // source node y-ranges
 const srcY=[]; let y=PT;
 for(let s=0;s<2;s++){const h=srcTot[s]*sc; srcY.push([y,h]); y+=h+gap;}
 // bucket node y-ranges
 const bkY=[]; y=PT;
 for(let b=0;b<3;b++){const h=bkTot[b]*bsc; bkY.push([y,h]); y+=h+gap;}
 // draw bands: order src-major
 const srcOff=[srcY[0][0],srcY[1][0]];
 const bkOff=[bkY[0][0],bkY[1][0],bkY[2][0]];
 let biggest={v:-1};
 for(let s=0;s<2;s++)for(let b=0;b<3;b++){
   const v=flow[s][b]; const th=v*sc;
   const y0=srcOff[s], y1=bkOff[b];
   const x0=SX+W, x1=BX, mx=(x0+x1)/2;
   const d='M'+x0+' '+y0+' C'+mx+' '+y0+' '+mx+' '+y1+' '+x1+' '+y1
          +' L'+x1+' '+(y1+th)+' C'+mx+' '+(y1+th)+' '+mx+' '+(y0+th)+' '+x0+' '+(y0+th)+' Z';
   const band=mk('path',{d:d,fill:cols[b],'fill-opacity':'0.55',stroke:cols[b],'stroke-width':'0.5'});
   band.style.cursor='ns-resize';
   band.dataset.s=s; band.dataset.b=b;
   sv.appendChild(band);
   band.addEventListener('pointerdown',start);
   srcOff[s]+=th; bkOff[b]+=th;
   if(v>biggest.v)biggest={v:v,s:s,b:b};
 }
 // source nodes
 for(let s=0;s<2;s++){
   sv.appendChild(mk('rect',{x:SX,y:srcY[s][0],width:W,height:srcY[s][1],fill:'var(--ink)',rx:2}));
   const lbl=mk('text',{x:SX-4,y:srcY[s][0]+srcY[s][1]/2+3,'text-anchor':'end','font-size':'9',fill:'var(--ink)'});
   lbl.textContent=srcN[s]+' '+srcTot[s]+'k'; sv.appendChild(lbl);
 }
 // bucket nodes
 for(let b=0;b<3;b++){
   sv.appendChild(mk('rect',{x:BX,y:bkY[b][0],width:W,height:bkY[b][1],fill:cols[b],rx:2}));
   const lbl=mk('text',{x:BX+W+4,y:bkY[b][0]+bkY[b][1]/2+3,'text-anchor':'start','font-size':'9',fill:'var(--ink)'});
   lbl.textContent=bkN[b]+' '+bkTot[b]+'k'; sv.appendChild(lbl);
 }
 const bs=biggest;
 cap.innerHTML=srcN[bs.s]+'\u2192'+bkN[bs.b]+' is the biggest stream at <b>$'+bs.v+'k</b> ('+Math.round(bs.v/grand*100)+'% of all spend).';
}
let drag=null;
function pt(e){const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(sv.getScreenCTM().inverse());}
function start(e){const s=+this.dataset.s,b=+this.dataset.b;drag={s:s,b:b,y0:pt(e).y,v0:flow[s][b]};this.setPointerCapture(e.pointerId);this.addEventListener('pointermove',move);this.addEventListener('pointerup',end);e.preventDefault();}
function move(e){if(!drag)return;const dy=pt(e).y-drag.y0;const PT=20,PB=18,H=150-PT-PB-10;const grand=tot(0)+tot(1);const sc=H/grand;let nv=Math.round(drag.v0+dy/sc);nv=Math.max(2,nv);
 // conserve this source total: take/give from siblings proportionally
 const s=drag.s,b=drag.b;const T=tot(s);const others=[0,1,2].filter(x=>x!==b);const osum=flow[s][others[0]]+flow[s][others[1]];
 nv=Math.min(nv,T-4);// leave min for siblings
 const rem=T-nv;const f=osum>0?rem/osum:0.5;
 flow[s][b]=nv; flow[s][others[0]]=Math.max(2,Math.round(flow[s][others[0]]*f)); flow[s][others[1]]=Math.max(2,T-nv-flow[s][others[0]]);
 render();}
function end(e){drag=null;try{this.releasePointerCapture(e.pointerId);}catch(_){}}
render();
})();

/* ---- merged inline block ---- */
(function(){
const root=document.getElementById('c-icicle'); const sv=document.getElementById('s-icicle'); const cap=document.getElementById('cap-icicle');
const X0=8,X1=312,W=X1-X0, TOTAL=240;
const cols=['var(--c1)','var(--c2)','var(--c3)'];
const branches=[
 {name:'Engineering', share:0.45, leaves:[{name:'Build',f:0.6},{name:'QA',f:0.4}]},
 {name:'Design', share:0.30, leaves:[{name:'UX',f:0.55},{name:'Visual',f:0.45}]},
 {name:'Ops', share:0.25, leaves:[{name:'Cloud',f:0.5},{name:'Support',f:0.5}]}
];
function norm(){let s=branches.reduce((a,b)=>a+b.share,0); branches.forEach(b=>b.share/=s);}
const TOPY=22,TOPH=26, BRY=58,BRH=30, LFY=96,LFH=34;
function pt(e){const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(sv.getScreenCTM().inverse());}
function txt(x,y,s,fill,anchor,size){const t=document.createElementNS(sv.namespaceURI,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('fill',fill);t.setAttribute('text-anchor',anchor||'middle');t.setAttribute('font-size',size||7);t.textContent=s;return t;}
function rect(x,y,w,h,fill){const r=document.createElementNS(sv.namespaceURI,'rect');r.setAttribute('x',x);r.setAttribute('y',y);r.setAttribute('width',Math.max(0.5,w));r.setAttribute('height',h);r.setAttribute('fill',fill);r.setAttribute('rx',2);return r;}
let drag=null;
function draw(){
 while(sv.firstChild)sv.removeChild(sv.firstChild);
 sv.appendChild(txt(160,12,'$'+TOTAL+'k total','var(--mut)','middle',8));
 // top bar
 sv.appendChild(rect(X0,TOPY,W,TOPH,'var(--faint)'));
 sv.appendChild(txt(160,TOPY+TOPH/2+3,'Total','var(--ink)','middle',8));
 let bx=X0, big=0,bigName='';
 branches.forEach((b,i)=>{
  const bw=b.share*W; if(b.share>big){big=b.share;bigName=b.name;}
  sv.appendChild(rect(bx,BRY,bw,BRH,cols[i]));
  if(bw>26){sv.appendChild(txt(bx+bw/2,BRY+12,b.name,'var(--ink)','middle',7));
   sv.appendChild(txt(bx+bw/2,BRY+23,'$'+Math.round(b.share*TOTAL)+'k','var(--ink)','middle',7));}
  // leaves
  let lx=bx; b.leaves.forEach((lf,j)=>{
   const lw=lf.f*bw;
   const r=rect(lx,LFY,lw-1.5,LFH,cols[i]); r.setAttribute('opacity',j===0?0.75:0.45);
   if(j===0){r.setAttribute('cursor','ew-resize'); r.style.cursor='ew-resize';
    r.addEventListener('pointerdown',ev=>{ev.preventDefault();r.setPointerCapture(ev.pointerId);drag={bi:i,bx:bx,bw:bw};});
   }
   sv.appendChild(r);
   if(lw>24){sv.appendChild(txt(lx+lw/2,LFY+14,lf.name,'var(--ink)','middle',6.5));
    sv.appendChild(txt(lx+lw/2,LFY+25,'$'+Math.round(lf.f*b.share*TOTAL)+'k','var(--ink)','middle',6.5));}
   lx+=lw;
  });
  // branch drag handle on right edge (resize branch)
  if(i<branches.length-1){
   const h=rect(bx+bw-2,BRY,4,BRH,'var(--hot)'); h.setAttribute('opacity',0.0); h.style.cursor='ew-resize';
   h.addEventListener('pointerdown',ev=>{ev.preventDefault();h.setPointerCapture(ev.pointerId);drag={branchEdge:i,startX:bx};});
   sv.appendChild(h);
   const vis=rect(bx+bw-1,BRY-2,2,BRH+4,'var(--hot)'); vis.setAttribute('opacity',0.5); sv.appendChild(vis);
  }
  bx+=bw;
 });
 cap.innerHTML='Biggest branch is <b>'+bigName+'</b> at $'+Math.round(big*TOTAL)+'k. Drag a leaf to re-split; drag a divider to rebalance branches.';
}
sv.addEventListener('pointermove',e=>{
 if(!drag)return; const p=pt(e);
 if(drag.branchEdge!=null){
  const i=drag.branchEdge; let left=X0; for(let k=0;k<i;k++)left+=branches[k].share*W;
  const minw=18; let neww=p.x-left; const pairW=(branches[i].share+branches[i+1].share)*W;
  neww=Math.max(minw,Math.min(pairW-minw,neww));
  branches[i].share=neww/W; branches[i+1].share=(pairW-neww)/W; draw();
 } else if(drag.bi!=null){
  let f=(p.x-drag.bx)/drag.bw; f=Math.max(0.12,Math.min(0.88,f));
  branches[drag.bi].leaves[0].f=f; branches[drag.bi].leaves[1].f=1-f; draw();
 }
});
sv.addEventListener('pointerup',()=>{drag=null;});
norm(); draw();
})();

/* ---- merged inline block ---- */
(function(){
  const root=document.getElementById('c-allocgrid');
  const sv=document.getElementById('s-allocgrid');
  const cap=document.getElementById('cap-allocgrid');
  const SVG='http://www.w3.org/2000/svg';
  const people=['Ana','Bo','Cy','Di'];
  const weeks=['W1','W2','W3','W4','W5'];
  // rows=people, cols=weeks; load 0-100(+) percent
  const load=[
    [40,70,90,60,30],
    [80,85,110,50,20],
    [30,40,60,95,70],
    [60,50,45,80,120]
  ];
  const L=42,T=20,cw=52,ch=22,gap=3;
  let drag=null;
  function el(t,a){const e=document.createElementNS(SVG,t);for(const k in a)e.setAttribute(k,a[k]);return e;}
  function P(x,y){const p=sv.createSVGPoint();p.x=x;p.y=y;return p.matrixTransform(sv.getScreenCTM().inverse());}
  function draw(){
    while(sv.firstChild)sv.removeChild(sv.firstChild);
    // week headers
    weeks.forEach((w,c)=>sv.appendChild(el('text',{x:L+c*cw+(cw-gap)/2,y:T-7,'text-anchor':'middle','font-size':8,fill:'var(--mut)'})).textContent=w);
    people.forEach((p,r)=>{
      sv.appendChild(el('text',{x:L-5,y:T+r*ch+ch*.62,'text-anchor':'end','font-size':9,fill:'var(--ink)'})).textContent=p;
      load[r].forEach((v,c)=>{
        const x=L+c*cw, y=T+r*ch, bw=cw-gap, bh=ch-gap;
        sv.appendChild(el('rect',{x,y,width:bw,height:bh,fill:'var(--faint)',stroke:'var(--faint)'}));
        const frac=Math.min(v,100)/100, fh=bh*frac, over=v>100;
        const fill=over?'var(--hot)':(v>=90?'var(--c4)':'var(--c1)');
        sv.appendChild(el('rect',{x,y:y+bh-fh,width:bw,height:fh,fill,opacity:.85}));
        const h=el('rect',{x,y,width:bw,height:bh,fill:'transparent',stroke:over?'var(--hot)':'var(--mut)','stroke-width':over?1.4:.4,style:'cursor:ns-resize'});
        h.addEventListener('pointerdown',ev=>{drag={r,c};h.setPointerCapture(ev.pointerId);ev.preventDefault();});
        h.addEventListener('pointermove',ev=>{if(!drag||drag.r!==r||drag.c!==c)return;const pt=P(ev.clientX,ev.clientY);let f=(y+bh-pt.y)/bh;f=Math.max(0,Math.min(1.2,f));load[r][c]=Math.round(f*100/5)*5;draw();});
        h.addEventListener('pointerup',()=>{drag=null;});
        sv.appendChild(h);
      });
    });
    upd();
  }
  function upd(){
    let best=0,bi=0,overs=[];
    people.forEach((p,r)=>{
      let s=0;
      load[r].forEach((v,c)=>{s+=v;if(v>100)overs.push(p+' '+weeks[c]);});
      if(s>best){best=s;bi=r;}
    });
    const avg=Math.round(best/weeks.length);
    let msg='<b>'+people[bi]+'</b> is most loaded at <b>'+avg+'%</b> avg across the 5 weeks';
    msg+= overs.length? '; over-allocated: <b>'+overs.join(', ')+'</b>' : '; no cell exceeds 100%';
    cap.innerHTML=msg;
  }
  draw();
})();