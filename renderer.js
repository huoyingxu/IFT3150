// 将每个轴方向画成经过中心的完整线段。length 是单侧长度，画圆时传入半径。
//后续可能会修改轴的长度，长度为半径
function drawNodeAxis(axis, length = 120, target = null) {
    const board = target || document.getElementById('drawing-board');

    for (let i = 0; i < axis.nRosy; i++) {
        // 各方向等间隔分布，三角函数使用弧度。
        const degrees = axis.rotation + i * 360 / axis.nRosy;
        const radians = degrees * Math.PI / 180;
        const startX = axis.center.x - length * Math.cos(radians);
        const startY = axis.center.y - length * Math.sin(radians);
        const endX = axis.center.x + length * Math.cos(radians);
        const endY = axis.center.y + length * Math.sin(radians);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', startX);
        line.setAttribute('y1', -startY);
        line.setAttribute('x2', endX);
        line.setAttribute('y2', -endY);
        line.setAttribute('stroke', '#e8eeeb');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-linecap', 'butt');

        // SVG 的 Y 轴朝下，因此上面的 Y 坐标取负，让数学坐标的 Y 轴朝上。
        board.appendChild(line);
    }
}

// 绘制圆，以及两端位于圆周的直径轴。
function drawNodeCircle(circle, showAxis = false, target = null) {
    const board = target || document.getElementById('drawing-board');
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

    element.setAttribute('cx', circle.center.x);
    element.setAttribute('cy', -circle.center.y);
    element.setAttribute('r', circle.radius);
    element.setAttribute('fill', 'none');
    element.setAttribute('stroke', '#f3a6cb');
    element.setAttribute('stroke-width', '2');
    board.appendChild(element);

    // 以半径作为单侧长度，整条轴线长度为直径。
    if (showAxis) {
        drawNodeAxis(circle.axis, circle.radius, board);
    }
    return element;
}
