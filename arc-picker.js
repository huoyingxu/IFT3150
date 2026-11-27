function arcPickCandidates(state, nodeId) {
    const circles = state.nodes.filter(n => n.visible && canUseTangentSource(state.nodes,nodeId,n.id))
        .flatMap(n => (state.evaluation.results.get(n.id)||[]).flatMap((circle,index) =>
            circle.type==='circle' ? [{circle,ref:{nodeId:n.id,index},label:n.name+' / Circle '+(index+1)}] : []));
    const points=[];
    for(const item of circles) {
        points.push({position:item.circle.center,point:{...defaultArcPoint(),kind:'center',circle:item.ref},label:item.label+' center'});
        const count=Math.max(1,item.circle.axis.nRosy);
        for(let i=0;i<count;i++) {
            const point={...defaultArcPoint(),kind:'circlePoint',circle:item.ref,angle:i*360/count};
            points.push({position:resolveArcPoint(point,id=>state.evaluation.results.get(id)),point,label:item.label+' axis point '+(i+1)});
        }
    }
    for(let i=0;i<circles.length;i++) for(let j=i+1;j<circles.length;j++) {
        for(const branch of ['left','right']) {
            try {
                const position=arcIntersection(circles[i].circle,circles[j].circle,branch);
                if(branch==='right') {
                    const left=arcIntersection(circles[i].circle,circles[j].circle,'left');
                    if(Math.hypot(left.x-position.x,left.y-position.y)<circles[i].circle.radius*1e-8) continue;
                }
                points.push({position,point:{...defaultArcPoint(),kind:'intersection',first:circles[i].ref,second:circles[j].ref,branch},
                    label:circles[i].label+' × '+circles[j].label+' ('+branch+')'});
            } catch (_) { /* Disjoint and concentric circles have no selectable contact. */ }
        }
    }
    for(const candidate of state.freeEditor?.arcPoints()||[]) {
        const refs=arcPointReferences(candidate.point);
        if(!refs.every(ref=>canUseTangentSource(state.nodes,nodeId,ref.nodeId)))continue;
        try {
            const position=resolveArcPoint(candidate.point,id=>state.evaluation.results.get(id)||[]);
            if(position && !points.some(p=>Math.hypot(p.position.x-position.x,p.position.y-position.y)<1e-7))points.push({...candidate,position});
        }catch(_){/* Do not expose missing or display-only endpoints. */}
    }
    return {circles,points};
}

