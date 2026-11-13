/* All coordinates here are in the drawing's mathematical frame (Y grows up). */
const freeDistance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const freeCross = (a,b) => a.x*b.y-a.y*b.x;
const freeDelta = (a,b) => ({x:a.x-b.x,y:a.y-b.y});

function freePoint(curve,t) {
    if (curve.a) return {x:curve.a.x+t*(curve.b.x-curve.a.x),y:curve.a.y+t*(curve.b.y-curve.a.y)};
    const angle=curve.start+t*(curve.end-curve.start);
    return {x:curve.center.x+curve.radius*Math.cos(angle),y:curve.center.y+curve.radius*Math.sin(angle)};
}

function freeParameter(curve,p,epsilon) {
    if (curve.a) {
        const v=freeDelta(curve.b,curve.a), w=freeDelta(p,curve.a);
        const length=Math.hypot(v.x,v.y);
        if (length<=epsilon || Math.abs(freeCross(v,w))>epsilon*length) return null;
        const t=(w.x*v.x+w.y*v.y)/(length*length);
        return t>=-epsilon/length && t<=1+epsilon/length ? Math.max(0,Math.min(1,t)) : null;
    }
    if (Math.abs(freeDistance(curve.center,p)-curve.radius)>epsilon) return null;
    if (freeDistance(freePoint(curve,0),p)<=epsilon) return 0;
    if (freeDistance(freePoint(curve,1),p)<=epsilon) return 1;
    const sweep=curve.end-curve.start;
    const angle=Math.atan2(p.y-curve.center.y,p.x-curve.center.x);
    const t=arcAngle((angle-curve.start)*Math.sign(sweep))/Math.abs(sweep);
    return t<=1 ? t : null;
}

function freeContacts(first,second,epsilon) {
    if (!first.a && second.a) return freeContacts(second,first,epsilon);
    if (first.a) {
        const v=freeDelta(first.b,first.a);
        if (second.a) {
            const w=freeDelta(second.b,second.a), det=freeCross(v,w);
            if (Math.abs(det)<=epsilon*Math.max(freeDistance(first.a,first.b),freeDistance(second.a,second.b)))
                return [first.a,first.b,second.a,second.b]; // clipped below, including collinear overlaps
            return [freePoint(first,freeCross(freeDelta(second.a,first.a),w)/det)];
        }
        const length=freeDistance(first.a,first.b);
        if (length<=epsilon) return [];
        const w=freeDelta(second.center,first.a);
        const t=(w.x*v.x+w.y*v.y)/(length*length);
        const h=Math.abs(freeCross(w,v))/length;
        if (h>second.radius+epsilon) return [];
        if (Math.abs(h-second.radius)<=epsilon) return [freePoint(first,t)];
        const offset=Math.sqrt((second.radius-h)*(second.radius+h))/length;
        return [freePoint(first,t-offset),freePoint(first,t+offset)];
    }
    if (freeDistance(first.center,second.center)<=epsilon && Math.abs(first.radius-second.radius)<=epsilon)
        return [freePoint(first,0),freePoint(first,1),freePoint(second,0),freePoint(second,1)];
    return circleArcContacts(first,second).map(({angle})=>({x:first.center.x+first.radius*Math.cos(angle),y:first.center.y+first.radius*Math.sin(angle)}));
}

function buildFreeSegments(curves, centers = []) {
    const size=curves.reduce((n,c)=>Math.max(n,c.a?freeDistance(c.a,c.b):c.radius),1);
    const epsilon=size*1e-8;
    const key=p=>[p.x,p.y].map(x=>Math.round(x/epsilon)).join(',');
    const worldKey=p=>[p.x,p.y].map(x=>Number(x.toFixed(7))).join(',');
    const points=new Map(), pieces=[];
    const cuts=curves.map(c=>[0,1].map(t=>({t,p:freePoint(c,t)})));
    for(let i=0;i<curves.length;i++) for(let j=i+1;j<curves.length;j++) {
        for(const p of freeContacts(curves[i],curves[j],epsilon)) {
            const a=freeParameter(curves[i],p,epsilon), b=freeParameter(curves[j],p,epsilon);
            if (a===null || b===null) continue;
            cuts[i].push({t:a,p});cuts[j].push({t:b,p});
        }
    }
    const centerIds = new Set();
    for (const center of centers) {
        const id = key(center);
        if (centerIds.has(id)) continue;
        centerIds.add(id);
        points.set(id, center);
        curves.forEach((curve, index) => {
            const t = freeParameter(curve, center, epsilon);
            if (t !== null) cuts[index].push({t, p:center});
        });
    }
    curves.forEach((curve,i)=>{
        const ordered=cuts[i].sort((a,b)=>a.t-b.t);
        for(let j=1;j<ordered.length;j++) {
            const from=ordered[j-1],to=ordered[j];
            if (to.t-from.t<1e-9) continue;
            const a=from.p,b=to.p;
            const ends=[key(a),key(b)];
            points.set(ends[0],a);points.set(ends[1],b);
            const middle=freePoint(curve,(from.t+to.t)/2);
            const id=[...([worldKey(a),worldKey(b)].sort()),worldKey(middle)].join('/');
            const path=curve.a ? `M ${a.x} ${-a.y} L ${b.x} ${-b.y}` :
                circleArcPath(curve,{start:curve.start+from.t*(curve.end-curve.start),end:curve.start+to.t*(curve.end-curve.start)});
            pieces.push({id,ends,path,curve});
        }
    });
    return {points,pieces,centerIds};
}

