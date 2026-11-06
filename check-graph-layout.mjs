import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ELK=require('./vendor/elkjs/elk.bundled.js');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('graph-layout.js',import.meta.url),'utf8'),context);
const {graphInputPorts,buildElkGraph,elkSectionPath,graphViewSignature}=context;
const outer={id:'outer',kind:'circle'},inner={id:'inner',kind:'tangent',sourceId:'outer'};
const gap={id:'gap',kind:'gapTangent',sourceId:'inner'};
const triple={id:'triple',kind:'threeTangent',boundaries:[{nodeId:'inner',index:0},{nodeId:'inner',index:1},{nodeId:'outer',index:0}],containerRef:{nodeId:'outer'}};
const arc={id:'arc',kind:'arc',arcConfig:{support:'circle',circle:{nodeId:'inner',index:0},bounds:'directions',sweep:'short',startPoint:{kind:'center',circle:{nodeId:'inner',index:1}},endPoint:{kind:'center',circle:{nodeId:'inner',index:2}}}};
const nodes=[outer,inner,gap,triple,arc];
assert.equal(graphInputPorts(triple,nodes).length,4);
assert.equal(graphInputPorts(gap,nodes)[1].ref.nodeId,'outer');
assert.deepEqual(Array.from(graphInputPorts(arc,nodes),p=>p.key),['support','start','end']);
arc.arcConfig.sweep='full';assert.equal(graphInputPorts(arc,nodes).length,2);arc.arcConfig.sweep='short';
function viewsFor(nodes,compact=false) {
 return nodes.flatMap(node=>(node.kind==='circle'?['geometry']:['function','geometry']).map(role=>{
  const id=node.id+':'+role;
  const ports=[{id:id+':out',x:284,y:36,side:'EAST'}];
  const inputs=role==='function'?graphInputPorts(node,nodes):node.kind==='circle'?[]:[{key:'result',label:'Result',ref:{nodeId:node.id}}];
  inputs.forEach((p,i)=>ports.push({id:id+':'+p.key,x:0,y:86+i*24,side:'WEST',label:p.label,index:p.ref?.index,source:p.ref?p.ref.nodeId+':'+(role==='geometry'?'function':'geometry'):null}));
  return {id,nodeId:node.id,role,width:284,height:compact?200:role==='function'?600:450,x:10,y:20,ports};
 }));
}
function intersects(a,b,r) {
 if(Math.abs(a.x-b.x)<1e-6)return a.x>r.x+1e-5&&a.x<r.x+r.width-1e-5&&Math.max(a.y,b.y)>r.y+1e-5&&Math.min(a.y,b.y)<r.y+r.height-1e-5;
 return a.y>r.y+1e-5&&a.y<r.y+r.height-1e-5&&Math.max(a.x,b.x)>r.x+1e-5&&Math.min(a.x,b.x)<r.x+r.width-1e-5;
}
for(const compact of [false,true]) {
 const views=viewsFor(nodes,compact),before=graphViewSignature(views),graph=buildElkGraph(views);
 const repeated=graph.edges.filter(e=>e.sources[0]==='inner:geometry:out'&&e.targets[0].startsWith('triple:'));
 assert.equal(repeated.length,2);assert.notEqual(repeated[0].targets[0],repeated[1].targets[0]);
 // Match the browser worker's structured-copy boundary across this VM realm.
 const result=await new ELK().layout(JSON.parse(JSON.stringify(graph)));
 assert.equal(graphViewSignature(views),before,'layout does not mutate input snapshot');
 const actualPorts=new Map();
 for(const child of result.children)for(const p of child.ports)actualPorts.set(p.id,{x:child.x+p.x,y:child.y+p.y});
 for(const edge of result.edges) {
  assert.ok(edge.sections?.length);
  const first=edge.sections[0],last=edge.sections.at(-1);
  assert.deepEqual(first.startPoint,actualPorts.get(edge.sources[0]));assert.deepEqual(last.endPoint,actualPorts.get(edge.targets[0]));
  for(const section of edge.sections) {
   assert.match(elkSectionPath(section),/^M /);
   const points=[section.startPoint,...(section.bendPoints||[]),section.endPoint];
   for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i];assert.ok(a.x===b.x||a.y===b.y,'orthogonal segment');
    for(const rect of result.children)assert.ok(!intersects(a,b,rect),'edge avoids '+rect.id);
   }
  }
  for(const label of edge.labels)assert.ok(Number.isFinite(label.x)&&Number.isFinite(label.y));
 }
}
const missing={...triple,boundaries:[null,{nodeId:'deleted',index:0},null],containerRef:null};
assert.equal(buildElkGraph(viewsFor([outer,missing])).edges.length,1,'missing sources produce no dangling edges');
assert.equal(buildElkGraph([]).children.length,0);
console.log('Passed: ELK orthogonal routes avoid cards, exact port endpoints, distinct A/B from one group, inherited outer input, active arc inputs, compact cards, labels, missing sources and immutable snapshots.');
