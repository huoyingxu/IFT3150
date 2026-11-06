const ARC_TAU = 2 * Math.PI;
const arcAngle = a => (a % ARC_TAU + ARC_TAU) % ARC_TAU;

// Return intersection/tangency directions, with contact identities independent
// of world coordinates. Normalization keeps the tolerance relative to size.
function circleArcContacts(circle, other) {
    const dx = other.center.x-circle.center.x, dy = other.center.y-circle.center.y;
    const scale = Math.max(circle.radius,other.radius,Math.hypot(dx,dy));
    const r = circle.radius/scale, s = other.radius/scale, d = Math.hypot(dx,dy)/scale;
    const epsilon = 1e-9;
    if (d < epsilon || d > r+s+epsilon || d < Math.abs(r-s)-epsilon) return [];
    const base = Math.atan2(dy,dx);
    const projection = (r*r-s*s+d*d)/(2*d*r);
    // Explicit tangency handling prevents floating-point noise from producing
    // two nearly identical cuts and a tiny, unclickable arc.
    if (Math.abs(d-r-s) <= epsilon || Math.abs(d-Math.abs(r-s)) <= epsilon) {
        return [{ angle:arcAngle(base+(projection < 0 ? Math.PI : 0)), side:'touch' }];
    }
    const offset = Math.acos(Math.max(-1,Math.min(1,projection)));
    return [{angle:arcAngle(base-offset),side:'minus'}, {angle:arcAngle(base+offset),side:'plus'}];
}

function splitCircleArcs(entry, entries) {
    const cuts = [];
    for (const other of entries) {
        if (other === entry) continue;
        for (const contact of circleArcContacts(entry.circle,other.circle)) {
            cuts.push({ angle:contact.angle, labels:[other.key+':'+contact.side] });
        }
    }
    cuts.sort((a,b)=>a.angle-b.angle);
    const unique = [];
    for (const cut of cuts) {
        const last = unique.at(-1);
        if (last && cut.angle-last.angle < 1e-7) last.labels.push(...cut.labels);
        else unique.push(cut);
    }
    if (unique.length > 1 && unique[0].angle+ARC_TAU-unique.at(-1).angle < 1e-7) {
        unique[0].labels.push(...unique.pop().labels);
    }
    if (unique.length < 2) return [{ key:entry.key+'/full', start:0, end:ARC_TAU }];
    return unique.map((cut,i)=>{
        const next = unique[(i+1)%unique.length];
        return { key:entry.key+'/'+cut.labels.sort().join('&')+'>'+next.labels.sort().join('&'),
            start:cut.angle, end:next.angle+(i===unique.length-1 ? ARC_TAU : 0) };
    });
}

function circleArcPath(circle, arc) {
    const point = a => `${circle.center.x+circle.radius*Math.cos(a)} ${-circle.center.y-circle.radius*Math.sin(a)}`;
    const mid = (arc.start+arc.end)/2, r = circle.radius;
    // Two SVG arcs also handle an unsplit, complete circumference.
    const sweep = arc.end >= arc.start ? 0 : 1;
    return `M ${point(arc.start)} A ${r} ${r} 0 0 ${sweep} ${point(mid)} A ${r} ${r} 0 0 ${sweep} ${point(arc.end)}`;
}

function collectArcCircles(nodes, evaluation) {
    const entries = [];
    for (const node of nodes) {
        const circles = evaluation.results.get(node.id) || [];
        circles.forEach((circle,index)=>{
            if (circle.type !== 'circle') return;
            const alias = { node, index };
            const existing = entries.find(e=> {
                const eps = 1e-9*Math.max(circle.radius,e.circle.radius);
                return Math.abs(circle.radius-e.circle.radius) <= eps &&
                    Math.hypot(circle.center.x-e.circle.center.x,circle.center.y-e.circle.center.y) <= eps;
            });
            if (existing) { existing.aliases.push(alias); return; }
            entries.push({ key:node.id+'@'+circles.length+':'+index, circle, aliases:[alias] });
        });
    }
    return entries;
}
