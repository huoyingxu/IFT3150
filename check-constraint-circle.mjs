import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c=vm.createContext({console});
for(const f of ['point','node-axis','node-circle','self-tangent-circles','constructed-arc','constraint-circle','graph-model','arc-geometry','free-editor'])vm.runInContext(fs.readFileSync(f+'.js','utf8'),c);
const outer=c.makeNode('circle'),inner=c.makeNode('tangent'),node=c.makeNode('constraintCircle');inner.sourceId=outer.id;
const nodes=[outer,inner,node];let e=c.evaluateGraph(nodes);
const cfg=node.arcConfig;delete cfg.constraints;cfg.carrier={nodeId:outer.id,index:0};cfg.target={nodeId:inner.id,index:0};cfg.point={...c.defaultArcPoint(),kind:'circlePoint',circle:{nodeId:inner.id,index:1},angle:180};
e=c.evaluateGraph(nodes);let options=e.candidates.get(node.id);assert.ok(options.length>=2);cfg.solution=options[0].angle;
for(const n of [3,4,5]){
 outer.params.nRosy=n;e=c.evaluateGraph(nodes);options=e.candidates.get(node.id);assert.ok(options.length);
 for(const o of options){const carrier=e.results.get(outer.id)[0],t=e.results.get(inner.id)[0],p=c.resolveArcPoint(cfg.point,id=>e.results.get(id));
 const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 assert.ok(Math.abs(d(o.center,carrier.center)-carrier.radius)<1e-5);
 assert.ok(Math.abs(d(o.center,t.center)-o.radius-t.radius)<1e-5);
 assert.ok(Math.abs(d(o.center,p)-o.radius)<1e-5);}
 assert.ok(e.results.has(node.id), e.errors.get(node.id));
}
assert.ok(c.getNodeDependencies(node).includes(inner.id));
assert.equal(c.solveCenterTangentPoint({center:{x:0,y:0},radius:1},{center:{x:100,y:0},radius:1},{x:0,y:0}).length,0);
assert.throws(()=>c.solveCenterTangentPoint({center:{x:0,y:0},radius:1},{center:{x:0,y:0},radius:2},{x:0,y:0},'internal'),/infinitely/);
console.log('Passed three constraints, multiple candidates, nRosy 3/4/5, dependencies, no solution and infinite solutions.');
const ref=(id,index=0)=>({nodeId:id,index});
const P=(x,y)=>({kind:'coordinates',x,y});
const solve=constraints=>c.solveCircleConstraints({constraints},id=>e.results.get(id));
let sols=solve([{type:'point',point:P(0,0)},{type:'point',point:P(2,0)},{type:'point',point:P(0,2)}]);
assert.equal(sols.length,1);assert.ok(Math.abs(sols[0].center.x-1)<1e-5);assert.ok(Math.abs(sols[0].radius-Math.SQRT2)<1e-5);
sols=solve([{type:'point',point:P(-1,0)},{type:'point',point:P(1,0)},{type:'radius',value:2}]);assert.equal(sols.length,2);
sols=solve([{type:'centerLine',a:P(0,-2),b:P(0,2)},{type:'point',point:P(1,0)},{type:'point',point:P(0,1)}]);assert.equal(sols.length,1);assert.ok(Math.abs(sols[0].center.y)<1e-5);
assert.throws(()=>solve([{type:'point',point:P(1,0)},{type:'point',point:P(1,0)},{type:'radius',value:2}]),/Repeated/);
sols=solve([{type:'point',point:P(-5,0)},{type:'point',point:P(5,0)},{type:'radius',value:1}]);assert.equal(sols.length,0);
outer.params.nRosy=3;e=c.evaluateGraph(nodes);
sols=solve([{type:'tangent',circle:ref(inner.id,0),mode:'external'},{type:'tangent',circle:ref(inner.id,1),mode:'external'},{type:'tangent',circle:ref(outer.id),mode:'internal'}]);assert.ok(sols.length>=1);
for(const s of sols)for(const [id,index,mode]of [[inner.id,0,'external'],[inner.id,1,'external'],[outer.id,0,'internal']]){const q=e.results.get(id)[index];assert.ok(Math.abs(Math.hypot(s.center.x-q.center.x,s.center.y-q.center.y)-(mode==='external'?s.radius+q.radius:Math.abs(s.radius-q.radius)))<1e-4);}
console.log('Passed unified three points, radius + two points, center line + points, repeated constraints, no solution and three tangencies.');
// Exercise the actual right-panel wizard with a small DOM fixture.
vm.runInContext(fs.readFileSync('arc-picker.js','utf8'),c);
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.style={};this.value='';}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k]??null;}
 add(option){this.append(option);}
 addEventListener(k,fn){this['on'+k]=fn;}
 before(n){this.parent?.append(n);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 querySelectorAll(selector){return walk(this).filter(n=>selector==='.arc-pick-overlay'&&n.attrs.class==='arc-pick-overlay');}
}
const walk=n=>n.children.flatMap(ch=>[ch,...walk(ch)]);
const board=new Element('svg'),area=new Element('div'),host=new Element('div');host.append(area);area.append(board);board.parentElement=area;
const toggle=new Element('input');
c.document={getElementById:id=>id==='drawing-board'?board:toggle,createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),addEventListener(){}};
c.Option=function(text,value){this.textContent=text;this.value=value;this.children=[];this.attrs={};};c.structuredClone=structuredClone;
const uiNode=c.makeNode('constraintCircle'),uiState={nodes:[outer,inner,uiNode],evaluation:null};let picker;
const update=()=>{uiState.evaluation=c.evaluateGraph(uiState.nodes);picker?.render();};update();picker=c.createArcPicker(uiState,update,{render(){}});
picker.open(uiNode.id,'constraint',null,'constraint');
const preset=walk(host).find(n=>n.attrs['aria-label']==='Constraint preset');preset.value='ppp';preset.onchange();
walk(host).find(n=>n.textContent==='Next: pick on canvas').onclick();
function pick(label){const n=walk(board).find(n=>n.attrs['aria-label']===label);assert.ok(n,label);n.onclick({type:'click',preventDefault(){},stopPropagation(){}});}
pick('Pick Circle 1 / Circle 1 axis point 1');pick('Pick Circle 1 / Circle 1 axis point 2');pick('Pick Circle 1 / Circle 1 axis point 3');
assert.ok(walk(board).some(n=>n.attrs['aria-label']==='Pick candidate 1'));pick('Pick candidate 1');assert.ok(uiState.evaluation.results.has(uiNode.id));
const saved=JSON.stringify(uiNode.arcConfig);picker.open(uiNode.id,'constraint',null,'constraint');
walk(host).find(n=>n.textContent==='Cancel picking').onclick();assert.equal(JSON.stringify(uiNode.arcConfig),saved);
console.log('Passed right-panel preset selection, three canvas picks, candidate confirmation and cancellation.');
