function renderArcNodeFields(node, state, onChange, rebuild) {
    const config = node.arcConfig;
    const root = document.createElement('div'); root.className = 'arc-construction-fields';
    const changed = () => { onChange(); rebuild(); };
    function section(title) {
        const box=document.createElement('fieldset'), legend=document.createElement('legend');
        box.className='arc-fieldset'; legend.textContent=title; box.append(legend); return box;
    }
    function row(box,title,input) {
        const label=document.createElement('label');label.className='arc-field';
        const text=document.createElement('span');text.textContent=title;
        input.setAttribute('aria-label',node.name+' · '+title);
        label.append(text,input);box.append(label);return input;
    }
    function menu(box,title,value,options,setter) {
        const input=document.createElement('select');
        options.forEach(([key,label])=>input.add(new Option(label,key))); input.value=value;
        input.onchange=()=>{setter(input.value);changed();};return row(box,title,input);
    }
    function number(box,title,value,setter) {
        const input=document.createElement('input');input.type='number';input.step='any';
        input.value=Number.isFinite(value)?value:'';
        input.oninput=()=>{setter(input.valueAsNumber);onChange();};return row(box,title,input);
    }
    function circle(box,title,getter,setter) {
        const input=document.createElement('select');input.dataset.arcReference='true';
        const key=ref=>ref?`${ref.nodeId}:${ref.index}:${ref.count}`:'';
        input.refreshArcChoices=()=>{
            input.replaceChildren(new Option('Select a circle',''));
            for (const source of state.nodes) {
                if (['arc','arcGroup'].includes(source.kind) || !canUseTangentSource(state.nodes,node.id,source.id)) continue;
                const circles=state.evaluation.results.get(source.id)||[];
                circles.forEach((c,index)=>{
                    if(c.type==='circle') input.add(new Option(source.name+' / Circle '+(index+1),key({nodeId:source.id,index,count:circles.length})));
                });
            }
            const selected=key(getter());
            if(selected && ![...input.options].some(o=>o.value===selected)) input.add(new Option('Reference changed or unavailable — select again',selected));
            input.value=selected;
        };
        input.onchange=()=>{
            const [nodeId,index,count]=input.value.split(':');
            setter(input.value?{nodeId,index:Number(index),count:Number(count)}:null);changed();
        };
        input.refreshArcChoices();return row(box,title,input);
    }
    function point(box,title,p) {
        const sub=section(title);
        menu(sub,title+' source',p.kind,[['coordinates','Coordinates'],['center','Circle center'],['circlePoint','Point on circle'],['intersection','Circle intersection / tangency']],value=>p.kind=value);
        if(p.kind==='coordinates') {
            number(sub,title+' X',p.x,value=>p.x=value);number(sub,title+' Y',p.y,value=>p.y=value);
        }
        if(p.kind==='center'||p.kind==='circlePoint') circle(sub,title+' circle',()=>p.circle,value=>p.circle=value);
        if(p.kind==='circlePoint') {
            number(sub,title+' angle offset (°)',p.angle,value=>p.angle=value);
            const note=document.createElement('p');note.className='arc-field-note';note.textContent='Angle follows the source circle\'s axis rotation.';sub.append(note);
        }
        if(p.kind==='intersection') {
            circle(sub,title+' first circle',()=>p.first,value=>p.first=value);
            circle(sub,title+' second circle',()=>p.second,value=>p.second=value);
            menu(sub,title+' intersection',p.branch,[['left','Left of first → second center'],['right','Right of first → second center']],value=>p.branch=value);
        }
        box.append(sub);
    }
    const support=section('1. Support circle');root.append(support);
    menu(support,'Support mode',config.support,[['circle','Use an existing circle'],['defined','Define center and radius']],value=>config.support=value);
    if(config.support==='circle') circle(support,'Source circle',()=>config.circle,value=>config.circle=value);
    else {
        point(support,'Center',config.center);
        menu(support,'Radius source',config.radiusMode,[['number','Number'],['point','Distance to a reference point'],['circle','Radius of another circle']],value=>config.radiusMode=value);
        if(config.radiusMode==='number') number(support,'Radius',config.radius,value=>config.radius=value);
        if(config.radiusMode==='point') point(support,'Radius point',config.radiusPoint);
        if(config.radiusMode==='circle') {
            circle(support,'Radius circle',()=>config.radiusCircle,value=>config.radiusCircle=value);
            number(support,'Radius multiplier',config.radiusFactor,value=>config.radiusFactor=value);
        }
    }
    const bounds=section('2. Endpoints');root.append(bounds);
    menu(bounds,'Endpoint mode',config.bounds,[['angles','Angles'],['directions','Directions toward reference points'],['points','Exact points on the circle']],value=>config.bounds=value);
    menu(bounds,'Arc portion',config.sweep,[['short','Short arc'],['long','Long arc'],['ccw','Counterclockwise'],['cw','Clockwise'],['full','Full circle']],value=>config.sweep=value);
    if(config.bounds==='angles') {
        if(config.support==='circle') menu(bounds,'Angle frame',config.angleFrame,[['circle','Follow source axis rotation'],['world','Fixed world angles']],value=>config.angleFrame=value);
        number(bounds,'Start angle (°)',config.startAngle,value=>config.startAngle=value);
        if(config.sweep!=='full') number(bounds,'End angle (°)',config.endAngle,value=>config.endAngle=value);
    } else {
        point(bounds,'Start',config.startPoint);
        if(config.sweep!=='full') point(bounds,'End',config.endPoint);
    }
    const help=document.createElement('p');help.className='arc-field-note';
    help.textContent=config.bounds==='points'?'Exact endpoints must lie on the support circle.':config.bounds==='directions'
        ? 'Reference points define directions. The endpoints are projected onto the support circle.'
        : 'Angles are measured counterclockwise from +X. For a semicircle, Short uses CCW and Long uses CW.';
    bounds.append(help);
    const note=document.createElement('p');note.className='arc-field-note';
    note.textContent='The arc updates automatically. Use Edit arcs to switch solid / dashed / hidden. Hide a source circle if you want to display only its arc.';
    root.append(note);
    return root;
}
