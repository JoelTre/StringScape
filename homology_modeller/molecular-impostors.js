/* Analytic spheres/capped cylinders on one shared quad, including software WebGL. */
(function(){
    const vertexShader=`
        attribute vec3 center; attribute vec3 endpoint; attribute float radius;
        attribute vec3 instanceTint;
        attribute vec2 spinIndices;
        uniform sampler2D spinTransforms; uniform float spinEnabled; uniform float spinRows;
        attribute vec2 pulseEndpoints; attribute vec2 selectionEndpoints; attribute vec2 conformationEndpoints;
        varying vec3 vA; varying vec3 vB; varying float vRadius; varying vec3 vTint;
        varying vec3 vPlane; varying vec2 vPulse; varying vec2 vSelection; varying vec2 vPresence;
        varying float vDetail; uniform vec2 viewportSize;
        uniform float gaussian; uniform float rod; uniform float orthographic; uniform float cameraNear; uniform mat4 projectionInverse;
        vec3 spinPoint(vec3 p,float index){
            if(spinEnabled<.5)return p;
            float y=(index+.5)/spinRows;
            vec4 a=texture2D(spinTransforms,vec2(.125,y));
            vec4 b=texture2D(spinTransforms,vec2(.375,y));
            vec4 c=texture2D(spinTransforms,vec2(.625,y));
            return vec3(dot(a,vec4(p,1.)),dot(b,vec4(p,1.)),dot(c,vec4(p,1.)));
        }
        void main(){
            vA=(modelViewMatrix*vec4(spinPoint(center,spinIndices.x),1.)).xyz;
            vB=(modelViewMatrix*vec4(spinPoint(endpoint,spinIndices.y),1.)).xyz;
            vRadius=radius;vTint=instanceTint;vPulse=pulseEndpoints;vSelection=selectionEndpoints;vPresence=conformationEndpoints;
            // Tangent bounds include the perspective shift of off-axis spheres.
            // Centered billboards with a depth-only expansion can cut off their silhouettes.
            float boundRadius=radius*mix(1.,2.5,gaussian);
            vec3 boundA=mix(vA,(vA+vB)*.5+(vA-vB)*1.25,gaussian*rod);
            vec3 boundB=mix(vB,(vA+vB)*.5+(vB-vA)*1.25,gaussian*rod);
            vec2 lo,hi;
            // Fully hidden primitives must not take the near-plane fullscreen path.
            // Extreme close-ups can put most of a complex behind the camera.
            if(max(-boundA.z,mix(-boundA.z,-boundB.z,rod))+boundRadius<cameraNear){lo=vec2(2.);hi=lo;}
            else if(orthographic>.5){lo=min(boundA.xy,mix(boundA.xy,boundB.xy,rod))-boundRadius;hi=max(boundA.xy,mix(boundA.xy,boundB.xy,rod))+boundRadius;}
            else if(min(-boundA.z,mix(-boundA.z,-boundB.z,rod))<=boundRadius+cameraNear){lo=vec2(-1.e6);hi=vec2(1.e6);}
            else{
                float da=-boundA.z,db=mix(da,-boundB.z,rod),rr=boundRadius*boundRadius;
                vec2 ca=boundA.xy,cb=mix(boundA.xy,boundB.xy,rod);
                vec2 sa=boundRadius*sqrt(max(vec2(0.),ca*ca+da*da-rr));
                vec2 sb=boundRadius*sqrt(max(vec2(0.),cb*cb+db*db-rr));
                lo=min((ca*da-sa)/(da*da-rr),(cb*db-sb)/(db*db-rr));
                hi=max((ca*da+sa)/(da*da-rr),(cb*db+sb)/(db*db-rr));
            }
            vec2 diagonal=vec2(projectionMatrix[0][0],projectionMatrix[1][1]);
            vec2 offset=orthographic>.5?projectionMatrix[3].xy:-projectionMatrix[2].xy;
            lo=clamp(lo*diagonal+offset,vec2(-1.),vec2(1.));
            hi=clamp(hi*diagonal+offset,vec2(-1.),vec2(1.));
            float diameter=min((hi.x-lo.x)*viewportSize.x,(hi.y-lo.y)*viewportSize.y)*.5;
            vDetail=rod>.5?1.:smoothstep(6.,12.,diameter);
            gl_Position=vec4(mix(lo,hi,position.xy*.5+.5),0.,1.);
            if(radius<=0.)gl_Position=vec4(2.,2.,2.,1.);
            gl_Position/=gl_Position.w;gl_Position.z=0.;
            vec4 nearPoint=projectionInverse*vec4(gl_Position.xy,-1.,1.);vPlane=nearPoint.xyz/nearPoint.w;
        }`;
    const fragmentShader=`
        uniform mat4 projectionMatrix;
        #include <clipping_planes_pars_fragment>
        varying vec3 vA; varying vec3 vB; varying float vRadius; varying vec3 vTint;
        varying vec3 vPlane; varying vec2 vPulse; varying vec2 vSelection; varying vec2 vPresence;
        uniform float gaussian; uniform float rod; uniform float orthographic; uniform float physicsPulse; uniform float nonSelectedOpacity;
        uniform float renderPass; uniform float baseOpacity; uniform float glow;
        uniform vec3 keyDirection; uniform vec3 fillDirection; uniform vec3 lightLevels;
        uniform float shine; uniform float specularLevel; varying float vDetail;
        void main(){
            vec3 ro=orthographic>.5?vec3(vPlane.xy,0.):vec3(0.);
            vec3 rd=orthographic>.5?vec3(0.,0.,-1.):normalize(vPlane);
            float t=1.e20;vec3 normal=vec3(0.);float along=0.;float density=1.;
            if(gaussian>.5){
                // Closest approach through an ellipsoidal Gaussian: spherical
                // atoms and bond-aligned elongated dots, with a 2.5-sigma halo.
                if(vRadius<=0.)discard;
                vec3 ba=vB-vA;float len=length(ba);
                vec3 axis=len>.000001?ba/len:vec3(0.,1.,0.);
                vec3 center=mix(vA,(vA+vB)*.5,rod);
                float width=vRadius,extent=mix(width,max(width,len*.5),rod);
                vec3 o=ro-center;
                vec3 q=(o-axis*dot(o,axis))/width+axis*dot(o,axis)/extent;
                vec3 d=(rd-axis*dot(rd,axis))/width+axis*dot(rd,axis)/extent;
                t=-dot(q,d)/dot(d,d);
                float r2=dot(q+d*t,q+d*t);
                if(r2>6.25)discard;
                // Fourth-power falloff keeps the centre full and tightens the soft edge.
                density=.88*exp(-r2*r2);
                along=rod>.5?clamp(dot(ro+rd*t-vA,axis)/max(len,.000001),0.,1.):0.;
                normal=-rd;
            }else if(rod<.5){
                vec3 oc=ro-vA;float b=dot(oc,rd),c=dot(oc,oc)-vRadius*vRadius,h=b*b-c;
                if(h<0.)discard;
                float root=sqrt(h);t=-b-root;if(t<0.)t=-b+root;
                normal=normalize(ro+rd*t-vA);
            }else{
                vec3 ba=vB-vA,oa=ro-vA;float len=length(ba);if(len<.000001)discard;
                vec3 axis=ba/len;float dv=dot(rd,axis),ov=dot(oa,axis);
                vec3 d=rd-axis*dv,o=oa-axis*ov;
                float a=dot(d,d),b=dot(d,o),c=dot(o,o)-vRadius*vRadius,h=b*b-a*c;
                if(a>.0000001&&h>=0.){
                    float root=sqrt(h);
                    for(int k=0;k<2;k++){
                        float candidate=(-b+(k==0?-root:root))/a,y=ov+candidate*dv;
                        if(candidate>=0.&&y>=0.&&y<=len&&candidate<t){t=candidate;along=y/len;normal=normalize(oa+rd*t-axis*y);}
                    }
                }
                if(abs(dv)>.0000001)for(int k=0;k<2;k++){
                    float y=k==0?0.:len,candidate=(y-ov)/dv;
                    vec3 q=oa+rd*candidate-axis*y;
                    if(candidate>=0.&&dot(q,q)<=vRadius*vRadius&&candidate<t){t=candidate;along=float(k);normal=axis*(k==0?-1.:1.);}
                }
            }
            if(t<0.||t>1.e19||vRadius<=0.)discard;
            vec3 hit=ro+rd*t;
            #if NUM_CLIPPING_PLANES > 0
                for(int i=0;i<NUM_CLIPPING_PLANES;i++)if(dot(-hit,clippingPlanes[i].xyz)>clippingPlanes[i].w)discard;
            #endif
            float selection=mix(vSelection.x,max(vSelection.x,vSelection.y),rod);
            float presence=mix(vPresence.x,min(vPresence.x,vPresence.y),rod);
            float alpha=density*baseOpacity*presence*mix(nonSelectedOpacity,1.,selection)*mix(1.,physicsPulse,mix(vPulse.x,vPulse.y,along));
            if(alpha<=0.)discard;
            // Gaussian colour is composited back to front without a depth prepass.
            // Writing halo depth would erase the atoms behind transparent edges.
            if(gaussian>.5&&renderPass<1.5)discard;
            if(renderPass<.5&&alpha<.999)discard;
            if(renderPass>.5&&alpha>=.999&&gaussian<.5)discard;
            vec4 clip=projectionMatrix*vec4(hit,1.);float depth=.5*(clip.z/clip.w)+.5;
            if(depth<0.||depth>1.)discard;gl_FragDepthEXT=depth;
            float diffuse=lightLevels.x+lightLevels.y*max(0.,dot(normal,keyDirection))+lightLevels.z*max(0.,dot(normal,fillDirection));
            // Subpixel highlights cannot be resolved reliably. Skip their expensive
            // specular calculation below six pixels, blending back by twelve pixels.
            float spec=0.;
            if(vDetail>0.){vec3 halfVector=normalize(keyDirection-rd);spec=vDetail*specularLevel*pow(max(0.,dot(normal,halfVector)),max(1.,shine));}
            gl_FragColor=vec4((glow>.5||gaussian>.5)?vTint:vTint*diffuse+vec3(spec),alpha);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
        }`;
    function gpuStatus(renderer){
        let state='unknown',name='';
        if(!renderer)state='unavailable';
        else try{const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
            name=String(ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));
            state=/swiftshader|llvmpipe|softpipe|software|swrast|lavapipe|microsoft basic render/i.test(name)?'software':ext?'hardware':'unknown';
        }catch(_){}
        MolecularImpostors.gpu={state,renderer:name};
        const label=document.getElementById('gpuStatus');if(label){label.hidden=!['software','unavailable'].includes(state);label.title=state==='unavailable'?'WebGL is unavailable. Enable browser software or hardware WebGL to render molecules.':'Software WebGL runs the same molecular shaders on the CPU; appearance is preserved.';}
        return state;
    }
    function supported(renderer){return !!renderer&&(renderer.capabilities.isWebGL2||renderer.extensions.has('EXT_frag_depth'))&&(renderer.capabilities.isWebGL2||renderer.extensions.has('ANGLE_instanced_arrays'));}
    function create(capacity,baseRadius=1,rod=false,options={}){
        const geometry=new THREE.InstancedBufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));geometry.setIndex([0,1,2,0,2,3]);
        let size=Math.max(1,options.dynamic?Math.min(16,capacity||1):capacity);
        const uniforms={gaussian:{value:options.gaussian?1:0},spinTransforms:{value:null},spinEnabled:{value:0},spinRows:{value:1},viewportSize:{value:new THREE.Vector2(1,1)},projectionInverse:{value:new THREE.Matrix4()},rod:{value:rod?1:0},orthographic:{value:0},cameraNear:{value:.1},physicsPulse:{value:1},nonSelectedOpacity:{value:1},renderPass:{value:0},baseOpacity:{value:options.opacity??1},glow:{value:options.glow?1:0},keyDirection:{value:new THREE.Vector3()},fillDirection:{value:new THREE.Vector3()},lightLevels:{value:new THREE.Vector3(.6,.8,.3)},shine:{value:options.shininess??6},specularLevel:{value:.03}};
        function material(pass){const m=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{...uniforms,renderPass:{value:pass}},extensions:{fragDepth:true},clipping:true,transparent:pass===2||!!options.glow||!!options.composite,depthWrite:pass!==2&&!options.glow&&!options.composite,depthTest:true});m.userData.impostor=true;m.color=new THREE.Color(0xffffff);if(options.composite)m.uniforms.renderPass.value=2;if(options.glow){m.blending=THREE.AdditiveBlending;m.uniforms.renderPass.value=2;}if(pass===1)m.colorWrite=false;return m;}
        const mesh=new THREE.Mesh(geometry,material(0));mesh.userData.impostor={rod,gaussian:!!options.gaussian,baseRadius,opacity:options.opacity??1};mesh.frustumCulled=false;
        let count=options.dynamic?0:capacity;
        Object.defineProperty(mesh,'count',{get:()=>count,set:v=>{count=v;ensure(v);geometry.instanceCount=v;}});
        function allocate(n){
            for(const [name,itemSize,Type,normalized,fill] of [['center',3,Float32Array,false,0],['endpoint',3,Float32Array,false,0],['radius',1,Float32Array,false,0],['spinIndices',2,Float32Array,false,0],['instanceTint',3,Uint8Array,true,255],['pulseEndpoints',2,Float32Array,false,0],['selectionEndpoints',2,Float32Array,false,1],['conformationEndpoints',2,Float32Array,false,1]]){
                const old=geometry.getAttribute(name),array=new Type(n*itemSize);if(fill)array.fill(fill);if(old)array.set(old.array);
                geometry.setAttribute(name,new THREE.InstancedBufferAttribute(array,itemSize,normalized).setUsage(THREE.DynamicDrawUsage));
            }
            if(!rod)geometry.setAttribute('endpoint',geometry.attributes.center);
        }
        function ensure(n){if(n<=size)return;geometry.dispose();delete geometry._maxInstanceCount;const oldSize=size;size=2**Math.ceil(Math.log2(n));allocate(size);if(options.color){const c=new THREE.Color(options.color);for(let i=oldSize;i<size;i++)mesh.setColorAt(i,c);}}
        allocate(size);geometry.instanceCount=count;
        mesh.instanceMatrix={setUsage(){return this;},set needsUpdate(v){if(v)for(const name of ['center','endpoint','radius'])geometry.attributes[name].needsUpdate=true;}};
        mesh.instanceColor={set needsUpdate(v){if(v)geometry.attributes.instanceTint.needsUpdate=true;}};
        mesh.setPositionAt=(i,x,y,z,r)=>{ensure(i+1);geometry.attributes.center.setXYZ(i,x,y,z);geometry.attributes.endpoint.setXYZ(i,x,y,z);geometry.attributes.radius.setX(i,r);};
        mesh.setBondAt=(i,a,b,r)=>{ensure(i+1);geometry.attributes.center.setXYZ(i,a.x,a.y,a.z);geometry.attributes.endpoint.setXYZ(i,b.x,b.y,b.z);geometry.attributes.radius.setX(i,r);};
        mesh.setSpinTransforms=(texture,rows,matrices)=>{uniforms.spinTransforms.value=texture;uniforms.spinRows.value=rows;uniforms.spinEnabled.value=texture?1:0;mesh.userData.spinMatrices=texture?matrices:null;};
        mesh.setMatrixAt=(i,m)=>{ensure(i+1);const e=m.elements,a=geometry.attributes.center,b=geometry.attributes.endpoint;
            const r=baseRadius*Math.hypot(e[0],e[1],e[2]);geometry.attributes.radius.setX(i,r);
            if(rod){a.setXYZ(i,e[12]-e[4]*.5,e[13]-e[5]*.5,e[14]-e[6]*.5);b.setXYZ(i,e[12]+e[4]*.5,e[13]+e[5]*.5,e[14]+e[6]*.5);}
            else{a.setXYZ(i,e[12],e[13],e[14]);b.setXYZ(i,e[12],e[13],e[14]);}
        };
        mesh.setColorAt=(i,c)=>{ensure(i+1);const a=geometry.attributes.instanceTint.array,k=i*3;a[k]=Math.round(255*Math.max(0,Math.min(1,c.r)));a[k+1]=Math.round(255*Math.max(0,Math.min(1,c.g)));a[k+2]=Math.round(255*Math.max(0,Math.min(1,c.b)));};
        mesh.getColorAt=(i,c)=>{const a=geometry.attributes.instanceTint.array,k=i*3;return c.setRGB(a[k]/255,a[k+1]/255,a[k+2]/255);};
        if(options.color){const c=new THREE.Color(options.color);for(let i=0;i<size;i++)mesh.setColorAt(i,c);}
        const depth=new THREE.Mesh(geometry,material(1)),transparent=new THREE.Mesh(geometry,material(2));
        if(!options.glow&&!options.composite){mesh.userData.impostor.passes=[depth,transparent];for(const child of [depth,transparent]){child.frustumCulled=false;child.raycast=()=>{};mesh.add(child);}depth.renderOrder=100000;transparent.renderOrder=100001;}
        else{depth.material.dispose();transparent.material.dispose();}
        const viewport=new THREE.Vector4();
        mesh.onBeforeRender=(renderer,scene,camera)=>{
            renderer.getCurrentViewport(viewport);uniforms.viewportSize.value.set(viewport.z,viewport.w);
            uniforms.baseOpacity.value=(options.opacity??1)*mesh.material.opacity;uniforms.projectionInverse.value.copy(camera.projectionMatrixInverse);uniforms.orthographic.value=camera.isOrthographicCamera?1:0;uniforms.cameraNear.value=camera.near;
            uniforms.physicsPulse.value=options.composite||typeof physicsPulseUniform==='undefined'?1:physicsPulseUniform.value;
            uniforms.nonSelectedOpacity.value=options.composite||typeof physicsNonSelectedOpacityUniform==='undefined'?1:physicsNonSelectedOpacityUniform.value;
            if(typeof physicsMaterialSettings!=='undefined'){
                const settings=physicsMaterialSettings;uniforms.lightLevels.value.set(settings.ambient,settings.key,settings.fill);
                uniforms.shine.value=physicsMaterialOverrides.has('shininess')?settings.shininess:options.shininess??6;
                uniforms.specularLevel.value=physicsMaterialOverrides.has('specular')?settings.specular:.03;
                const angle=settings.azimuth*Math.PI/180,custom=physicsMaterialOverrides.has('azimuth');
                uniforms.keyDirection.value.set(custom?Math.cos(angle)*70:50,100,custom?Math.sin(angle)*70:50).transformDirection(camera.matrixWorldInverse);
                uniforms.fillDirection.value.set(custom?-Math.cos(angle)*70:-50,-50,custom?-Math.sin(angle)*70:-50).transformDirection(camera.matrixWorldInverse);
            }
        };
        const a=new THREE.Vector3(),b=new THREE.Vector3(),point=new THREE.Vector3(),pickingSphere=new THREE.Sphere();
        mesh.raycast=(raycaster,hits)=>{
            const centers=geometry.attributes.center,ends=geometry.attributes.endpoint,radii=geometry.attributes.radius;
            for(let i=0;i<count;i++){
                const r=radii.getX(i);if(r<=0)continue;
                const spin=mesh.userData.spinMatrices,ids=geometry.attributes.spinIndices;
                a.fromBufferAttribute(centers,i);if(spin)a.applyMatrix4(spin[ids.getX(i)]);a.applyMatrix4(mesh.matrixWorld);
                if(!rod){const hit=raycaster.ray.intersectSphere(pickingSphere.set(a,r),point);if(!hit)continue;}
                else{
                    b.fromBufferAttribute(ends,i);if(spin)b.applyMatrix4(spin[ids.getY(i)]);b.applyMatrix4(mesh.matrixWorld);
                    const length=a.distanceTo(b);if(length<1e-8)continue;
                    const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length,uz=(b.z-a.z)/length;
                    const origin=raycaster.ray.origin,d=raycaster.ray.direction,x=origin.x-a.x,y=origin.y-a.y,z=origin.z-a.z;
                    const dv=d.x*ux+d.y*uy+d.z*uz,ov=x*ux+y*uy+z*uz,A=1-dv*dv,B=d.x*x+d.y*y+d.z*z-dv*ov,C=x*x+y*y+z*z-ov*ov-r*r;
                    let t=Infinity;const h=B*B-A*C;
                    if(A>1e-8&&h>=0){const root=Math.sqrt(h);for(const v of [(-B-root)/A,(-B+root)/A]){const along=ov+v*dv;if(v>=0&&along>=0&&along<=length)t=Math.min(t,v);}}
                    if(Math.abs(dv)>1e-8)for(const cap of [0,length]){const v=(cap-ov)/dv,px=x+d.x*v-ux*cap,py=y+d.y*v-uy*cap,pz=z+d.z*v-uz*cap;if(v>=0&&px*px+py*py+pz*pz<=r*r)t=Math.min(t,v);}
                    if(!Number.isFinite(t))continue;raycaster.ray.at(t,point);
                }
                const distance=raycaster.ray.origin.distanceTo(point);if(distance<raycaster.near||distance>raycaster.far)continue;
                hits.push({distance,point:point.clone(),object:mesh,instanceId:i});
            }
        };
        let disposed=false;mesh.dispose=()=>{if(disposed)return;disposed=true;for(const child of mesh.children)child.material.dispose();};
        return mesh;
    }
    function syncPasses(mesh,pulse=1,nonSelected=1){
        const state=mesh.userData.impostor;if(!state?.passes)return;
        const p=mesh.geometry.attributes.pulseEndpoints.array,s=mesh.geometry.attributes.selectionEndpoints.array,c=mesh.geometry.attributes.conformationEndpoints.array;
        const base=state.opacity*mesh.material.opacity;let translucent=!!state.gaussian;
        for(let i=0;i<mesh.count;i++){
            const k=i*2,selection=state.rod?Math.max(s[k],s[k+1]):s[k],presence=state.rod?Math.min(c[k],c[k+1]):c[k];
            const alpha=base*presence*(nonSelected+(1-nonSelected)*selection),a=alpha*(1+(pulse-1)*p[k]),b=state.rod?alpha*(1+(pulse-1)*p[k+1]):a;
            if(Math.max(a,b)>0&&Math.min(a,b)<.999){translucent=true;break;}
        }
        for(const pass of state.passes)pass.visible=translucent;
    }
    // One back-to-front batch interleaves protein, overlay, and lipid atoms.
    // Keep source buffers in their original order so picking and animation IDs
    // remain stable. Gaussian halos blend normally and never write depth.
    function syncGaussianScene(scene,camera){
        let state=scene.userData.gaussianComposite;
        if(state)state.mesh.visible=false;
        const sources=[];
        scene.traverseVisible(object=>{
            if(object===state?.mesh)return;
            if(object.userData.impostor?.gaussian&&!object.userData.impostor.rod&&object.geometry.drawRange.count!==0)sources.push(object);
            else if(object.userData.gaussianLipid&&object.material===object.userData.gaussianLipid.gaussianMaterial)sources.push(object);
        });
        if(!sources.length)return;
        if(!state){
            const mesh=create(0,1,false,{dynamic:true,gaussian:true,composite:true});
            mesh.renderOrder=100001;mesh.raycast=()=>{};scene.add(mesh);
            state=scene.userData.gaussianComposite={mesh,records:[],order:[]};
        }
        scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
        const point=new THREE.Vector3(),color=new THREE.Color(),view=camera.matrixWorldInverse.elements;
        let count=0;
        const emit=(x,y,z,r,tint,alpha=1)=>{
            if(r<=0||alpha<=0)return;
            const record=state.records[count]||(state.records[count]={});
            Object.assign(record,{x,y,z,r,red:tint.r,green:tint.g,blue:tint.b,alpha,depth:view[2]*x+view[6]*y+view[10]*z+view[14]});
            state.order[count++]=record;
        };
        for(const source of sources){
            if(source.userData.gaussianLipid){
                LipidRenderer.collectGaussianAtoms(source.userData.gaussianLipid,emit);
                source.material.visible=false;
                continue;
            }
            source.material.visible=false;
            for(const pass of source.userData.impostor.passes||[])pass.visible=false;
            const a=source.geometry.attributes,spin=source.userData.spinMatrices;
            const pulse=typeof physicsPulseUniform==='undefined'?1:physicsPulseUniform.value;
            const unselected=typeof physicsNonSelectedOpacityUniform==='undefined'?1:physicsNonSelectedOpacityUniform.value;
            for(let i=0;i<source.count;i++){
                point.fromBufferAttribute(a.center,i);
                if(spin)point.applyMatrix4(spin[a.spinIndices.getX(i)]);
                point.applyMatrix4(source.matrixWorld);source.getColorAt(i,color);
                const alpha=source.userData.impostor.opacity*source.material.opacity*a.conformationEndpoints.getX(i)*
                    (unselected+(1-unselected)*a.selectionEndpoints.getX(i))*(1+(pulse-1)*a.pulseEndpoints.getX(i));
                emit(point.x,point.y,point.z,a.radius.getX(i),color,alpha);
            }
        }
        state.order.length=count;state.order.sort((a,b)=>a.depth-b.depth);
        const mesh=state.mesh;mesh.count=count;
        const presence=mesh.geometry.attributes.conformationEndpoints;
        state.order.forEach((record,i)=>{
            mesh.setPositionAt(i,record.x,record.y,record.z,record.r);
            color.setRGB(record.red,record.green,record.blue);mesh.setColorAt(i,color);
            presence.setXY(i,record.alpha,record.alpha);
        });
        mesh.material.clippingPlanes=sources[0].material.clippingPlanes;
        mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;presence.needsUpdate=true;
        mesh.visible=count>0;
    }
    globalThis.MolecularImpostors={create,supported,syncPasses,syncGaussianScene,gpuStatus,gpu:{state:'unknown'}};
})();
