// 创建点的数据，画图由后续的绘制函数负责。
function createPoint(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error('point x,y should be finite');
    }

    return {
        type: 'point',
        x: x,
        y: y
    };
}
