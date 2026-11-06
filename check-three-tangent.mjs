import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({console});
for(const file of ['point.js','node-axis.js','node-circle.js','self-tangent-circles.js','gap-tangent-circles.js','three-tangent-circle.js','graph-model.js']) vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),context);
const {createPoint,createNodeAxis,createNodeCircle,createSelfTangentCircles,createGapTangentCircles,solveThreeTangentCircles:solve,checkTangentCandidate:check,makeNode,evaluateGraph,setNodeSource,getSourceChain}=context;
const circle=(x,y,r,n=3,rotation=90)=>{const p=createPoint(x,y);return createNodeCircle(p,r,createNodeAxis(p,n,rotation));};
const distance=(a,b)=>Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y);
function verify(c,inputs,modes){ inputs.forEach((b,i)=>assert.ok(Math.abs(distance(c,b)-(modes[i]==='internal'?b.radius-c.radius:b.radius+c.radius))<1e-6*Math.max(c.radius,b.radius))); }
const external=['external','external','external'];
const equal=[circle(0,0,1),circle(2,0,1),circle(1,Math.sqrt(3),1)];
let candidates=solve(equal,external);
assert.equal(candidates.length,1);
assert.ok(Math.abs(candidates[0].radius-(2/Math.sqrt(3)-1))<1e-9);
verify(candidates[0],equal,external);
const collinear=[circle(-2,0,1),circle(0,0,.5),circle(2,0,1)];
candidates=solve(collinear,external); assert.equal(candidates.length,2);
assert.notEqual(candidates[0].branch,candidates[1].branch);
candidates.forEach(c=>verify(c,collinear,external));
assert.throws(()=>solve([equal[0],equal[0],equal[2]],external),/degenerate/);
assert.equal(solve([circle(0,0,10),circle(1,0,1),circle(0,1,1)],external).length,0);
const mixed=[circle(0,0,10),circle(-5,0,5),circle(5,0,5)];
candidates=solve(mixed,['internal','external','external']); assert.equal(candidates.length,2);
candidates.forEach(c=>{verify(c,mixed,['internal','external','external']);assert.ok(Math.abs(c.radius-10/3)<1e-8);});
// Translation, rotation, unequal radii and scaling preserve tangency and branch.
for(const scale of [1e-4,1,1e6]){
 const base=circle(1,-2,.7);
 const inputs=[0,1,2].map((i)=>{const angle=i*2.1+.2,r=[1,2,.4][i];return circle(base.center.x+(base.radius+r)*Math.cos(angle),base.center.y+(base.radius+r)*Math.sin(angle),r);});
 const first=solve(inputs,external).find(c=>Math.abs(c.radius-.7)<1e-7);assert.ok(first);
 const transform=c=>circle((c.center.x*Math.cos(.6)-c.center.y*Math.sin(.6))*scale+53,(c.center.x*Math.sin(.6)+c.center.y*Math.cos(.6))*scale-21,c.radius*scale);
 const result=solve(inputs.map(transform),external).find(c=>c.branch===first.branch); assert.ok(result);
 assert.ok(Math.abs(result.radius-.7*scale)<1e-7*scale);verify(result,inputs.map(transform),external);
}
// Reproduce the marked gap for N=3, then vary N and the placement.
for(const n of [3,4,5,8]){
 const outer=circle(30,-10,120,n,90), inner=createSelfTangentCircles(outer,3,0).circles;
 const gaps=createGapTangentCircles(outer,inner,3,0).circles;
 const boundaries=[gaps[0],gaps[1],inner[0]];
 const scene=[outer,...inner,...gaps].map((circle,i)=>({circle,label:'circle '+i}));
 const result=solve(boundaries,external).filter(c=>!check(c,boundaries,external,scene,outer));
 assert.ok(result.length>0,'marked gap exists for N='+n);
 result.forEach(c=>verify(c,boundaries,external));
 const candidate=result[0];
 assert.match(check(candidate,boundaries,external,[...scene,{circle:circle(candidate.center.x,candidate.center.y,candidate.radius*.2),label:'blocker'}],outer),/Overlaps/);
}
const outer=makeNode('circle'), inner=makeNode('tangent'), gap=makeNode('gapTangent'), output=makeNode('threeTangent');
inner.sourceId=outer.id;gap.sourceId=inner.id;
output.boundaries=[{nodeId:gap.id,index:0,count:6},{nodeId:gap.id,index:1,count:6},{nodeId:inner.id,index:0,count:3}];
output.obstacleIds=[outer.id,inner.id,gap.id];
const nodes=[outer,inner,gap,output];
let evalResult=evaluateGraph(nodes);
output.branch=evalResult.candidates.get(output.id).find(c=>!c.blocked).branch;
evalResult=evaluateGraph(nodes);assert.equal(evalResult.errors.size,0);
const radius=evalResult.results.get(output.id)[0].radius;
outer.params.radius*=2;evalResult=evaluateGraph(nodes);
assert.ok(Math.abs(evalResult.results.get(output.id)[0].radius-2*radius)<1e-8);
outer.params.rotation=20; outer.params.x=50; outer.params.y=-20;
evalResult=evaluateGraph(nodes);assert.equal(evalResult.errors.size,0);
const child=makeNode('tangent');child.sourceId=output.id;nodes.push(child);
evalResult=evaluateGraph(nodes);assert.equal(evalResult.results.get(child.id).length,3);
assert.throws(()=>setNodeSource(nodes,child.id,inner.id),/dependent/);
assert.ok(getSourceChain(nodes,child.id).some(n=>n.id===gap.id));
for(const n of [4,5,8,3]) {
 outer.params.nRosy=n;evalResult=evaluateGraph(nodes);assert.equal(evalResult.errors.size,0);
 verify(evalResult.results.get(output.id)[0],output.boundaries.map(r=>evalResult.results.get(r.nodeId)[r.index]),output.modes);
 assert.equal(evalResult.results.get(child.id).length,3);
}
// User example: two inner circles externally tangent, outer circle internally tangent.
const mixedOutput=makeNode('threeTangent');
mixedOutput.boundaries=[{nodeId:inner.id,index:0,count:3},{nodeId:inner.id,index:1,count:3},{nodeId:outer.id,index:0,count:1}];
mixedOutput.modes=['external','external','internal'];
mixedOutput.containerRef={nodeId:outer.id,index:0,count:1};
mixedOutput.obstacleIds=[outer.id,inner.id];
const mixedNodes=[outer,inner,mixedOutput];
evalResult=evaluateGraph(mixedNodes);
mixedOutput.branch=evalResult.candidates.get(mixedOutput.id).find(c=>!c.blocked).branch;
const savedBranch=mixedOutput.branch;
for(const n of [3,4,5,8,4,3]) {
 outer.params.nRosy=n;evalResult=evaluateGraph(mixedNodes);assert.equal(evalResult.errors.size,0);
 verify(evalResult.results.get(mixedOutput.id)[0],mixedOutput.boundaries.map(r=>evalResult.results.get(r.nodeId)[r.index]),mixedOutput.modes);
 assert.equal(mixedOutput.branch,savedBranch);
}
mixedOutput.boundaries[1]={nodeId:inner.id,index:3,count:4};
evalResult=evaluateGraph(mixedNodes);assert.match(evalResult.errors.get(mixedOutput.id),/no longer exists/);
outer.params.nRosy=4;evalResult=evaluateGraph(mixedNodes);assert.ok(evalResult.candidates.has(mixedOutput.id));
outer.params.nRosy=3; output.branch='missing';evalResult=evaluateGraph(nodes);assert.match(evalResult.errors.get(output.id),/selected solution no longer exists/);
output.boundaries[0].nodeId='deleted';evalResult=evaluateGraph(nodes);assert.ok(evalResult.errors.has(output.id));
console.log('Passed: tangency solver, two branches, internal/external, degeneracy, no solution, transforms, N=3/4/5/8 marked gaps, collision checks, graph propagation, stable selection, topology changes, missing sources, reuse and cycle prevention.');
