// 在parent-circle, child-circle以及parent-circle的aix之间的缝隙生成与三者相切的gap-circle
// gap-circle数量 = 2 * 大圆的nRosy
function createGapTangentCircles(outer, innerCircles, nRosy, rotation) {
    const count = outer?.axis?.nRosy;
    if (!outer || outer.type !== 'circle' || !Number.isInteger(count) || count < 2 || innerCircles.length !== count) {
        throw new Error('The outer circle requires nRosy ≥ 2 and the same number of equal inner circles. No group was generated.');
    }
    const R = outer.radius;
    const tolerance = 1e-7;


    const circles = [];
    for (let gap = 0; gap < count; gap++) {
        // 使用相邻内圆方向的角平分线；偶数 N 时，它不一定是外圆已有的轴线。
        const angle = ((outer.axis.rotation % 360) + (gap + 0.5) * 360 / count) * Math.PI / 180;
        const ux = Math.cos(angle), uy = Math.sin(angle);
        for (const side of [-1, 1]) {
            const inner = innerCircles[(gap + (side === 1 ? 1 : 0)) % count];
            const dx = (inner.center.x - outer.center.x) / R;
            const dy = (inner.center.y - outer.center.y) / R;
            const a = dx * ux + dy * uy;
            const b = -dx * uy + dy * ux;
            const q = inner.radius / R;

            // 外圆归一化为半径 1，沿轴坐标为 t，新圆半径 h=(1-t²)/2。
            // 代入与内圆的外切条件，得到 A*t²+B*t+C=0。
            const A = 1 + side * b + q;
            const B = -2 * a;
            const C = a * a + b * b - q * q - side * b - q;
            const discriminant = B * B - 4 * A * C;
            if (discriminant < 0) throw new Error('A circle has no solution. No circles in this group were generated.');
            const roots = [(-B + Math.sqrt(discriminant)) / (2 * A), (-B - Math.sqrt(discriminant)) / (2 * A)];
            const candidates = roots.filter(t => t >= 0 && t < 1).map(t => ({ t: t, h: (1 - t * t) / 2 }));
            candidates.sort((first, second) => first.h - second.h);
            if (!candidates.length) throw new Error('A circle has no valid solution in the forward direction. No circles in this group were generated.');
            const { t, h } = candidates[0];
            const x = t * ux - side * h * uy;
            const y = t * uy + side * h * ux;
            if (!(h > 0) || Math.abs(Math.hypot(x, y) + h - 1) > tolerance ||
                Math.abs(Math.hypot(x - dx, y - dy) - q - h) > tolerance ||
                Math.abs(-x * uy + y * ux - side * h) > tolerance) {
                throw new Error('A circle fails the tangency constraints. No circles in this group were generated.');
            }
            // 与现有构造相同，依次创建圆心、轴和圆。
            const O = createPoint(outer.center.x + R * x, outer.center.y + R * y);
            const axis = createNodeAxis(O, nRosy, rotation);
            circles.push(createNodeCircle(O, R * h, axis));
        }
    }

    // 校验整组：不能与其他内圆或其他新圆发生重叠。
    for (let i = 0; i < circles.length; i++) {
        for (const other of [...innerCircles, ...circles.slice(0, i)]) {
            const distance = Math.hypot(circles[i].center.x - other.center.x, circles[i].center.y - other.center.y);
            if ((distance - circles[i].radius - other.radius) / R < -tolerance) {
                throw new Error('Circles overlap. No circles in this group were generated.');
            }
        }
    }
    return { type: 'group', circles: circles };
}
