'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../../script.js'),'utf8');const a=source.indexOf('        function validationNodeColor('),b=source.indexOf('        function selectMatrixResiduePair(',a);assert.ok(a>=0&&b>a);
const toggle={checked:false};const nodes=[{res:{entityType:'protein'},referenceLockTarget:{}},{res:{entityType:'protein'}}];
const ctx={physicsNodes:nodes,document:{getElementById:()=>toggle},modelConfidenceColor:x=>`color:${x}`,calculateModelConfidence:()=>({scores:[1,null],local:[1,null],placement2:[1,null],placement5:[1,null]}),validationState:{nodeColors:null,pairs:[]},Float64Array,Uint32Array,Number};vm.createContext(ctx);vm.runInContext(source.slice(a,b)+'\nthis.color=validationNodeColor;',ctx);
for(const mode of ['constraint-confidence','model-confidence','local-confidence','placement-2','placement-5']){toggle.checked=false;assert.equal(ctx.color(0,mode),'#374151');toggle.checked=true;assert.equal(ctx.color(0,mode),'color:1');}
assert.equal(ctx.color(1,'model-confidence'),'#64748b');
console.log('Locked confidence colour tests passed');
