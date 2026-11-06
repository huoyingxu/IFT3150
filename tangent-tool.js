function createTangentTool(state, onChange, editor) {
    const panel = document.getElementById('tangent-tool');
    const board = document.getElementById('drawing-board');
    const rows = document.getElementById('tangent-boundaries');
    const containerMenu = document.getElementById('tangent-container');
    const candidates = document.getElementById('tangent-candidates');
    let slot = 0;
    const activeNode = () => state.nodes.find(n=>n.id === state.tangentToolId);
    const colors = ['#ffce73', '#80c9ff', '#dfacff'];
    const ns = 'http://www.w3.org/2000/svg';

    function captureObstacles(node) {
        node.obstacleIds = state.nodes.filter(n=>!['arc','arcGroup'].includes(n.kind) && n.id !== node.id && state.evaluation.results.has(n.id)
            && canUseTangentSource(state.nodes,node.id,n.id)).map(n=>n.id);
    }
    function circleOptions(node) {
        return state.nodes.filter(n=>!['arc','arcGroup'].includes(n.kind) && canUseTangentSource(state.nodes,node.id,n.id)).flatMap(n=>{
            const circles = state.evaluation.results.get(n.id) || [];
            return circles.map((circle,index)=>({ value:n.id+':'+index,
                label:n.name+' / Circle '+(index+1), ref:{nodeId:n.id,index,count:circles.length},circle }));
        });
    }
    function fillMenu(menu, options, ref, placeholder) {
        menu.replaceChildren(new Option(placeholder,''));
        options.forEach(o=>menu.add(new Option(o.label,o.value)));
        if (ref) {
            const value = ref.nodeId+':'+ref.index;
            if (!options.some(o=>o.value === value)) menu.add(new Option('Source unavailable. Select again.',value));
            menu.value = value;
        }
    }
    function changed() { onChange(); editor.render(); }
    function setBoundary(ref) {
        const node = activeNode();
        if (!node || !canUseTangentSource(state.nodes,node.id,ref.nodeId)) return;
        node.boundaries[slot] = ref; node.branch = null;
        const next = node.boundaries.findIndex(r=>!r);
        if (next !== -1) slot = next;
        changed();
    }
    function choose(branch) {
        const node = activeNode();
        const candidate = state.evaluation.candidates?.get(node?.id)?.find(c=>c.branch === branch);
        if (!candidate || candidate.blocked) return;
        node.branch = branch;
        changed();
        editor.notify('Circle created. It updates with its sources and can be used for further tangent constructions.');
    }
    function open(id) {
        state.arcEditing = false;
        state.tangentToolId = id;
        slot = Math.max(0, activeNode()?.boundaries.findIndex(r=>!r) ?? 0);
        onChange();
    }
    function refresh() {
        board.querySelectorAll('.tangent-overlay').forEach(e=>e.remove());
        const node = activeNode();
        panel.hidden = !node;
        board.classList.toggle('picking-circles', Boolean(node));
        if (!node) { state.tangentToolId = null; return; }
        document.getElementById('tangent-tool-title').textContent = 'create circle by 3 parameter → '+node.name;
        const options = circleOptions(node);
        rows.replaceChildren();
        node.boundaries.forEach((ref,i)=>{
            const row = document.createElement('div'); row.className = 'boundary-row';
            const button = document.createElement('button'); button.type='button';
            button.textContent=String.fromCharCode(65+i); button.style.color=colors[i];
            button.setAttribute('aria-label','Pick boundary from canvas: '+button.textContent);
            button.setAttribute('aria-pressed',String(slot === i));
            button.onclick=()=>{slot=i; refresh();};
            const menu=document.createElement('select'); menu.setAttribute('aria-label','Boundary '+button.textContent);
            fillMenu(menu,options,ref,'Select circle '+button.textContent);
            menu.onchange=()=>{
                slot=i;
                const option=options.find(o=>o.value===menu.value);
                if (option) setBoundary(option.ref);
                else { node.boundaries[i]=null; node.branch=null; changed(); }
            };
            const mode=document.createElement('select'); mode.setAttribute('aria-label','Boundary '+button.textContent+' tangency mode');
            mode.add(new Option('External','external')); mode.add(new Option('Internal (inside)','internal'));
            mode.value=node.modes[i]; mode.onchange=()=>{node.modes[i]=mode.value; node.branch=null; changed();};
            row.append(button,menu,mode); rows.append(row);
        });
        fillMenu(containerMenu,options,node.containerRef,'Detect containers automatically');
        containerMenu.onchange=()=>{
            node.containerRef=options.find(o=>o.value===containerMenu.value)?.ref || null;
            changed();
        };
        document.getElementById('obstacle-count').textContent=node.obstacleIds.length+' sources';
        candidates.replaceChildren();
        const list=state.evaluation.candidates?.get(node.id) || [];
        list.forEach((c,i)=>{
            const button=document.createElement('button'); button.type='button';
            button.textContent='Candidate '+(i+1)+' · Radius '+Number(c.radius.toPrecision(5))+(node.branch===c.branch?' ✓':'');
            button.disabled=Boolean(c.blocked); button.title=c.blocked || 'Choose this tangent circle';
            button.onclick=()=>choose(c.branch); candidates.append(button);
            if (c.blocked) {
                const reason=document.createElement('span'); reason.className='candidate-reason';
                reason.textContent=c.blocked; candidates.append(reason); return;
            }
            if (node.branch===c.branch) return;
            const ghost=document.createElementNS(ns,'circle');
            Object.entries({cx:c.center.x,cy:-c.center.y,r:c.radius,fill:'none',stroke:'#91e5c4',
                'stroke-width':3,'stroke-dasharray':'6 4','vector-effect':'non-scaling-stroke',
                class:'tangent-overlay tangent-candidate',tabindex:0,role:'button','aria-label':'Choose candidate circle '+(i+1)
            }).forEach(([k,v])=>ghost.setAttribute(k,v));
            ghost.dataset.branch=c.branch;
            const title=document.createElementNS(ns,'title');title.textContent=button.textContent;ghost.append(title);
            board.append(ghost);
        });
        node.boundaries.forEach((ref,i)=>{
            if (!ref) return;
            const circle=state.evaluation.results.get(ref.nodeId)?.[ref.index];
            if (!circle) return;
            const outline=document.createElementNS(ns,'circle');
            Object.entries({cx:circle.center.x,cy:-circle.center.y,r:circle.radius,fill:'none',stroke:colors[i],
                'stroke-width':3,'vector-effect':'non-scaling-stroke',class:'tangent-overlay boundary-highlight','pointer-events':'none'
            }).forEach(([k,v])=>outline.setAttribute(k,v));
            const text=document.createElementNS(ns,'text');text.textContent=String.fromCharCode(65+i);
            Object.entries({x:circle.center.x,y:-circle.center.y,fill:colors[i],'font-size':Math.max(3,circle.radius*.25),
                'text-anchor':'middle','dominant-baseline':'middle',class:'tangent-overlay','pointer-events':'none'
            }).forEach(([k,v])=>text.setAttribute(k,v));
            board.append(outline,text);
        });
        document.getElementById('tangent-tool-status').textContent=state.evaluation.errors.get(node.id)
            || 'Confirmed. The solid green circle is the result. Change the boundaries to use another gap.';
    }
    function pick(event) {
        if (!activeNode()) return;
        if (event.type === 'keydown' && !['Enter',' '].includes(event.key)) return;
        const element=event.target.closest('[data-branch],[data-circle-node]');
        if (!element) return;
        event.preventDefault();
        if (element.dataset.branch) {choose(element.dataset.branch); return;}
        const nodeId=element.dataset.circleNode;
        if (!canUseTangentSource(state.nodes,activeNode().id,nodeId)) {
            editor.notify('You cannot select this node or circles that depend on it.'); return;
        }
        setBoundary({nodeId,index:Number(element.dataset.circleIndex),count:state.evaluation.results.get(nodeId).length});
    }
    board.addEventListener('click',pick); board.addEventListener('keydown',pick);
    document.getElementById('refresh-obstacles').onclick=()=>{
        const node=activeNode(); if (!node) return;
        captureObstacles(node); changed(); editor.notify('Collision sources updated. Nodes that depend on this circle are excluded.');
    };
    document.getElementById('close-tangent-tool').onclick=()=>{state.tangentToolId=null;onChange();};
    return {open,refresh,captureObstacles};
}
