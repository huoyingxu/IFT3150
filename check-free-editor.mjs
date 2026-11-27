import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});
for(const file of ['arc-geometry.js','free-editor.js']) vm.runInContext(fs.readFileSync(file,'utf8'),context);
const line=(x,y,X,Y)=>({a:{x,y},b:{x:X,y:Y}});
const horizontal=line(-2,0,2,0), vertical=line(0,-2,0,2);
const circle={center:{x:0,y:0},radius:1,start:0,end:2*Math.PI};
const graph=context.buildFreeSegments([horizontal,vertical,circle]);
assert.equal(graph.points.size,9);
assert.equal(graph.pieces.length,12);
assert.equal(context.buildFreeSegments([line(2,-2,2,2),horizontal]).pieces.length,3);
const half={...circle,end:Math.PI};
assert.equal(context.buildFreeSegments([vertical,half]).pieces.length,4);
const reversed=line(2,0,-2,0);
const double=context.buildFreeSegments([horizontal,reversed,vertical]);
assert.equal(new Set(double.pieces.map(p=>p.id)).size,4);
const two=context.buildFreeSegments([circle,horizontal]);
const arcs=two.pieces.filter(p=>p.curve===circle);
assert.equal(arcs.length,2);
assert.notEqual(arcs[0].id,arcs[1].id);
console.log('Passed editor intersections, bounded arcs, shared endpoints and alternate paths.');

const controls=new Map();
const document={getElementById(id){if(!controls.has(id)) controls.set(id,element());return controls.get(id);}};
function element(attrs={}) {return {attrs,style:{},children:[],setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]??null;},before(item){this.children.push(item);},remove(){this.removed=true;},append(item){this.children.push(item);}};}
context.document=document;
const board=element();
board.getScreenCTM=()=>({a:1});
let editor,curves;
const paint=()=>{
    board.children=[];
    curves=[horizontal,vertical].map(c=>({...c,element:element({stroke:'white'})}));
    editor.render(curves,board,(_,attrs)=>element(attrs));
};
editor=context.createFreeEditor({},paint,paint);
const click=id=>document.getElementById(id).onclick();
const point=(x,y)=>board.children.find(e=>e.attrs.cx===x && e.attrs.cy===-y).onclick();
click('create-editor');
point(-2,0);point(0,0);click('free-dash');
assert.ok(curves[0].element.children.some(e=>e.attrs['stroke-dasharray']==='6 4'));
point(-2,0);point(0,0);click('free-hide');
assert.equal(curves[0].element.children.length,1);
click('create-editor');
assert.equal(curves[0].element.children.length,1);
click('create-editor');click('free-undo');
assert.ok(curves[0].element.children.some(e=>e.attrs['stroke-dasharray']==='6 4'));
console.log('Passed endpoint selection, dash, hide, exit and undo.');
const centersTest=context.buildFreeSegments([horizontal],[{x:0,y:0},{x:1,y:1},{x:0,y:0}]);
assert.equal(centersTest.centerIds.size,2);
assert.equal(centersTest.points.size,4);
assert.equal(centersTest.pieces.length,2);
assert.equal(centersTest.pieces[0].ends[1],centersTest.pieces[1].ends[0]);
point(-2,0);point(0,2);
assert.equal(document.getElementById('free-connect').disabled,false);
click('free-connect');
assert.equal(curves.length,3);
point(-2,0);point(0,2);
assert.equal(document.getElementById('free-connect').disabled,true);
click('free-dash');
assert.ok(curves[2].element.children.some(e=>e.attrs['stroke-dasharray']==='6 4'));
click('create-editor');
assert.equal(curves.length,3);
click('create-editor');click('free-undo');click('free-undo');
assert.equal(curves.length,2);
const ref={id:'original',a:{x:2,y:0},middle:{x:3,y:1},b:{x:2,y:2},curve:{key:'node-2@3:0',radius:1}};
const transform=(piece,fn,id)=>({...piece,id,a:fn(piece.a),middle:fn(piece.middle),b:fn(piece.b)});
const rotation=p=>({x:-p.y,y:p.x});
const reflection=p=>({x:-p.x,y:p.y});
const rotated=transform(ref,rotation,'rotated');
const mirrored=transform(ref,reflection,'mirrored');
const translated=transform(ref,p=>({x:p.x+4,y:p.y}),'translated');
const otherNode={...rotated,id:'other-node',curve:{...rotated.curve,key:'node-9@3:0'}};
const otherArc={...ref,id:'other-arc',middle:{x:1,y:1}};
assert.deepEqual(Array.from(context.findSimilarFreeSegments(ref,[ref,rotated,mirrored,translated,otherNode,otherArc],{x:0,y:0}),p=>p.id),['original','rotated','mirrored']);
const shifted=p=>({x:p.x+31,y:p.y-22});
assert.equal(context.findSimilarFreeSegments(transform(ref,shifted,'original'),[transform(rotated,shifted,'rotated')],{x:31,y:-22}).length,1);
console.log('Passed rotation/reflection matches, opposite arc exclusion, family isolation and translated origin.');

