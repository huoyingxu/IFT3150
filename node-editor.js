// Separate function and geometry views share an evaluator identity: inputs always reference geometry.
function createNodeEditor(state, onChange) {
    const layer=document.getElementById('node-cards'),message=document.getElementById('editor-message');
    const layout=document.getElementById('card-layout'),links=document.getElementById('card-links'),viewport=document.getElementById('node-viewport');
    const names={tangent:'Self tangent',gapTangent:'Gap circles',threeTangent:'create circle by 3 parameter',arc:'Create arc',arcGroup:'Generate group'};
    const observer=new ResizeObserver(updateLayout);
    let drag=null,zoom=1,arrangeRevision=0,routed=null,elk=null;
    const arrangeButton=document.getElementById('arrange-nodes');
    const layoutStatus=document.getElementById('graph-layout-status');
    const graphSpace=document.getElementById('graph-space');
    const notify=value=>message.textContent=value;
    const el=(tag,value='',cls='')=>{const e=document.createElement(tag);e.textContent=value;e.className=cls;return e;};
    const cardFor=(id,role)=>layer.querySelector(`[data-node-id="${id}"][data-role="${role}"]`);
    const refs=node=>[...new Set([node.sourceId,node.kind==='arcGroup'&&node.groupConfig.centerMode==='circle'?node.groupConfig.centerRef?.nodeId:null,node.kind==='gapTangent'?state.nodes.find(n=>n.id===node.sourceId)?.sourceId:null,...(node.boundaries||[]).map(r=>r?.nodeId),node.containerRef?.nodeId,
        ...(node.kind==='arc'?arcConstructionReferences(node.arcConfig).map(r=>r.nodeId):[])].filter(Boolean))];
    const format=value=>Math.abs(value)<1e-12?0:Number(value.toPrecision(6));
    function inputRow(node,key,title) {
        const row=el('div','','parameter-row'),label=el('label',title),input=document.createElement('input');
        input.id=node.id+'-'+key;input.type='number';input.step=key==='nRosy'?'1':'any';
        if(key==='nRosy'){input.min='1';input.max='60';}
        input.value=Number.isFinite(node.params[key])?node.params[key]:'';input.dataset.parameter=key;
        label.htmlFor=input.id;row.append(label,input);return row;
    }
    function checkbox(node,key,title) {
        const label=el('label','','checkbox-row'),input=document.createElement('input');
        input.type='checkbox';input.checked=node[key];input.dataset.option=key;
        label.append(input,document.createTextNode(title));return label;
    }
    function field(body,title,control) {
        const label=el('label','','function-field');label.append(el('span',title),control);body.append(label);
    }
    function sourceMenu(node,body) {
        const menu=document.createElement('select');menu.dataset.source='true';menu.id=node.id+'-source';
        menu.setAttribute('aria-label',names[node.kind]+' · Input geometry');menu.add(new Option('Select geometry',''));
        for(const candidate of state.nodes) {
            if(['arc','arcGroup'].includes(candidate.kind)||candidate.id===node.id)continue;
            if(node.kind==='gapTangent'&&candidate.kind!=='tangent')continue;
            const option=new Option(candidate.name,candidate.id);
            option.disabled=!canUseTangentSource(state.nodes,node.id,candidate.id);menu.add(option);
        }
        menu.value=node.sourceId||'';
        field(body,node.kind==='gapTangent'?'Input · Equal inner circle group':'Input · Circle or circle group',menu);
        const info=el('p','','function-note');info.dataset.sourceInfo='true';body.append(info);
    }
    function circleChoices(node) {
        return state.nodes.filter(n=>!['arc','arcGroup'].includes(n.kind)&&canUseTangentSource(state.nodes,node.id,n.id)).flatMap(n=>
            (state.evaluation.results.get(n.id)||[]).map((c,index)=>({value:n.id+':'+index,label:n.name+' / Circle '+(index+1),ref:{nodeId:n.id,index,count:state.evaluation.results.get(n.id).length}})));
    }
    function tangentFields(node,body) {
        node.boundaries.forEach((ref,i)=>{
            const group=el('fieldset','','constraint-input');group.append(el('legend','Input '+String.fromCharCode(65+i)));
            const menu=document.createElement('select');menu.dataset.boundary=String(i);
            menu.setAttribute('aria-label',node.name+' · Boundary '+String.fromCharCode(65+i));field(group,'Geometry / member',menu);
            const mode=document.createElement('select');mode.dataset.mode=String(i);mode.setAttribute('aria-label',node.name+' · Tangency '+String.fromCharCode(65+i));
            mode.add(new Option('External','external'));mode.add(new Option('Internal (inside)','internal'));mode.value=node.modes[i];
            field(group,'Tangency',mode);body.append(group);
        });
        const choices=el('div','','inline-candidates');choices.dataset.candidates='true';body.append(choices);
        const button=el('button','Canvas selection / collision settings');button.type='button';button.dataset.action='configure-tangent';body.append(button);
    }
    function makeCard(node,role) {
        const fn=role==='function',card=el('article','','node-card '+role+'-card');card.dataset.nodeId=node.id;card.dataset.role=role;
        const collapsed=fn?node.functionCollapsed:node.collapsed,name=fn?names[node.kind]:node.name;
        card.setAttribute('aria-label',role+' node: '+name);
        const header=el('header','','node-header'),collapse=el('button',collapsed?'▸':'▾');collapse.type='button';collapse.dataset.action='collapse';
        collapse.setAttribute('aria-expanded',String(!collapsed));collapse.setAttribute('aria-label','Expand or collapse '+role+' '+name);
        const title=el('div','','node-heading');title.append(el('span',fn?'FUNCTION':'GEOMETRY','node-kind'),el('h3',name,'node-title'));
        const remove=el('button','×');remove.type='button';remove.dataset.action='delete';remove.title=node.kind==='circle'?'Delete geometry':'Delete function and its output geometry';remove.setAttribute('aria-label',remove.title);
        header.append(collapse,title,remove);
        const body=el('div','','node-body');body.hidden=Boolean(collapsed);
        if(fn) {
            if(node.kind==='arcGroup')body.append(renderArcGroupFields(node,state,onChange,render));
            else if(node.kind==='arc')body.append(renderArcNodeFields(node,state,onChange,render));
            else if(node.kind==='threeTangent')tangentFields(node,body);
            else sourceMenu(node,body);
        } else {
            if(node.kind==='circle')body.append(inputRow(node,'x','Center X'),inputRow(node,'y','Center Y'),inputRow(node,'radius','Radius'));
            else {
                body.append(el('p','From '+names[node.kind],'producer-label'));
                const properties=el('div','','geometry-properties');properties.dataset.properties='true';body.append(properties);
                if(node.kind==='tangent'||node.kind==='gapTangent') {
                    const details=el('details','','member-details');details.append(el('summary','Member circles · center & radius'));
                    const table=el('div','','member-table');table.dataset.members='true';details.append(table);body.append(details);
                }
            }
            if(!['arc','arcGroup'].includes(node.kind)) {
                body.append(el('h4',node.kind==='tangent'||node.kind==='gapTangent'?'Member axis':'Axis','property-heading'),inputRow(node,'nRosy','nRosy'),inputRow(node,'rotation','Rotation (°)'));
                if(node.kind!=='circle')body.append(el('p','Axis settings apply to each output circle and control downstream constructions.','function-note'));
            }
            if(node.kind==='arc'){const button=el('button','Generate group');button.type='button';button.dataset.action='generate-group';body.append(button);}
            body.append(checkbox(node,'visible','Show geometry'),checkbox(node,'showAxis',['arc','arcGroup'].includes(node.kind)?'Show construction guide':'Show axes'));
        }
        const status=el('p','','node-status');status.setAttribute('aria-live','polite');card.append(header,body,status);
        card.append(el('span','','node-port output-port'));layer.append(card);syncPorts(card,node);observer.observe(card);
    }
    function syncPorts(card,node) {
        const ports=card.dataset.role==='function'?graphInputPorts(node,state.nodes):node.kind==='circle'?[]:[{key:'result',label:'Result',ref:{nodeId:node.id}}];
        const signature=JSON.stringify(ports);
        if(card.dataset.ports===signature)return;
        card.dataset.ports=signature;card.querySelector('.node-ports')?.remove();
        const rail=el('div','','node-ports');rail.setAttribute('aria-label','Input ports');
        for(const port of ports) {
            const row=el('div','','port-row');row.dataset.portKey=port.key;
            const pin=el('span','','node-port input-port');pin.title=port.label;
            row.append(pin,el('span',port.label,'port-name'));
            const source=state.nodes.find(n=>n.id===port.ref?.nodeId);
            const detail=card.dataset.role==='geometry'?'Function output':source?source.name+(Number.isInteger(port.ref.index)?' / #'+(port.ref.index+1):''):'Not connected';
            row.append(el('span',detail,'port-source'));row.title=port.label+' ← '+detail;
            if(!port.ref)row.classList.add('unconnected');rail.append(row);
        }
        card.insertBefore(rail,card.querySelector('.node-body'));
    }
    function snapshot() {
        return [...layer.children].filter(card=>state.nodes.some(n=>n.id===card.dataset.nodeId)).map(card=>{
            const node=state.nodes.find(n=>n.id===card.dataset.nodeId),role=card.dataset.role,id=node.id+':'+role;
            const ports=[{id:id+':out',x:card.offsetWidth,y:36,side:'EAST'}];
            const inputs=role==='function'?graphInputPorts(node,state.nodes):node.kind==='circle'?[]:[{key:'result',label:'Result',ref:{nodeId:node.id}}];
            for(const input of inputs) {
                const row=card.querySelector(`[data-port-key="${input.key}"]`);
                if(!row)continue;
                const y=row.parentElement.offsetTop+row.offsetTop+row.offsetHeight/2;
                ports.push({id:id+':'+input.key,x:0,y,side:'WEST',label:input.label,index:input.ref?.index,
                    source:input.ref?input.ref.nodeId+':'+(role==='geometry'?'function':'geometry'):null});
            }
            return {id,nodeId:node.id,role,x:card.offsetLeft,y:card.offsetTop,width:card.offsetWidth,height:card.offsetHeight,ports};
        });
    }
    async function arrange(includeHeight=true) {
        const revision=++arrangeRevision,views=snapshot(),signature=graphViewSignature(views);
        arrangeButton.disabled=true;layoutStatus.textContent='Arranging…';
        try {
            if(!elk)elk=new ELK({workerUrl:'vendor/elkjs/elk-worker.min.js'});
            const result=await elk.layout(buildElkGraph(views));
            if(revision!==arrangeRevision)return;
            if(drag||signature!==graphViewSignature(snapshot())) {
                layoutStatus.textContent='Graph changed · Auto arrange again';return;
            }
            for(const child of result.children) {
                const view=views.find(v=>v.id===child.id),node=state.nodes.find(n=>n.id===view.nodeId),card=cardFor(view.nodeId,view.role);
                node[view.role==='geometry'?'position':'functionPosition']={x:child.x,y:child.y};
                card.style.left=child.x+'px';card.style.top=child.y+'px';
            }
            routed={signature:graphViewSignature(snapshot()),edges:result.edges,width:result.width,height:result.height};
            updateLayout();fit(includeHeight);layoutStatus.textContent='Auto layout · Orthogonal routes';
        } catch(error) {
            if(revision===arrangeRevision){layoutStatus.textContent='Auto layout unavailable · Manual layout remains available';notify('Could not arrange the graph. '+error.message);}
        } finally {if(revision===arrangeRevision)arrangeButton.disabled=false;}
    }
    function render() {
        observer.disconnect();layer.replaceChildren();
        for(const node of state.nodes){if(node.kind!=='circle')makeCard(node,'function');makeCard(node,'geometry');}
        placeCards(false);refresh();
    }
    function placeCards(force) {
        const depths=new Map(),visiting=new Set(),rows=new Map();
        function depth(node) {
            if(depths.has(node.id))return depths.get(node.id);if(visiting.has(node.id))return 0;visiting.add(node.id);
            const sources=refs(node).map(id=>state.nodes.find(n=>n.id===id)).filter(Boolean);
            const d=node.kind==='circle'?0:Math.max(-1,...sources.map(depth))+2;
            visiting.delete(node.id);depths.set(node.id,d);return d;
        }
        for(const node of state.nodes) {
            const d=depth(node);
            for(const role of node.kind==='circle'?['geometry']:['function','geometry']) {
                const card=cardFor(node.id,role),column=role==='geometry'?d:d-1,key=role==='geometry'?'position':'functionPosition';
                if(force||!node[key])node[key]={x:16+column*354,y:20+(rows.get(column)||0)};
                card.style.left=node[key].x+'px';card.style.top=node[key].y+'px';
                rows.set(column,Math.max(rows.get(column)||0,node[key].y+card.offsetHeight+40));
            }
        }
        updateLayout();
    }
    function updateLayout() {
        let width=400,height=400;
        for(const card of layer.children){width=Math.max(width,card.offsetLeft+card.offsetWidth+40);height=Math.max(height,card.offsetTop+card.offsetHeight+40);}
        if(routed&&routed.signature===graphViewSignature(snapshot())){width=Math.max(width,routed.width);height=Math.max(height,routed.height);}
        layout.style.width=width+'px';layout.style.height=height+'px';
        graphSpace.style.width=width*zoom+'px';graphSpace.style.height=height*zoom+'px';drawLinks();
    }
    function drawLinks() {
        links.replaceChildren();const ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'defs');
        defs.innerHTML='<marker id="card-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#90bbae"/></marker>';links.append(defs);
        const views=snapshot(),valid=routed&&routed.signature===graphViewSignature(views);
        function path(d,edge) {
            const line=document.createElementNS(ns,'path');line.setAttribute('d',d);
            line.setAttribute('class','card-link '+(edge.targets[0].includes(':function:')?'input-link':'output-link')+(valid?'':' provisional-link'));
            line.dataset.edgeId=edge.id;line.setAttribute('marker-end','url(#card-arrow)');
            const title=document.createElementNS(ns,'title');title.textContent=edge.labels?.[0]?.text||'Geometry connection';line.append(title);links.append(line);
        }
        function label(value,x,y) {
            const group=document.createElementNS(ns,'g');group.setAttribute('class','edge-label');
            const rect=document.createElementNS(ns,'rect');Object.entries({x,y,width:value.width,height:value.height,rx:4}).forEach(([k,v])=>rect.setAttribute(k,v));
            const text=document.createElementNS(ns,'text');text.setAttribute('x',x+6);text.setAttribute('y',y+13);text.textContent=value.text;
            group.append(rect,text);links.append(group);
        }
        if(valid) {
            for(const edge of routed.edges) {
                for(const section of edge.sections||[])path(elkSectionPath(section),edge);
                for(const item of edge.labels||[])if(Number.isFinite(item.x))label(item,item.x,item.y);
            }
        } else {
            if(routed){routed=null;layoutStatus.textContent='Layout changed · Use Auto arrange';}
            const graph=buildElkGraph(views),points=new Map();
            for(const v of views)for(const p of v.ports)points.set(p.id,{x:v.x+p.x,y:v.y+p.y});
            for(const edge of graph.edges) {
                const a=points.get(edge.sources[0]),b=points.get(edge.targets[0]);
                const mid=a.x<b.x?(a.x+b.x)/2:Math.max(a.x,b.x)+30;
                path(`M ${a.x} ${a.y} L ${mid} ${a.y} L ${mid} ${b.y} L ${b.x} ${b.y}`,edge);
            }
        }
    }
    function refresh() {
        for(const card of layer.children) {
            const node=state.nodes.find(n=>n.id===card.dataset.nodeId);if(!node)continue;
            syncPorts(card,node);
            const error=state.evaluation.errors.get(node.id),values=state.evaluation.results.get(node.id)||[],fn=card.dataset.role==='function';
            card.classList.toggle('has-error',Boolean(error));card.querySelector('.node-status').textContent=error||(fn?'Output → '+node.name:values.length+(['arc','arcGroup'].includes(node.kind)?(values.length===1?' arc':' arcs'):values.length===1?' circle':' circles')+(node.visible?'':' · Hidden'));
            const properties=card.querySelector('[data-properties]');
            if(properties) {
                properties.replaceChildren();
                if(values.length) {
                    const c=values[0];properties.append(el('p',node.kind==='arcGroup'?'Arc group · '+values.length+' members':node.kind==='arc'?'Arc':values.length===1?'Single circle':'Circle group · '+values.length+' members'));
                    properties.append(el('p',(values.length>1?(node.kind==='arcGroup'?'Base arc #1 · ':'Base circle #1 · '):'')+'Center ('+format(c.center.x)+', '+format(c.center.y)+')'),el('p','Radius '+format(c.radius)));
                    if(node.kind==='arc')properties.append(el('p','Sweep '+format(c.sweep*180/Math.PI)+'°'));properties.append(el('small','Computed by the function'));
                } else properties.append(el('p','Waiting for a valid function result.'));
            }
            const members=card.querySelector('[data-members]');
            if(members){members.replaceChildren();for(const [i,c] of values.entries())members.append(el('p',`#${i+1} · (${format(c.center.x)}, ${format(c.center.y)}) · r ${format(c.radius)}`));}
            const info=card.querySelector('[data-source-info]');
            if(info) {
                const source=state.nodes.find(n=>n.id===node.sourceId),inputs=state.evaluation.results.get(node.sourceId)||[];
                info.textContent=node.kind==='tangent'?'Uses the input circle axis for count and placement.':'Outer boundary: '+(state.nodes.find(n=>n.id===source?.sourceId)?.name||'Select an input group')+'. Inherited from the group’s construction.';
                if(inputs.length)info.textContent+=' Input: '+inputs.length+' circle'+(inputs.length===1?'':'s')+'.';
            }
            card.querySelectorAll('[data-arc-reference]').forEach(menu=>menu.refreshArcChoices());
            if(fn&&node.kind==='threeTangent') {
                const options=circleChoices(node);
                card.querySelectorAll('[data-boundary]').forEach(menu=>{
                    const ref=node.boundaries[Number(menu.dataset.boundary)],value=ref?ref.nodeId+':'+ref.index:'';
                    menu.replaceChildren(new Option('Select a circle',''));options.forEach(o=>menu.add(new Option(o.label,o.value)));
                    if(value&&!options.some(o=>o.value===value))menu.add(new Option('Source unavailable',value));menu.value=value;
                });
                const choices=card.querySelector('[data-candidates]');choices.replaceChildren(el('span','Solution','property-heading'));
                (state.evaluation.candidates?.get(node.id)||[]).forEach((c,i)=>{
                    const button=el('button','Candidate '+(i+1)+' · r '+format(c.radius)+(node.branch===c.branch?' ✓':''));button.type='button';button.dataset.branch=c.branch;button.disabled=Boolean(c.blocked);button.title=c.blocked||'Use this solution';choices.append(button);
                    if(c.blocked)choices.append(el('small',c.blocked));
                });
            }
        }
        document.getElementById('node-count').textContent=state.nodes.length+' geometry · '+state.nodes.filter(n=>n.kind!=='circle').length+' functions';updateLayout();
    }
    layer.addEventListener('input',event=>{
        const card=event.target.closest('[data-node-id]');if(!card)return;const node=state.nodes.find(n=>n.id===card.dataset.nodeId);
        if(event.target.dataset.parameter){node.params[event.target.dataset.parameter]=event.target.valueAsNumber;onChange();}
        else if(event.target.dataset.option){node[event.target.dataset.option]=event.target.checked;onChange();}
    });
    layer.addEventListener('change',event=>{
        const card=event.target.closest('[data-node-id]');if(!card)return;const node=state.nodes.find(n=>n.id===card.dataset.nodeId),target=event.target;
        try {
            if(target.dataset.source)setNodeSource(state.nodes,target.value||null,node.id);
            else if(target.dataset.boundary!==undefined){node.boundaries[Number(target.dataset.boundary)]=circleChoices(node).find(o=>o.value===target.value)?.ref||null;node.branch=null;}
            else if(target.dataset.mode!==undefined){node.modes[Number(target.dataset.mode)]=target.value;node.branch=null;}
            else return;
            onChange();render();notify('Function inputs updated. Output geometry recalculated.');
        }catch(error){render();notify(error.message);}
    });
    layer.addEventListener('click',event=>{
        const card=event.target.closest('[data-node-id]');if(!card)return;const node=state.nodes.find(n=>n.id===card.dataset.nodeId),button=event.target.closest('button');
        if(button?.dataset.branch){node.branch=button.dataset.branch;onChange();return;}
        if(button?.dataset.action==='generate-group'){state.generateArcGroup(node.id);return;}
        if(button?.dataset.action==='configure-tangent'){state.openTangentTool(node.id);return;}
        if(button?.dataset.action==='collapse'){const key=card.dataset.role==='function'?'functionCollapsed':'collapsed';node[key]=!node[key];render();return;}
        if(button?.dataset.action==='delete') {
            state.nodes=state.nodes.filter(n=>n.id!==node.id);
            for(const item of state.nodes){if(item.sourceId===node.id)item.sourceId=null;if(item.obstacleIds)item.obstacleIds=item.obstacleIds.filter(id=>id!==node.id);}
            onChange();render();notify('Geometry and its producing function removed. Dependent functions may need new inputs.');
        }
    });
    layer.addEventListener('pointerdown',event=>{
        const header=event.target.closest('.node-header');if(!header||event.target.closest('button')||event.button!==0)return;
        const card=header.closest('.node-card'),node=state.nodes.find(n=>n.id===card.dataset.nodeId),key=card.dataset.role==='geometry'?'position':'functionPosition';
        ++arrangeRevision;arrangeButton.disabled=false;
        drag={node,key,card,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:node[key].x,y:node[key].y,scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop};
        card.classList.add('dragging');header.setPointerCapture(event.pointerId);event.preventDefault();
    });
    layer.addEventListener('pointermove',event=>{
        if(!drag||drag.pointerId!==event.pointerId)return;const position=drag.node[drag.key];
        position.x=Math.max(8,drag.x+(event.clientX-drag.startX+viewport.scrollLeft-drag.scrollLeft)/zoom);position.y=Math.max(8,drag.y+(event.clientY-drag.startY+viewport.scrollTop-drag.scrollTop)/zoom);
        drag.card.style.left=position.x+'px';drag.card.style.top=position.y+'px';updateLayout();
    });
    function stopDrag(){if(drag)drag.card.classList.remove('dragging');drag=null;}
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>layer.addEventListener(type,stopDrag));
    function setZoom(value){zoom=Math.min(1.5,Math.max(.1,value));layout.style.transform=`scale(${zoom})`;graphSpace.style.width=layout.offsetWidth*zoom+'px';graphSpace.style.height=layout.offsetHeight*zoom+'px';document.getElementById('graph-zoom-label').textContent=Math.round(zoom*100)+'%';}
    function fit(includeHeight=true){updateLayout();setZoom(Math.min(1,(viewport.clientWidth-40)/layout.offsetWidth,includeHeight?(viewport.clientHeight-40)/layout.offsetHeight:1));viewport.scrollTo(0,0);}
    arrangeButton.onclick=()=>arrange();document.getElementById('fit-graph').onclick=()=>fit();
    document.getElementById('graph-zoom-in').onclick=()=>setZoom(zoom+.1);document.getElementById('graph-zoom-out').onclick=()=>setZoom(zoom-.1);
    new ResizeObserver(updateLayout).observe(viewport);return {render,refresh,notify,fit,arrange};
}
