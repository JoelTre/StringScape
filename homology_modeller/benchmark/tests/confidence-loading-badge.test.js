'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../../script.js'),'utf8');
const a=source.indexOf('        function updatePhysicsColourLoadingBadge()'),b=source.indexOf('        // Async confidence data',a);assert.ok(a>=0&&b>a);
const badge={hidden:true,classList:{toggle(name,value){assert.equal(name,'hidden');badge.hidden=value;},add(name){assert.equal(name,'hidden');badge.hidden=true;}}};
const ctx={document:{getElementById:id=>id==='physicsColourLoadingBadge'?badge:null},physicsColorMode:'model-confidence',modelLoading:false,physicsRepresentation:'backbone',atomRepresentation:null,validationState:{paeLoading:true,paeVersion:1,version:1},validationRefreshPending:false,Boolean,Map};
vm.createContext(ctx);vm.runInContext(source.slice(a,b)+'\nthis.update=updatePhysicsColourLoadingBadge;',ctx);
ctx.update();assert.equal(badge.hidden,false);
ctx.physicsColorMode='chain';ctx.update();assert.equal(badge.hidden,true);
ctx.physicsColorMode='model-confidence';ctx.validationState.paeLoading=false;ctx.update();assert.equal(badge.hidden,true);
// Background validation and surface work after initial completion, including orbit, remain hidden.
ctx.validationRefreshPending=true;ctx.update();assert.equal(badge.hidden,true);
ctx.validationRefreshPending=false;ctx.physicsRepresentation='surface';ctx.atomRepresentation={pending:true};ctx.update();assert.equal(badge.hidden,true);
ctx.atomRepresentation.pending=false;ctx.physicsColorMode='placement-2';ctx.validationRefreshPending=true;ctx.update();assert.equal(badge.hidden,false);
ctx.validationRefreshPending=false;ctx.update();assert.equal(badge.hidden,true);
// A new model invalidates the remembered completion.
ctx.validationState.version=2;ctx.validationState.paeVersion=2;ctx.validationState.paeLoading=true;ctx.modelLoading=true;ctx.update();assert.equal(badge.hidden,true);ctx.modelLoading=false;ctx.update();assert.equal(badge.hidden,false);
ctx.validationState.paeLoading=false;ctx.update();assert.equal(badge.hidden,true);
ctx.physicsColorMode='spring-strain';ctx.validationState.paeLoading=true;ctx.update();assert.equal(badge.hidden,true);
// Exercise the actual worker promise lifecycle, including switching modes and rejection.
(async()=>{
 let resolveJob,rejectJob;let job=new Promise((resolve,reject)=>{resolveJob=resolve;rejectJob=reject;});
 const workerStart=source.indexOf('        let validationRefreshPending=false;'),workerEnd=source.indexOf('        function computeValidationPairs()',workerStart);assert.ok(workerStart>=0&&workerEnd>workerStart);
 const workingBadge={hidden:true,classList:{toggle(name,value){workingBadge.hidden=value;},add(){workingBadge.hidden=true;}}};const errors=[];
 const testCtx={document:{getElementById:()=>workingBadge},physicsColorMode:'local-confidence',modelLoading:false,physicsRepresentation:'backbone',atomRepresentation:null,validationState:{version:1,paeLoading:false,pairs:[]},calculateValidationPairsAsync:()=>job,refreshValidationColourDisplay:()=>{},validationElement:()=>({open:false}),validationMembraneDetectionConfidence:()=>null,reportBackgroundError:e=>errors.push(e),Boolean,Map};
 vm.createContext(testCtx);vm.runInContext(source.slice(a,b)+source.slice(workerStart,workerEnd)+'\nthis.calculate=calculateValidationPairs;this.update=updatePhysicsColourLoadingBadge;',testCtx);
 testCtx.calculate();assert.equal(workingBadge.hidden,false);testCtx.physicsColorMode='chain';testCtx.update();assert.equal(workingBadge.hidden,true);testCtx.physicsColorMode='local-confidence';testCtx.update();assert.equal(workingBadge.hidden,false);
 resolveJob({pairs:[]});await new Promise(resolve=>setImmediate(resolve));assert.equal(workingBadge.hidden,true);
 job=new Promise((resolve,reject)=>{rejectJob=reject;});testCtx.calculate();assert.equal(workingBadge.hidden,true);rejectJob(new Error('failed'));await new Promise(resolve=>setImmediate(resolve));assert.equal(workingBadge.hidden,true);assert.equal(errors.length,1);
 testCtx.validationState.version=2;job=new Promise((resolve,reject)=>{rejectJob=reject;});testCtx.calculate();assert.equal(workingBadge.hidden,false);rejectJob(new Error('new model failed'));await new Promise(resolve=>setImmediate(resolve));assert.equal(workingBadge.hidden,true);assert.equal(errors.length,2);
 console.log('Confidence colour loading badge state tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