const sceneState={nodes:[{id:'root',kind:'circle'}],evaluation:{results:new Map([['root',[{center:{x:0,y:0},radius:2}]]])}};
editor=context.createFreeEditor(sceneState,paint,paint);
click('create-editor');
point(-2,0);point(0,0);click('free-hide');
assert.equal(document.getElementById('free-similar').disabled,false);
assert.match(document.getElementById('free-similar').textContent,/\(3\)/);
click('free-similar');
assert.equal(curves[0].element.children.length,0);
assert.equal(curves[1].element.children.length,0);
click('free-undo');
assert.equal(curves[0].element.children.length,1);
assert.equal(curves[1].element.removed,undefined);
console.log('Passed hide-one then hide-similar and atomic batch undo.');
for(const file of ['point.js','node-axis.js','node-circle.js','self-tangent-circles.js','graph-model.js'])
    vm.runInContext(fs.readFileSync(file,'utf8'),context);
const root=context.makeNode('circle'), children=context.makeNode('tangent');
children.sourceId=root.id;
const dependencyState={nodes:[root,children],evaluation:context.evaluateGraph([root,children])};
let sources=context.freeSourceRegistry(dependencyState,[]);
const childCircle=dependencyState.evaluation.results.get(children.id)[0];
const centerRef=context.captureFreePoint(childCircle.center,sources);
const outerCircle=dependencyState.evaluation.results.get(root.id)[0];
const touch=context.freeContacts(outerCircle,childCircle,1e-7)[0];
const touchRef=context.captureFreePoint(touch,sources);
assert.equal(centerRef.kind,'center');
assert.equal(touchRef.kind,'intersection');
root.params.nRosy=4;
dependencyState.evaluation=context.evaluateGraph([root,children]);
sources=context.freeSourceRegistry(dependencyState,[]);
const newCenter=context.resolveFreePoint(centerRef,sources);
assert.ok(vm.runInContext("freeDistance",context)(newCenter,dependencyState.evaluation.results.get(children.id)[0].center)<1e-8);
assert.ok(vm.runInContext("freeDistance",context)(newCenter,childCircle.center)>1);
const newContact=context.resolveFreePoint(touchRef,sources);
assert.ok(newContact);
assert.ok(Math.abs(vm.runInContext("freeDistance",context)(newContact,newCenter)-dependencyState.evaluation.results.get(children.id)[0].radius)<1e-7);
sources.delete(children.id+':0');
assert.equal(context.resolveFreePoint(centerRef,sources),null);
assert.equal(context.resolveFreePoint(touchRef,sources),null);

// Exercise the same click/connect/render path used by the canvas with changing nRosy.
let liveCurves;
const livePaint=()=>{
    board.children=[];
    liveCurves=[];
    const liveCenters=dependencyState.evaluation.results.get(children.id).map(c=>c.center);
    editor.render(liveCurves,board,(_,attrs)=>element(attrs),liveCenters);
};
editor=context.createFreeEditor(dependencyState,livePaint,livePaint);
click('create-editor');
let liveCenters=dependencyState.evaluation.results.get(children.id).map(c=>c.center);
point(liveCenters[0].x,liveCenters[0].y);
point(liveCenters[1].x,liveCenters[1].y);
click('free-connect');
assert.equal(liveCurves.length,1);
root.params.nRosy=3;
root.params.rotation=35;
root.params.x=17;
dependencyState.evaluation=context.evaluateGraph([root,children]);
livePaint();
liveCenters=dependencyState.evaluation.results.get(children.id).map(c=>c.center);
assert.ok(vm.runInContext("freeDistance",context)(liveCurves[0].a,liveCenters[0])<1e-8);
assert.ok(vm.runInContext("freeDistance",context)(liveCurves[0].b,liveCenters[1])<1e-8);
click('create-editor');
assert.equal(liveCurves.length,1);
click('create-editor');
click('free-undo');
assert.equal(liveCurves.length,0);
console.log('Passed source-referenced centers/tangencies, missing sources, nRosy/rotation/translation updates and connection undo.');

