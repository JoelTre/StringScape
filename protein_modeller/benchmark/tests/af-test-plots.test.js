'use strict';
const assert=require('node:assert/strict');
const {benchmarkHistogramBins}=require('../plots.js');
let bins=benchmarkHistogramBins([{values:[0,1,2,null,NaN]},{values:[1,2,3]}],3);
assert.equal(bins.min,0);assert.equal(bins.max,3);
assert.deepEqual(bins.counts,[[1,1,1],[0,1,2]]);
bins=benchmarkHistogramBins([{values:[-2,0,2]}],4);
assert.equal(bins.min,-2);assert.equal(bins.max,2);assert.deepEqual(bins.counts,[[1,0,1,1]]);
bins=benchmarkHistogramBins([{values:[5,5]}],4);
assert.ok(bins.min<5&&bins.max>5);assert.equal(bins.counts[0].reduce((a,b)=>a+b,0),2);
bins=benchmarkHistogramBins([{values:[]}],4);
assert.deepEqual(bins.counts,[[0,0,0,0]]);
console.log('AlphaFold comparison histogram tests passed');
const {benchmarkDistributionStats}=require('../plots.js');
assert.deepEqual(benchmarkDistributionStats([]),{mean:null,median:null});
assert.deepEqual(benchmarkDistributionStats([3,1,2]),{mean:2,median:2});
assert.deepEqual(benchmarkDistributionStats([-2,4,1,1]),{mean:1,median:1});
const {benchmarkMeanTriangle}=require('../plots.js');
const triangle=benchmarkMeanTriangle(3,4,5);
assert.ok(Math.abs(Math.hypot(triangle.reference.x,triangle.reference.y)-3)<1e-10);
assert.ok(Math.abs(Math.hypot(triangle.reference.x-triangle.final.x,triangle.reference.y)-4)<1e-10);
assert.equal(benchmarkMeanTriangle(null,1,1),null);
assert.equal(benchmarkMeanTriangle(1,1,3),null);
assert.deepEqual(benchmarkMeanTriangle(2,2,0).reference,{x:0,y:2});
const {benchmarkMds}=require('../plots.js');
const tetra=[[0,1,1,1],[1,0,Math.SQRT2,Math.SQRT2],[1,Math.SQRT2,0,Math.SQRT2],[1,Math.SQRT2,Math.SQRT2,0]];
const fitted3d=benchmarkMds(tetra,3),fitted2d=benchmarkMds(tetra,2);
assert.ok(fitted3d.rmse<1e-8);assert.ok(fitted2d.rmse>0.01);
assert.deepEqual(benchmarkMds([[0,0],[0,0]],3).coordinates,[[0,0,0],[0,0,0]]);
assert.equal(benchmarkMds([[0,1],[2,0]],2),null);

const {benchmarkMeanByX}=require('../plots.js');
assert.deepEqual(benchmarkMeanByX([{id:'A',x:1,y:2},{id:'B',x:1,y:6},{id:'A',x:2,y:9}]),[{x:1,y:4},{x:2,y:9}]);
assert.deepEqual(benchmarkMeanByX([]),[]);

const {benchmarkScatterBounds,benchmarkClampView}=require('../plots.js');
assert.deepEqual(benchmarkScatterBounds([{x:-2,y:4},{x:5,y:10}]),{xMin:-2,xMax:5,yMin:4,yMax:10});
assert.deepEqual(benchmarkScatterBounds([]),{xMin:0,xMax:1,yMin:0,yMax:1});
assert.deepEqual(benchmarkScatterBounds([{x:0,y:5}]),{xMin:-0.5,xMax:0.5,yMin:4.5,yMax:5.5});
const limits={xMin:0,xMax:10,yMin:-5,yMax:5};
assert.deepEqual(benchmarkClampView({xMin:-2,xMax:2,yMin:4,yMax:8},limits),{xMin:0,xMax:4,yMin:1,yMax:5});
assert.deepEqual(benchmarkClampView({xMin:-10,xMax:20,yMin:-20,yMax:20},limits),limits);

const {benchmarkPointDensity}=require('../plots.js');
assert.deepEqual(benchmarkPointDensity([{x:0,y:0},{x:0,y:0},{x:10,y:10}]),[1,1,0]);
assert.deepEqual(benchmarkPointDensity([{x:1,y:1}]),[0]);
assert.deepEqual(benchmarkPointDensity([]),[]);

// Nearby points on either side of a grid boundary count each other; points in the
// same broad region can nevertheless have different local densities.
assert.deepEqual(benchmarkPointDensity([{x:0,y:0},{x:0.04,y:0},{x:0.08,y:0},{x:1,y:1}]),[1,2,1,0]);
