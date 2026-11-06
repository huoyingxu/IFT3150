function createArcGroup(arc, center, count) {
    if(arc?.type!=='arc')throw new Error('Select a single arc as the source.');
    if(!Number.isInteger(count)||count<1||count>60)throw new Error('Arc count must be an integer from 1 to 60.');
    if(!Number.isFinite(center.x)||!Number.isFinite(center.y))throw new Error('Define a finite rotation center.');
    return Array.from({length:count},(_,i)=>{
        const angle=i*2*Math.PI/count,c=Math.cos(angle),s=Math.sin(angle);
        const rotate=p=>createPoint(center.x+(p.x-center.x)*c-(p.y-center.y)*s,center.y+(p.x-center.x)*s+(p.y-center.y)*c);
        return {...arc,center:rotate(arc.center),start:arc.start+angle,end:arc.end+angle,
            startPoint:rotate(arc.startPoint),endPoint:rotate(arc.endPoint)};
    });
}

function renderArcGroupFields(node,state,onChange,rebuild) {
    const root=document.createElement('div');root.className='arc-construction-fields';
    const config=node.groupConfig;
    function field(title,input){const label=document.createElement('label');label.className='function-field';const span=document.createElement('span');span.textContent=title;input.setAttribute('aria-label',node.name+' · '+title);label.append(span,input);root.append(label);}
    function select(title,value,options,setter){const input=document.createElement('select');options.forEach(([v,t])=>input.add(new Option(t,v)));input.value=value;input.onchange=()=>{setter(input.value);onChange();rebuild();};field(title,input);}
    function number(title,value,setter){const input=document.createElement('input');input.type='number';input.step=title==='Arc count'?'1':'any';input.value=value;input.oninput=()=>{setter(input.valueAsNumber);onChange();};field(title,input);}
    select('Source arc',node.sourceId||'',[['','Select an arc'],...state.nodes.filter(n=>n.kind==='arc'&&canUseTangentSource(state.nodes,node.id,n.id)).map(n=>[n.id,n.name])],v=>node.sourceId=v||null);
    select('Rotation center',config.centerMode,[['circle','Circle center'],['coordinates','Coordinates']],v=>config.centerMode=v);
    if(config.centerMode==='circle') {
        const choices=[['','Select a circle']];
        for(const n of state.nodes)if(canUseTangentSource(state.nodes,node.id,n.id))
            (state.evaluation.results.get(n.id)||[]).forEach((c,i)=>{if(c.type==='circle')choices.push([n.id+':'+i,n.name+' / Circle '+(i+1)]);});
        const value=config.centerRef?config.centerRef.nodeId+':'+config.centerRef.index:'';
        if(value&&!choices.some(c=>c[0]===value))choices.push([value,'Source unavailable']);
        select('Center circle',value,choices,v=>{const [nodeId,index]=v.split(':');config.centerRef=v?{nodeId,index:Number(index)}:null;});
        select('Count mode',config.countMode,[['number','Number'],['axis','Follow center circle nRosy']],v=>config.countMode=v);
    }
    else {number('Center X',config.x,v=>config.x=v);number('Center Y',config.y,v=>config.y=v);}
    if(config.centerMode==='coordinates'||config.countMode==='number')number('Arc count',config.count,v=>config.count=v);
    const note=document.createElement('p');note.className='function-note';note.textContent='Includes the original arc at 0°. Copies are spaced evenly through 360°. Edit the source arc to update the whole group.';root.append(note);return root;
}
