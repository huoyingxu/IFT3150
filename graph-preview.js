// 显示各节点的计算结果，负责绘图和Fit view。
function createGraphPreview(state) {
    const board = document.getElementById('drawing-board');

    let cachedEvaluation, entries = [];
    function render() {
        board.replaceChildren();
        if (cachedEvaluation !== state.evaluation) {
            entries = collectArcCircles(state.nodes,state.evaluation);
            entries.forEach(entry=>entry.arcs=splitCircleArcs(entry,entries));
            cachedEvaluation = state.evaluation;
        }
        const constructed = state.nodes.filter(n=>['arc','arcGroup'].includes(n.kind)).flatMap(node=>(state.evaluation.results.get(node.id)||[]).map((arc,index)=>({node,arc,index,key:node.id+'/constructed'+(node.kind==='arcGroup'?'/'+index:'')})));
        const keys = new Set(entries.flatMap(entry=>entry.arcs.map(arc=>arc.key)));
        constructed.forEach(item=>keys.add(item.key));
        const removed = state.arcStyles.sync(keys);
        const namespace = 'http://www.w3.org/2000/svg';
        const svg = (tag,attributes) => {
            const element=document.createElementNS(namespace,tag);
            Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,value));
            return element;
        };
        let count = 0;
        for (const entry of entries) {
            const alias = entry.aliases.find(a=>a.node.visible);
            if (!alias) continue;
            const {node,index} = alias, circle = entry.circle;
            const name = node.name+' / Circle '+(index+1);
            const color = node.kind === 'threeTangent' ? '#91e5c4' : '#f3a6cb';
            const group = svg('g',{class:'geometry-node'});
            let visible = false;
            entry.arcs.forEach((arc,arcIndex)=>{
                const style = state.arcStyles.get(arc.key);
                const hidden = style === 'hidden';
                if (!hidden) visible = true;
                if (hidden && !state.showHiddenArcs) return;
                const path = circleArcPath(circle,arc);
                const piece = svg('g',{class:'arc-piece'+(state.arcEditing ? ' arc-editable' : '')});
                const stroke = svg('path',{d:path,fill:'none',stroke:hidden ? '#a1b5aa' : color,
                    'stroke-width':hidden ? 1.5 : 2,'stroke-dasharray':hidden ? '2 6' : style === 'dashed' ? '7 5' : 'none',
                    opacity:hidden ? .35 : 1,'vector-effect':'non-scaling-stroke',class:'arc-stroke',
                    'pointer-events':'none','data-arc-style':style});
                piece.append(stroke);
                if (state.arcEditing && !state.tangentToolId) {
                    const action = style === 'solid' ? 'Click to make dashed' : style === 'dashed' ? 'Click to hide' : 'Click to restore solid';
                    const label = name+' / Arc '+(arcIndex+1)+' · '+action;
                    // A continuous transparent stroke makes dashed gaps and thin
                    // arcs easy to hit; hidden arcs have no hit target by default.
                    const hit = svg('path',{d:path,fill:'none',stroke:'transparent','stroke-width':10,
                        'vector-effect':'non-scaling-stroke','pointer-events':'stroke','data-arc-key':arc.key,
                        tabindex:0,role:'button','aria-label':label,class:'arc-hit'});
                    const title=svg('title',{});title.textContent=label;hit.append(title);piece.append(hit);
                }
                group.append(piece);
            });
            if (entry.aliases.some(a=>a.node.visible && a.node.showAxis)) drawNodeAxis(circle.axis,circle.radius,group);
            // Construction mode can still select a circle even when some of its
            // arcs are hidden. It never changes the saved display styles.
            if (state.tangentToolId && node.id !== state.tangentToolId) {
                const hit=drawNodeCircle(circle,false,group);
                hit.dataset.circleNode=node.id; hit.dataset.circleIndex=index;
                hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','10');
                hit.setAttribute('pointer-events','stroke');hit.setAttribute('tabindex','0');hit.setAttribute('role','button');
                hit.setAttribute('aria-label','Select '+name);
                const title=svg('title',{});title.textContent=name;hit.append(title);
            }
            if (visible) count++;
            board.append(group);
        }
        let arcCount=0;
        for (const {node,arc,index,key} of constructed) {
            if(!node.visible) continue;
            const style=state.arcStyles.get(key), hidden=style==='hidden';
            if(!hidden) arcCount++;
            const group=svg('g',{class:'constructed-arc','data-arc-node':node.id});
            if(node.showAxis) {
                const guide=svg('g',{class:'arc-construction-guide','aria-hidden':'true'});
                guide.append(svg('circle',{cx:arc.center.x,cy:-arc.center.y,r:arc.radius,fill:'none',stroke:'#8b9290',
                    'stroke-width':1,'stroke-dasharray':'3 6','vector-effect':'non-scaling-stroke',opacity:.45}));
                for(const [label,p] of [['O',arc.center],['S',arc.startPoint],['E',arc.endPoint]]) {
                    guide.append(svg('circle',{cx:p.x,cy:-p.y,r:arc.radius*.012,fill:'#ffe0a6'}));
                    const text=svg('text',{x:p.x+arc.radius*.025,y:-p.y-arc.radius*.025,fill:'#ffe0a6','font-size':arc.radius*.07});
                    text.textContent=label;guide.append(text);
                    if(label!=='O') guide.append(svg('line',{x1:arc.center.x,y1:-arc.center.y,x2:p.x,y2:-p.y,
                        stroke:'#8b9290','stroke-width':1,'stroke-dasharray':'3 6','vector-effect':'non-scaling-stroke'}));
                }
                group.append(guide);
            }
            if(!hidden || state.showHiddenArcs) {
                const path=circleArcPath(arc,arc);
                const piece=svg('g',{class:'arc-piece'+(state.arcEditing?' arc-editable':'')});
                piece.append(svg('path',{d:path,fill:'none',stroke:hidden?'#a1b5aa':'#ff8e9d',
                    'stroke-width':hidden?1.5:2.5,'stroke-dasharray':hidden?'2 6':style==='dashed'?'7 5':'none',
                    opacity:hidden?.35:1,'vector-effect':'non-scaling-stroke',class:'arc-stroke',
                    'pointer-events':'none','data-arc-style':style}));
                if(state.arcEditing && !state.tangentToolId) {
                    const action=style==='solid'?'Click to make dashed':style==='dashed'?'Click to hide':'Click to restore solid';
                    const hit=svg('path',{d:path,fill:'none',stroke:'transparent','stroke-width':10,
                        'vector-effect':'non-scaling-stroke','pointer-events':'stroke','data-arc-key':key,
                        tabindex:0,role:'button','aria-label':node.name+(node.kind==='arcGroup'?' / Arc '+(index+1):'')+' · '+action,class:'arc-hit'});
                    const title=svg('title',{});title.textContent=node.name+' · '+action;hit.append(title);piece.append(hit);
                }
                group.append(piece);
            }
            board.append(group);
        }
        document.getElementById('geometry-count').textContent = count + (count === 1 ? ' visible circle' : ' visible circles')
            +(constructed.length?' · '+arcCount+(arcCount===1?' arc':' arcs'):'');
        board.classList.toggle('editing-arcs',Boolean(state.arcEditing));
        document.getElementById('edit-arcs').setAttribute('aria-pressed',String(Boolean(state.arcEditing)));
        const styles=[...state.arcStyles.styles.values()];
        document.getElementById('arc-style-count').textContent=styles.filter(s=>s==='dashed').length+' dashed arcs · '+styles.filter(s=>s==='hidden').length+' hidden arcs';
        document.getElementById('undo-arc').disabled=!state.arcStyles.canUndo();
        document.getElementById('restore-arcs').disabled=!styles.length;
        document.getElementById('arc-edit-help').textContent=state.arcEditing
            ? 'Click: solid → dashed → hidden. Enable Show hidden arcs, then click a faded arc to restore it.'
            : 'Enable Edit arcs to style segments between intersections and tangencies.';
        document.getElementById('arc-change-notice').textContent=removed
            ? 'Arc boundaries changed. Cleared '+removed+' display settings that no longer match.' : '';
    }

    function fit() {
        const boxes = state.nodes.filter(node=>node.visible).flatMap(node=>(state.evaluation.results.get(node.id)||[]).map(object=>
            object.type==='arc' && !node.showAxis ? constructedArcBounds(object)
                : [object.center.x-object.radius,-object.center.y-object.radius,object.center.x+object.radius,-object.center.y+object.radius]));
        if (!boxes.length) { board.setAttribute('viewBox', '-200 -200 400 400'); return; }
        const left = Math.min(...boxes.map(b=>b[0])), top = Math.min(...boxes.map(b=>b[1]));
        const right = Math.max(...boxes.map(b=>b[2])), bottom = Math.max(...boxes.map(b=>b[3]));
        const size = Math.max(right - left, bottom - top, 1) * 1.2;
        board.setAttribute('viewBox', `${(left + right - size) / 2} ${(top + bottom - size) / 2} ${size} ${size}`);
    }

    document.getElementById('fit-view').addEventListener('click', fit);
    return { render: render, fit: fit };
}
