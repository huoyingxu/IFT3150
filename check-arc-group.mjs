import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c=vm.createContext({});for(const f of ['point.js','node-axis.js','node-circle.js','self-tangent-circles.js','constructed-arc.js','arc-group.js','graph-model.js','graph-layout.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const outer=c.makeNode('circle'),inner=c.makeNode('tangent'),arc=c.makeNode('arc'),group=c.makeNode('arcGroup');inner.sourceId=outer.id;group.sourceId=arc.id;group.groupConfig.centerRef={nodeId:outer.id,index:0};
const point=i=>({...c.defaultArcPoint(),kind:'center',circle:{nodeId:inner.id,index:i,count:3}});
Object.assign(arc.arcConfig,{support:'defined',center:point(1),radiusMode:'point',radiusPoint:point(0),bounds:'points',startPoint:point(0),endPoint:point(2),sweep:'short'});
const nodes=[outer,inner,arc,group];let r=c.evaluateGraph(nodes);assert.equal(r.errors.size,0);
const near=(a,b)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-7);
let arcs=r.results.get(group.id);assert.equal(arcs.length,3);for(const a of arcs)assert.ok(arcs.some(b=>Math.hypot(a.endPoint.x-b.startPoint.x,a.endPoint.y-b.startPoint.y)<1e-7),'three arcs form closed loop');
for(const n of [1,4,8,60]){group.groupConfig.count=n;r=c.evaluateGraph(nodes);arcs=r.results.get(group.id);assert.equal(arcs.length,n);for(const a of arcs){assert.equal(a.radius,r.results.get(arc.id)[0].radius);assert.equal(a.sweep,r.results.get(arc.id)[0].sweep);}}
group.groupConfig.count=3;outer.params.x=35;outer.params.y=-70;outer.params.radius=240;r=c.evaluateGraph(nodes);assert.equal(r.errors.size,0);near(r.results.get(group.id)[0].startPoint,r.results.get(arc.id)[0].startPoint);
arc.visible=false;r=c.evaluateGraph(nodes);assert.equal(r.results.get(group.id).length,3);
group.groupConfig.centerMode='coordinates';group.groupConfig.x=30;group.groupConfig.y=10;r=c.evaluateGraph(nodes);assert.equal(r.errors.size,0);
group.groupConfig.count=0;assert.ok(c.evaluateGraph(nodes).errors.has(group.id));group.groupConfig.count=3;
group.groupConfig.centerMode='circle';group.groupConfig.centerRef={nodeId:group.id,index:0};assert.match(c.evaluateGraph(nodes).errors.get(group.id),/Circular/);
group.groupConfig.centerRef={nodeId:'deleted',index:0};assert.ok(c.evaluateGraph(nodes).errors.has(group.id));
group.groupConfig.centerRef={nodeId:outer.id,index:0};group.groupConfig.countMode='axis';assert.equal(c.evaluateGraph(nodes).results.get(group.id).length,3);
assert.equal(c.graphInputPorts(group,nodes).length,2);assert.ok(c.getNodeDependencies(group).includes(outer.id));
console.log('Passed: closed three-arc reference, counts 1/4/8/60, radius and sweep preservation, moved/scaled centers, hidden source, explicit center, invalid count, cycles, missing source, axis count and layout dependencies.');