const grandparent=context.makeNode('circle');
const parents=context.makeNode('tangent'); parents.sourceId=grandparent.id;parents.params.nRosy=6;
const small=context.makeNode('tangent');small.sourceId=parents.id;
const groupState={nodes:[grandparent,parents,small],evaluation:context.evaluateGraph([grandparent,parents,small])};
const entries=context.collectArcCircles(groupState.nodes,groupState.evaluation);
const groupedCurves=entries.flatMap(entry=>context.splitCircleArcs(entry,entries).map(arc=>({
    ...entry.circle,start:arc.start,end:arc.end,key:arc.key
})));
const groupPieces=context.buildFreeSegments(groupedCurves).pieces;
const smallPieces=groupPieces.filter(piece=>piece.curve.key.startsWith(small.id+'@'));
const referencePiece=smallPieces.find(piece=>{
    const parent=context.freeParentCircle(piece,groupState);
    const d=vm.runInContext('freeDistance',context);
    return d(piece.middle,parent.center)<d(piece.curve.center,parent.center)-piece.curve.radius*.8;
});
assert.ok(referencePiece);
const matching=context.findGroupedFreeSegments(referencePiece,groupPieces,groupState,'groups');
const localMatching=context.findGroupedFreeSegments(referencePiece,groupPieces,groupState,'local');
assert.equal(new Set(matching.map(piece=>piece.id)).size,18);
assert.equal(new Set(localMatching.map(piece=>piece.id)).size,6);
assert.ok(matching.every(piece=>{
    const parent=context.freeParentCircle(piece,groupState);
    const d=vm.runInContext('freeDistance',context);
    return d(piece.middle,parent.center)<d(piece.curve.center,parent.center);
}));
console.log('Passed screenshot configuration: 3 parent circles x 6 children; exactly 18 inward arcs or 6 local arcs, outer arcs preserved.');
const addSources=context.freeSourceRegistry(groupState,groupedCurves);
const parentCircle=groupState.evaluation.results.get(parents.id)[0];
const smallCircles=groupState.evaluation.results.get(small.id);
const endpoint=context.freeContacts(smallCircles[1],smallCircles[2],1e-7)[0];
const prototypeLine={a:parentCircle.center,b:endpoint};
prototypeLine.aRef=context.captureFreePoint(prototypeLine.a,addSources);
prototypeLine.bRef=context.captureFreePoint(prototypeLine.b,addSources);
const addCenters=groupState.nodes.flatMap(node=>groupState.evaluation.results.get(node.id).map(c=>c.center));
const addPoints=context.buildFreeSegments(groupedCurves,addCenters).points;
const allCopies=context.similarFreeConnections(prototypeLine,groupState,addSources,addPoints,[prototypeLine],'groups');
assert.equal(allCopies.length,17);
assert.equal(context.similarFreeConnections(prototypeLine,groupState,addSources,addPoints,[prototypeLine],'local').length,5);
assert.equal(context.similarFreeConnections(prototypeLine,groupState,addSources,addPoints,[prototypeLine,...allCopies],'groups').length,0);
assert.ok(allCopies.every(line=>line.aRef.kind!=='fixed' && line.bRef.kind!=='fixed'));

