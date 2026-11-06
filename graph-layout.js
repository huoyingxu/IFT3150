// Named function inputs preserve distinct uses of the same geometry (A, B, C, etc.).
function graphInputPorts(node, nodes) {
    const ports=[];
    const add=(key,label,ref)=>ports.push({key,label,ref:ref||null});
    const point=(key,label,p)=>{
        if(!p)return;
        if(p.kind==='center'||p.kind==='circlePoint')add(key,label,p.circle);
        if(p.kind==='intersection'){add(key+'-first',label+' 1',p.first);add(key+'-second',label+' 2',p.second);}
    };
    if(node.kind==='arcGroup'){add('source','Source arc',node.sourceId?{nodeId:node.sourceId}:null);if(node.groupConfig.centerMode==='circle')add('center','Rotation center',node.groupConfig.centerRef);}
    if(node.kind==='tangent')add('source','Circle / group',node.sourceId?{nodeId:node.sourceId}:null);
    if(node.kind==='gapTangent') {
        add('source','Inner group',node.sourceId?{nodeId:node.sourceId}:null);
        const outer=nodes.find(n=>n.id===node.sourceId)?.sourceId;
        add('outer','Outer circle',outer?{nodeId:outer}:null);
    }
    if(node.kind==='threeTangent') {
        for(let i=0;i<3;i++)add('boundary-'+i,'Boundary '+String.fromCharCode(65+i),node.boundaries[i]);
        if(node.containerRef)add('container','Container',node.containerRef);
    }
    if(node.kind==='arc') {
        const c=node.arcConfig;
        if(c.support==='circle')add('support','Support circle',c.circle);
        else {
            point('center','Center',c.center);
            if(c.radiusMode==='point')point('radius','Radius point',c.radiusPoint);
            if(c.radiusMode==='circle')add('radius','Radius circle',c.radiusCircle);
        }
        if(c.bounds!=='angles') {point('start','Start',c.startPoint);if(c.sweep!=='full')point('end','End',c.endPoint);}
    }
    return ports;
}

// The same measured snapshot is used for ELK and stale-result detection.
function buildElkGraph(views) {
    const ids=new Set(views.map(v=>v.id));
    const children=views.map(v=>({id:v.id,width:v.width,height:v.height,
        layoutOptions:{'elk.portConstraints':'FIXED_POS'},
        ports:v.ports.map(p=>({id:p.id,width:0,height:0,x:p.x,y:p.y,
            layoutOptions:{'elk.port.side':p.side}}))}));
    const edges=[];
    for(const view of views) for(const port of view.ports) {
        if(!port.source||!ids.has(port.source))continue;
        const label=port.label+(Number.isInteger(port.index)?' · #'+(port.index+1):'');
        edges.push({id:port.id+'-edge',sources:[port.source+':out'],targets:[port.id],
            labels:[{id:port.id+'-label',text:label,width:label.length*6.8+12,height:18}],
            layoutOptions:{'elk.edgeLabels.placement':'CENTER'}});
    }
    return {id:'graph',layoutOptions:{
        'elk.algorithm':'layered','elk.direction':'RIGHT','elk.edgeRouting':'ORTHOGONAL',
        'elk.padding':'[top=32,left=32,bottom=32,right=32]',
        'elk.spacing.nodeNode':'60','elk.layered.spacing.nodeNodeBetweenLayers':'36',
        'elk.spacing.edgeNode':'24','elk.spacing.edgeEdge':'18',
        'elk.layered.spacing.edgeNodeBetweenLayers':'24',
        'elk.layered.spacing.edgeEdgeBetweenLayers':'18',
        'elk.layered.considerModelOrder.strategy':'NODES_AND_EDGES',
        'elk.randomSeed':'1'
    },children,edges};
}
function graphViewSignature(views) { return JSON.stringify(views); }
function elkSectionPath(section) {
    return [section.startPoint,...(section.bendPoints||[]),section.endPoint]
        .map((p,i)=>(i?'L ':'M ')+p.x+' '+p.y).join(' ');
}
