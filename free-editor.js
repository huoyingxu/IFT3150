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

// Display an unbounded construction line across the current geometry, with margin.
// Endpoints remain dependent on the original two selected points.
function extendFreeLine(a,b,curves) {
    const length=freeDistance(a,b);
    if(length<1e-9) return null;
    const u={x:(b.x-a.x)/length,y:(b.y-a.y)/length};
    const project=p=>(p.x-a.x)*u.x+(p.y-a.y)*u.y;
    let lo=0,hi=length;
    for(const curve of curves) {
        const values=curve.a?[project(curve.a),project(curve.b)]:
            [project(curve.center)-curve.radius,project(curve.center)+curve.radius];
        lo=Math.min(lo,...values);hi=Math.max(hi,...values);
    }
    const margin=Math.max(hi-lo,length)*0.04;
    return {a:{x:a.x+u.x*(lo-margin),y:a.y+u.y*(lo-margin)},
        b:{x:a.x+u.x*(hi+margin),y:a.y+u.y*(hi+margin)}};
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
            pieces.push({id,ends,path,curve,a,b,middle});
        }
    });
    return {points,pieces,centerIds};
}

// A registry identifies each source circle/arc by node and member ordinal.
function freeSourceRegistry(state, curves) {
    const sources=new Map();
    for (const curve of curves) {
        if (curve.key && curve.a) sources.set(curve.key.replace(/@\d+:/g, ':'),curve);
    }
    if(!state.nodes) curves.filter(curve=>!curve.a && curve.key).forEach(curve=>sources.set(curve.key,curve));
    for (const node of state.nodes || []) {
        (state.evaluation.results.get(node.id) || []).forEach((object,index)=>{
            const start=object.type==='arc' ? object.start : (object.axis?.rotation || 0)*Math.PI/180;
            sources.set(node.id+':'+index,{...object,start,
                end:object.type==='arc' ? object.end : start+ARC_TAU});
        });
    }
    return sources;
}

function captureFreePoint(point,sources) {
    const scale=Math.max(1,...[...sources.values()].map(c=>c.radius || freeDistance(c.a,c.b)));
    const epsilon=scale*1e-7;
    for (const [key,curve] of sources) {
        if (curve.center && freeDistance(point,curve.center)<=epsilon)
            return {kind:'center',key};
    }
    // Full source circles avoid references to temporary split-arc boundaries.
    const entries=[...sources].filter(([key])=>!key.includes('@') && !key.includes('>') && !key.includes('/full'));
    const on=entries.filter(([,curve])=>freeParameter(curve,point,epsilon)!==null);
    for (let i=0;i<on.length;i++) {
        for (let j=i+1;j<on.length;j++) {
            const [first,a]=on[i], [second,b]=on[j];
            if(a.center && b.center && freeDistance(a.center,b.center)<=epsilon &&
                Math.abs(a.radius-b.radius)<=epsilon) continue;
            const contacts=freeContacts(a,b,epsilon).filter(p=>
                freeParameter(a,p,epsilon)!==null && freeParameter(b,p,epsilon)!==null);
            const branch=contacts.findIndex(p=>freeDistance(p,point)<=epsilon);
            if(branch>=0) return {kind:'intersection',first,second,branch,count:contacts.length};
        }
    }
    if(on.length) {
        const [key,curve]=on[0];
        return {kind:'parameter',key,t:freeParameter(curve,point,epsilon)};
    }
    return {kind:'fixed',point:{...point}};
}

function resolveFreePoint(reference,sources) {
    if(reference.kind==='fixed') return reference.point;
    if(reference.kind==='center') return sources.get(reference.key)?.center || null;
    if(reference.kind==='parameter') {
        const curve=sources.get(reference.key);
        return curve ? freePoint(curve,reference.t) : null;
    }
    const a=sources.get(reference.first),b=sources.get(reference.second);
    if(!a || !b) return null;
    const epsilon=Math.max(1,a.radius || freeDistance(a.a,a.b),b.radius || freeDistance(b.a,b.b))*1e-7;
    const contacts=freeContacts(a,b,epsilon).filter(p=>
        freeParameter(a,p,epsilon)!==null && freeParameter(b,p,epsilon)!==null);
    return contacts.length===reference.count ? contacts[reference.branch] || null : null;
}

