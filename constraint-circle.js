// One-dimensional solve in the carrier circle's local axis frame.
function solveCenterTangentPoint(carrier,target,point,mode='external') {
    const scale=Math.max(carrier.radius,target.radius,Math.hypot(point.x-carrier.center.x,point.y-carrier.center.y),1e-12);
    const rotation=(carrier.axis?.rotation||0)*Math.PI/180;
    const center=t=>({x:carrier.center.x+carrier.radius*Math.cos(t+rotation),y:carrier.center.y+carrier.radius*Math.sin(t+rotation)});
    const f=t=>{const o=center(t),r=Math.hypot(o.x-point.x,o.y-point.y),d=Math.hypot(o.x-target.center.x,o.y-target.center.y);return (d-(mode==='external'?r+target.radius:Math.abs(r-target.radius)))/scale;};
    const n=4096,step=2*Math.PI/n,values=Array.from({length:n+1},(_,i)=>f(i*step));
    if(values.every(v=>Math.abs(v)<1e-9))throw new Error('These constraints admit infinitely many circles. Choose a different point or tangent circle.');
    const angles=[];
    function add(t){t=(t%(2*Math.PI)+2*Math.PI)%(2*Math.PI);if(Math.abs(f(t))>1e-8)return;
        const o=center(t),r=Math.hypot(o.x-point.x,o.y-point.y);
        if(r<scale*1e-9)return;
        if(mode==='internal'&&Math.hypot(o.x-target.center.x,o.y-target.center.y)<scale*1e-8&&Math.abs(r-target.radius)<scale*1e-8)return;
        if(!angles.some(a=>Math.abs(Math.atan2(Math.sin(a-t),Math.cos(a-t)))<1e-6))angles.push(t);
    }
    for(let i=0;i<n;i++){
        if(Math.abs(values[i])<1e-10)add(i*step);
        if(values[i]*values[i+1]<0){let lo=i*step,hi=(i+1)*step,fl=values[i];for(let j=0;j<55;j++){const m=(lo+hi)/2,fm=f(m);if(fl*fm<=0)hi=m;else{lo=m;fl=fm;}}add((lo+hi)/2);}
        // Tangential roots do not change sign: minimize the local residual.
        if(Math.abs(values[i])<=Math.abs(values[(i+n-1)%n])&&Math.abs(values[i])<=Math.abs(values[i+1])){
            let lo=(i-1)*step,hi=(i+1)*step;for(let j=0;j<65;j++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(Math.abs(f(a))<Math.abs(f(b)))hi=b;else lo=a;}add((lo+hi)/2);
        }
    }
    return angles.sort((a,b)=>a-b).map(angle=>{const o=center(angle);return {center:o,radius:Math.hypot(o.x-point.x,o.y-point.y),angle};});
}
function circleConstraintItems(c) {return c.constraints||[{type:'centerCircle',circle:c.carrier},{type:'tangent',circle:c.target,mode:c.mode},{type:'point',point:c.point}];}
function constraintCircleReferences(c){return circleConstraintItems(c).flatMap(q=>[q.circle,...arcPointReferences(q.point),...arcPointReferences(q.a),...arcPointReferences(q.b)]).filter(Boolean);}
function solveCircleConstraints(config,evaluate){
 const items=circleConstraintItems(config);
 const data=items.map(q=>{
  if(q.type==='tangent'||q.type==='centerCircle')return {...q,c:resolveArcCircle(q.circle,evaluate)};
  if(q.type==='point'){if(!q.point)throw Error('Select the through point.');return {...q,p:resolveArcPoint(q.point,evaluate)};}
  if(q.type==='centerLine'){if(!q.a||!q.b)throw Error('Select two points defining the center line.');return {...q,a:resolveArcPoint(q.a,evaluate),b:resolveArcPoint(q.b,evaluate)};}
  if(q.type==='radius'){if(!(q.value>0))throw Error('Radius must be positive.');return q;}
  throw Error('Choose three constraint types.');
 });
 const anchors=data.flatMap(q=>q.c?[q.c.center]:q.p?[q.p]:q.a?[q.a,q.b]:[]);
 if(!anchors.length)throw Error('Constraints do not determine a center.');
 const origin=anchors[0],scale=Math.max(...anchors.map(p=>Math.hypot(p.x-origin.x,p.y-origin.y)),...data.map(q=>q.c?.radius||q.value||0),1e-9);
 const norm=p=>({x:(p.x-origin.x)/scale,y:(p.y-origin.y)/scale});
 const d=data.map(q=>({...q,c:q.c?{center:norm(q.c.center),radius:q.c.radius/scale}:null,p:q.p?norm(q.p):null,a:q.a?norm(q.a):null,b:q.b?norm(q.b):null,value:q.value/scale}));
 const signature=q=>JSON.stringify([q.type,q.c,q.p,q.a,q.b,q.value,q.mode]);
 if(new Set(d.map(signature)).size<3)throw Error('Repeated constraints: choose independent conditions.');
 for(const q of d)if(q.a&&Math.hypot(q.a.x-q.b.x,q.a.y-q.b.y)<1e-10)throw Error('The center line needs two distinct points.');
 function equations(v){const [x,y,r]=v;return d.map(q=>{
  if(q.type==='radius')return {f:r-q.value,j:[0,0,1]};
  if(q.type==='centerLine'){const dx=q.b.x-q.a.x,dy=q.b.y-q.a.y,len=Math.hypot(dx,dy);return {f:((x-q.a.x)*dy-(y-q.a.y)*dx)/len,j:[dy/len,-dx/len,0]};}
  const p=q.p||q.c.center,dx=x-p.x,dy=y-p.y;
  if(q.type==='centerCircle')return {f:dx*dx+dy*dy-q.c.radius*q.c.radius,j:[2*dx,2*dy,0]};
  const t=r+(q.type==='tangent'?(q.mode==='internal'?-q.c.radius:q.c.radius):0);
  return {f:dx*dx+dy*dy-t*t,j:[2*dx,2*dy,-2*t]};
 });}
 function linear(rows){const a=rows.map(q=>[...q.j,-q.f]);for(let k=0;k<3;k++){let pivot=k;for(let i=k+1;i<3;i++)if(Math.abs(a[i][k])>Math.abs(a[pivot][k]))pivot=i;if(Math.abs(a[pivot][k])<1e-12)return null;[a[k],a[pivot]]=[a[pivot],a[k]];const v=a[k][k];for(let j=k;j<4;j++)a[k][j]/=v;for(let i=0;i<3;i++)if(i!==k){const f=a[i][k];for(let j=k;j<4;j++)a[i][j]-=f*a[k][j];}}return a.map(q=>q[3]);}
 const results=[];let singular=false;
 const seeds=[];
 for(const q of d)if(q.c)for(let i=0;i<24;i++)seeds.push([q.c.center.x+q.c.radius*Math.cos(i*Math.PI/12),q.c.center.y+q.c.radius*Math.sin(i*Math.PI/12)]);
 for(const x of [-8,-2,-1,0,.5,1,2,8])for(const y of [-8,-2,-1,0,.5,1,2,8])seeds.push([x,y]);
 for(const [x,y]of seeds)for(const radius of [.1,.5,1,2,8]){
  let v=[x,y,radius];
  for(let it=0;it<45;it++){
   const rows=equations(v),err=Math.max(...rows.map(q=>Math.abs(q.f))),delta=linear(rows);
   if(err<1e-10){if(!delta)singular=true;break;}if(!delta)break;
   let alpha=1;while(alpha>1/128){const next=v.map((n,i)=>n+alpha*delta[i]);if(Math.max(...equations(next).map(q=>Math.abs(q.f)))<err){v=next;break;}alpha/=2;}if(alpha<=1/128)break;
  }
  if(v[2]<1e-8||!v.every(Number.isFinite)||Math.max(...equations(v).map(q=>Math.abs(q.f)))>1e-8)continue;
  if(d.some(q=>q.type==='tangent'&&Math.hypot(v[0]-q.c.center.x,v[1]-q.c.center.y)<1e-7&&Math.abs(v[2]-q.c.radius)<1e-7))continue;
  if(!results.some(o=>Math.hypot(o[0]-v[0],o[1]-v[1],o[2]-v[2])<1e-5))results.push(v);
 }
 if(results.length>16||singular&&results.length>1)throw Error('Constraints may be dependent. Choose an additional independent condition.');
 return results.sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map((v,index)=>({center:{x:origin.x+scale*v[0],y:origin.y+scale*v[1]},radius:v[2]*scale,angle:index,signature:v}));
}