// Normal UI entry: create one radius, add 17, undo the batch, then undo the prototype.
let addedCurves;
const additionPaint=()=>{
    board.children=[];
    addedCurves=groupedCurves.map(c=>({...c,element:element({stroke:'pink'})}));
    editor.render(addedCurves,board,(_,attrs)=>element(attrs),addCenters);
};
editor=context.createFreeEditor(groupState,additionPaint,additionPaint);
click('create-editor');
point(prototypeLine.a.x,prototypeLine.a.y);
const endDot=board.children.find(e=>typeof e.attrs.cx==='number' && Math.hypot(e.attrs.cx-endpoint.x,-e.attrs.cy-endpoint.y)<1e-6);
endDot.onclick();
click('free-connect');
assert.equal(addedCurves.filter(c=>c.a).length,1);
assert.match(document.getElementById('free-add-similar').textContent,/\(17\)/);
click('free-add-similar');
assert.equal(addedCurves.filter(c=>c.a).length,18);
assert.equal(document.getElementById('free-add-similar').disabled,true);
click('free-undo');
assert.equal(addedCurves.filter(c=>c.a).length,1);
click('free-undo');
assert.equal(addedCurves.filter(c=>c.a).length,0);
console.log('Passed similar connection creation, 17 all-group / 5 local copies, duplicate prevention, live endpoint references and batch undo.');
// Recreate both edits through the UI and change the outer symmetry repeatedly.
let persistentCurves;
const persistentPaint=()=>{
    board.children=[];
    const currentEntries=context.collectArcCircles(groupState.nodes,groupState.evaluation);
    persistentCurves=currentEntries.flatMap(entry=>context.splitCircleArcs(entry,currentEntries).map(arc=>({
        ...entry.circle,start:arc.start,end:arc.end,key:arc.key,element:element({stroke:'pink'})
    })));
    const centers=groupState.nodes.flatMap(node=>(groupState.evaluation.results.get(node.id)||[]).map(c=>c.center));
    editor.render(persistentCurves,board,(_,attrs)=>element(attrs),centers);
};
editor=context.createFreeEditor(groupState,persistentPaint,persistentPaint);
click('create-editor');
const selectNear=p=>board.children.find(e=>typeof e.attrs.cx==='number' && Math.hypot(e.attrs.cx-p.x,-e.attrs.cy-p.y)<1e-6).onclick();
selectNear(referencePiece.a);selectNear(referencePiece.b);
for(let i=0;i<4 && !board.children.some(e=>e.attrs.d===referencePiece.path && e.attrs.stroke==='#ffce78');i++)click('free-next');
assert.ok(board.children.some(e=>e.attrs.d===referencePiece.path && e.attrs.stroke==='#ffce78'));
click('free-hide');click('free-similar');
const hiddenChildren=()=>persistentCurves.filter(c=>c.key.startsWith(small.id+'@') && c.element.removed && !c.element.children.length).length;
assert.equal(hiddenChildren(),18);
selectNear(prototypeLine.a);selectNear(prototypeLine.b);click('free-connect');click('free-add-similar');
assert.equal(persistentCurves.filter(c=>c.a).length,18);
for(const n of [4,5,3]) {
    grandparent.params.nRosy=n;
    grandparent.params.x=12*n;
    grandparent.params.rotation=90+10*n;
    groupState.evaluation=context.evaluateGraph(groupState.nodes);
    persistentPaint();
    assert.equal(persistentCurves.filter(c=>c.a).length,n*6,'all groups receive new spokes');
    assert.equal(hiddenChildren(),n*6,'hidden inward arcs survive topology change');
}
click('free-undo');
assert.equal(persistentCurves.filter(c=>c.a).length,1);
click('free-undo');
assert.equal(persistentCurves.filter(c=>c.a).length,0);
click('free-undo');
assert.equal(hiddenChildren(),1);
click('free-undo');
assert.equal(hiddenChildren(),0);
console.log('Passed retained group hide/add rules at nRosy 3/4/5/3 with translation, rotation and undo after topology changes.');
vm.runInContext(fs.readFileSync('gap-tangent-circles.js','utf8'),context);
const gap=context.makeNode('gapTangent');gap.sourceId=parents.id;
groupState.nodes.push(gap);
grandparent.params.nRosy=3;
groupState.evaluation=context.evaluateGraph(groupState.nodes);
function gapScene() {
    const entries=context.collectArcCircles(groupState.nodes,groupState.evaluation);
    const curves=entries.flatMap(entry=>context.splitCircleArcs(entry,entries).map(arc=>({...entry.circle,...arc,key:arc.key})));
    return {pieces:context.buildFreeSegments(curves).pieces,sources:context.freeSourceRegistry(groupState,curves)};
}
let gapData=gapScene();
const outerCenter=groupState.evaluation.results.get(grandparent.id)[0].center;
const inwardGap=gapData.pieces.find(p=>p.curve.key.startsWith(gap.id+'@') &&
    Math.hypot(p.middle.x-outerCenter.x,p.middle.y-outerCenter.y)<Math.hypot(p.curve.center.x-outerCenter.x,p.curve.center.y-outerCenter.y)-p.curve.radius*.5);
