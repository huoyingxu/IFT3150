import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({console});
for(const file of ['point.js','node-axis.js','node-circle.js','self-tangent-circles.js','gap-tangent-circles.js','three-tangent-circle.js','constructed-arc.js','graph-model.js','arc-geometry.js','arc-styles.js','renderer.js','graph-preview.js']) vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),context);
const {createPoint,createNodeAxis,createNodeCircle,defaultArcConfig,defaultArcPoint,createConstructedArc:construct,constructedArcBounds,arcIntersection,makeNode,evaluateGraph,setNodeSource,getSourceChain,collectArcCircles,createArcStyles}=context;
const circle=(x,y,r,rotation=0)=>{const p=createPoint(x,y);return createNodeCircle(p,r,createNodeAxis(p,3,rotation));};
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const ref=(id,index=0,count=1)=>({nodeId:id,index,count});
const center=(id,index=0,count=1)=>({...defaultArcPoint(),kind:'center',circle:ref(id,index,count)});
const source=new Map([['base',[circle(0,0,10)]],['other',[circle(10,0,10)]]]);
const resolve=id=>{if(!source.has(id))throw new Error('missing');return source.get(id);};
const config=defaultArcConfig();config.circle=ref('base');config.angleFrame='world';
let arc=construct(config,resolve);close(arc.sweep,Math.PI/2);close(arc.startPoint.x,10);close(arc.endPoint.y,10);
config.sweep='long';close(construct(config,resolve).sweep,-3*Math.PI/2);
config.sweep='cw';close(construct(config,resolve).sweep,-3*Math.PI/2);
config.sweep='ccw';close(construct(config,resolve).sweep,Math.PI/2);
config.startAngle=350;config.endAngle=10;config.sweep='short';close(construct(config,resolve).sweep,20*Math.PI/180);
config.startAngle=0;config.endAngle=180;close(construct(config,resolve).sweep,Math.PI);
config.sweep='long';close(construct(config,resolve).sweep,-Math.PI);
config.endAngle=0;assert.throws(()=>construct(config,resolve),/coincide/);
config.sweep='full';config.endAngle=NaN;close(construct(config,resolve).sweep,Math.PI*2);
config.sweep='short';config.bounds='directions';config.startPoint=defaultArcPoint(3,0);config.endPoint=defaultArcPoint(0,40);
arc=construct(config,resolve);close(arc.startPoint.x,10);close(arc.endPoint.y,10);
config.bounds='points';assert.throws(()=>construct(config,resolve),/endpoint is not on/);
config.startPoint=defaultArcPoint(10,0);config.endPoint=defaultArcPoint(0,10);close(construct(config,resolve).sweep,Math.PI/2);
config.startPoint=defaultArcPoint();assert.throws(()=>construct(config,resolve),/coincide/);
config.startPoint={...defaultArcPoint(),kind:'intersection',first:ref('base'),second:ref('other'),branch:'left'};
config.endPoint={...config.startPoint,branch:'right'};
arc=construct(config,resolve);close(arc.startPoint.x,5);close(arc.startPoint.y,Math.sqrt(75));close(arc.sweep,-2*Math.PI/3);
source.set('other',[circle(30,0,10)]);assert.throws(()=>construct(config,resolve),/no longer intersect/);
close(arcIntersection(circle(0,0,10),circle(20,0,10),'left').x,10);
assert.throws(()=>arcIntersection(circle(0,0,10),circle(0,0,10),'left'),/Concentric/);
config.support='defined';config.center=defaultArcPoint(20,30);config.radiusMode='point';config.radiusPoint=defaultArcPoint(23,34);
config.bounds='angles';config.sweep='short';config.startAngle=0;config.endAngle=90;
arc=construct(config,resolve);close(arc.radius,5);close(arc.startPoint.x,25);
config.radiusMode='circle';config.radiusCircle=ref('base');config.radiusFactor=2;close(construct(config,resolve).radius,20);
config.radiusMode='number';config.radius=-1;assert.throws(()=>construct(config,resolve),/positive/);
config.radius=10;arc=construct(config,resolve);
const box=constructedArcBounds(arc);close(box[0],20);close(box[1],-40);close(box[2],30);close(box[3],-30);
config.sweep='long';const long=construct(config,resolve);const longBox=constructedArcBounds(long);close(longBox[0],10);close(longBox[3],-20);
assert.match(context.circleArcPath(long,long),/0 0 1/);
// Reference image and general regular layouts: choose any center, then two
// equally distant neighboring centers. No special case for three circles.
for(const n of [3,4,5,8]){
 const outer=makeNode('circle'),group=makeNode('tangent'),node=makeNode('arc');
 outer.params.nRosy=n;group.sourceId=outer.id;
 const c=node.arcConfig;c.support='defined';c.center=center(group.id,1,n);
 c.radiusMode='point';c.radiusPoint=center(group.id,0,n);c.bounds='points';
 c.startPoint=center(group.id,0,n);c.endPoint=center(group.id,2,n);
 const nodes=[outer,group,node];let result=evaluateGraph(nodes);assert.equal(result.errors.size,0);
 const value=result.results.get(node.id)[0];close(Math.abs(value.sweep),(n-2)*Math.PI/n);
 const radius=value.radius;
 if(n===3)close(radius,2*result.results.get(group.id)[0].radius);
 outer.params.radius*=2;outer.params.rotation+=73;outer.params.x=15;outer.params.y=-24;
 result=evaluateGraph(nodes);assert.equal(result.errors.size,0);close(result.results.get(node.id)[0].radius,2*radius);
 assert.ok(getSourceChain(nodes,node.id).some(s=>s.id===group.id));
 assert.throws(()=>setNodeSource(nodes,node.id,group.id),/not an arc/);
 outer.params.nRosy=n+1;result=evaluateGraph(nodes);assert.match(result.errors.get(node.id),/count has changed/);
 assert.ok(result.results.has(outer.id));
}
const outer=makeNode('circle'),arcNode=makeNode('arc');arcNode.arcConfig.circle=ref(outer.id);
let result=evaluateGraph([outer,arcNode]);assert.equal(result.errors.size,0);
assert.equal(collectArcCircles([outer,arcNode],result).length,1);
arcNode.arcConfig.circle=ref(arcNode.id);assert.match(evaluateGraph([outer,arcNode]).errors.get(arcNode.id),/Circular/);
arcNode.arcConfig.circle=ref('deleted');assert.match(evaluateGraph([outer,arcNode]).errors.get(arcNode.id),/does not exist/);
// Actual preview includes one constructed path, not its invisible support circle,
// and display styles never alter the geometry result.
class Element{
 constructor(tag='div'){this.tag=tag;this.attrs={};this.dataset={};this.children=[];this.classList={toggle(){}};}
 setAttribute(k,v){this.attrs[k]=String(v);}append(...xs){this.children.push(...xs);}appendChild(e){this.append(e);}replaceChildren(...xs){this.children=xs;}addEventListener(){}
}
const elements=new Map(['drawing-board','geometry-count','edit-arcs','arc-style-count','undo-arc','restore-arcs','arc-edit-help','arc-change-notice','fit-view'].map(id=>[id,new Element()]));
context.document={getElementById:id=>elements.get(id),createElementNS:(_,tag)=>new Element(tag)};
arcNode.arcConfig.circle=ref(outer.id);outer.visible=false;
const state={nodes:[outer,arcNode],evaluation:evaluateGraph([outer,arcNode]),arcStyles:createArcStyles(),arcEditing:true};
const preview=context.createGraphPreview(state);
const all=()=>{const xs=[];function walk(e){xs.push(e);e.children.forEach(walk);}walk(elements.get('drawing-board'));return xs;};
preview.render();assert.equal(all().filter(e=>e.tag==='circle').length,0);
assert.equal(all().filter(e=>e.attrs['data-arc-node']===arcNode.id).length,1);
const key=arcNode.id+'/constructed';state.arcStyles.cycle(key);preview.render();assert.ok(all().some(e=>e.attrs['data-arc-style']==='dashed'));
state.arcStyles.cycle(key);preview.render();assert.ok(!all().some(e=>e.attrs['data-arc-key']===key));
state.showHiddenArcs=true;preview.render();assert.ok(all().some(e=>e.attrs['data-arc-style']==='hidden'));
arcNode.showAxis=true;preview.render();assert.ok(all().some(e=>e.attrs.class==='arc-construction-guide'));
preview.fit();assert.ok(!elements.get('drawing-board').attrs.viewBox.includes('NaN'));
assert.equal(state.evaluation.results.get(arcNode.id)[0].type,'arc');
console.log('Passed: all sweep modes, wraparound, strict/projected endpoints, circle intersections and tangencies, radius sources, exact bounds, reference image at N=3/4/5/8, source updates, type safety, cycle/deletion/count errors, SVG paths, guides and display styles.');
