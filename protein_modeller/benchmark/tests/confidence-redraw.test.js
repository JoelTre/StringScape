'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../../script.js'),'utf8');
const start=source.indexOf('        function refreshValidationColourDisplay()'),end=source.indexOf('        // PAE is pairwise:',start);assert.ok(start>=0&&end>start);
const calls=[];let pending;
const ctx={validationState:{version:1,pae:new Map(),paeLoading:false},modelData2:{files:[{pdbId:'P12345',fileIndex:0}]},alphaFoldMolstarFiles:[{pdbId:'P12345',sequenceOnly:false}],springPaeRevision:0,physicsColorMode:'local-confidence',showModel1Overlay:true,referenceColorMode:'same',validationElement:()=>({open:false,textContent:''}),fetch:async url=>url.includes('api/prediction')?{ok:true,json:async()=>[{paeDocUrl:'https://example.test/pae'}]}:{ok:true,json:async()=>[{predicted_aligned_error:[[0,2],[3,0]]}]},trustedAlphaFoldUrl:x=>x,Float32Array,Number,Array,Map,console,
 updatePhysicsColourLoadingBadge:()=>{},updatePhysicsNodeColors:()=>calls.push('nodes'),updateModel1AlignmentColors:()=>calls.push('reference'),invalidatePhysicsSurfaceColours:()=>calls.push('surface'),updateAtomRepresentation:()=>calls.push('atoms'),updateCartoonRepresentation:()=>calls.push('cartoon'),requestVisualPhysicsMeshUpdate:()=>calls.push('redraw'),calculateValidationPairs:()=>calls.push('pairs')};
vm.createContext(ctx);vm.runInContext(source.slice(start,end)+'\nthis.load=loadValidationPae;',ctx);
(async()=>{
 await ctx.load();assert.equal(ctx.validationState.paeLoading,false);assert.equal(ctx.validationState.pae.get(0).values[1],2);assert.equal(ctx.springPaeRevision,1);assert.deepEqual(calls,['pairs','nodes','reference','surface','atoms','cartoon','redraw']);
 calls.length=0;ctx.physicsColorMode='chain';ctx.validationState.pae.clear();await ctx.load();assert.deepEqual(calls,[]);
 const surfaceStart=source.indexOf('        function invalidatePhysicsSurfaceColours()'),surfaceEnd=source.indexOf('        // Smoothly blend',surfaceStart);assert.ok(surfaceStart>=0&&surfaceEnd>surfaceStart);
 const surfaceCtx={physicsRepresentation:'surface',lastSurfaceUpdate:123,atomRepresentation:{pending:true}};vm.createContext(surfaceCtx);vm.runInContext(source.slice(surfaceStart,surfaceEnd)+'\nthis.invalidate=invalidatePhysicsSurfaceColours;',surfaceCtx);surfaceCtx.invalidate();assert.equal(surfaceCtx.lastSurfaceUpdate,-Infinity);assert.equal(surfaceCtx.atomRepresentation.colorRefreshPending,true);
 // Completion of the background validation job must refresh even without a pointer event.
 const a=source.indexOf('        let validationRefreshPending=false;'),b=source.indexOf('        function computeValidationPairs()',a);assert.ok(a>=0&&b>a);
 const calls2=[];const workerCtx={updatePhysicsColourLoadingBadge:()=>{},physicsColorMode:'placement-5',calculateValidationPairsAsync:()=>Promise.resolve({pairs:[]}),refreshValidationColourDisplay:()=>calls2.push('refresh'),validationElement:()=>({open:false}),validationMembraneDetectionConfidence:()=>null,validationState:{pairs:[]},reportBackgroundError:e=>{throw e;}};
 vm.createContext(workerCtx);vm.runInContext(source.slice(a,b)+'\nthis.calculate=calculateValidationPairs;',workerCtx);workerCtx.calculate();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls2,['refresh']);
 console.log('Asynchronous confidence redraw tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