assert.ok(inwardGap);
const gapReference=context.freeStyleReference(inwardGap,gapData.sources);
for(const n of [3,4,5,3]) {
    grandparent.params.nRosy=n;
    groupState.evaluation=context.evaluateGraph(groupState.nodes);
    gapData=gapScene();
    const seed=context.resolveFreeStyle(gapReference,gapData.pieces,gapData.sources);
    assert.ok(seed.length,'gap arc reference resolves');
    const matches=seed.flatMap(p=>context.relatedFreePieces(p,gapData.pieces,groupState,'groups'));
    assert.equal(new Set(matches.map(p=>p.id)).size,2*n);
}
console.log('Passed gap circle hide rules at nRosy 3/4/5/3.');
// Extended authored lines expose intersections, preserve dependencies and undo.
{
 const root=context.makeNode('circle'),group=context.makeNode('tangent');group.sourceId=root.id;
 const state={nodes:[root,group]};state.evaluation=context.evaluateGraph(state.nodes);
 let extensionEditor,drawn=[];
 const render=()=>{
  board.children=[];
  drawn=[...state.evaluation.results.values()].flat().map((c,i)=>({...c,start:0,end:2*Math.PI,key:'shape'+i,element:element({stroke:'pink'})}));
  const centers=drawn.map(c=>c.center);
  extensionEditor.render(drawn,board,(_,attrs)=>element(attrs),centers);
 };
 extensionEditor=context.createFreeEditor(state,render,render);
 click('create-editor');
 const a=state.evaluation.results.get(group.id)[1].center,b=state.evaluation.results.get(group.id)[2].center;
 point(a.x,a.y);point(b.x,b.y);click('free-connect');
 assert.equal(document.getElementById('free-extend').disabled,false);
 click('free-extend');
 const extended=drawn.find(c=>c.key?.startsWith('connection/'));
 assert.ok(extended.a.x<a.x && extended.b.x>b.x);
 const outer=state.evaluation.results.get(root.id)[0];
 const contacts=context.freeContacts(extended,{...outer,start:0,end:2*Math.PI},1e-7);
 assert.equal(contacts.length,2);
 for(const p of contacts) assert.ok(board.children.some(e=>Math.hypot((e.attrs.cx??1e9)-p.x,(e.attrs.cy??1e9)+p.y)<1e-6));
 point(contacts[0].x,contacts[0].y);point(contacts[1].x,contacts[1].y);
 assert.equal(document.getElementById('free-connect').disabled,true);
 click('free-clear');click('free-undo');
 const shortened=drawn.find(c=>c.key?.startsWith('connection/'));
 assert.ok(Math.hypot(shortened.a.x-a.x,shortened.a.y-a.y)<1e-7);
 click('free-extend');root.params.nRosy=4;state.evaluation=context.evaluateGraph(state.nodes);render();
 const moved=drawn.find(c=>c.key?.startsWith('connection/'));
 const currentA=state.evaluation.results.get(group.id)[1].center,currentB=state.evaluation.results.get(group.id)[2].center;
 assert.ok(context.freeParameter(moved,currentA,1e-6)!==null);
 assert.ok(context.freeParameter(moved,currentB,1e-6)!==null);
 const vertical=context.extendFreeLine({x:0,y:-1},{x:0,y:1},[{...outer,start:0,end:2*Math.PI}]);
 assert.ok(vertical.a.y<-120 && vertical.b.y>120);
 assert.equal(context.extendFreeLine(a,a,[]),null);
 console.log('Passed line extension, selectable outer intersections, undo, nRosy updates, vertical and degenerate lines.');
}
