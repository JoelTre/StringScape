// Whole-molecule instancing: two draw calls, one transform per visible lipid.
// Atom/bond template geometry is static; spin, bob and tail deformation run on GPU.
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
    function geometry(atoms,bonds,segments,bond,count,params,radii){
        const template=bond?new THREE.CylinderGeometry(1,1,1,segments,1):new THREE.SphereGeometry(1,segments,Math.max(3,segments-2));
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
            if(!variants.has(segments))variants.set(segments,[geometry(atoms,bonds,segments,false,count,params,radii),geometry(atoms,bonds,segments,true,count,params,radii)]);
            return variants.get(segments);
        }
        const geos=level(6),atomMesh=new THREE.InstancedMesh(geos[0],material(uniforms,false),count),stickMesh=new THREE.InstancedMesh(geos[1],material(uniforms,true),count);
        const glowUniforms={...uniforms,lipidGlow:{value:1.24}};
        // Selection copies one particle's parameters into an independent buffer.
        const glowParams=new THREE.InstancedBufferAttribute(new Float32Array(3),3);
        const glowGeo=geometry(atoms,bonds,8,false,1,glowParams,radii);
        const atomGlowMesh=new THREE.InstancedMesh(glowGeo,material(glowUniforms,false,true),1);
        for(const mesh of [atomMesh,stickMesh,atomGlowMesh]){mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.raycast=()=>{};}
        atomGlowMesh.renderOrder=15;atomMesh.renderOrder=2;stickMesh.renderOrder=2;
        return {atomMesh,stickMesh,atomGlowMesh,uniforms,params,glowParams,variants,level,detail:6};
    }
    function colors(render,atoms,bonds,colorAt){
        const palette=atoms.map(colorAt);
        for(const geos of render.variants.values())for(const geo of geos){
            const values=geo.attributes.color.array,len=geo.userData.verticesPerPart;
            for(let i=0;i<(geo.userData.bond?bonds.length:atoms.length);i++){
                const color=geo.userData.bond?palette[bonds[i][0]].clone().lerp(palette[bonds[i][1]],.5):palette[i];
                for(let j=0;j<len;j++){const k=(i*len+j)*3;values[k]=color.r;values[k+1]=color.g;values[k+2]=color.b;}
            }
            geo.attributes.color.needsUpdate=true;
        }
    }
    window.LipidRenderer={create,colors,shader};
})();