// Compare congruent segments under rotation or reflection around a construction center.
function findSimilarFreeSegments(reference, pieces, origin, targetOrigin = () => origin) {
    const family = curve => curve.key ? curve.key.split('@')[0].split('/')[0] : 'free-lines';
    const tolerance = Math.max(1, freeDistance(reference.a,origin),
        freeDistance(reference.b,origin), freeDistance(reference.middle,origin)) * 1e-6;
    const source = [origin,reference.a,reference.middle,reference.b];
    return pieces.filter(piece => {
        if (family(piece.curve) !== family(reference.curve) ||
            Boolean(piece.curve.a) !== Boolean(reference.curve.a)) return false;
        if (!piece.curve.a && Math.abs(piece.curve.radius-reference.curve.radius)>tolerance) return false;
        return [[piece.a,piece.middle,piece.b],[piece.b,piece.middle,piece.a]].some(points => {
            const target = [targetOrigin(piece),...points];
            for (let i=0;i<source.length;i++) {
                for (let j=i+1;j<source.length;j++) {
                    if (Math.abs(freeDistance(source[i],source[j])-freeDistance(target[i],target[j]))>tolerance)
                        return false;
                }
            }
            return true;
        });
    });
}

function freeParentCircle(piece,state) {
    const match=piece.curve.key?.match(/^([^@]+)@\d+:(\d+)/);
    if(!match) return null;
    const node=state.nodes?.find(node=>node.id===match[1]);
    if(node?.kind!=='tangent') return null;
    let index=Number(match[2]);
    for(const parent of state.evaluation.results.get(node.sourceId) || []) {
        if(index<parent.axis.nRosy) return parent;
        index-=parent.axis.nRosy;
    }
    return null;
}

function findGroupedFreeSegments(reference,pieces,state,scope) {
    const parent=freeParentCircle(reference,state);
    if(!parent) return null;
    const candidates=pieces.filter(piece=>{
        const other=freeParentCircle(piece,state);
        return other && (scope!=='local' || other===parent);
    });
    return findSimilarFreeSegments(reference,candidates,parent.center,piece=>freeParentCircle(piece,state).center);
}

function similarFreeConnections(connection,state,sources,points,curves,scope) {
    if(!connection || !state.nodes) return [];
    const a=resolveFreePoint(connection.aRef,sources),b=resolveFreePoint(connection.bRef,sources);
    if(!a || !b) return [];
    const circles=state.nodes.flatMap(node=>(state.evaluation.results.get(node.id)||[])
        .filter(circle=>circle.type==='circle').map(circle=>({node,circle})));
    // The smallest containing circle is the local construction frame.
    const enclosing=circles.filter(({circle})=>[a,b].every(point=>
        freeDistance(point,circle.center)<=circle.radius*(1+1e-7)));
    enclosing.sort((x,y)=>x.circle.radius-y.circle.radius);
    const source=scope==='global'?enclosing.at(-1):enclosing[0];
    if(!source) return [];
    const targets=scope==='groups'?circles.filter(entry=>entry.node.id===source.node.id):[source];
    const candidates=[];
    for(const {circle} of targets) {
        const count=circle.axis?.nRosy || 1;
        const epsilon=Math.max(1,circle.radius)*1e-6;
        for(let i=0;i<count;i++) {
            const angle=((circle.axis?.rotation || 0)-(source.circle.axis?.rotation || 0))*Math.PI/180+i*ARC_TAU/count;
            const scale=circle.radius/source.circle.radius;
            const transform=point=>{
                const x=(point.x-source.circle.center.x)*scale,y=(point.y-source.circle.center.y)*scale;
                return {x:circle.center.x+x*Math.cos(angle)-y*Math.sin(angle),
                    y:circle.center.y+x*Math.sin(angle)+y*Math.cos(angle)};
            };
            const ends=[a,b].map(point=>{
                const transformed=transform(point);
                return [...points.values()].find(p=>freeDistance(p,transformed)<=epsilon);
            });
            if(ends.some(point=>!point) || freeDistance(...ends)<=epsilon) continue;
            const [start,end]=ends;
            const exists=[...curves,...candidates].some(curve=>curve.a &&
                freeParameter(curve,start,epsilon)!==null && freeParameter(curve,end,epsilon)!==null);
            if(exists) continue;
            const aRef=captureFreePoint(start,sources),bRef=captureFreePoint(end,sources);
            if(aRef.kind==='fixed' || bRef.kind==='fixed') continue;
            candidates.push({a:start,b:end,aRef,bRef});
        }
    }
    return candidates;
}

