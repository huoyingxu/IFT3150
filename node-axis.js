// nRosy：360° is divided into nRosy parts 
// rotation：how many degree axis contrarotate (default direction: x positive)
function createNodeAxis(center, nRosy, rotation) {
    if (!center || center.type !== 'point') {
        throw new Error('center must be a point');
    }

    if (!Number.isInteger(nRosy) || nRosy < 1) {
        throw new Error('nRosy must be a positive integer');
    }

    if (!Number.isFinite(rotation)) {
        throw new Error('rotation must be finite');
    }

    return {
        type: 'axis',
        center: createPoint(center.x, center.y),
        nRosy: nRosy,
        rotation: rotation
    };
}
