// 节点只保存参数和来源 ID；几何对象由 evaluateGraph 计算。
let nextNodeId = 1;

function makeNode(kind) {
    const id = 'node-' + nextNodeId++;
    return {
        id: id,
        kind: kind,
        name: (kind === 'circle' || kind === 'threeTangent' ? 'Circle ' : kind === 'arc' ? 'Arc ' : kind === 'arcGroup' ? 'Arc group ' : 'Circle group ') + id.split('-')[1],
        sourceId: null,
        ...(kind === 'threeTangent' ? {
            boundaries: [null, null, null], modes: ['external', 'external', 'external'],
            branch: null, obstacleIds: [], containerRef: null
        } : {}),
        ...(kind === 'arc' ? { arcConfig:defaultArcConfig() } : {}),
        ...(kind === 'arcGroup' ? { groupConfig:{centerMode:'circle',centerRef:null,x:0,y:0,countMode:'number',count:3} } : {}),
        visible: true,
        showAxis: false,
        collapsed: false,
        params: kind === 'circle'
            ? { x: 0, y: 0, radius: 120, nRosy: 3, rotation: 90 }
            : { nRosy: 3, rotation: 0 }
    };
}

// All geometric constraints participate in cycle checks, including obstacles.
function getNodeDependencies(node) {
    return [...new Set([node.sourceId, ...(node.boundaries || []).map(r=>r?.nodeId),
        node.containerRef?.nodeId, node.kind==='arcGroup'&&node.groupConfig.centerMode==='circle'?node.groupConfig.centerRef?.nodeId:null, ...(node.obstacleIds || []), ...(node.kind === 'arc' ? arcConstructionReferences(node.arcConfig).map(r=>r.nodeId) : [])].filter(Boolean))];
}
function getSourceChain(nodes, id) {
    const chain = [], visited = new Set();
    function visit(key) {
        if (visited.has(key)) return;
        visited.add(key);
        const node = nodes.find(n=>n.id === key);
        if (!node) return;
        getNodeDependencies(node).forEach(visit);
        chain.push(node);
    }
    visit(id);
    return chain;
}
function canUseTangentSource(nodes, targetId, sourceId) {
    return !getSourceChain(nodes, sourceId).some(n=>n.id === targetId);
}

// 设置下拉菜单选中的来源，避免几何计算循环依赖。
function setNodeSource(nodes, sourceId, targetId) {
    const target = nodes.find(node => node.id === targetId);
    if (!target || !['tangent', 'gapTangent'].includes(target.kind)) {
        throw new Error('Only circle group nodes require a source.');
    }
    if (sourceId === null) {
        target.sourceId = null;
        return;
    }
    const source = nodes.find(node => node.id === sourceId);
    if (!source) throw new Error('Source node not found.');
    if (['arc','arcGroup'].includes(source.kind)) throw new Error('A circle construction requires a complete circle source, not an arc.');
    if (target.kind === 'gapTangent' && source.kind !== 'tangent') throw new Error('A gap group requires a self-tangent group of equal inner circles.');
    if (getSourceChain(nodes, sourceId).some(node => node.id === targetId)) {
        throw new Error('A node cannot use itself or its dependent nodes as its source.');
    }
    target.sourceId = sourceId;
}