function freeStyleReference(piece,sources) {
    const match=piece.curve.key?.match(/^([^@]+)@\d+:(\d+)/);
    const key=match && !piece.curve.a ? match[1]+':'+match[2] : piece.curve.key?.replace(/@\d+:/g, ':');
    const curve=sources.get(key);
    if(!curve) return {id:piece.id};
    const aRef=captureFreePoint(piece.a,sources),bRef=captureFreePoint(piece.b,sources);
    const start=freeParameter(curve,piece.a,1e-6),end=freeParameter(curve,piece.b,1e-6);
    const middle=freeParameter(curve,piece.middle,1e-6);
    const wrap=value=>(value%1+1)%1;
    return {key,aRef,bRef,full:!curve.a && freeDistance(piece.a,piece.b)<1e-7,
        forward:curve.a || wrap(middle-start)<=wrap(end-start)+1e-7};
}

function resolveFreeStyle(reference,pieces,sources) {
    if(!reference.key) return pieces.filter(piece=>piece.id===reference.id);
    const curve=sources.get(reference.key);
    if(!curve) return [];
    const a=resolveFreePoint(reference.aRef,sources),b=resolveFreePoint(reference.bRef,sources);
    if(!a || !b) return [];
    const epsilon=Math.max(1,curve.radius || freeDistance(curve.a,curve.b))*1e-7;
    const start=freeParameter(curve,a,epsilon),end=freeParameter(curve,b,epsilon);
    if(start===null || end===null) return [];
    const wrap=value=>(value%1+1)%1;
    return pieces.filter(piece=>{
        const match=piece.curve.key?.match(/^([^@]+)@\d+:(\d+)/);
        const key=match && !piece.curve.a ? match[1]+':'+match[2] : piece.curve.key?.replace(/@\d+:/g, ':');
        if(key!==reference.key) return false;
        const t=freeParameter(curve,piece.middle,epsilon);
        if(t===null) return false;
        if(curve.a) return t>Math.min(start,end)-1e-8 && t<Math.max(start,end)+1e-8;
        if(reference.full) return true;
        return reference.forward ? wrap(t-start)<=wrap(end-start)+1e-8 : wrap(t-end)<=wrap(start-end)+1e-8;
    });
}

function freeCirclePieces(reference,pieces) {
    return pieces.filter(piece=>{
        if(piece.curve.a)return false;
        const match=piece.curve.key?.match(/^([^@]+)@\d+:(\d+)/);
        const key=match?match[1]+':'+match[2]:piece.curve.key;
        return key===reference.key;
    });
}

function relatedFreePieces(reference,pieces,state,scope) {
    if(scope!=='global') {
        const grouped=findGroupedFreeSegments(reference,pieces,state,scope);
        if(grouped) return grouped;
    }
    const nodeId=reference.curve.key?.split('@')[0].split('/')[0];
    const chain=nodeId && state.nodes ? getSourceChain(state.nodes,nodeId) : [];
    let roots=chain.filter(node=>node.kind==='circle').flatMap(node=>state.evaluation.results.get(node.id)||[]);
    if(!roots.length) roots=(state.nodes || []).filter(node=>node.kind==='circle').flatMap(node=>state.evaluation.results.get(node.id)||[]);
    const outer=roots.sort((a,b)=>b.radius-a.radius)[0];
    return outer ? findSimilarFreeSegments(reference,pieces,outer.center) : [];
}

// Two selected points can delimit a whole arc across several intersection cuts.
function freeArcAlternatives(a,b,ends,pieces,sources) {
    const results=[];
    for(const [key,circle] of sources){
        if(circle.a || !circle.center || Math.abs(Math.abs(circle.end-circle.start)-Math.PI*2)>1e-7)continue;
        const eps=Math.max(1,circle.radius)*1e-7;
        if(Math.abs(freeDistance(a,circle.center)-circle.radius)>eps || Math.abs(freeDistance(b,circle.center)-circle.radius)>eps)continue;
        const parts=pieces.filter(p=>{
            if(p.curve.a)return false;
            const m=p.curve.key?.match(/^([^@]+)@\d+:(\d+)/);
            return (m?m[1]+':'+m[2]:p.curve.key)===key;
        });
        if(!parts.length)continue;
        const start=Math.atan2(a.y-circle.center.y,a.x-circle.center.x),end=Math.atan2(b.y-circle.center.y,b.x-circle.center.x);
        const ccw=arcAngle(end-start);
        for(const sweep of [ccw,ccw-Math.PI*2]){
            if(Math.abs(sweep)<1e-9)continue;
            const arc={...circle,start,end:start+sweep};
            const travel=p=>arcAngle((Math.atan2(p.y-circle.center.y,p.x-circle.center.x)-start)*Math.sign(sweep));
            const included=parts.filter(p=>travel(p.middle)<Math.abs(sweep)+1e-8);
            const length=included.reduce((sum,p)=>sum+arcAngle((Math.atan2(p.b.y-circle.center.y,p.b.x-circle.center.x)-Math.atan2(p.a.y-circle.center.y,p.a.x-circle.center.x))*Math.sign(p.curve.end-p.curve.start)),0);
            if(Math.abs(length-Math.abs(sweep))>1e-6)continue;
            const middle=freePoint(arc,.5);
            // Keep existing single-piece choices; add only alternatives spanning multiple pieces.
            if(included.length<=1)continue;
            results.push({id:'arc-selection/'+key+'/'+start+'/'+sweep,ends,a,b,middle,curve:{...circle,key},path:circleArcPath(arc,arc)});
        }
    }
    return results;
}

