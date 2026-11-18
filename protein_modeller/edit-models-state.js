/* Data model for the Edit Models workspace. Coordinates are in ångströms. */
(function (root) {
    'use strict';
    const axes = ['x', 'y', 'z'];
    const zero = () => ({x: 0, y: 0, z: 0});
    const copy = v => ({x: v.x, y: v.y, z: v.z});
    const pose = () => ({translation: zero(), rotation: zero()});
    function rotate(point, angles) {
        let {x, y, z} = point;
        const rx = angles.x * Math.PI / 180, ry = angles.y * Math.PI / 180, rz = angles.z * Math.PI / 180;
        let c = Math.cos(rx), s = Math.sin(rx);
        [y, z] = [y * c - z * s, y * s + z * c];
        c = Math.cos(ry); s = Math.sin(ry);
        [x, z] = [x * c + z * s, -x * s + z * c];
        c = Math.cos(rz); s = Math.sin(rz);
        [x, y] = [x * c - y * s, x * s + y * c];
        return {x, y, z};
    }
    function inverseRotate(point, angles) {
        let {x, y, z} = point;
        let angle = -angles.z * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
        [x, y] = [x * c - y * s, x * s + y * c];
        angle = -angles.y * Math.PI / 180; c = Math.cos(angle); s = Math.sin(angle);
        [x, z] = [x * c + z * s, -x * s + z * c];
        angle = -angles.x * Math.PI / 180; c = Math.cos(angle); s = Math.sin(angle);
        [y, z] = [y * c - z * s, y * s + z * c];
        return {x, y, z};
    }
    function apply(point, transform, centre) {
        const relative = Object.fromEntries(axes.map(axis => [axis, point[axis] - centre[axis]]));
        const rotated = rotate(relative, transform.rotation);
        return Object.fromEntries(axes.map(axis => [axis, rotated[axis] + centre[axis] + transform.translation[axis]]));
    }
    function centre(atoms) {
        const result = zero();
        if (!atoms.length) return result;
        for (const atom of atoms) for (const axis of axes) result[axis] += atom[axis] / atoms.length;
        return result;
    }
    function cloneMembrane(membrane) {
        return {...membrane, center:[...membrane.center], normal:[...membrane.normal], u:[...membrane.u], v:[...membrane.v], curvature:[...membrane.curvature], labels:{...membrane.labels}, lipids:(membrane.lipids||[]).map(lipid=>({...lipid})), meshes:membrane.meshes?.map(mesh=>({vertices:mesh.vertices.map(copy),indices:[...mesh.indices]}))};
    }
    class EditModelsState {
        constructor() { this.models = []; this.nextId = 1; }
        static parseMembranes(text) {
            const lines=text.split(/\r?\n/), tables={};
            for(let i=0;i<lines.length;i++){
                if(lines[i].trim()!=='loop_')continue;
                const fields=[];while(i+1<lines.length&&lines[i+1].trim().startsWith('_'))fields.push(lines[++i].trim());
                const category=fields[0]?.split('.')[0];if(!['_stringscape_membrane_geometry','_stringscape_membrane_vertex','_stringscape_membrane_triangle'].includes(category))continue;
                const rows=[];while(i+1<lines.length){const line=lines[i+1].trim();if(!line||line.startsWith('#')||line==='loop_'||line.startsWith('_')||line.startsWith('data_'))break;rows.push(lines[++i].trim().split(/\s+/));}
                tables[category]={fields:fields.map(field=>field.split('.')[1].toLowerCase()),rows};
            }
            const objects=category=>{const table=tables[category];return table?table.rows.map(row=>Object.fromEntries(table.fields.map((field,i)=>[field,row[i]]))):[];};
            const vertices=objects('_stringscape_membrane_vertex'),triangles=objects('_stringscape_membrane_triangle');
            const vector=(a,b)=>[b.x-a.x,b.y-a.y,b.z-a.z],normalise=v=>{const n=Math.hypot(...v);return n>1e-8?v.map(x=>x/n):null;},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
            const membranes=[];
            for(const geometry of objects('_stringscape_membrane_geometry')){
                const meshes=[];let basis=null;
                for(const leaflet of ['1','2']){
                    const rows=vertices.filter(v=>v.membrane_id===geometry.id&&v.leaflet===leaflet),points=rows.map(v=>({x:Number(v.cartn_x),y:Number(v.cartn_y),z:Number(v.cartn_z)}));
                    if(points.length<4||points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))break;
                    const ids=new Map(rows.map((row,index)=>[row.id,index])),indices=[];
                    for(const t of triangles.filter(t=>t.membrane_id===geometry.id&&t.leaflet===leaflet)){const face=[t.vertex_id_1,t.vertex_id_2,t.vertex_id_3].map(id=>ids.get(id));if(face.every(Number.isInteger))indices.push(...face);}
                    if(!indices.length)break;
                    const first=rows[0],xIndex=rows.findIndex(row=>row.row===first.row&&Number(row.column)>Number(first.column)),yIndex=rows.findIndex(row=>Number(row.row)>Number(first.row)&&row.column===first.column);
                    if(xIndex<0||yIndex<0)break;
                    const u=normalise(vector(points[0],points[xIndex])),v=normalise(vector(points[0],points[yIndex])),normal=u&&v&&normalise(cross(u,v));if(!normal)break;
                    if(!basis)basis={u,v,normal,extent:Math.max(...points.map(p=>Math.hypot(...vector(points[0],p))))/Math.SQRT2/2};
                    meshes.push({vertices:points,indices});
                }
                if(meshes.length!==2)continue;
                const centres=meshes.map(mesh=>centre(mesh.vertices)),center=axes.map(axis=>(centres[0][axis]+centres[1][axis])/2),halfThickness=Number(geometry.half_thickness);
                membranes.push({center,normal:basis.normal,u:basis.u,v:basis.v,extent:basis.extent,curvature:[0,0,0],halfThickness:Number.isFinite(halfThickness)?halfThickness:0,labels:{},lipids:[],meshes});
            }
            return membranes;
        }
        addModel(name, atoms, membranes = [], membraneVisible = true) {
            if (!Array.isArray(atoms) || !atoms.length) throw new Error('The structure contains no atoms.');
            const chains = new Map();
            for (const input of atoms) {
                if (!axes.every(axis => Number.isFinite(Number(input[axis])))) throw new Error('Invalid atom coordinates.');
                const id = String(input.chainId || 'A');
                if (!chains.has(id)) chains.set(id, {id, atoms: [], pose: pose(), visible: true});
                chains.get(id).atoms.push({...input, x: Number(input.x), y: Number(input.y), z: Number(input.z)});
            }
            for (const chain of chains.values()) chain.centre = centre(chain.atoms);
            const shared = {chains: [...chains.values()], centre: centre([...chains.values()].flatMap(chain => chain.atoms))};
            const model = {id: this.nextId++, name, shared, pose: pose(), visible: true, hiddenChains: new Set(),
                symmetryAxes: [], membranes: membranes.map(cloneMembrane), membraneVisible, lipidsVisible: true, membraneLabelsVisible: true};
            this.models.push(model);
            return model;
        }
        duplicateModel(model, chains = model.shared.chains) {
            if (!this.models.includes(model)) throw new Error('Unknown model.');
            if (!chains.length || chains.some(chain => !model.shared.chains.includes(chain))) throw new Error('Select chains from one model.');
            const chosen = new Set(chains);
            const points = this.atoms(model).filter(item => chosen.has(item.chain)).map(item => item.position);
            let minX = Infinity, maxX = -Infinity;
            for (const point of points) { minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); }
            const width = Math.max(10, maxX - minX + 10);
            const instance = {id: this.nextId++, name: `${model.name} copy`, shared: {chains: [...chosen], centre: copy(model.shared.centre)},
                pose: {translation: copy(model.pose.translation), rotation: copy(model.pose.rotation)}, visible: true, hiddenChains: new Set(model.hiddenChains),
                symmetryAxes: (model.symmetryAxes || []).filter(axis => axis.chains.every(id => [...chosen].some(chain=>chain.id===id))).map(axis=>({normal:[...axis.normal],chains:[...axis.chains]})),
                membranes: chosen.size === model.shared.chains.length ? (model.membranes || []).map(cloneMembrane) : [], membraneVisible: model.membraneVisible !== false,
                lipidsVisible: model.lipidsVisible !== false, membraneLabelsVisible: model.membraneLabelsVisible !== false};
            instance.pose.translation.x += width;
            this.models.push(instance);
            return instance;
        }
        deleteSelection(selection) {
            const wholeModels = new Set(), chainsByModel = new Map();
            for (const {model, chain} of selection) {
                if (!this.models.includes(model) || (chain && !model.shared.chains.includes(chain))) continue;
                if (!chain) wholeModels.add(model);
                else { if (!chainsByModel.has(model)) chainsByModel.set(model, new Set()); chainsByModel.get(model).add(chain); }
            }
            for (const [model, chains] of chainsByModel) {
                if (wholeModels.has(model)) continue;
                model.shared.chains = model.shared.chains.filter(chain => !chains.has(chain));
                for (const chain of chains) model.hiddenChains.delete(chain.id);
                model.symmetryAxes = (model.symmetryAxes || []).filter(axis => axis.chains.every(id => model.shared.chains.some(chain => chain.id === id)));
                if (!model.shared.chains.length) wholeModels.add(model);
            }
            this.models = this.models.filter(model => !wholeModels.has(model));
        }
        averageSymmetryAxes(vectors) {
            const normals=vectors.map(v=>{const n=Math.hypot(v[0],v[1],v[2]);return n>1e-10?v.map(value=>value/n):null;}).filter(Boolean);
            if(!normals.length)return [0,0,1];
            const reference=normals[0],sum=[0,0,0];
            for(const normal of normals){const sign=normal.reduce((total,value,index)=>total+value*reference[index],0)<0?-1:1;for(let i=0;i<3;i++)sum[i]+=normal[i]*sign;}
            const length=Math.hypot(...sum);return length>1e-10?sum.map(value=>value/length):reference;
        }
        // Estimate axes only for matching chains that form a regular ring.
        detectSymmetry(model, fitPair = null) {
            const groups=new Map();
            for(const chain of model.shared.chains){
                const residues=new Map();for(const atom of chain.atoms){if(atom.atomName!=='CA')continue;const key=`${atom.resSeq}:${atom.insertionCode||''}`;if(!residues.has(key))residues.set(key,atom);}
                const points=[...residues.values()];if(points.length<12)continue;const signature=points.map(atom=>atom.resName||'').join('|');
                if(!groups.has(signature))groups.set(signature,[]);groups.get(signature).push({chain,points});
            }
            const results=[],dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),length=a=>Math.hypot(a.x,a.y,a.z);
            for(const members of groups.values()){
                if(members.length<2)continue;const centers=members.map(member=>centre(member.points)),origin=centre(centers),offsets=centers.map(point=>sub(point,origin));let axis=null;
                if(members.length===2&&fitPair){
                    const fit=fitPair(members[0].points,members[1].points),R=fit?.R;
                    if(!R||R[0][0]+R[1][1]+R[2][2]>-.65)continue;
                    const rms=Math.sqrt(members[0].points.reduce((sum,p,i)=>{const q=members[1].points[i],v=[q.x,q.y,q.z],d=[p.x,p.y,p.z].map((x,k)=>R[k][0]*v[0]+R[k][1]*v[1]+R[k][2]*v[2]+fit.t[k]-x);return sum+dot({x:d[0],y:d[1],z:d[2]},{x:d[0],y:d[1],z:d[2]});},0)/members[0].points.length);
                    if(rms>4)continue;const k=[0,1,2].sort((a,b)=>R[b][b]-R[a][a])[0],v=[0,0,0];v[k]=Math.sqrt(Math.max(0,(R[k][k]+1)/2));if(v[k]<.2)continue;for(let i=0;i<3;i++)if(i!==k)v[i]=(R[i][k]+R[k][i])/(4*v[k]);axis={x:v[0],y:v[1],z:v[2]};
                }else if(members.length>2){
                    let best=0;for(let i=0;i<offsets.length;i++)for(let j=i+1;j<offsets.length;j++){const v=cross(offsets[i],offsets[j]),n=length(v);if(n>best){best=n;axis=v;}}if(best<4)continue;
                }
                if(!axis||length(axis)<1e-8)continue;const scale=length(axis);axis={x:axis.x/scale,y:axis.y/scale,z:axis.z/scale};
                const radial=offsets.map(v=>{const z=dot(v,axis);return sub(v,{x:axis.x*z,y:axis.y*z,z:axis.z*z});}),mean=radial.reduce((sum,v)=>sum+length(v),0)/radial.length;
                if(mean<3||radial.some(v=>Math.abs(length(v)-mean)>mean*.35)||offsets.some(v=>Math.abs(dot(v,axis))>mean*.3))continue;
                if(members.length>2){const unit={x:radial[0].x/length(radial[0]),y:radial[0].y/length(radial[0]),z:radial[0].z/length(radial[0])},perp=cross(axis,unit),angles=radial.map(v=>Math.atan2(dot(v,perp),dot(v,unit))).sort((a,b)=>a-b),ideal=2*Math.PI/angles.length;if(angles.some((value,i)=>Math.abs((angles[(i+1)%angles.length]+(i===angles.length-1?2*Math.PI:0)-value)-ideal)>Math.max(.42,ideal*.3)))continue;}
                const values=[axis.x,axis.y,axis.z],dominant=values.reduce((a,b)=>Math.abs(b)>Math.abs(a)?b:a,0);results.push({normal:values.map(value=>dominant<0?-value:value),chains:members.map(member=>member.chain.id)});
            }
            model.symmetryAxes=results;return results;
        }
        transformModelPoint(model, point) { return apply(point, model.pose, model.shared.centre); }
        membraneMesh(model, membrane, side, grid = 18) {
            if (membrane.meshes?.length === 2) {
                const mesh=membrane.meshes[side<0?0:1];
                return {vertices:mesh.vertices.map(point=>this.transformModelPoint(model,point)),indices:[...mesh.indices]};
            }
            const vertices = [], indices = [];
            for (let y=0; y<=grid; y++) for (let x=0; x<=grid; x++) {
                const u=(x/grid*2-1)*membrane.extent, v=(y/grid*2-1)*membrane.extent;
                const z=membrane.curvature[0]*u*u+membrane.curvature[1]*u*v+membrane.curvature[2]*v*v+side*membrane.halfThickness;
                const point={x:membrane.center[0]+membrane.u[0]*u+membrane.v[0]*v+membrane.normal[0]*z,
                    y:membrane.center[1]+membrane.u[1]*u+membrane.v[1]*v+membrane.normal[1]*z,
                    z:membrane.center[2]+membrane.u[2]*u+membrane.v[2]*v+membrane.normal[2]*z};
                vertices.push(this.transformModelPoint(model,point));
            }
            for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){const i=y*(grid+1)+x;indices.push(i,i+1,i+grid+1,i+1,i+grid+2,i+grid+1);}
            return {vertices, indices};
        }
        atoms(model) {
            const output = [];
            for (const chain of model.shared.chains) for (const atom of chain.atoms) {
                const local = apply(atom, chain.pose, chain.centre);
                output.push({atom, chain, model, position: apply(local, model.pose, model.shared.centre)});
            }
            return output;
        }
        setField(targets, kind, axis, value) {
            if (!['translation', 'rotation'].includes(kind) || !axes.includes(axis) || !Number.isFinite(value)) throw new Error('Invalid transform.');
            for (const target of new Set(targets)) target.pose[kind][axis] = value;
        }
        groupsCanMoveIndependently(fixed, moving) {
            return !moving.some(item => fixed.some(anchor => {
                if (!item.chain) return item.model === anchor.model;
                return anchor.chain ? item.chain === anchor.chain : anchor.model.shared.chains.includes(item.chain);
            }));
        }
        setSelectionRotations(selection, axis, values, pivotMode = 'individual') {
            if (!axes.includes(axis) || !['individual', 'selection'].includes(pivotMode)) throw new Error('Invalid rotation.');
            const unique = new Map();
            for (const item of selection) {
                if (!this.models.includes(item.model) || (item.chain && !item.model.shared.chains.includes(item.chain))) throw new Error('Unknown selection.');
                const target = item.chain || item.model;
                if (!unique.has(target)) unique.set(target, item);
            }
            for (const target of unique.keys()) if (!Number.isFinite(values.get(target))) throw new Error('Invalid rotation value.');
            let pivot = zero();
            if (pivotMode === 'selection') {
                const selected = [];
                for (const model of this.models) for (const item of this.atoms(model)) {
                    if (selection.some(entry => entry.model === model && (!entry.chain || entry.chain === item.chain))) selected.push(item.position);
                }
                if (!selected.length) return;
                pivot = centre(selected);
            }
            for (const [target, item] of unique) {
                const before = copy(target.pose.rotation), after = {...before, [axis]: values.get(target)};
                if (pivotMode === 'selection') {
                    const parent = item.chain ? item.model : null;
                    const localOrigin = item.chain ? apply(item.chain.centre, target.pose, item.chain.centre) : null;
                    const origin = parent ? apply(localOrigin, parent.pose, parent.shared.centre)
                        : Object.fromEntries(axes.map(a => [a, item.model.shared.centre[a] + target.pose.translation[a]]));
                    let relative = Object.fromEntries(axes.map(a => [a, origin[a] - pivot[a]]));
                    if (parent) relative = inverseRotate(relative, parent.pose.rotation);
                    relative = rotate(inverseRotate(relative, before), after);
                    if (parent) relative = rotate(relative, parent.pose.rotation);
                    let shift = Object.fromEntries(axes.map(a => [a, pivot[a] + relative[a] - origin[a]]));
                    if (parent) shift = inverseRotate(shift, parent.pose.rotation);
                    for (const a of axes) target.pose.translation[a] += shift[a];
                }
                target.pose.rotation[axis] = after[axis];
            }
        }
        fieldValue(targets, kind, axis) {
            if (!targets.length) return {value: null, mixed: false};
            const first = targets[0].pose[kind][axis];
            return {value: first, mixed: targets.some(target => Math.abs(target.pose[kind][axis] - first) > 1e-8)};
        }
        exportCif({selection = null, visibleOnly = false} = {}) {
            const fields = ['group_PDB', 'id', 'type_symbol', 'label_atom_id', 'label_alt_id', 'label_comp_id', 'label_asym_id', 'label_seq_id', 'Cartn_x', 'Cartn_y', 'Cartn_z', 'occupancy', 'B_iso_or_equiv', 'auth_asym_id', 'auth_seq_id', 'pdbx_PDB_ins_code'];
            const lines = ['data_StringScape_Edit_Models', '#', 'loop_', ...fields.map(field => `_atom_site.${field}`)];
            const token = value => {
                const s = String(value ?? '?');
                if (/^[A-Za-z0-9_+.-]+$/.test(s) && !/^(?:data_|save_|loop_|stop_|global_)/i.test(s)) return s;
                if (!s.includes("'")) return `'${s}'`;
                if (!s.includes('"')) return `"${s}"`;
                throw new Error('An atom identifier cannot be represented as an mmCIF token.');
            };
            let id = 0, chainNumber = 0;
            for (const model of this.models) {
                if (visibleOnly && !model.visible) continue;
                const chainIds = new Map(model.shared.chains.map(chain => [chain, `C${++chainNumber}`]));
                for (const item of this.atoms(model)) {
                    const {atom, chain, position} = item;
                    if (visibleOnly && (!chain.visible || model.hiddenChains.has(chain.id))) continue;
                    if (selection && !selection(item)) continue;
                    const values = [atom.groupPdb || 'ATOM', ++id, atom.element || 'C', atom.atomName || 'C', '.', atom.resName || 'UNK', chainIds.get(chain), atom.resSeq ?? 1,
                        position.x.toFixed(3), position.y.toFixed(3), position.z.toFixed(3), atom.occupancy ?? 1, atom.bFactor ?? 0,
                        chainIds.get(chain), atom.resSeq ?? 1, atom.insertionCode || '?'];
                    lines.push(values.map(token).join(' '));
                }
            }
            if (!id) throw new Error('No matching atoms to download.');
            lines.push('#');
            // Preserve membrane geometry in the same categories as the main viewer.
            // As in its exporter, a selection-only export contains atoms only.
            const membranes = selection ? [] : this.models.flatMap(model =>
                (visibleOnly && (!model.visible || model.membraneVisible === false)) ? [] :
                    (model.membranes || []).map(membrane => ({model, membrane})));
            if (membranes.length) {
                lines.push('loop_','_stringscape_membrane_geometry.id','_stringscape_membrane_geometry.kind','_stringscape_membrane_geometry.units','_stringscape_membrane_geometry.half_thickness');
                membranes.forEach(({membrane},i)=>lines.push(`${i+1} two_leaflet_surface angstrom ${membrane.halfThickness.toFixed(3)}`));
                lines.push('#','loop_','_stringscape_membrane_vertex.id','_stringscape_membrane_vertex.membrane_id','_stringscape_membrane_vertex.leaflet','_stringscape_membrane_vertex.row','_stringscape_membrane_vertex.column','_stringscape_membrane_vertex.Cartn_x','_stringscape_membrane_vertex.Cartn_y','_stringscape_membrane_vertex.Cartn_z');
                const grid=18, meshes=[];let vertexId=1;
                membranes.forEach(({model,membrane},i)=>[-1,1].forEach((side,leaflet)=>{
                    const mesh=this.membraneMesh(model,membrane,side,grid),offset=vertexId-1;
                    meshes.push({mesh,offset,membraneId:i+1,leaflet:leaflet+1});
                    mesh.vertices.forEach((point,index)=>lines.push(`${vertexId++} ${i+1} ${leaflet+1} ${Math.floor(index/(grid+1))} ${index%(grid+1)} ${point.x.toFixed(3)} ${point.y.toFixed(3)} ${point.z.toFixed(3)}`));
                }));
                lines.push('#','loop_','_stringscape_membrane_triangle.id','_stringscape_membrane_triangle.membrane_id','_stringscape_membrane_triangle.leaflet','_stringscape_membrane_triangle.vertex_id_1','_stringscape_membrane_triangle.vertex_id_2','_stringscape_membrane_triangle.vertex_id_3');
                let triangleId=1;for(const {mesh,offset,membraneId,leaflet} of meshes)for(let i=0;i<mesh.indices.length;i+=3)lines.push(`${triangleId++} ${membraneId} ${leaflet} ${offset+mesh.indices[i]+1} ${offset+mesh.indices[i+1]+1} ${offset+mesh.indices[i+2]+1}`);
                lines.push('#');
            }
            return lines.join('\n');
        }
        exportMolViewSpec(options = {}) {
            const cif=this.exportCif(options),primitives=[];
            if(!options.selection)for(const model of this.models){
                if(options.visibleOnly&&(!model.visible||model.membraneVisible===false))continue;
                for(const membrane of model.membranes||[])for(const side of [-1,1]){
                    const mesh=this.membraneMesh(model,membrane,side,18);
                    primitives.push({kind:'primitive',params:{kind:'mesh',vertices:mesh.vertices.flatMap(p=>[p.x,p.y,p.z]),indices:mesh.indices,color:side<0?'#38bdf8':'#2dd4bf',tooltip:'Membrane plane'}});
                }
            }
            const structure={kind:'download',params:{url:'data:chemical/x-mmcif,'+encodeURIComponent(cif)},children:[{kind:'parse',params:{format:'mmcif'},children:[{kind:'structure',params:{type:'model'},children:[{kind:'component',params:{selector:'all'},children:[{kind:'representation',params:{type:'ball_and_stick'}}]}]}]}]};
            const children=[structure];if(primitives.length)children.push({kind:'primitives',params:{opacity:.22},children:primitives});
            return JSON.stringify({metadata:{title:'Model editor',version:'1',timestamp:new Date().toISOString()},root:{kind:'root',children}});
        }
    }
    root.EditModelsState = EditModelsState;
    if (typeof module !== 'undefined' && module.exports) module.exports = EditModelsState;
})(typeof globalThis !== 'undefined' ? globalThis : window);
