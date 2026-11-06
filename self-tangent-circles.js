// 在父圆内生成等大的圆：每个圆与父圆内切，相邻的小圆外切。
// 父圆的轴决定小圆的数量和位置；childNRosy、childRotation 决定小圆自己的轴。
function createSelfTangentCircles(parentCircle, childNRosy, childRotation) {
    if (!parentCircle || parentCircle.type !== 'circle') {
        throw new Error('parentCircle must be a NodeCircle');
    }

    const count = parentCircle.axis.nRosy;
    if (count < 2) {
        throw new Error('parent nRosy must be at least 2 for tangent circles');
    }

    // 设圆心到父圆圆心的距离为 d，小圆半径为 r：
    // d + r = R，且 d * sin(PI / count) = r。
    const sine = Math.sin(Math.PI / count);
    const radius = parentCircle.radius * sine / (1 + sine);
    const distance = parentCircle.radius - radius;
    const circles = [];

    for (let i = 0; i < count; i++) {
        const degrees = parentCircle.axis.rotation + i * 360 / count;
        const radians = degrees * Math.PI / 180;
        const x = parentCircle.center.x + distance * Math.cos(radians);
        const y = parentCircle.center.y + distance * Math.sin(radians);

        // 每个小圆都重复 O → A → C 的创建流程。
        const O = createPoint(x, y);
        const A = createNodeAxis(O, childNRosy, childRotation);
        const C = createNodeCircle(O, radius, A);
        circles.push(C);
    }

    return {
        type: 'group',
        circles: circles
    };
}
