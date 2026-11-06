// Three signed circle tangencies. Normalize around the first circle to keep
// the equations independent of translation and the drawing's unit scale.
function solveThreeTangentCircles(circles, modes) {
    if (circles.length !== 3 || modes.length !== 3) throw new Error('Select three boundary circles.');
    circles.forEach(c => {
        if (c?.type !== 'circle' || !Number.isFinite(c.radius) || c.radius <= 0 ||
            !Number.isFinite(c.center.x) || !Number.isFinite(c.center.y)) throw new Error('Invalid boundary circle.');
    });
    if (modes.some(m => !['external', 'internal'].includes(m))) throw new Error('Invalid tangency mode.');
    const origin = circles[0].center;
    const scale = Math.max(...circles.map(c => Math.max(c.radius, Math.hypot(c.center.x - origin.x, c.center.y - origin.y))));
    const cs = circles.map((c, i) => ({ x: (c.center.x - origin.x) / scale,
        y: (c.center.y - origin.y) / scale, r: c.radius / scale, sign: modes[i] === 'external' ? 1 : -1 }));
    const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
    const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const first = cs[0];
    // Subtract the first squared tangency equation from the other two.
    const rows = cs.slice(1).map(c => [2*c.x, 2*c.y, 2*(c.sign*c.r-first.sign*first.r)]);
    const rhs = cs.slice(1).map(c => c.x*c.x+c.y*c.y-c.r*c.r+first.r*first.r);
    const direction = cross(rows[0], rows[1]);
    const norm = Math.hypot(...direction);
    if (norm < 1e-12 * Math.max(1, Math.hypot(...rows[0])*Math.hypot(...rows[1]))) {
        throw new Error('These boundaries do not define isolated circles (duplicate or degenerate constraints). Select different boundaries.');
    }
    const v = direction.map(x => x / norm);
    // Fix the best-conditioned coordinate and solve a 2×2 system for a point
    // on the intersection of the two planes in (x, y, radius) space.
    const fixed = direction.reduce((best, n, i) => Math.abs(n) > Math.abs(direction[best]) ? i : best, 0);
    const free = [0, 1, 2].filter(i => i !== fixed), [i, j] = free;
    const det = rows[0][i]*rows[1][j]-rows[0][j]*rows[1][i];
    const p = [0, 0, 0];
    p[i] = (rhs[0]*rows[1][j]-rows[0][j]*rhs[1])/det;
    p[j] = (rows[0][i]*rhs[1]-rhs[0]*rows[1][i])/det;
    const a = v[0]*v[0]+v[1]*v[1]-v[2]*v[2];
    const b = 2*(p[0]*v[0]+p[1]*v[1]-(p[2]+first.sign*first.r)*v[2]);
    const c = p[0]*p[0]+p[1]*p[1]-(p[2]+first.sign*first.r)**2;
    let roots;
    if (Math.abs(a) < 1e-12) {
        if (Math.abs(b) < 1e-12) throw new Error('No isolated solution for these boundaries.');
        roots = [-c/b];
    } else {
        let discriminant = b*b-4*a*c;
        const tolerance = 1e-12 * Math.max(1, b*b, Math.abs(4*a*c));
        if (discriminant < -tolerance) return [];
        discriminant = Math.max(0, discriminant);
        const q = -.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(discriminant));
        roots = discriminant === 0 ? [-b/(2*a)] : [q/a, c/q];
    }
    const solutions = [];
    for (const t of roots) {
        const [x, y, r] = p.map((n, k) => n+t*v[k]);
        if (![x, y, r].every(Number.isFinite) || r <= 1e-10) continue;
        if (cs.some(boundary => {
            if (boundary.sign === -1 && r >= boundary.r) return true;
            const expected = boundary.sign === 1 ? r+boundary.r : boundary.r-r;
            return Math.abs(Math.hypot(x-boundary.x,y-boundary.y)-expected) > 1e-7*Math.max(1,r);
        })) continue;
        if (solutions.some(s => Math.hypot(s.center.x-(origin.x+x*scale),s.center.y-(origin.y+y*scale)) < scale*1e-8 && Math.abs(s.radius-r*scale) < scale*1e-8)) continue;
        // The determinant distinguishes solution branches without relying on
        // radius ordering. Translation, rotation and uniform scaling preserve it.
        const jacobian = cs.map(k => [x-k.x, y-k.y, -(r+k.sign*k.r)]);
        const orientation = dot(jacobian[0], cross(jacobian[1], jacobian[2]));
        const branch = Math.abs(orientation) < 1e-12 ? 'double' : orientation > 0 ? 'positive' : 'negative';
        solutions.push({ center: createPoint(origin.x+x*scale, origin.y+y*scale), radius: r*scale, branch });
    }
    return solutions.sort((a, b) => a.radius-b.radius);
}

// Enclosing construction circles are containers, not solid obstacles. A circle
// is automatically a container only if it contains all three boundaries.
function checkTangentCandidate(candidate, boundaries, modes, scene, container) {
    const distance = (a,b) => Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y);
    const eps = 1e-7*Math.max(candidate.radius, ...boundaries.map(c=>c.radius));
    const same = (a,b) => distance(a,b) <= eps && Math.abs(a.radius-b.radius) <= eps;
    if (container && distance(candidate,container)+candidate.radius > container.radius+eps) return 'Outside the containing circle.';
    for (const entry of scene) {
        const other = entry.circle;
        if (boundaries.some(c=>same(c,other))) continue;
        const enclosing = boundaries.every(c=>distance(c,other)+c.radius <= other.radius+eps);
        if (enclosing) {
            if (distance(candidate,other)+candidate.radius > other.radius+eps) return 'Outside ' + entry.label + '.';
        } else if (distance(candidate,other) < candidate.radius+other.radius-eps) {
            return 'Overlaps ' + entry.label + '.';
        }
    }
    return null;
}