function createArcPicker(state,onChange,editor) {
    const board=document.getElementById('drawing-board');
    const panel=document.createElement('div');panel.className='arc-pick-panel';panel.hidden=true;
    board.parentElement.before(panel);
    let pending=null;
    const api={
        open(nodeId,slot,setter,wizard=false) {
            api.close();
            state.freeEditor?.close();state.arcEditing=false;state.tangentToolId=null;
            const toggle=document.getElementById('render-image');
            if(toggle?.checked){toggle.checked=false;toggle.dispatchEvent(new Event('change'));}
            pending={nodeId,slot,setter,wizard,step:0,original:structuredClone(state.nodes.find(n=>n.id===nodeId).arcConfig)};if(wizard==='constraint'&&pending.original.constraints)pending.tasks=pending.original.constraints.flatMap((q,index)=>q.type==='radius'?[]:q.type==='centerLine'?[{index,field:'a',type:'point'},{index,field:'b',type:'point'}]:[{index,field:q.type==='point'?'point':'circle',type:q.type}]);if(pending.tasks)pending.step=-1;state.arcPicking=true;onChange();
        },
        close(commit=false){
            if(pending?.wizard&&!commit){const node=state.nodes.find(n=>n.id===pending.nodeId);if(node)node.arcConfig=pending.original;}
            pending=null;state.arcPicking=false;panel.hidden=true;board.querySelectorAll('.arc-pick-overlay').forEach(e=>e.remove());},
        render(){
            board.querySelectorAll('.arc-pick-overlay').forEach(e=>e.remove());
            const node=state.nodes.find(n=>n.id===pending?.nodeId);
            if(!node){api.close();return;}
            panel.hidden=false;panel.replaceChildren();
            if(pending.tasks&&pending.step===-1){
                const heading=document.createElement('strong');heading.textContent='Choose three circle constraints';panel.append(heading);
                const preset=document.createElement('select');preset.setAttribute('aria-label','Constraint preset');
                for(const [value,label]of [['custom','Custom combination'],['ttt','Three tangencies'],['ctp','Center on circle + Tangent + Point'],['ppp','Three points']])preset.add(new Option(label,value));
                preset.onchange=()=>{const types={ttt:['tangent','tangent','tangent'],ctp:['centerCircle','tangent','point'],ppp:['point','point','point']}[preset.value];if(types){node.arcConfig.constraints=types.map(type=>({type,mode:'external',value:60}));node.arcConfig.solution=null;onChange();editor.render();}};panel.append(preset);
                node.arcConfig.constraints.forEach((q,i)=>{
                    const row=document.createElement('label');row.textContent=' '+(i+1)+'. ';
                    const select=document.createElement('select');select.setAttribute('aria-label','Canvas constraint '+(i+1));
                    for(const [value,label]of [['tangent','Tangent to circle'],['point','Through point'],['centerCircle','Center on circle'],['centerLine','Center on line (two points)'],['radius','Fixed radius']])select.add(new Option(label,value));select.value=q.type;
                    select.onchange=()=>{node.arcConfig.constraints[i]={type:select.value,mode:'external',value:60};node.arcConfig.solution=null;onChange();editor.render();};row.append(select);
                    if(q.type==='tangent'){const mode=document.createElement('select');mode.setAttribute('aria-label','Canvas tangency '+(i+1));mode.add(new Option('External','external'));mode.add(new Option('Internal','internal'));mode.value=q.mode||'external';mode.onchange=()=>{q.mode=mode.value;node.arcConfig.solution=null;onChange();editor.render();};row.append(mode);}
                    if(q.type==='radius'){const input=document.createElement('input');input.type='number';input.min='0';input.step='any';input.value=q.value;input.setAttribute('aria-label','Canvas radius '+(i+1));input.onchange=()=>{q.value=input.valueAsNumber;node.arcConfig.solution=null;onChange();editor.render();};row.append(input);}
                    panel.append(row);
                });
                const start=document.createElement('button');start.textContent='Next: pick on canvas';start.onclick=()=>{pending.tasks=node.arcConfig.constraints.flatMap((q,index)=>q.type==='radius'?[]:q.type==='centerLine'?[{index,field:'a',type:'point'},{index,field:'b',type:'point'}]:[{index,field:q.type==='point'?'point':'circle',type:q.type}]);pending.step=0;onChange();};panel.append(start);
                const cancel=document.createElement('button');cancel.textContent='Cancel picking';cancel.onclick=()=>{api.close();onChange();editor.render();};panel.append(cancel);return;
            }
            const message=document.createElement('span');
            const constraint=pending.wizard==='constraint';
            const tasks=pending.tasks,done=tasks?tasks.length:3,task=tasks?.[pending.step];
            const slot=tasks?(task?'constraint '+(task.index+1)+' · '+task.type+(task.field==='a'?' · first line point':task.field==='b'?' · second line point':''):'dashed candidate circle'):constraint?['1/4: circle containing the new center','2/4: circle to be tangent to','3/4: point to pass through','4/4: dashed candidate circle'][pending.step]:pending.wizard?['Center','Start (also sets radius)','End'][pending.step]:pending.slot;
            message.textContent='Pick '+slot+' on canvas · Blue: centers · Green: intersections / axis points. ';
            const cancel=document.createElement('button');cancel.textContent='Cancel picking';cancel.onclick=()=>{api.close();onChange();};
            panel.append(message,cancel);
            if(constraint){
                if(!tasks){const mode=document.createElement('select');mode.setAttribute('aria-label','Canvas tangency');
                mode.add(new Option('External tangency','external'));mode.add(new Option('Internal tangency','internal'));mode.value=node.arcConfig.mode;
                mode.onchange=()=>{node.arcConfig.mode=mode.value;node.arcConfig.solution=null;onChange();editor.render();};panel.append(mode);}
                if(pending.step>0||tasks){const back=document.createElement('button');back.textContent='Back';back.onclick=()=>{pending.step--;onChange();};panel.append(back);}
                if(pending.step===done){const status=document.createElement('span');status.textContent=state.evaluation.candidates.get(node.id)?.length?' Click a dashed outline to confirm.':state.evaluation.errors.get(node.id)||'No candidate.';panel.append(status);}
            }
            const {circles,points}=arcPickCandidates(state,node.id);
            const ns='http://www.w3.org/2000/svg',overlay=document.createElementNS(ns,'g');overlay.setAttribute('class','arc-pick-overlay');
            const vb=(board.getAttribute('viewBox')||'-200 -200 400 400').split(/[ ,]+/).map(Number);
            const radius=Math.max(vb[2],vb[3])*0.009;
            function add(tag,attrs,label,choose){
                const el=document.createElementNS(ns,tag);
                Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
                el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label','Pick '+label);
                const title=document.createElementNS(ns,'title');title.textContent=label;el.append(title);
                const activate=e=>{if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;e.preventDefault();e.stopPropagation();choose();};
                el.addEventListener('click',activate);el.addEventListener('keydown',activate);
                if(tag==='circle' && attrs.fill==='none') {
                    const group=document.createElementNS(ns,'g');group.setAttribute('class','canvas-circle-choice');
                    const highlight=document.createElementNS(ns,'circle');
                    for(const key of ['cx','cy','r'])highlight.setAttribute(key,attrs[key]);
                    highlight.setAttribute('class','canvas-circle-highlight');
                    highlight.setAttribute('pointer-events','none');highlight.setAttribute('aria-hidden','true');
                    el.style.cursor='pointer';group.append(el,highlight);overlay.append(group);
                }else overlay.append(el);
            }
            function choose(value){
                if(constraint){
                    const c=node.arcConfig;
                    if(tasks)c.constraints[task.index][task.field]=value;
                    else if(pending.step===0)c.carrier=value;
                    if(!tasks&&pending.step===1)c.target=value;
                    if(!tasks&&pending.step===2)c.point=value;
                    c.solution=null;pending.step++;
                }else if(pending.wizard){
                    const c=node.arcConfig;
                    if(pending.step===0){c.support='defined';c.center=value;c.radiusMode='point';c.bounds='points';c.sweep='short';}
                    if(pending.step===1){c.radiusPoint=structuredClone(value);c.startPoint=value;}
                    if(pending.step===2)c.endPoint=value;
                    if(++pending.step===done)api.close(true);
                } else {pending.setter(value);api.close();}
                onChange();editor.render();
            }
            if(constraint&&pending.step===done){
                (state.evaluation.candidates.get(node.id)||[]).forEach((candidate,i)=>{
                    add('circle',{cx:candidate.center.x,cy:-candidate.center.y,r:candidate.radius,fill:'none',stroke:i%2?'#80c9ff':'#ffce73','stroke-width':3,'stroke-dasharray':'7 5','vector-effect':'non-scaling-stroke','pointer-events':'stroke',cursor:'pointer'},'candidate '+(i+1),()=>{node.arcConfig.solution=candidate.angle;api.close(true);onChange();editor.render();});
                });
            }else if((constraint&&(tasks?task?.field==='circle':pending.step<2))||(pending.slot==='circle'&&!pending.wizard)){
                for(const {circle,ref,label} of circles)add('circle',{cx:circle.center.x,cy:-circle.center.y,r:circle.radius,fill:'none',stroke:'transparent','stroke-width':14,'vector-effect':'non-scaling-stroke','pointer-events':'stroke'},label,()=>choose(ref));
            }else{
                // Centers are appended last so coincident axis points cannot obscure them.
                points.sort((a,b)=>(a.point.kind==='center')-(b.point.kind==='center'));
                for(const {position,point,label} of points)add('circle',{cx:position.x,cy:-position.y,r:radius,fill:point.kind==='center'?'#80c9ff':'#91e5c4',stroke:'#12382c','stroke-width':1,'vector-effect':'non-scaling-stroke',cursor:'pointer'},label,()=>choose(point));
            }
            board.append(overlay);
        }
    };
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pending){api.close();onChange();}});
    return api;
}
