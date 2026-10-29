/* Compact column stores shared by the page and generated workers. */
function installMemoryData() {
    const descriptors = new WeakMap();
    const numeric = key => ['x','y','z','occupancy','bFactor','i','j','target','weight','nodeIndex','springIndex'].includes(key);
    const indexOf = key => typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) ? Number(key) : -1;
    function row(table, index) {
        const view = new Proxy({}, {
            get(_, key) { const col=table.columns[key]; return col ? col.kind==='number' ? (Number.isNaN(col.values[index]) ? null : col.values[index]) : col.dictionary[col.values[index]] : undefined; },
            set(_, key, value) { const col=table.columns[key]; if(!col)throw Error('Unknown packed column '+String(key)); if(col.kind==='number')col.values[index]=value??NaN;else{let code=col.dictionary.indexOf(value);if(code<0){code=col.dictionary.length;col.dictionary.push(value);}col.values[index]=code;}return true; },
            ownKeys() { return Object.keys(table.columns); },
            getOwnPropertyDescriptor(_, key) { return key in table.columns ? {enumerable:true,configurable:true} : undefined; }
        });
        descriptors.set(view,{memoryKind:'row',table,index});return view;
    }
    function list(table, start=0, length=table.length, indices=null) {
        const target=new Array(length);
        const view=new Proxy(target,{
            get(a,key,receiver) { const i=indexOf(key);return i>=0 ? i<length?row(table,indices?indices[start+i]:start+i):undefined : Reflect.get(a,key,receiver); },
            has(a,key) { const i=indexOf(key);return i>=0 ? i<length : Reflect.has(a,key); },
            set(a,key,value) { const i=indexOf(key);if(i>=0&&i<length){for(const k of Object.keys(table.columns))row(table,indices?indices[start+i]:start+i)[k]=value[k];return true;}throw Error('Packed lists have fixed length'); }
        });
        descriptors.set(view,{memoryKind:'list',table,start,length,indices});return view;
    }
    function table(rows, fields) {
        if(!fields){const keys=new Set();for(const r of rows)for(const k of Object.keys(r))keys.add(k);fields=[...keys];}
        const result={length:rows.length,columns:Object.create(null)};
        for(const key of fields){
            const isNumber=numeric(key)||rows.every(r=>r[key]==null||typeof r[key]==='number');
            const values=isNumber?new Float64Array(rows.length):new Uint32Array(rows.length),dictionary=[],codes=new Map();
            for(let i=0;i<rows.length;i++){
                const v=rows[i][key];
                if(isNumber)values[i]=v??NaN;
                else{if(!codes.has(v)){codes.set(v,dictionary.length);dictionary.push(v);}values[i]=codes.get(v);}
            }
            result.columns[key]={kind:isNumber?'number':'dictionary',values,...(isNumber?{}:{dictionary})};
        }
        return result;
    }
    function pack(rows, fields){return descriptors.has(rows)?rows:list(table(rows,fields));}
    function packAtoms(root){
        const seen=new WeakSet(),lists=[],rows=[];
        function visit(value){
            if(!value||typeof value!=='object'||seen.has(value)||descriptors.has(value)||ArrayBuffer.isView(value))return;
            seen.add(value);
            if(value instanceof Map){for(const v of value.values())visit(v);return;}
            if(value instanceof Set)return;
            for(const key of Object.keys(value)){
                const child=value[key];
                if(key==='sourceAtoms'&&Array.isArray(child)&&child.length&&!descriptors.has(child)){
                    lists.push({owner:value,start:rows.length,length:child.length});for(const r of child)rows.push(r);
                }else visit(child);
            }
        }
        visit(root);if(!rows.length)return root;
        const columns=table(rows);
        for(const item of lists)item.owner.sourceAtoms=list(columns,item.start,item.length);
        return root;
    }
    // Preserve sharing and cycles. Packed views cross worker boundaries as buffers,
    // never as per-atom objects; the worker installs this same module.
    function wire(root, decode=false){
        const seen=new Map();
        function visit(value){
            if(!value||typeof value!=='object'||ArrayBuffer.isView(value)||value instanceof ArrayBuffer||value instanceof Blob)return value;
            if(seen.has(value))return seen.get(value);
            if(decode&&value.memoryKind==='pointMap'){const result=pointMap(visit(value.table),value.start,value.length);seen.set(value,result);return result;}
            if(decode&&value.memoryKind==='entries'){const d={...value,sources:visit(value.sources)};const result=entryView(d);seen.set(value,result);return result;}
            if(decode&&value.memoryKind==='vectors'){const result=vectorView(value);seen.set(value,result);return result;}
            if(decode&&value.memoryKind==='offsets'){const result=offsetView(value);seen.set(value,result);return result;}
            if(decode&&value.memoryKind==='pairs'){const result=pairView(value);seen.set(value,result);return result;}
            if(decode&&value.memoryKind&&['list','row'].includes(value.memoryKind)){
                const decodedTable=visit(value.table);const result=value.memoryKind==='list'?list(decodedTable,value.start,value.length,value.indices):row(decodedTable,value.index);seen.set(value,result);return result;
            }
            const desc=descriptors.get(value);
            if(desc){const result={};seen.set(value,result);for(const key of Object.keys(desc))result[key]=visit(desc[key]);return result;}
            if(value instanceof Map){const result=new Map();seen.set(value,result);for(const [k,v] of value)result.set(visit(k),visit(v));return result;}
            if(value instanceof Set){const result=new Set();seen.set(value,result);for(const v of value)result.add(visit(v));return result;}
            if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return value;
            const result=Array.isArray(value)?new Array(value.length):{};seen.set(value,result);
            for(const key of Object.keys(value))result[key]=visit(value[key]);return result;
        }
        return visit(root);
    }
    function buffers(root){const out=new Set(),seen=new WeakSet();function visit(v){if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);const d=descriptors.get(v);if(d){visit(d.table);return;}if(ArrayBuffer.isView(v)){out.add(v.buffer);return;}if(v instanceof ArrayBuffer){out.add(v);return;}if(v instanceof Map){for(const x of v.values())visit(x);return;}for(const k of Object.keys(v))visit(v[k]);}visit(root);return [...out];}
    // XYZ display buffers use float32, source coordinates remain float64 for export.
    // A Map-compatible atom-name lookup backed by shared typed columns.
    const pointMapPrototype={
        get(name){const d=descriptors.get(this),c=d.table.columns,code=c.atomName.dictionary.indexOf(name);for(let i=d.start;i<d.start+d.length;i++)if(c.atomName.values[i]===code)return {x:c.x.values[i],y:c.y.values[i],z:c.z.values[i]};},
        has(name){return this.get(name)!==undefined;},get size(){return descriptors.get(this).length;}
    };
    function pointMap(table,start,length){const view=Object.create(pointMapPrototype);descriptors.set(view,{memoryKind:'pointMap',table,start,length});return view;}
    function coordinates(length){return list({length,columns:Object.fromEntries(['x','y','z'].map(key=>[key,{kind:'number',values:new Float32Array(length)}]))});}
    function builder(fields,capacity=1024){
        const TypeFor=key=>['i','j','springIndex'].includes(key)?Uint32Array:['isBackbone','isBasePair'].includes(key)?Uint8Array:['strain','confidence','satisfaction','membraneScore','combined','pae','plddt','identity','localSimilarity'].includes(key)?Float32Array:Float64Array;
        let used=0,columns=Object.fromEntries(fields.map(key=>[key,{kind:'number',values:new (TypeFor(key))(capacity)}]));
        return {push(value){if(used===capacity){capacity*=2;for(const col of Object.values(columns)){const next=new col.values.constructor(capacity);next.set(col.values);col.values=next;}}for(const key of fields)columns[key].values[used]=value[key]??NaN;used++;},
            finish(){for(const col of Object.values(columns))col.values=col.values.slice(0,used);return list({length:used,columns});}};
    }
    function atomEntries(sources){
        let length=0;for(const source of sources)length+=source.length;
        const nodes=new Uint32Array(length),indices=new Uint32Array(length);let offset=0;
        for(let n=0;n<sources.length;n++)for(let i=0;i<sources[n].length;i++){nodes[offset]=n;indices[offset++]=i;}
        // Entry wrappers are transient; only two integer columns are retained.
        const view=new Proxy(new Array(length),{get(a,key,r){const i=indexOf(key);return i>=0?i<length?{nodeIndex:nodes[i],source:sources[nodes[i]][indices[i]]}:undefined:Reflect.get(a,key,r);},has(a,key){const i=indexOf(key);return i>=0?i<length:Reflect.has(a,key);}});
        descriptors.set(view,{memoryKind:'entries',sources,nodes,indices,length});return view;
    }
    function entryView(d){
        const {sources,nodes,indices,length}=d;
        const view=new Proxy(new Array(length),{get(a,key,r){const i=indexOf(key);return i>=0?i<length?{nodeIndex:nodes[i],source:sources[nodes[i]][indices[i]]}:undefined:Reflect.get(a,key,r);},has(a,key){const i=indexOf(key);return i>=0?i<length:Reflect.has(a,key);}});
        descriptors.set(view,d);return view;
    }
    function pairs(rows){if(descriptors.get(rows)?.memoryKind==='pairs')return rows;const values=new Uint32Array(rows.length*2);for(let i=0;i<rows.length;i++){values[i*2]=rows[i][0];values[i*2+1]=rows[i][1];}return pairView({memoryKind:'pairs',values,length:rows.length});}
    function pairView(d){const view=new Proxy(new Array(d.length),{get(a,key,r){const i=indexOf(key);return i>=0?i<d.length?[d.values[i*2],d.values[i*2+1]]:undefined:Reflect.get(a,key,r);},has(a,key){const i=indexOf(key);return i>=0?i<d.length:Reflect.has(a,key);}});descriptors.set(view,d);return view;}
    function vectors(rows,width=3){const values=new Float32Array(rows.length*width);for(let i=0;i<rows.length;i++)values.set(rows[i],i*width);return vectorView({memoryKind:'vectors',values,width,length:rows.length});}
    function vectorView(d){const view=new Proxy(new Array(d.length),{get(a,key,r){const i=indexOf(key);return i>=0?i<d.length?Array.from(d.values.subarray(i*d.width,(i+1)*d.width)):undefined:Reflect.get(a,key,r);},has(a,key){const i=indexOf(key);return i>=0?i<d.length:Reflect.has(a,key);},set(a,key,v){const i=indexOf(key);if(i>=0&&i<d.length){d.values.set(v,i*d.width);return true;}throw Error('Packed vectors have fixed length');}});descriptors.set(view,d);return view;}
    function offsets(rows){
        const starts=new Uint32Array(rows.length+1),names=[],dictionary=[],codes=new Map();let count=0;
        for(let i=0;i<rows.length;i++){starts[i]=count;for(const key of Object.keys(rows[i])){if(!codes.has(key)){codes.set(key,dictionary.length);dictionary.push(key);}names.push(codes.get(key));count++;}}starts[rows.length]=count;
        const values=new Float32Array(count*3);let index=0;for(const row of rows)for(const value of Object.values(row)){values.set(value,index);index+=3;}
        return offsetView({memoryKind:'offsets',starts,names:Uint32Array.from(names),dictionary,values,length:rows.length});
    }
    function offsetView(d){
        const view=new Proxy(new Array(d.length),{get(a,key,r){const i=indexOf(key);if(i<0)return Reflect.get(a,key,r);if(i>=d.length)return;
            const names=d.names.subarray(d.starts[i],d.starts[i+1]);
            return new Proxy({}, {ownKeys:()=>Array.from(names,n=>d.dictionary[n]),get(_,name){const code=d.dictionary.indexOf(name),local=names.indexOf(code);if(local<0)return;const offset=(d.starts[i]+local)*3;return Array.from(d.values.subarray(offset,offset+3));},getOwnPropertyDescriptor(_,name){return names.includes(d.dictionary.indexOf(name))?{enumerable:true,configurable:true}:undefined;}});
        },has(a,key){const i=indexOf(key);return i>=0?i<d.length:Reflect.has(a,key);}});descriptors.set(view,d);return view;
    }
    function recordBuilder(fields){
        let length=0,capacity=4096;const columns=Object.create(null),codes=Object.create(null);
        for(const key of fields){const number=numeric(key)||key==='resSeq';columns[key]={kind:number?'number':'dictionary',values:number?new Float64Array(capacity):new Uint32Array(capacity),...(number?{}:{dictionary:[]})};if(!number)codes[key]=new Map();}
        return {push(record){if(length===capacity){capacity*=2;for(const col of Object.values(columns)){const next=new col.values.constructor(capacity);next.set(col.values);col.values=next;}}
            for(const key of fields){const col=columns[key],v=record[key];if(col.kind==='number')col.values[length]=v??NaN;else{const map=codes[key];if(!map.has(v)){map.set(v,col.dictionary.length);col.dictionary.push(v);}col.values[length]=map.get(v);}}length++;},
            finish(){for(const col of Object.values(columns))col.values=col.values.slice(0,length);return list({length,columns});}};
    }
    function pairBuilder(){let capacity=4096,length=0,values=new Uint32Array(capacity*2);return {get length(){return length;},push(pair){if(length===capacity){capacity*=2;const next=new Uint32Array(capacity*2);next.set(values);values=next;}values[length*2]=pair[0];values[length*2+1]=pair[1];length++;},*[Symbol.iterator](){for(let i=0;i<length;i++)yield [values[i*2],values[i*2+1]];},finish(){return pairView({memoryKind:'pairs',values:values.slice(0,length*2),length});}};}
    globalThis.MemoryData={pointMap,pairBuilder,pairList:values=>pairView({memoryKind:'pairs',values,length:values.length/2}),recordBuilder,same:(a,b)=>{if(a===b)return true;const da=descriptors.get(a),db=descriptors.get(b);return !!da&&!!db&&da.memoryKind==='row'&&db.memoryKind==='row'&&da.table===db.table&&da.index===db.index;},vectors,offsets,clone:root=>wire(structuredClone(wire(root)),true),builder,atomEntries,pairs,pack,packAtoms,list,row,table,coordinates,wire,buffers,tag:(view,descriptor)=>{if(descriptor)descriptors.set(view,descriptor);return view;},descriptor:v=>descriptors.get(v)};
}
installMemoryData();
