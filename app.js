// 页面入口：连接数据计算、卡片参数和Geometry canvas。
const parentNode = makeNode('circle');
const tangentNode = makeNode('tangent');
tangentNode.sourceId = parentNode.id;

const state = {
    nodes: [parentNode, tangentNode],
    arcStyles: createArcStyles(), arcEditing: false, showHiddenArcs: false,
    evaluation: { results: new Map(), errors: new Map() }
};

function updateGraph() {
    state.evaluation = evaluateGraph(state.nodes);
    preview.render();
    editor.refresh();
    tangentTool.refresh();
}

const preview = createGraphPreview(state);
const editor = createNodeEditor(state, updateGraph);
const tangentTool = createTangentTool(state, updateGraph, editor);
state.openTangentTool = tangentTool.open;
state.generateArcGroup = sourceId => {
    const source=state.nodes.find(n=>n.id===sourceId);
    if(!source||state.evaluation.results.get(sourceId)?.[0]?.type!=='arc') {
        editor.notify('Create a valid source arc before generating a group.');return;
    }
    const node=makeNode('arcGroup');node.sourceId=sourceId;
    const center=getSourceChain(state.nodes,sourceId).find(n=>n.kind==='circle')||state.nodes.find(n=>n.kind==='circle');
    if(center)node.groupConfig.centerRef={nodeId:center.id,index:0};
    else node.groupConfig.centerMode='coordinates';
    state.nodes.push(node);
    // The group includes its 0-degree member. Hide the duplicate source drawing only.
    source.visible=false;state.tangentToolId=null;
    updateGraph();editor.render();editor.arrange();
    editor.notify('Arc group created with 3 members, including the original. Source geometry hidden to avoid overlap; its construction remains active.');
};
createArcControls(state,updateGraph,()=>{ preview.render(); tangentTool.refresh(); });

function addNode(kind) {
    const node = makeNode(kind);
    if (kind === 'arc') {
        state.tangentToolId=null;
        const source=state.nodes.find(n=>(state.evaluation.results.get(n.id)||[]).some(c=>c.type==='circle'));
        if(source) node.arcConfig.circle={nodeId:source.id,index:0,count:state.evaluation.results.get(source.id).length};
    }
    if (kind === 'gapTangent') node.sourceId = state.nodes.find(item => item.kind === 'tangent')?.id || null;
    state.nodes.push(node);
    state.evaluation = evaluateGraph(state.nodes);
    editor.render();
    preview.render();
    tangentTool.refresh();
    editor.notify(kind === 'arc' ? 'Arc added. Choose a support circle and endpoints in its card.' : kind === 'gapTangent' ? 'Gap group added. All circles must be valid before the group is shown.' : kind === 'circle' ? 'Independent circle added.' : 'Self-tangent group added. Select a source.');
    document.querySelector('[data-node-id="' + node.id + '"].node-card')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

document.getElementById('add-three-tangent').addEventListener('click', () => {
    const node = makeNode('threeTangent');
    state.nodes.push(node);
    tangentTool.captureObstacles(node);
    updateGraph(); editor.render(); tangentTool.open(node.id);
    document.querySelector('[data-node-id="'+node.id+'"]')?.scrollIntoView({block:'nearest'});
});

document.getElementById('add-arc').addEventListener('click', () => addNode('arc'));

document.getElementById('add-circle').addEventListener('click', () => addNode('circle'));
document.getElementById('add-tangent').addEventListener('click', () => addNode('tangent'));
document.getElementById('add-gap-tangent').addEventListener('click', () => addNode('gapTangent'));

state.evaluation = evaluateGraph(state.nodes);
editor.render();
preview.render();
editor.fit(false);
editor.arrange(false);
