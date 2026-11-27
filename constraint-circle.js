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
function constraintCircleReferences(c){return [c.carrier,c.target,...arcPointReferences(c.point)].filter(Boolean);}
