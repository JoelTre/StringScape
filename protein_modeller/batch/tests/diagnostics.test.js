'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const code=source.slice(source.indexOf('function diagnosticSummary('),source.indexOf('function renderDiagnostics('));
const ctx={Map,Number,Object};vm.createContext(ctx);vm.runInContext(code,ctx);
const records=[{status:'completed',stageMs:{Build:1000,Save:200}},{status:'completed',stageMs:{Build:3000}},{status:'failed',stageMs:{Build:9000}}];
const result=ctx.diagnosticSummary(records,'completed');assert.equal(result.count,2);assert.equal(result.rows[0]['Average time (seconds)'],'2.00');assert.equal(result.rows[0]['Rows measured'],2);assert.equal(result.rows[1]['Rows measured'],1);assert.equal(ctx.diagnosticSummary(records,'failed').rows[0]['Average time (seconds)'],'9.00');
console.log('Batch performance diagnostics tests passed');
