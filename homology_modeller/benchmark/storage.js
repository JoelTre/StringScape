'use strict';
// Intern identical directional-pair JSON strings across both residue tables.
function packBenchmarkResult(result){
    const values=[],indices=new Map(),pack=rows=>rows.map(row=>{
        const value=row['Directional anchor PAE pairs'];if(typeof value!=='string'||!value)return row;
        let index=indices.get(value);if(index===undefined){index=values.length;indices.set(value,index);values.push(value);}
        return {...row,'Directional anchor PAE pairs':index};
    });
    return {...result,residues:pack(result.residues||[]),predictionResidues:pack(result.predictionResidues||[]),anchorPairEncoding:'dictionary-v1',anchorPairValues:values};
}
function unpackBenchmarkResult(result){
    if(result?.anchorPairEncoding!=='dictionary-v1')return result;
    const values=result.anchorPairValues;if(!Array.isArray(values))throw Error('Invalid directional anchor-pair dictionary.');
    const unpack=rows=>(rows||[]).map(row=>{const index=row['Directional anchor PAE pairs'];if(typeof index!=='number')return row;if(!Number.isInteger(index)||index<0||index>=values.length)throw Error('Invalid directional anchor-pair index.');return {...row,'Directional anchor PAE pairs':values[index]};});
    return {...result,residues:unpack(result.residues),predictionResidues:unpack(result.predictionResidues)};
}
if(typeof module!=='undefined')module.exports={packBenchmarkResult,unpackBenchmarkResult};
