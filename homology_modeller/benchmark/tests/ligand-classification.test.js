'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),source=fs.readFileSync(path.join(root,'script.js'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);assert(i>=0&&j>i);return source.slice(i,j);};
const context={detectBindingPatches:()=>[]};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'memory-data.js'),'utf8')+slice('const AA_3TO1 =','// Color Tables')+slice('// structureParsing.js start','// structureParsing.js end')+slice('function* cifTokens(text)','// referenceSearch.js end')+slice('// mmcifParsing.js start','// mmcifParsing.js end')+fs.readFileSync(path.join(root,'benchmark/bridge.js'),'utf8')+'\nthis.parse=parseMmCifCalpha;this.prepare=benchmarkPrepareReference;',context);
const headers=['group_PDB','id','type_symbol','label_atom_id','label_comp_id','label_asym_id','label_seq_id','auth_seq_id','Cartn_x','Cartn_y','Cartn_z'];
const rows=['ATOM 1 C CA ALA A 1 1 0 0 0','HETATM 2 N N THF G . 401 1 0 0','HETATM 3 C CA THF G . 401 2 0 0','HETATM 4 C C THF G . 401 3 0 0','HETATM 5 N N XYZ B 1 1 4 0 0','HETATM 6 C CA XYZ B 1 1 5 0 0','HETATM 7 C C XYZ B 1 1 6 0 0'];
const text=['data_test','loop_',...headers.map(h=>`_atom_site.${h}`),...rows,'#'].join('\n');
const parsed=context.parse(text,true);assert.equal(parsed.chains['G:THF401'][0].entityType,'other');assert.equal(parsed.chains.B[0].entityType,'protein');
const prepared=context.prepare({text,distance:0,seed:1});assert(!prepared.chains.includes('G'));assert(context.parse(prepared.masked,true).chains['G:THF401']);
const fixture='/home/joel/PhD/StringScape/Benchmark_results/run4_Nov_13_Distance=10/0050-4O7U/reference.cif';
if(fs.existsSync(fixture)){const original=fs.readFileSync(fixture,'utf8'),result=context.prepare({text:original,distance:10,seed:2442844863});assert(!result.chains.includes('G'));assert(context.parse(result.masked,true).chains['G:THF401']);}
console.log('Ligand and polymer classification tests passed');
