// Whole-molecule instancing: two draw calls, one transform per visible lipid.
// Atom/bond template geometry is static; orientation, bobbing and tail wiggle run on GPU.
(function(){
    const shader=`
attribute vec3 lipidAnchor;
attribute vec3 lipidEnd;
attribute float lipidRadius;
attribute vec3 lipidParams;
uniform float lipidTime, lipidClock, lipidMotionScale, lipidJiggle, lipidDepth, lipidAtomSize, lipidStickSize, lipidElementSize, lipidGlow;
vec3 lipidSpin(vec3 v){
    float a=lipidParams.y+lipidParams.z*lipidClock,c=cos(a),s=sin(a);
    return vec3(c*v.x-s*v.y,s*v.x+c*v.y,v.z);
}
vec3 lipidPoint(vec3 p){
    float z=p.z*lipidDepth,tail=max(0.0,z);
    float tx=lipidJiggle*.10*sin(lipidTime*2.5*lipidMotionScale+lipidParams.x);
    float ty=lipidJiggle*.10*sin(lipidTime*2.1*lipidMotionScale+lipidParams.x*1.7);
    return lipidSpin(vec3(p.x+tx*tail,p.y+ty*tail,z));
}
vec3 lipidBondRotate(vec3 v,vec3 d){
    vec4 q=vec4(d.z,0.0,-d.x,1.0+d.y);
    if(q.w<0.000001)q=vec4(0.0,0.0,1.0,0.0);else q=normalize(q);
    return v+2.0*cross(q.xyz,cross(q.xyz,v)+q.w*v);
}
vec3 lipidPosition(vec3 p){
#ifdef LIPID_BOND
    vec3 a=lipidPoint(lipidAnchor),b=lipidPoint(lipidEnd),d=b-a;
    float len=length(d);vec3 dir=len>0.000001?d/len:vec3(0.0,1.0,0.0);
    vec3 v=vec3(p.x*.07*lipidStickSize*lipidGlow,p.y*len,p.z*.07*lipidStickSize*lipidGlow);
    vec3 result=(a+b)*.5+lipidBondRotate(v,dir);
#else
    float radius=.34*lipidAtomSize*(1.0+lipidElementSize*(lipidRadius-1.0))*lipidGlow;
    vec3 result=lipidPoint(lipidAnchor)+p*radius;
#endif
    result.z+=lipidJiggle*.85*sin(lipidTime*1.5*lipidMotionScale+lipidParams.x);
    return result;
}
vec3 lipidNormal(vec3 n){
#ifdef LIPID_BOND
    vec3 d=lipidPoint(lipidEnd)-lipidPoint(lipidAnchor);
    return lipidBondRotate(n,length(d)>0.000001?normalize(d):vec3(0.0,1.0,0.0));
#else
    return n;
#endif
}
`;
    function material(uniforms,bond,glow=false){
        const mat=glow?new THREE.MeshBasicMaterial({color:0xffe85a,transparent:true,opacity:.56,depthWrite:false,blending:THREE.AdditiveBlending}):
            new THREE.MeshPhongMaterial({vertexColors:true,shininess:6,specular:0x080a0d});
        if(bond)mat.defines={LIPID_BOND:1};
        mat.onBeforeCompile=compiled=>{
            Object.assign(compiled.uniforms,uniforms);
            compiled.vertexShader=shader+compiled.vertexShader;
            compiled.vertexShader=compiled.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=lipidNormal(objectNormal);')
                .replace('#include <begin_vertex>','vec3 transformed=lipidPosition(position);');
        };
        mat.customProgramCacheKey=()=>`lipid-molecule-v1-${bond}-${glow}`;
        return mat;
    }
    function gaussianMaterial(uniforms){
        return new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,clipping:true,
            vertexShader:shader+`
                attribute vec3 color;
                varying vec2 gaussianOffset;
                varying vec3 gaussianTint;
                #include <clipping_planes_pars_vertex>
                void main(){
                    float radius=.34*lipidAtomSize*(1.0+lipidElementSize*(lipidRadius-1.0));
                    vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(lipidPosition(vec3(0.)),1.);
                    gaussianOffset=position.xy*2.5;gaussianTint=color;
                    mvPosition.xy+=gaussianOffset*radius;
                    gl_Position=projectionMatrix*mvPosition;
                    #include <clipping_planes_vertex>
                }`,
            fragmentShader:`
                varying vec2 gaussianOffset;
                varying vec3 gaussianTint;
                #include <clipping_planes_pars_fragment>
                void main(){
                    #include <clipping_planes_fragment>
                    float r2=dot(gaussianOffset,gaussianOffset);
                    if(r2>6.25)discard;
                    // Match the sharper fourth-power atom falloff.
                    float alpha=.88*exp(-r2*r2);
                    gl_FragColor=vec4(gaussianTint,alpha);
                    #include <tonemapping_fragment>
                    #include <encodings_fragment>
                }`});
    }
    function geometry(atoms,bonds,segments,bond,count,params,radii){
        const template=segments===0?new THREE.PlaneGeometry(2,2):bond?new THREE.CylinderGeometry(1,1,1,segments,1):new THREE.SphereGeometry(1,segments,Math.max(3,segments-2));
        const base=template.toNonIndexed(),length=base.attributes.position.count,n=bond?bonds.length:atoms.length;
        const pos=new Float32Array(length*n*3),norm=new Float32Array(pos.length),anchors=new Float32Array(pos.length),ends=new Float32Array(pos.length),colors=new Float32Array(pos.length),radius=new Float32Array(length*n);
        for(let i=0;i<n;i++){
            pos.set(base.attributes.position.array,i*length*3);norm.set(base.attributes.normal.array,i*length*3);
            const a=atoms[bond?bonds[i][0]:i],b=bond?atoms[bonds[i][1]]:a;
            for(let j=0;j<length;j++){
                const k=(i*length+j)*3;anchors[k]=a.x;anchors[k+1]=a.y;anchors[k+2]=a.z;
                ends[k]=b.x;ends[k+1]=b.y;ends[k+2]=b.z;radius[i*length+j]=radii[a.element]??1;
            }
        }
        const geo=new THREE.BufferGeometry();
        for(const [name,array,size] of [['position',pos,3],['normal',norm,3],['lipidAnchor',anchors,3],['lipidEnd',ends,3],['color',colors,3],['lipidRadius',radius,1]])geo.setAttribute(name,new THREE.BufferAttribute(array,size));
        geo.setAttribute('lipidParams',params);geo.userData={lipidTemplate:true,bond,verticesPerPart:length};
        // Bounds are shader-dependent. Rendering is explicitly uncullled; picking
        // uses the animated molecule's atom centres instead of these template bounds.
        geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,10),40);
        template.dispose();base.dispose();return geo;
    }
    function create(atoms,bonds,count,radii){
        const uniforms=Object.fromEntries(['Time','Clock','MotionScale','Jiggle','Depth','AtomSize','StickSize','ElementSize','Glow'].map(name=>['lipid'+name,{value:name==='Glow'?1:0}]));
        const params=new THREE.InstancedBufferAttribute(new Float32Array(count*3),3);params.setUsage(THREE.DynamicDrawUsage);
        const variants=new Map();
        function level(segments){
            if(!variants.has(segments)){for(const pair of variants.values())for(const geo of pair)geo.dispose();variants.clear();variants.set(segments,[geometry(atoms,bonds,segments,false,count,params,radii),geometry(atoms,bonds,segments,true,count,params,radii),geometry(atoms,bonds,0,false,count,params,radii)]);}
            return variants.get(segments);
        }
        const geos=level(6),atomMesh=new THREE.InstancedMesh(geos[0],material(uniforms,false),count),stickMesh=new THREE.InstancedMesh(geos[1],material(uniforms,true),count);
        const atomMaterial=atomMesh.material,gaussian=gaussianMaterial(uniforms);
        const glowUniforms={...uniforms,lipidGlow:{value:1.24}};
        // Selection copies one particle's parameters into an independent buffer.
        const glowParams=new THREE.InstancedBufferAttribute(new Float32Array(3),3);
        const glowGeo=geometry(atoms,bonds,8,false,1,glowParams,radii);
        const atomGlowMesh=new THREE.InstancedMesh(glowGeo,material(glowUniforms,false,true),1);
        for(const mesh of [atomMesh,stickMesh,atomGlowMesh]){mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.raycast=()=>{};}
        atomGlowMesh.renderOrder=15;atomMesh.renderOrder=2;stickMesh.renderOrder=2;
        const render={atomMesh,stickMesh,atomGlowMesh,atomMaterial,gaussianMaterial:gaussian,uniforms,params,glowParams,variants,level,detail:6,atoms,radii};
        atomMesh.userData.gaussianLipid=render;
        return render;
    }
    function colors(render,atoms,bonds,colorAt){
        const palette=atoms.map(colorAt);render.palette=palette;
        for(const geos of render.variants.values())for(const geo of geos){
            const values=geo.attributes.color.array,len=geo.userData.verticesPerPart;
            for(let i=0;i<(geo.userData.bond?bonds.length:atoms.length);i++){
                const color=geo.userData.bond?palette[bonds[i][0]].clone().lerp(palette[bonds[i][1]],.5):palette[i];
                for(let j=0;j<len;j++){const k=(i*len+j)*3;values[k]=color.r;values[k+1]=color.g;values[k+2]=color.b;}
            }
            geo.attributes.color.needsUpdate=true;
        }
    }
    function collectGaussianAtoms(render,emit){
        const {atomMesh,atoms,radii,params,uniforms:u,palette}=render;
        const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
        const time=u.lipidTime.value,scale=u.lipidMotionScale.value,jiggle=u.lipidJiggle.value;
        for(let i=0;i<atomMesh.count;i++){
            atomMesh.getMatrixAt(i,matrix);matrix.premultiply(atomMesh.matrixWorld);
            const phase=params.getX(i),angle=params.getY(i)+params.getZ(i)*u.lipidClock.value,c=Math.cos(angle),s=Math.sin(angle);
            const tx=jiggle*.10*Math.sin(time*2.5*scale+phase),ty=jiggle*.10*Math.sin(time*2.1*scale+phase*1.7);
            const bob=jiggle*.85*Math.sin(time*1.5*scale+phase);
            atoms.forEach((atom,index)=>{
                const z=atom.z*u.lipidDepth.value,x=atom.x+tx*Math.max(0,z),y=atom.y+ty*Math.max(0,z);
                point.set(c*x-s*y,s*x+c*y,z+bob).applyMatrix4(matrix);
                const radius=.34*u.lipidAtomSize.value*(1+u.lipidElementSize.value*((radii[atom.element]??1)-1));
                emit(point.x,point.y,point.z,radius,palette[index],atomMesh.material.opacity);
            });
        }
    }
    window.LipidRenderer={create,colors,collectGaussianAtoms,shader};
})();
