'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../bridge.js'),'utf8');
const context={};vm.createContext(context);vm.runInContext(source,context);
const group=chain=>[{node:{res:{c1:chain}}}];
const groups=new Map([['first',group('A:D')],['second',group('B:J')]]);
const alignments=[{entityType:'protein',c1:'A:D',sourceChains:['A','D']},{entityType:'protein',c1:'B:J',sourceChains:['B','J']}];
for(const [chain,expected] of [['A','A:D'],['D','A:D'],['B','B:J'],['J','B:J']]){
    const matches=context.benchmarkReferenceGroups(chain,groups,alignments);assert.equal(matches.length,1);assert.equal(matches[0][0].node.res.c1,expected);
}
assert.equal(context.benchmarkReferenceGroups('X',groups,alignments).length,0);
groups.set('ambiguous',group('A'));
assert.equal(context.benchmarkReferenceGroups('A',groups,alignments).length,2);
console.log('Merged reference comparison group tests passed');
