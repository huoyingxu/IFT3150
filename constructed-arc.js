function defaultArcPoint(x = 0, y = 0) {
    return { kind:'coordinates', x, y, circle:null, angle:0, first:null, second:null, branch:'left' };
}
function defaultArcConfig() {
    return {
        support:'circle', circle:null, center:defaultArcPoint(),
        radiusMode:'number', radius:120, radiusPoint:defaultArcPoint(120,0), radiusCircle:null, radiusFactor:1,
        bounds:'angles', angleFrame:'circle', startAngle:0, endAngle:90,
        startPoint:defaultArcPoint(120,0), endPoint:defaultArcPoint(0,120), sweep:'short'
    };
}
function arcPointReferences(point) {
    if (!point) return [];
    if(point.kind==='editorPoint') return editorExpressionReferences(point.expression);
    if (point.kind === 'center' || point.kind === 'circlePoint') return [point.circle];
    if (point.kind === 'intersection') return [point.first,point.second];
    return [];
}
function arcConstructionReferences(config) {
    if (!config) return [];
    const refs = config.support === 'circle' ? [config.circle] : arcPointReferences(config.center);
    if (config.support === 'defined') {
        if (config.radiusMode === 'point') refs.push(...arcPointReferences(config.radiusPoint));
        if (config.radiusMode === 'circle') refs.push(config.radiusCircle);
    }
    if (config.bounds !== 'angles') {
        refs.push(...arcPointReferences(config.startPoint));
        if (config.sweep !== 'full') refs.push(...arcPointReferences(config.endPoint));
    }
    return refs.filter(Boolean);
}

function resolveArcCircle(ref, evaluate) {
    if (!ref) throw new Error('Select a source circle.');
    const group = evaluate(ref.nodeId);
    if ((ref.count !== undefined && group.length !== ref.count) || !Number.isInteger(ref.index) || ref.index < 0 || !group[ref.index]) {
        throw new Error('The source circle count has changed. Select the reference again.');
    }
    if (group[ref.index].type !== 'circle') throw new Error('This reference requires a complete circle, not an arc.');
    return group[ref.index];
}

// Branch identity is relative to the directed line from the first center to
// the second, so a rotation cannot exchange the left and right intersections.
function arcIntersection(first, second, branch) {
    if (!['left','right'].includes(branch)) throw new Error('Choose the left or right intersection.');
    const dx = second.center.x-first.center.x, dy = second.center.y-first.center.y;
    const distance = Math.hypot(dx,dy), scale = Math.max(first.radius,second.radius,distance);
    const d = distance/scale, r = first.radius/scale, s = second.radius/scale;
    if (d < 1e-10) throw new Error('Concentric circles do not define a unique intersection.');
    if (d > r+s+1e-9 || d < Math.abs(r-s)-1e-9) throw new Error('The referenced circles no longer intersect.');
    const a = (r*r-s*s+d*d)/(2*d);
    const h = Math.sqrt(Math.max(0,r*r-a*a));
    const side = branch === 'left' ? 1 : -1, ux = dx/distance, uy = dy/distance;
    return createPoint(first.center.x+scale*(a*ux-side*h*uy),first.center.y+scale*(a*uy+side*h*ux));
}
function resolveArcPoint(point, evaluate) {
    if (!point) throw new Error('Define a reference point.');
    if(point.kind==='editorPoint') return resolveEditorExpression(point.expression,evaluate);
    if (point.kind === 'coordinates') return createPoint(point.x,point.y);
    if (point.kind === 'center') return resolveArcCircle(point.circle,evaluate).center;
    if (point.kind === 'circlePoint') {
        if (!Number.isFinite(point.angle)) throw new Error('The point angle must be finite.');
        const circle = resolveArcCircle(point.circle,evaluate);
        const angle = ((circle.axis.rotation+point.angle)%360)*Math.PI/180;
        return createPoint(circle.center.x+circle.radius*Math.cos(angle),circle.center.y+circle.radius*Math.sin(angle));
    }
    if (point.kind === 'intersection') return arcIntersection(resolveArcCircle(point.first,evaluate),resolveArcCircle(point.second,evaluate),point.branch);
    throw new Error('Unknown point source.');
}