function createFreeEditor(state,update,repaint) {
    const el=id=>document.getElementById(id);
    const styles=new Map(),history=[];
    const connections=[], connectionRules=[], styleRules=[];
    let livePieces=[],livePoints=new Map(),liveSources=new Map(),lastHiddenReference=null;
    let lastConnection=null, pendingSimilar=[], extensionTarget=null;
    let nextConnectionId=1, geometrySignature=null;
    let pendingConnection=null;
    let lastHiddenId=null, similarPieces=[], previewSimilar=false;
    let selected=[],choices=[],choice=0;
    function reset() { pendingConnection=null; selected=[];choices=[];choice=0; }
    const api={
        active:false,
        arcPoints(){ return [...livePoints.values()].flatMap(position=>{
            try {const expression=editorPointExpression(captureFreePoint(position,liveSources),liveSources);
                return [{position,point:{kind:"editorPoint",expression},label:"Editor point ("+position.x.toFixed(1)+", "+position.y.toFixed(1)+")"}];
            } catch(_){return [];}
        });},
        hasEdits:()=>styleRules.length>0 || connections.length>0 || connectionRules.length>0,
        close(){api.active=false;reset();},
        render(curves,board,svg,centers){
            el('free-panel').hidden=!api.active;
            el('create-editor').setAttribute('aria-pressed',String(api.active));
            el('create-editor').textContent=api.active?'Exit editor':'Create editor';
            if (!api.active && !api.hasEdits()) return;
            const sources=freeSourceRegistry(state,curves);
            const signature=JSON.stringify([...sources].map(([key,c])=>[key,c.center,c.radius,c.start,c.end,c.a,c.b]));
            if(geometrySignature!==null && signature!==geometrySignature) {
                reset();
            }
            geometrySignature=signature;
            let unavailable=0;
            const extensionBounds=[...curves];
            function drawConnection(connection) {
                // Upgrade in-memory coordinate connections when their sources can still be identified.
                connection.aRef ||= captureFreePoint(connection.a,sources);
                connection.bRef ||= captureFreePoint(connection.b,sources);
                connection.key ||= 'connection/'+nextConnectionId++;
                const a=resolveFreePoint(connection.aRef,sources);
                const b=resolveFreePoint(connection.bRef,sources);
                if(!a || !b || freeDistance(a,b)<1e-9) { unavailable++; return; }
                const drawn=connection.extended?extendFreeLine(a,b,extensionBounds):{a,b};
                const visible=connection.extended&&!api.active?{a,b}:drawn;
                const element=svg('line',{x1:visible.a.x,y1:-visible.a.y,x2:visible.b.x,y2:-visible.b.y,stroke:'#93e7cd','stroke-width':2,'vector-effect':'non-scaling-stroke','pointer-events':'none'});
                board.append(element);
                const curve={...drawn,element,key:connection.key,construction:connection,displaySegment:connection.extended&&!api.active?{a,b}:null};
                curves.push(curve);
                sources.set(connection.key,curve);
            }
            connections.forEach(drawConnection);
            for(const rule of connectionRules) {
                const available=buildFreeSegments(curves,centers).points;
                const generated=similarFreeConnections(rule.template,state,sources,available,curves,rule.scope);
                generated.forEach((connection,index)=>drawConnection({...connection,key:rule.key+'/'+index}));
            }
            const {points,pieces,centerIds}=buildFreeSegments(curves,centers);
            livePieces=pieces;livePoints=points;
            liveSources=sources;
            styles.clear();
            for(const rule of styleRules) {
                const seed=resolveFreeStyle(rule.reference,pieces,sources);
                if(rule.keepOnly){
                    // If references disappear, do not hide an unrelated or entire circle.
                    if(seed.length){const keep=new Set(seed.map(p=>p.id));
                        for(const piece of freeCirclePieces(rule.reference,pieces))styles.set(piece.id,keep.has(piece.id)?'solid':'hidden');}
                    continue;
                }
                const targets=rule.scope ? seed.flatMap(piece=>relatedFreePieces(piece,pieces,state,rule.scope)) : seed;
                for(const piece of targets) styles.set(piece.id,rule.style);
            }
            if(lastHiddenReference) lastHiddenId=resolveFreeStyle(lastHiddenReference,pieces,sources)[0]?.id;
            pendingSimilar=similarFreeConnections(
                connections.includes(lastConnection)?lastConnection:null,
                state,sources,points,curves,el('free-scope').value || 'groups');
            el('free-add-similar').disabled=!pendingSimilar.length;
            el('free-add-similar').textContent=pendingSimilar.length?'Add similar segments ('+pendingSimilar.length+')':'Add similar segments';
            const reference=pieces.find(piece=>piece.id===lastHiddenId && styles.get(piece.id)==='hidden');
            similarPieces=[];
            if(reference) similarPieces=relatedFreePieces(reference,pieces,state,el('free-scope').value || 'groups');
            const matches=[...new Set(similarPieces.map(piece=>piece.id))].filter(id=>styles.get(id)!=='hidden');
            el('free-similar').disabled=!matches.length;
            el('free-preview').disabled=!matches.length && !pendingSimilar.length;
            el('free-similar').textContent=matches.length ? 'Hide similar segments ('+matches.length+')' : 'Hide similar segments';
            if (selected.some(id=>!points.has(id))) reset();
            const alternatives=selected.length===2?freeArcAlternatives(...selected.map(id=>points.get(id)),selected,pieces,sources):[];
            livePieces=pieces.concat(alternatives);
            choices=[...new Set(livePieces.filter(p=>selected.length===2 && selected.every(id=>p.ends.includes(id))).map(p=>p.id))];
            pendingConnection=null;
            if (selected.length===2) {
                const [a,b]=selected.map(id=>points.get(id));
                const epsilon=freeDistance(a,b)*1e-8;
                const connected=curves.some(curve=>curve.a && freeParameter(curve,a,epsilon)!==null && freeParameter(curve,b,epsilon)!==null);
                if (!connected) pendingConnection={a,b,aRef:captureFreePoint(a,sources),bRef:captureFreePoint(b,sources),key:'connection/'+nextConnectionId++};
            }
            el('free-connect').disabled=!pendingConnection;
            extensionTarget=null;
            if(selected.length===2) {
                const [a,b]=selected.map(id=>points.get(id));
                extensionTarget=connections.find(c=>{
                    const curve=sources.get(c.key);
                    return curve && freeParameter(curve,a,1e-6)!==null && freeParameter(curve,b,1e-6)!==null;
                });
            } else if(!selected.length && connections.includes(lastConnection)) extensionTarget=lastConnection;
            el('free-extend').disabled=!extensionTarget || Boolean(extensionTarget.extended);

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
                    let displayPath=part.path;
                    if(curve.displaySegment) {
                        const limits=[curve.displaySegment.a,curve.displaySegment.b].map(p=>freeParameter(curve,p,1e-6));
                        const ends=[part.a,part.b].map(p=>freeParameter(curve,p,1e-6));
                        const lo=Math.max(Math.min(...limits),Math.min(...ends));
                        const hi=Math.min(Math.max(...limits),Math.max(...ends));
                        if(hi-lo<1e-9)continue;
                        const a=freePoint(curve,lo),b=freePoint(curve,hi);
                        displayPath=`M ${a.x} ${-a.y} L ${b.x} ${-b.y}`;
                    }
                    const path=svg('path',{d:displayPath,fill:'none','pointer-events':'none'});
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
            if(previewSimilar) {
                for(const {a,b} of pendingSimilar) {
                    board.append(svg('path',{d:'M '+a.x+' '+(-a.y)+' L '+b.x+' '+(-b.y),
                        fill:'none',stroke:'#77baff','stroke-width':3,'stroke-dasharray':'5 4',
                        'vector-effect':'non-scaling-stroke','pointer-events':'none'}));
                }
                for(const piece of similarPieces.filter(piece=>styles.get(piece.id)!=='hidden')) {
                    board.append(svg('path',{d:piece.path,fill:'none',stroke:'#ffd178','stroke-width':4,'vector-effect':'non-scaling-stroke','pointer-events':'none'}));
                }
            }
            const chosen=livePieces.find(p=>p.id===choices[choice]);
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
            el('free-help').textContent=!selected.length?'Select a blue center or a green intersection. After connecting two points, use Extend line to extend both ends.':selected.length===1?'Select a second point.':!chosen?(pendingConnection?'Click Connect points to draw a straight segment.':'Select neighboring points to style part of this line.'):choices.length>1?`Segment ${choice+1} of ${choices.length}. Use Switch path to select another arc between these points.`:'Selected segment highlighted. Choose a style.';
            if(unavailable) el('free-help').textContent+=' '+unavailable+' connection(s) unavailable because a referenced point no longer exists.';
            el('free-next').hidden=choices.length<2;
            el('free-next').textContent='Switch path ('+(choice+1)+' / '+choices.length+')';
            for(const id of ['free-dash','free-hide','free-solid']) el(id).disabled=!chosen;
            el('free-keep-only').disabled=!chosen || Boolean(chosen.curve.a);
            el('free-clear').disabled=!selected.length;
            el('free-undo').disabled=!history.length;
        }
    };
    el('create-editor').onclick=()=>{state.arcPicker?.close();api.active=!api.active;reset();state.arcEditing=false;state.tangentToolId=null;update();};
    el('free-clear').onclick=()=>{reset();repaint();};
    el('free-connect').onclick=()=>{
        if (!api.active || !pendingConnection) return;
        connections.push(pendingConnection);
        lastConnection=pendingConnection;
        history.push({connection:pendingConnection});
        reset();
        repaint();
    };
    el('free-extend').onclick=()=>{
        if(!api.active || !extensionTarget || extensionTarget.extended) return;
        history.push({extension:extensionTarget});extensionTarget.extended=true;
        reset();repaint();
    };
    el('free-next').onclick=()=>{choice=(choice+1)%choices.length;repaint();};
    el('free-add-similar').onclick=()=>{
        if(!api.active || !pendingSimilar.length) return;
        const rule={template:lastConnection,scope:el('free-scope').value || 'groups',key:'connection-rule/'+nextConnectionId++};
        connectionRules.push(rule);
        history.push({connectionRule:rule});
        reset();
        repaint();
    };
    el('free-scope').onchange=()=>{previewSimilar=true;repaint();};
    el('free-preview').onclick=()=>{previewSimilar=!previewSimilar;repaint();};
    el('free-similar').onclick=()=>{
        if (!api.active) return;
        const ids=[...new Set(similarPieces.map(piece=>piece.id))].filter(id=>styles.get(id)!=='hidden');
        if (!ids.length) return;
        const rule={reference:lastHiddenReference,scope:el('free-scope').value || 'groups',style:'hidden'};
        styleRules.push(rule);
        history.push({styleRule:rule});
        reset();
        repaint();
    };
    el('free-keep-only').onclick=()=>{
        const piece=livePieces.find(p=>p.id===choices[choice]);
        if(!api.active || !piece || piece.curve.a)return;
        const reference=freeStyleReference(piece,liveSources);
        if(!reference.key)return;
        const rule={reference,keepOnly:true};styleRules.push(rule);history.push({styleRule:rule});
        reset();repaint();
    };
    for(const [button,style] of [['free-dash','dashed'],['free-hide','hidden'],['free-solid','solid']]) {
        el(button).onclick=()=>{
            const id=choices[choice];
            const piece=livePieces.find(piece=>piece.id===id);
            if(!piece || styles.get(id)===style) return;
            const reference=freeStyleReference(piece,liveSources);
            const rule={reference,style};
            styleRules.push(rule);
            history.push({styleRule:rule});
            if(style==='hidden') {
                lastHiddenId=id;
                lastHiddenReference=reference;
                previewSimilar=false;
            }
            reset();
            repaint();
        };
    }
    el('free-undo').onclick=()=>{
        const edit=history.pop();
        if(!edit) return;
        if(edit.extension) edit.extension.extended=false;
        else if(edit.connectionRule) connectionRules.splice(connectionRules.indexOf(edit.connectionRule),1);
        else if(edit.connection) connections.splice(connections.indexOf(edit.connection),1);
        else if(edit.styleRule) styleRules.splice(styleRules.indexOf(edit.styleRule),1);
        reset();
        repaint();
    };
    return api;
}