function evaluateGraph(nodes) {
    const results = new Map();
    const errors = new Map();
    const candidates = new Map();
    const visiting = new Set();
    const byId = new Map(nodes.map(node => [node.id, node]));
    let totalCircles = 0;

    function evaluate(id) {
        if (results.has(id)) return results.get(id);
        if (errors.has(id)) throw new Error(errors.get(id));
        if (visiting.has(id)) throw new Error('Circular dependency detected.');
        const node = byId.get(id);
        if (!node) throw new Error('The source node does not exist.');
        visiting.add(id);

        try {
            const p = node.params;
            // 限制预览规模，避免错误输入生成过多线段或圆。
            if (!Number.isInteger(p.nRosy) || p.nRosy < 1 || p.nRosy > 60) {
                throw new Error('nRosy must be an integer from 1 to 60.');
            }
            let circles;
            if(node.kind==='arcGroup') {
                if(!node.sourceId)throw new Error('Select a source arc.');
                const source=evaluate(node.sourceId);
                if(source.length!==1||source[0].type!=='arc')throw new Error('Select a single arc as the source.');
                const g=node.groupConfig;
                let center={x:g.x,y:g.y},count=g.count;
                if(g.centerMode==='circle') {
                    const ref=g.centerRef;
                    if(!ref)throw new Error('Select the rotation center circle.');
                    const circle=evaluate(ref.nodeId)[ref.index];
                    if(!Number.isInteger(ref.index)||circle?.type!=='circle')throw new Error('The rotation center circle is unavailable.');
                    center=circle.center;if(g.countMode==='axis')count=circle.axis.nRosy;
                }
                circles=createArcGroup(source[0],center,count);
            } else if (node.kind === 'arc') {
                circles = [createConstructedArc(node.arcConfig,evaluate)];
            } else if (node.kind === 'circle') {
                const O = createPoint(p.x, p.y);
                const A = createNodeAxis(O, p.nRosy, p.rotation);
                circles = [createNodeCircle(O, p.radius, A)];
            } else if (node.kind === 'threeTangent') {
                function resolve(ref) {
                    if (!ref) throw new Error('Select three boundary circles, then choose a candidate.');
                    const group = evaluate(ref.nodeId);
                    // Track the selected ordinal in the live group, not its old size.
                    if (!Number.isInteger(ref.index) || ref.index < 0 || !group[ref.index]) {
                        throw new Error('The selected source circle no longer exists. Select an available boundary circle.');
                    }
                    if (group[ref.index].type !== 'circle') throw new Error('Select a complete circle, not an arc.');
                    return group[ref.index];
                }
                const boundaries = node.boundaries.map(resolve);
                const container = node.containerRef ? resolve(node.containerRef) : null;
                const scene = [];
                for (const sourceId of node.obstacleIds) {
                    const source = byId.get(sourceId);
                    if (!source) throw new Error('A collision-check source was deleted. Refresh collision sources.');
                    evaluate(sourceId).filter(circle=>circle.type === 'circle').forEach((circle,index)=>scene.push({circle,label:source.name+' / '+(index+1)}));
                }
                const options = solveThreeTangentCircles(boundaries,node.modes).map(candidate => ({
                    ...candidate, blocked: checkTangentCandidate(candidate,boundaries,node.modes,scene,container)
                }));
                candidates.set(id,options);
                if (!options.length) throw new Error('No valid solution for these boundaries and tangency modes. Adjust your selection.');
                const chosen = options.find(c=>c.branch === node.branch);
                if (!chosen) throw new Error(node.branch ? 'The selected solution no longer exists. Choose another candidate.' : 'Click a dashed candidate on the canvas or choose one below.');
                if (chosen.blocked) throw new Error('The selected solution is blocked: '+chosen.blocked+' Adjust the boundaries or choose another candidate.');
                const axis = createNodeAxis(chosen.center,p.nRosy,p.rotation);
                circles = [createNodeCircle(chosen.center,chosen.radius,axis)];
            } else if (node.kind === 'gapTangent') {
                const source = byId.get(node.sourceId);
                if (!source || source.kind !== 'tangent') throw new Error('Select a self-tangent group of equal inner circles. No group was generated.');
                const inners = evaluate(source.id);
                const outers = evaluate(source.sourceId);
                if (outers.length !== 1) throw new Error('The inner circles must belong to a single outer circle. No group was generated.');
                circles = createGapTangentCircles(outers[0], inners, p.nRosy, p.rotation).circles;
            } else {
                if (!node.sourceId) throw new Error('Select a parent circle source.');
                const parents = evaluate(node.sourceId);
                if (parents.some(p=>p.type !== 'circle')) throw new Error('A tangent group requires complete circles, not arcs.');
                const count = parents.reduce((sum, circle) => sum + circle.axis.nRosy, 0);
                if (count + totalCircles > 1000) throw new Error('The preview supports up to 1,000 circles. Reduce the count or nesting depth.');
                circles = [];
                // 来源是圆组时，对其中每个圆应用同一个相切构造。
                for (const parent of parents) {
                    const group = createSelfTangentCircles(parent, p.nRosy, p.rotation);
                    circles.push(...group.circles);
                }
            }
            if (totalCircles + circles.length > 1000) throw new Error('The preview supports up to 1,000 circles.');
            totalCircles += circles.length;
            results.set(id, circles);
            return circles;
        } catch (error) {
            errors.set(id, error.message);
            throw error;
        } finally {
            visiting.delete(id);
        }
    }

    for (const node of nodes) {
        try { evaluate(node.id); } catch (error) { /* 错误保存在 errors，其他分支继续计算。 */ }
    }
    return { results: results, errors: errors, candidates: candidates };
}