function createConstructedArc(config, evaluate) {
    const tau = Math.PI*2, normalize = a => (a%tau+tau)%tau;
    if (!['circle','defined'].includes(config.support)) throw new Error('Choose a support circle mode.');
    let center, radius, rotation = 0;
    if (config.support === 'circle') {
        const circle = resolveArcCircle(config.circle,evaluate);
        center = circle.center; radius = circle.radius; rotation = circle.axis.rotation;
    } else {
        center = resolveArcPoint(config.center,evaluate);
        if (config.radiusMode === 'number') radius = config.radius;
        else if (config.radiusMode === 'point') {
            const point = resolveArcPoint(config.radiusPoint,evaluate);
            radius = Math.hypot(point.x-center.x,point.y-center.y);
        } else if (config.radiusMode === 'circle') {
            const source = resolveArcCircle(config.radiusCircle,evaluate);
            if (!Number.isFinite(config.radiusFactor) || config.radiusFactor <= 0) throw new Error('The radius multiplier must be positive and finite.');
            radius = source.radius*config.radiusFactor;
        } else throw new Error('Choose a radius source.');
    }
    if (!Number.isFinite(radius) || radius <= 0) throw new Error('The arc radius must be positive and finite.');
    if (!['angles','directions','points'].includes(config.bounds)) throw new Error('Choose an endpoint mode.');
    if (!['short','long','ccw','cw','full'].includes(config.sweep)) throw new Error('Choose the arc portion.');
    function direction(which) {
        if (config.bounds === 'angles') {
            const value = config[which+'Angle'];
            if (!Number.isFinite(value)) throw new Error('Arc angles must be finite.');
            return normalize(((value+(config.angleFrame === 'circle' ? rotation : 0))%360)*Math.PI/180);
        }
        const p = resolveArcPoint(config[which+'Point'],evaluate);
        const d = Math.hypot(p.x-center.x,p.y-center.y);
        if (d <= radius*1e-10) throw new Error('A direction point cannot coincide with the arc center.');
        if (config.bounds === 'points' && Math.abs(d-radius) > radius*1e-7) {
            throw new Error('The '+which+' endpoint is not on the support circle. Use Directions to project reference points onto it.');
        }
        return normalize(Math.atan2(p.y-center.y,p.x-center.x));
    }
    const start = direction('start');
    let sweep = tau;
    if (config.sweep !== 'full') {
        const ccw = normalize(direction('end')-start);
        if (Math.min(ccw,tau-ccw) < 1e-10) throw new Error('Start and end coincide. Choose Full circle or change an endpoint.');
        const half = Math.abs(ccw-Math.PI) < 1e-10;
        if (config.sweep === 'ccw') sweep = ccw;
        if (config.sweep === 'cw') sweep = ccw-tau;
        if (config.sweep === 'short') sweep = half ? Math.PI : ccw < Math.PI ? ccw : ccw-tau;
        if (config.sweep === 'long') sweep = half ? -Math.PI : ccw < Math.PI ? ccw-tau : ccw;
    }
    const point = a => createPoint(center.x+radius*Math.cos(a),center.y+radius*Math.sin(a));
    return {type:'arc',center:createPoint(center.x,center.y),radius,start,end:start+sweep,sweep,
        startPoint:point(start),endPoint:point(start+sweep)};
}

function constructedArcBounds(arc) {
    const tau = 2*Math.PI, normalize = a => (a%tau+tau)%tau;
    const angles = [arc.start,arc.end];
    for (const a of [0,Math.PI/2,Math.PI,3*Math.PI/2]) {
        const travel = normalize(arc.sweep >= 0 ? a-arc.start : arc.start-a);
        if (travel <= Math.abs(arc.sweep)+1e-10) angles.push(a);
    }
    const xs = angles.map(a=>arc.center.x+arc.radius*Math.cos(a));
    const ys = angles.map(a=>-arc.center.y-arc.radius*Math.sin(a));
    return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
}

// Capture the construction recipe, never its current screen coordinates.
function editorPointExpression(ref,sources,visiting=new Set()) {
    function source(key) {
        if(visiting.has(key))throw new Error('Cyclic editor construction.');
        const curve=sources.get(key);if(!curve)throw new Error('Missing editor source.');
        const match=key.match(/^(node-\d+):(\d+)$/);
        if(match)return {type:'geometry',nodeId:match[1],index:Number(match[2])};
        if(curve.construction){
            const seen=new Set(visiting);seen.add(key);
            return {type:'line',a:editorPointExpression(curve.construction.aRef,sources,seen),
                b:editorPointExpression(curve.construction.bRef,sources,seen),extended:Boolean(curve.construction.extended)};
        }
        throw new Error('This point source is not supported for arc construction.');
    }
    if(ref.kind==='fixed')throw new Error('Point has no construction reference.');
    if(ref.kind==='center'||ref.kind==='parameter')return {type:ref.kind,source:source(ref.key),t:ref.t};
    return {type:'intersection',first:source(ref.first),second:source(ref.second),branch:ref.branch,count:ref.count};
}
function editorExpressionReferences(expr) {
    if(!expr)return [];
    if(expr.type==='geometry')return [{nodeId:expr.nodeId,index:expr.index}];
    return ['source','first','second','a','b'].flatMap(key=>editorExpressionReferences(expr[key]));
}
function resolveEditorExpression(expr,evaluate) {
    function geometry(e){
        if(e.type==='geometry'){
            const object=evaluate(e.nodeId)[e.index];
            if(!object)throw new Error('The editor point source no longer exists.');
            return {...object,start:object.type==='arc'?object.start:(object.axis?.rotation||0)*Math.PI/180,
                end:object.type==='arc'?object.end:(object.axis?.rotation||0)*Math.PI/180+Math.PI*2};
        }
        const a=resolveEditorExpression(e.a,evaluate),b=resolveEditorExpression(e.b,evaluate);
        if(freeDistance(a,b)<1e-9)throw new Error('The editor line endpoints coincide.');
        return {a,b,extended:e.extended};
    }
    if(expr.type==='center')return geometry(expr.source).center;
    if(expr.type==='parameter'){
        const curve=geometry(expr.source);
        if(curve.extended)throw new Error('Choose an intersection, not the display end of an extended line.');
        return freePoint(curve,expr.t);
    }
    const a=geometry(expr.first),b=geometry(expr.second);
    const epsilon=Math.max(1,a.radius||freeDistance(a.a,a.b),b.radius||freeDistance(b.a,b.b))*1e-7;
    const contacts=freeContacts(a,b,epsilon).filter(p=>(a.extended||freeParameter(a,p,epsilon)!==null)&&(b.extended||freeParameter(b,p,epsilon)!==null));
    if(contacts.length!==expr.count||!contacts[expr.branch])throw new Error('The editor intersection is no longer available.');
    return contacts[expr.branch];
}