function createFreeEditor(state,update,repaint) {
    const el=id=>document.getElementById(id);
    const styles=new Map(),history=[];
    const connections=[];
    let pendingConnection=null;
    let selected=[],choices=[],choice=0;
    function reset() { pendingConnection=null; selected=[];choices=[];choice=0; }
    const api={
        active:false,
        hasEdits:()=>styles.size>0 || connections.length>0,
        close(){api.active=false;reset();},
        render(curves,board,svg,centers){
            el('free-panel').hidden=!api.active;
            el('create-editor').setAttribute('aria-pressed',String(api.active));
            el('create-editor').textContent=api.active?'Exit editor':'Create editor';
            if (!api.active && !api.hasEdits()) return;
            for (const {a,b} of connections) {
                const element=svg('line',{x1:a.x,y1:-a.y,x2:b.x,y2:-b.y,stroke:'#93e7cd','stroke-width':2,'vector-effect':'non-scaling-stroke','pointer-events':'none'});
                board.append(element);
                curves.push({a,b,element});
            }
            const {points,pieces,centerIds}=buildFreeSegments(curves,centers);
            if (selected.some(id=>!points.has(id))) reset();
            choices=[...new Set(pieces.filter(p=>selected.length===2 && selected.every(id=>p.ends.includes(id))).map(p=>p.id))];
            pendingConnection=null;
            if (selected.length===2) {
                const [a,b]=selected.map(id=>points.get(id));
                const epsilon=freeDistance(a,b)*1e-8;
                const connected=curves.some(curve=>curve.a && freeParameter(curve,a,epsilon)!==null && freeParameter(curve,b,epsilon)!==null);
                if (!connected) pendingConnection={a,b};
            }
            el('free-connect').disabled=!pendingConnection;
            choice=choice<choices.length?choice:0;
            const byCurve=new Map();
            for(const piece of pieces) {
                if (!byCurve.has(piece.curve)) byCurve.set(piece.curve,[]);
                byCurve.get(piece.curve).push(piece);
            }
            for(const [curve,parts] of byCurve) {
                if (!parts.some(p=>styles.has(p.id))) continue;
                for(const part of parts) {
                    const style=styles.get(part.id);
                    if (style==='hidden') continue;
                    const path=svg('path',{d:part.path,fill:'none','pointer-events':'none'});
                    for(const attr of ['stroke','stroke-width','stroke-dasharray','vector-effect','opacity']) {
                        const value=curve.element.getAttribute(attr);
                        if(value!==null) path.setAttribute(attr,value);
                    }
                    if(style) path.setAttribute('stroke-dasharray',style==='dashed'?'6 4':'none');
                    curve.element.before(path);
                }
                curve.element.remove();
            }
            if (!api.active) return;
            const chosen=pieces.find(p=>p.id===choices[choice]);
            if(chosen) board.append(svg('path',{d:chosen.path,fill:'none',stroke:'#ffce78','stroke-width':5,'vector-effect':'non-scaling-stroke','pointer-events':'none'}));
            const scale=board.getScreenCTM()?.a || 1;
            for(const [id,p] of points) {
                const dot=svg('circle',{cx:p.x,cy:-p.y,r:5/scale,fill:selected.includes(id)?'#ffce78':centerIds.has(id)?'#77baff':'#93e7cd',stroke:'#203933','stroke-width':1.4,'vector-effect':'non-scaling-stroke',tabindex:0,role:'button','aria-label':`Select ${centerIds.has(id) ? 'circle center' : 'point'} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`});
                dot.style.cursor='pointer';
                const select=()=>{if(selected.includes(id))selected=selected.filter(k=>k!==id);else {if(selected.length===2)reset();selected.push(id);}choice=0;repaint();};
                dot.onclick=select;
                dot.onkeydown=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();select();}};
                board.append(dot);
            }
            el('free-help').textContent=!selected.length?'Select a blue circle center or a green endpoint or intersection. Enable Show axes to edit axis segments.':selected.length===1?'Select a second point.':!chosen?(pendingConnection?'Click Connect points to draw a straight segment.':'Select neighboring points to style part of this line.'):choices.length>1?`Segment ${choice+1} of ${choices.length}. Use Next segment to choose the highlighted path.`:'Selected segment highlighted. Choose a style.';
            el('free-next').hidden=choices.length<2;
            for(const id of ['free-dash','free-hide','free-solid']) el(id).disabled=!chosen;
            el('free-clear').disabled=!selected.length;
            el('free-undo').disabled=!history.length;
        }
    };
    el('create-editor').onclick=()=>{api.active=!api.active;reset();state.arcEditing=false;state.tangentToolId=null;update();};
    el('free-clear').onclick=()=>{reset();repaint();};
    el('free-connect').onclick=()=>{
        if (!api.active || !pendingConnection) return;
        connections.push(pendingConnection);
        history.push({connection:pendingConnection});
        reset();
        repaint();
    };
    el('free-next').onclick=()=>{choice=(choice+1)%choices.length;repaint();};
    for(const [button,style] of [['free-dash','dashed'],['free-hide','hidden'],['free-solid','solid']]) {
        el(button).onclick=()=>{const id=choices[choice];if(!id || styles.get(id)===style)return;history.push({id,previous:styles.get(id)});styles.set(id,style);reset();repaint();};
    }
    el('free-undo').onclick=()=>{const edit=history.pop();if(!edit)return;if(edit.connection) connections.pop();else if(edit.previous)styles.set(edit.id,edit.previous);else styles.delete(edit.id);reset();repaint();};
    return api;
}
