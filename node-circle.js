// 创建圆的数据，圆心必须与轴的中心重合。
function createNodeCircle(center, radius, axis) {
    if (!center || center.type !== 'point') {
        throw new Error('center must be a point');
    }

    if (!Number.isFinite(radius) || radius <= 0) {
        throw new Error('radius must be positive and finite');
    }

    if (!axis || axis.type !== 'axis' || !axis.center) {
        throw new Error('axis must be a NodeAxis');
    }

    if (axis.center.x !== center.x || axis.center.y !== center.y) {
        throw new Error('circle and axis must have the same center');
    }

    return {
        type: 'circle',
        center: createPoint(center.x, center.y),
        radius: radius,
        axis: axis
    };
}
