import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({console});
for(const file of ['point.js','node-axis.js','node-circle.js','self-tangent-circles.js','gap-tangent-circles.js','three-tangent-circle.js','graph-model.js','arc-geometry.js','arc-styles.js','renderer.js','graph-preview.js']) vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),context);
const {createPoint,createNodeAxis,createNodeCircle,makeNode,evaluateGraph,splitCircleArcs:split,collectArcCircles:collect,circleArcPath:path,createArcStyles}=context;
const circle=(x,y,r)=>{let p=createPoint(x,y);return createNodeCircle(p,r,createNodeAxis(p,3,0));};
const entry=(key,x,y,r)=>({key,circle:circle(x,y,r)});
const a=entry('a',0,0,10);
assert.equal(split(a,[a]).length,1);
assert.equal(split(a,[a,entry('b',10,0,10)]).length,2);
assert.equal(split(a,[a,entry('b',20,0,10),entry('c',-20,0,10)]).length,2);
assert.equal(split(a,[a,entry('b',5,0,5),entry('c',-5,0,5)]).length,2);
assert.equal(split(a,[a,entry('b',20+1e-10,0,10)]).length,1);
assert.equal(split(a,[a,entry('b',0,0,5),entry('c',40,0,1)]).length,1);
const multiple=[a,entry('b',10,0,10),entry('c',-10,0,10)];
const pieces=split(a,multiple);assert.equal(pieces.length,4);
assert.ok(Math.abs(pieces.reduce((s,c)=>s+c.end-c.start,0)-2*Math.PI)<1e-10);
assert.ok(!path(a.circle,split(a,[a])[0]).includes('NaN'));
for(const scale of [1e-4,1,1e5]) for(const angle of [-3,-.1,0,.9,3.2]){
 const transformed=multiple.map(e=>entry(e.key,(e.circle.center.x*Math.cos(angle)-e.circle.center.y*Math.sin(angle))*scale+23,(e.circle.center.x*Math.sin(angle)+e.circle.center.y*Math.cos(angle))*scale-41,e.circle.radius*scale));
 assert.deepEqual([...split(transformed[0],transformed).map(a=>a.key)].sort(),[...pieces.map(a=>a.key)].sort());
}
const arcStyles=createArcStyles(), key=pieces[0].key;
assert.equal(arcStyles.get(key),'solid');
arcStyles.cycle(key);assert.equal(arcStyles.get(key),'dashed');
arcStyles.cycle(key);assert.equal(arcStyles.get(key),'hidden');
arcStyles.cycle(key);assert.equal(arcStyles.get(key),'solid');
arcStyles.undo();assert.equal(arcStyles.get(key),'hidden');
arcStyles.restore();assert.equal(arcStyles.get(key),'solid');
arcStyles.undo();assert.equal(arcStyles.get(key),'hidden');
assert.equal(arcStyles.sync(new Set()),1);assert.equal(arcStyles.canUndo(),false);
const parent=makeNode('circle'), group=makeNode('tangent'), gaps=makeNode('gapTangent');
group.sourceId=parent.id;gaps.sourceId=group.id;
const nodes=[parent,group,gaps];
let evaluation=evaluateGraph(nodes), entries=collect(nodes,evaluation);
assert.equal(entries.length,10);
const originalArcs=entries.flatMap(e=>split(e,entries));
const originalKeys=originalArcs.map(a=>a.key).sort();
assert.ok(originalArcs.length>entries.length);
parent.params.rotation=185;parent.params.radius=240;parent.params.x=42;
evaluation=evaluateGraph(nodes);entries=collect(nodes,evaluation);
assert.deepEqual([...entries.flatMap(e=>split(e,entries).map(a=>a.key))].sort(),[...originalKeys]);
gaps.visible=false;
assert.deepEqual([...collect(nodes,evaluation).flatMap(e=>split(e,collect(nodes,evaluation)).map(a=>a.key))].sort(),[...originalKeys]);
// Coincident geometry is drawn once, so a second copy cannot cover a hidden arc.
const duplicate=makeNode('circle');duplicate.params={...parent.params};nodes.push(duplicate);
evaluation=evaluateGraph(nodes);entries=collect(nodes,evaluation);
assert.equal(entries.length,10);assert.equal(entries[0].aliases.length,2);
// Test the actual SVG output: state changes, invisible hit targets, restoration,
// and compatibility with the independent full-circle construction selection.
class Element {
 constructor(tag='div'){this.tag=tag;this.attrs={};this.dataset={};this.children=[];this.textContent='';this.classList={toggle(){}};}
 setAttribute(k,v){this.attrs[k]=String(v);}
 append(...items){this.children.push(...items);}
 appendChild(e){this.append(e);}
 replaceChildren(...items){this.children=items;}
 addEventListener(){}
}
const ids=['drawing-board','geometry-count','edit-arcs','arc-style-count','undo-arc','restore-arcs','arc-edit-help','arc-change-notice','fit-view'];
const elements=new Map(ids.map(id=>[id,new Element()]));
context.document={getElementById:id=>elements.get(id),createElementNS:(_,tag)=>new Element(tag)};
const state={nodes:nodes.slice(0,3),evaluation,arcStyles:createArcStyles(),arcEditing:true,showHiddenArcs:false};
const preview=context.createGraphPreview(state);
const allElements=()=>{const result=[];function visit(e){result.push(e);e.children.forEach(visit);}visit(elements.get('drawing-board'));return result;};
preview.render();
let target=allElements().find(e=>e.attrs['data-arc-key']);const targetKey=target.attrs['data-arc-key'];
const before=JSON.stringify([...evaluation.results]);
state.arcStyles.cycle(targetKey);preview.render();
assert.ok(allElements().some(e=>e.attrs['data-arc-style']==='dashed' && e.attrs['stroke-dasharray']==='7 5'));
state.arcStyles.cycle(targetKey);preview.render();
assert.ok(!allElements().some(e=>e.attrs['data-arc-key']===targetKey));
state.showHiddenArcs=true;preview.render();
assert.ok(allElements().some(e=>e.attrs['data-arc-style']==='hidden'));
assert.ok(allElements().some(e=>e.attrs['data-arc-key']===targetKey));
state.arcEditing=false;state.tangentToolId='new-construction';preview.render();
assert.ok(!allElements().some(e=>e.attrs['data-arc-key']));
assert.ok(allElements().some(e=>e.dataset.circleNode===parent.id));
assert.equal(state.arcStyles.get(targetKey),'hidden');
assert.equal(JSON.stringify([...evaluation.results]),before);
parent.params.nRosy=4;state.evaluation=evaluateGraph(state.nodes);preview.render();
assert.equal(state.arcStyles.get(targetKey),'solid');
console.log('Passed: intersections and tangencies, full circles, continuous arc coverage, stable identities under rotation/translation/scale, duplicate geometry, visibility, three states, undo/restore, SVG output, construction selection and topology invalidation.');
