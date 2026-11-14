'use strict';
const assert=require('node:assert/strict');const {benchmarkBackboneMetrics}=require('../metrics');
const point=x=>({x,y:0,z:0});
const a={reference:{CA:point(0)},predicted:{CA:point(0)},source:'UniProt sequence'},b={reference:{CA:point(5)},predicted:{CA:point(5)},source:'AlphaFold'},c={reference:{CA:point(10)},predicted:{},source:'UniProt sequence'};
benchmarkBackboneMetrics([[a],[b],[c]]);
assert.equal(a.lddtCompared,1);assert.equal(a.lddtMissing,1);assert.equal(a.neighbourSources.alphafold.eligible,1);assert.equal(a.neighbourSources.alphafold.compared,1);assert.equal(a.neighbourSources.uniprot.eligible,1);assert.equal(a.neighbourSources.uniprot.compared,0);assert.equal(b.neighbourSources.uniprot.eligible,2);
console.log('Mixed-source lDDT neighbour tests passed');
