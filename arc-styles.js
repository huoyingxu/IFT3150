// Display-only state; geometric data and dependencies are never changed here.
function createArcStyles() {
    const styles = new Map(), history = [];
    return {
        styles,
        get(key) { return styles.get(key) || 'solid'; },
        cycle(key) {
            history.push(new Map(styles));
            const current = styles.get(key) || 'solid';
            if (current === 'hidden') styles.delete(key);
            else styles.set(key,current === 'solid' ? 'dashed' : 'hidden');
        },
        undo() {
            const previous = history.pop();
            if (!previous) return;
            styles.clear(); previous.forEach((value,key)=>styles.set(key,value));
        },
        restore() {
            if (!styles.size) return;
            history.push(new Map(styles)); styles.clear();
        },
        canUndo() { return history.length > 0; },
        sync(keys) {
            let removed = 0;
            for (const key of styles.keys()) if (!keys.has(key)) { styles.delete(key); removed++; }
            // Never resurrect an obsolete segment through Undo.
            if (history.some(snapshot=>[...snapshot.keys()].some(key=>!keys.has(key)))) history.length = 0;
            return removed;
        }
    };
}

function createArcControls(state, onChange, repaint) {
    const button = document.getElementById('edit-arcs');
    const board = document.getElementById('drawing-board');
    function activate(event) {
        if (!state.arcEditing || state.tangentToolId) return;
        if (event.type === 'keydown' && !['Enter',' '].includes(event.key)) return;
        const key = event.target.closest('[data-arc-key]')?.dataset.arcKey;
        if (!key) return;
        event.preventDefault();
        state.arcStyles.cycle(key);
        repaint();
        // Keep keyboard focus on the edited segment when it is still visible.
        if (event.type === 'keydown') {
            const next = [...board.querySelectorAll('[data-arc-key]')].find(e=>e.dataset.arcKey === key);
            (next || document.getElementById('undo-arc')).focus();
        }
    }
    board.addEventListener('click',activate);
    board.addEventListener('keydown',activate);
    button.onclick = () => {
        state.arcEditing = !state.arcEditing;
        if (state.arcEditing) state.tangentToolId = null;
        onChange();
    };
    document.getElementById('show-hidden-arcs').onchange = event => {
        state.showHiddenArcs = event.target.checked; repaint();
    };
    document.getElementById('undo-arc').onclick = () => { state.arcStyles.undo(); repaint(); };
    document.getElementById('restore-arcs').onclick = () => { state.arcStyles.restore(); repaint(); };
}
