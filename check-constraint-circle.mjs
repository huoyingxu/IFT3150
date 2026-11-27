import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c=vm.createContext({console});
for(const f of ['point','node-axis','node-circle','self-tangent-circles','constructed-arc','constraint-circle','graph-model','arc-geometry','free-editor'])vm.runInContext(fs.readFileSync(f+'.js','utf8'),c);
const outer=c.makeNode('circle'),inner=c.makeNode('tangent'),node=c.makeNode('constraintCircle');inner.sourceId=outer.id;
const nodes=[outer,inner,node];let e=c.evaluateGraph(nodes);
const cfg=node.arcConfig;cfg.carrier={nodeId:outer.id,index:0};cfg.target={nodeId:inner.id,index:0};cfg.point={...c.defaultArcPoint(),kind:'circlePoint',circle:{nodeId:inner.id,index:1},angle:180};
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
