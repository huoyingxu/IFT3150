function createRenderedPreview(state, repaint) {
    const board = document.getElementById('drawing-board');
    const toggle = document.getElementById('render-image');
    const image = document.getElementById('rendered-image');
    const area = board.parentElement;
    let currentUrl = null;
    const namespace = 'http://www.w3.org/2000/svg';
    function svg(tag, attributes = {}) {
        const element = document.createElementNS(namespace, tag);
        for (const [name,value] of Object.entries(attributes)) element.setAttribute(name,value);
        return element;
    }
    function update() {
        if (!toggle.checked) return;
        const viewBox = board.getAttribute('viewBox') || '-200 -200 400 400';
        const [x,y,width,height] = viewBox.split(/[ ,]+/).map(Number);
        const unit = Math.max(width,height) / 700;
        const drawing = svg('svg', {xmlns:namespace,viewBox,width:1000,height:1000});
        const defs = svg('defs');
        const paper = svg('radialGradient',{id:'paper'});
        paper.append(svg('stop',{offset:'0%','stop-color':'#f8efd9'}),
            svg('stop',{offset:'100%','stop-color':'#d2b98a'}));
        const grain = svg('pattern',{id:'grain',width:5*unit,height:5*unit,patternUnits:'userSpaceOnUse'});
        grain.append(svg('path',{d:'M 0 0 L '+unit+' '+unit+' M '+3*unit+' '+4*unit+' h '+unit,
            stroke:'#5c462a','stroke-width':.3*unit,opacity:.16}));
        defs.append(paper,grain);
        drawing.append(defs,svg('rect',{x,y,width,height,fill:'url(#paper)'}),
            svg('rect',{x,y,width,height,fill:'url(#grain)'}));

        const originals = [...board.querySelectorAll('path,line,circle')].filter(element => {
            if (element.closest('.arc-construction-guide') || element.getAttribute('role')==='button') return false;
            const stroke = element.getAttribute('stroke');
            return stroke && stroke!=='transparent' && stroke!=='none' &&
                Number(element.getAttribute('opacity') || 1)>=.8;
        });
        // Drawing complete layers keeps intersections joined and produces raised moldings.
        for (const [stroke,weight,offset] of [
            ['#7c6541',10,1.2],['#2c271d',9,0],['#dfcda5',7.5,0],
            ['#5a4b33',5.5,0],['#f9efd5',4.3,0],['#99805a',1.5,0]
        ]) {
            const group = svg('g',{fill:'none',stroke,'stroke-width':weight*unit,
                'stroke-linecap':'round','stroke-linejoin':'round',
                transform:'translate('+(offset*unit)+' '+(offset*unit)+')'});
            for (const original of originals) {
                const path = svg(original.tagName);
                for (const attribute of ['d','x1','y1','x2','y2','cx','cy','r','transform'])
                    if(original.hasAttribute(attribute)) path.setAttribute(attribute,original.getAttribute(attribute));
                const dashed=original.getAttribute('stroke-dasharray');
                if(dashed && dashed!=='none') path.setAttribute('stroke-dasharray',dashed);
                group.append(path);
            }
            drawing.append(group);
        }
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(drawing)],{type:'image/svg+xml'}));
        const previous = currentUrl;
        currentUrl = url;
        image.src = url;
        if(previous) URL.revokeObjectURL(previous);
    }
    toggle.addEventListener('change',()=>{
        area.classList.toggle('rendered-mode',toggle.checked);
        image.hidden=!toggle.checked;
        if(toggle.checked) {
            state.arcPicker?.close();
            state.arcEditing=false;
            state.freeEditor.close();
            state.tangentToolId=null;
            repaint();
        }
        update();
    });
    new MutationObserver(update).observe(board,{attributes:true,attributeFilter:['viewBox']});
    return {update};
}
