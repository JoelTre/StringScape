(() => {
    'use strict';
    window.createEditModelsPage = () => {
        const state = new window.EditModelsState();
        const panel = document.createElement('section');
        panel.className = 'edit-models-panel';
        panel.innerHTML = `<h2>Model editor (beta)</h2>
          <details class="edit-visibility-section"><summary><i class="fa-solid fa-eye" aria-hidden="true"></i> Visibility toggles <i class="edit-visibility-chevron fa-solid fa-chevron-down" aria-hidden="true"></i></summary><div class="edit-visibility" data-visibility></div></details>
          <div class="edit-row"><label>Style <select data-style><option value="balls">Atoms</option><option value="backbone">Backbone</option></select></label>
          <label>Colour proteins by <select data-colour><option value="chain">Chain</option><option value="element">Element</option><option value="model">Model</option></select></label></div>
          <div class="edit-row"><label>Select <select data-mode><option value="chain">Chain/polynucleotide</option><option value="model">Model</option></select></label><button type="button" data-sequences><i class="fa-solid fa-align-left"></i> View sequences</button></div>
          <div class="edit-sequences" data-sequence-content hidden></div>
          <div class="edit-row"><button type="button" data-upload><i class="fa-solid fa-upload"></i> Upload structures</button><input type="file" data-files accept=".pdb,.ent,.cif,.mmcif" multiple hidden><button type="button" data-duplicate disabled><i class="fa-solid fa-copy"></i> Duplicate</button><button type="button" data-delete disabled><i class="fa-solid fa-trash" aria-hidden="true"></i> Delete selection</button></div>
          <form class="edit-row" data-fetch-form><label>PDB IDs <input type="text" data-pdb-ids placeholder="e.g. 1ABC, 2XYZ" autocomplete="off"></label><button type="submit" data-fetch><i class="fa-solid fa-cloud-arrow-down"></i> Fetch</button></form>
          <p class="edit-message" data-status role="status">Upload a structure or build a homology model. Click a chain to select it; Shift-click adds to the selection.</p>
          <h3>Translation (Å)</h3><div class="edit-row" data-translation></div>
          <h3>Rotation (degrees)</h3><div class="edit-row" data-rotation></div>
          <div class="edit-row"><label>Rotation centre <select data-pivot><option value="selection">Selection centre</option><option value="individual">Individual origins</option></select></label></div>
          <p class="edit-message">Transforms are measured from the starting position. Individual origins use chain or model centres.</p>
          <section class="edit-tm-align"><h3>TM align</h3><div class="edit-row"><span class="edit-control-tooltip"><button type="button" data-group="1">Set as Group 1</button></span><span class="edit-control-tooltip"><button type="button" data-group="2">Set as Group 2</button></span><span class="edit-control-tooltip"><button type="button" data-align>TM align</button></span></div><p class="edit-message">Group 1: <span data-group-assignment="1">Not set</span></p><p class="edit-message">Group 2: <span data-group-assignment="2">Not set</span></p><p class="edit-message" data-align-status role="status">Select chains or models to define each group. Group 1 aligns to Group 2.</p></section>
          <div class="edit-download-wrap"><button type="button" data-download aria-haspopup="true" aria-expanded="false" aria-controls="editDownloadMenu"><i class="fa-solid fa-download"></i> Download model <i class="fa-solid fa-chevron-down"></i></button>
          <div id="editDownloadMenu" class="edit-download-menu" role="group" aria-label="Download options" hidden>
            <button type="button" data-format="cif">.mmCIF</button><button type="button" data-format="mvsj">.mvsj (Mol* with membrane)</button><button type="button" data-format="glb">.glb</button><button type="button" data-format="obj">.obj</button><button type="button" data-format="stl">.stl</button><button type="button" data-format="session">Session</button>
            <label class="nucleic-guide-switch text-xs text-slate-300 px-2 py-2"><input type="checkbox" data-selection-only> Selection only</label><label class="nucleic-guide-switch text-xs text-slate-300 px-2 py-2"><input type="checkbox" data-visible-only> Visible only</label>
          </div></div>`;
        const viewer = document.createElement('div'); viewer.className = 'edit-models-viewer'; viewer.hidden = true;
        viewer.innerHTML = '<svg class="edit-membrane-leaders" aria-hidden="true"></svg><div class="edit-membrane-labels" aria-hidden="true"></div><div class="edit-selection-info" role="status" aria-live="polite" hidden></div><div class="edit-help">Drag to orbit · right-drag to pan · scroll to zoom · click to select</div>';
        const membraneLabels=viewer.querySelector('.edit-membrane-labels'),membraneLeaders=viewer.querySelector('.edit-membrane-leaders'),selectionInfo=viewer.querySelector('.edit-selection-info');let membraneLabelEntries=[],glowVisible=true,hoveredHandle=null,draggedHandle=null,selectionGlow=null;
        const membraneLabelMotion=new WeakMap();let labelFrame=0;
        const q = selector => panel.querySelector(selector);
        // Keep native selects as the source of truth, with the same button-based
        // dropdown interaction used by the main 3D viewer.
        for (const name of ['style','colour','mode','pivot']) {
            const select=panel.querySelector(`[data-${name}]`), label=select.closest('label');
            const title=label.firstChild.textContent.trim();
            const trigger=document.createElement('button'),menu=document.createElement('div');
            const menuId=`editModelsMenu-${name}`;
            trigger.type='button';trigger.className='edit-select-trigger';trigger.setAttribute('aria-label',title);
            trigger.setAttribute('aria-haspopup','true');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',menuId);
            menu.id=menuId;menu.className='edit-select-menu';menu.setAttribute('role','group');menu.setAttribute('aria-label',`${title} options`);menu.hidden=true;
            select.hidden=true;select.after(trigger);document.body.append(menu);
            const sync=()=>{
                const current=select.selectedOptions[0]?.textContent||'';trigger.setAttribute('aria-label',`${title}: ${current}`);
                trigger.replaceChildren(document.createTextNode(current));
                const chevron=document.createElement('i');chevron.className='fa-solid fa-chevron-down';chevron.setAttribute('aria-hidden','true');trigger.append(chevron);
                for(const button of menu.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.value===select.value));
            };
            const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};
            const place=()=>{
                if(!trigger.getClientRects().length){close();return;}
                const rect=trigger.getBoundingClientRect(),width=menu.offsetWidth,height=menu.offsetHeight;
                menu.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-width-8))}px`;
                menu.style.top=`${Math.max(8,Math.min(rect.bottom+6,window.innerHeight-height-8))}px`;
            };
            for(const option of select.options){
                const button=document.createElement('button');button.type='button';button.dataset.value=option.value;button.textContent=option.textContent;
                button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close();trigger.focus();});menu.append(button);
            }
            trigger.addEventListener('click',()=>{const opening=menu.hidden;menu.hidden=!opening;trigger.setAttribute('aria-expanded',String(opening));if(opening)place();});
            select.addEventListener('change',sync);
            document.addEventListener('click',event=>{if(!menu.contains(event.target)&&!trigger.contains(event.target))close();});
            document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){close();trigger.focus();}});
            window.addEventListener('resize',()=>{if(!menu.hidden)place();});
            document.addEventListener('scroll',()=>{if(!menu.hidden)place();},true);
            sync();
        }

        let selection = [], renderer, scene, camera, cloud, bonds, membraneGroup, gizmo, cloudItems = [], firstSnapshot = false, cameraTarget = null, alignmentBusy = false;
        let distance = 100, pointer = null, lipidRenderers = [];
        const palette = [0x60a5fa,0xf472b6,0x34d399,0xfbbf24,0xc084fc,0xfb923c,0x22d3ee,0xa3e635];
        const elementColours = ELEMENT_COLORS;
        function status(text) { q('[data-status]').textContent = text; }
        function selected(item) { return selection.some(s => s.model === item.model && (s.chain === null || s.chain === item.chain)); }
        function targets() { return [...new Set(selection.map(s => s.chain || s.model))]; }
        function updateSelectionInfo(){
            selectionInfo.replaceChildren();selectionInfo.hidden=!selection.length;if(!selection.length)return;
            const row=document.createElement('div');row.className='selection-info-heading';const title=document.createElement('strong'),first=selection[0];title.textContent=first.chain?`${first.chain.id} · ${first.model.name}`:first.model.name;
            const glow=document.createElement('button');glow.type='button';glow.className='selection-glow-button';glow.setAttribute('aria-pressed',String(glowVisible));glow.setAttribute('aria-label',glowVisible?'Hide glow':'Show glow');glow.append(document.createTextNode('Glow '));const icon=document.createElement('i');icon.className=`fa-solid ${glowVisible?'fa-eye':'fa-eye-slash'}`;icon.setAttribute('aria-hidden','true');glow.append(icon);glow.addEventListener('click',()=>{glowVisible=!glowVisible;updateSelectionInfo();render();});
            row.append(title,glow);selectionInfo.append(row);const detail=document.createElement('div');detail.textContent=first.chain?`Chain · ${first.chain.atoms.length} atoms`:`Model · ${first.model.shared.chains.length} chains`;selectionInfo.append(detail);
            if(selection.length>1){const more=document.createElement('div');more.textContent=`Also selected: ${selection.length-1} ${selection.length===2?'item':'items'}`;selectionInfo.append(more);}
            const clear=document.createElement('button');clear.type='button';clear.className='edit-clear-selection';clear.textContent='Clear selection';clear.addEventListener('click',()=>{selection=[];updateFields();render();});selectionInfo.append(clear);
        }
        function updateFields(preserveActive = false) {
            for (const kind of ['translation','rotation']) for (const axis of ['x','y','z']) {
                const input = q(`[data-kind="${kind}"][data-axis="${axis}"]`), value = state.fieldValue(targets(),kind,axis);
                input.disabled = !selection.length; input.classList.toggle('mixed',value.mixed);
                input.parentElement.title = selection.length ? '' : 'Select a molecule first';
                const reset = q(`[data-reset-kind="${kind}"][data-reset-axis="${axis}"]`);
                reset.classList.toggle('is-hidden', !targets().some(target => Math.abs(target.pose[kind][axis]) > 1e-8));
                if (!preserveActive || document.activeElement !== input) input.value = value.value === null || value.mixed ? '' : Number(value.value.toFixed(3));
                input.placeholder = value.mixed ? 'Mixed' : '—';
            }
            q('[data-duplicate]').disabled = !selection.length || selection.some(item => item.model !== selection[0].model);
            q('[data-delete]').disabled = !selection.length || alignmentBusy;
            for (const button of panel.querySelectorAll('[data-group], [data-align]')) { button.disabled = !selection.length || alignmentBusy; button.parentElement.title = selection.length ? '' : 'Select a molecule first'; }
            updateSelectionInfo();
        }
        for (const kind of ['translation','rotation']) for (const axis of ['x','y','z']) {
            const field=document.createElement('div'); field.className='edit-transform-field';
            const label = document.createElement('label'); label.className='edit-field'; label.textContent=axis.toUpperCase();
            const input=document.createElement('input'); input.type='text'; input.inputMode='decimal'; input.className='edit-transform-input'; input.dataset.kind=kind; input.dataset.axis=axis;
            input.setAttribute('aria-label',`${axis.toUpperCase()} ${kind}`);
            input.title='Click to edit, or drag up or right to increase the value';
            const applyValue=value=>{if(!Number.isFinite(value)||!selection.length)return; if(kind==='rotation')state.setSelectionRotations(selection,axis,new Map(targets().map(target=>[target,value])),q('[data-pivot]').value); else state.setField(targets(),kind,axis,value); updateFields(true); render();};
            input.addEventListener('input',()=>{if(input.value.trim())applyValue(Number(input.value));});
            input.addEventListener('change',()=>{if(input.value.trim()&&Number.isFinite(Number(input.value)))applyValue(Number(input.value)); updateFields();});
            input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.dispatchEvent(new Event('change'));input.blur();}});
            let drag=null;
            input.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,start:state.fieldValue(targets(),kind,axis).value??0,moved:false};input.setPointerCapture(event.pointerId);});
            input.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<4)return;drag.moved=true;const value=Math.round((drag.start+(dx-dy)*.5)*100)/100;input.value=String(value);applyValue(value);input.setSelectionRange(input.value.length,input.value.length);event.preventDefault();});
            input.addEventListener('pointerup',()=>{drag=null;});input.addEventListener('pointercancel',()=>{drag=null;});
            const reset=document.createElement('button');reset.type='button';reset.className='edit-transform-reset is-hidden';reset.dataset.resetKind=kind;reset.dataset.resetAxis=axis;reset.title=`Reset ${axis.toUpperCase()} ${kind}`;reset.setAttribute('aria-label',reset.title);reset.innerHTML='<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>';
            reset.addEventListener('click',()=>applyValue(0));
            label.append(input);field.append(label,reset);q(`[data-${kind}]`).append(field);
        }
        function init() {
            if (renderer) return;
            if (!window.THREE) throw new Error('The 3D viewer library could not be loaded.');
            renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)); viewer.prepend(renderer.domElement);
            scene=new THREE.Scene(); scene.background=new THREE.Color(document.body.classList.contains('light-mode')?0xffffff:0x01030a);
            camera=new THREE.PerspectiveCamera(45,1,.1,100000);camera.position.set(50,60,70);camera.up.set(0,1,0);camera.lookAt(0,0,0);addPhysicsViewerLights(scene);
            renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
            function rayAt(event) {
                const rect=renderer.domElement.getBoundingClientRect(), mouse=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1), ray=new THREE.Raycaster();
                ray.setFromCamera(mouse,camera); return ray;
            }
            renderer.domElement.addEventListener('pointerdown', event=>{
                if(event.button!==0&&event.button!==2)return;
                const hit=event.button===0&&gizmo&&rayAt(event).intersectObjects(gizmo.children,true).find(item=>item.object.userData.handle);
                pointer={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false,button:event.button};
                if(hit){
                    const handle=hit.object.userData.handle, origin=gizmo.position.clone(), end=origin.clone().add(handle.vector);
                    const a=origin.clone().project(camera),b=end.project(camera), rect=renderer.domElement.getBoundingClientRect();
                    const dx=(b.x-a.x)*rect.width/2,dy=-(b.y-a.y)*rect.height/2, length=Math.hypot(dx,dy);
                    pointer.handle=handle;draggedHandle=handle.key;hoveredHandle=handle.key;renderer.domElement.style.cursor='pointer';updateGizmo();draw();pointer.direction=length>2?{x:dx/length,y:dy/length}:{x:1,y:0};
                    pointer.scale=2*distance*Math.tan(camera.fov*Math.PI/360)/rect.height;
                    pointer.initial=targets().map(target=>({target,translation:{...target.pose.translation},rotation:{...target.pose.rotation}}));
                    if(handle.kind==='rotation'){
                        pointer.axis=handle.vector.clone().normalize();pointer.center=origin.clone();pointer.pivotMode=q('[data-pivot]').value;
                        const radial=hit.point.clone().sub(origin).addScaledVector(pointer.axis,-hit.point.clone().sub(origin).dot(pointer.axis));
                        const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(pointer.axis,origin),ray=rayAt(event).ray;
                        pointer.plane=Math.abs(ray.direction.dot(pointer.axis))>.08?plane:null;
                        pointer.startVector=radial.clone().normalize();pointer.lastAngle=0;pointer.totalAngle=0;
                        const tangent=new THREE.Vector3().crossVectors(pointer.axis,radial),start=hit.point.clone().project(camera),endPoint=hit.point.clone().add(tangent).project(camera);
                        pointer.tangent={x:(endPoint.x-start.x)*rect.width/2,y:-(endPoint.y-start.y)*rect.height/2};
                    }
                }
                renderer.domElement.setPointerCapture(event.pointerId);
            });
            renderer.domElement.addEventListener('pointermove', event=>{
                if(!pointer){const hit=gizmo&&rayAt(event).intersectObjects(gizmo.children,true).find(item=>item.object.userData.handle),key=hit?.object.userData.handle.key||null;renderer.domElement.style.cursor=key?'pointer':'default';if(key!==hoveredHandle){hoveredHandle=key;updateGizmo();draw();}return;}const dx=event.clientX-pointer.lastX,dy=event.clientY-pointer.lastY;pointer.lastX=event.clientX;pointer.lastY=event.clientY;
                if(Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>4)pointer.moved=true;
                if(pointer.handle){
                    const h=pointer.handle, px=event.clientX-pointer.x,py=event.clientY-pointer.y;
                    if(h.kind==='rotation'){
                        let angle=null;if(pointer.plane){const point=new THREE.Vector3();if(rayAt(event).ray.intersectPlane(pointer.plane,point)){const current=point.sub(pointer.center).normalize(),relative=Math.atan2(pointer.axis.dot(new THREE.Vector3().crossVectors(pointer.startVector,current)),pointer.startVector.dot(current));let step=relative-pointer.lastAngle;while(step>Math.PI)step-=2*Math.PI;while(step< -Math.PI)step+=2*Math.PI;pointer.totalAngle+=step;pointer.lastAngle=relative;angle=pointer.totalAngle;}}
                        if(angle===null){const tangent=pointer.tangent,scale=tangent.x*tangent.x+tangent.y*tangent.y;angle=scale>4?(px*tangent.x+py*tangent.y)/scale:0;}
                        applyGizmoRotation(pointer,angle);
                    }else{
                        const delta=(px*pointer.direction.x+py*pointer.direction.y)*pointer.scale*h.sign,world=h.vector.clone().multiplyScalar(delta*h.sign);
                        for(const entry of pointer.initial){const item=selection.find(candidate=>(candidate.chain||candidate.model)===entry.target),local=world.clone();if(item?.chain){const e=item.model.pose.rotation;const parent=new THREE.Quaternion().setFromEuler(new THREE.Euler(e.x*Math.PI/180,e.y*Math.PI/180,e.z*Math.PI/180,'ZYX')).invert();local.copy(world).applyQuaternion(parent);}entry.target.pose.translation={x:entry.translation.x+local.x,y:entry.translation.y+local.y,z:entry.translation.z+local.z};}
                    }
                    updateFields();render();
                } else if(pointer.moved){
                    const target=cameraTarget||new THREE.Vector3(); camera.updateMatrixWorld();
                    const right=new THREE.Vector3(),up=new THREE.Vector3(),forward=new THREE.Vector3();camera.matrixWorld.extractBasis(right,up,forward);
                    if(pointer.button===2){const scale=2*distance*Math.tan(camera.fov*Math.PI/360)/viewer.clientHeight,shift=right.multiplyScalar(-dx*scale).add(up.multiplyScalar(dy*scale));camera.position.add(shift);target.add(shift);cameraTarget=target;}
                    else {const offset=camera.position.clone().sub(target);offset.applyAxisAngle(right,-dy*.008);camera.up.applyAxisAngle(right,-dy*.008);offset.applyAxisAngle(camera.up,-dx*.008);camera.position.copy(target).add(offset);camera.lookAt(target);}draw();}
            });
            renderer.domElement.addEventListener('pointerup',event=>{if(pointer&&!pointer.moved&&!pointer.handle&&pointer.button===0)pick(event);pointer=null;draggedHandle=null;updateGizmo();draw();});
            renderer.domElement.addEventListener('pointercancel',()=>{pointer=null;draggedHandle=null;hoveredHandle=null;renderer.domElement.style.cursor='default';updateGizmo();draw();});
            renderer.domElement.addEventListener('pointerleave',()=>{if(!pointer){hoveredHandle=null;renderer.domElement.style.cursor='default';updateGizmo();draw();}});
            renderer.domElement.addEventListener('wheel',event=>{event.preventDefault();distance=Math.max(1,distance*Math.exp(event.deltaY*.001));const target=cameraTarget||new THREE.Vector3(),offset=camera.position.clone().sub(target).setLength(distance);camera.position.copy(target).add(offset);draw();},{passive:false});
            new ResizeObserver(()=>draw()).observe(viewer);
            new MutationObserver(()=>render()).observe(document.body,{attributes:true,attributeFilter:['class']});
        }
        function draw() {
            if(!renderer || viewer.hidden || !viewer.clientWidth || !viewer.clientHeight)return;
            renderer.setSize(viewer.clientWidth,viewer.clientHeight,false); camera.aspect=viewer.clientWidth/viewer.clientHeight; camera.updateProjectionMatrix();
            scene.background.setHex(document.body.classList.contains('light-mode')?0xffffff:0x01030a);camera.lookAt(cameraTarget||new THREE.Vector3());camera.updateMatrixWorld();syncPhysicsMaterials(scene);if(cloud?.userData.impostor)MolecularImpostors.syncPasses(cloud,1,1);if(bonds?.userData.impostor)MolecularImpostors.syncPasses(bonds,1,1);renderer.render(scene,camera);
            let animateLabels=false;
            for(const {model,membrane,side,node,line} of membraneLabelEntries){
                let pair=membraneLabelMotion.get(membrane);if(!pair){pair={negative:{},positive:{}};membraneLabelMotion.set(membrane,pair);}
                const motion=side<0?pair.negative:pair.positive,width=viewer.clientWidth,height=viewer.clientHeight;
                const project=(x,y)=>{
                    const coords=membranePlatePoint(membrane,x,y,side),world=state.transformModelPoint(model,{x:coords[0],y:coords[1],z:coords[2]});
                    const worldPoint=new THREE.Vector3(world.x,world.y,world.z),p=worldPoint.clone().project(camera);
                    return p.z>=-1&&p.z<=1&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:(p.x+1)*width/2,y:(1-p.y)*height/2,distance:camera.position.distanceTo(worldPoint)}:null;
                };
                const corners=[[-1,-1],[-1,1],[1,-1],[1,1]],projected=corners.map(([x,y])=>project(x*membrane.extent,y*membrane.extent)),distances=projected.filter(Boolean).map(point=>point.distance);
                const near=Math.min(...distances),far=Math.max(...distances),scores=projected.map(point=>point?point.x/width*.7+(far-point.distance)/Math.max(1,far-near)*.3:-Infinity),best=scores.indexOf(Math.max(...scores));
                if(!Number.isFinite(scores[best])){node.hidden=true;line.style.display='none';continue;}
                if(motion.corner==null||!Number.isFinite(scores[motion.corner]))motion.corner=best;
                else if(best!==motion.corner&&scores[best]>scores[motion.corner]+.08){
                    const now=performance.now();if(motion.candidate?.index!==best)motion.candidate={index:best,since:now};
                    else if(now-motion.candidate.since>180){motion.corner=best;motion.candidate=null;motion.transition=true;}
                    if(motion.candidate)animateLabels=true;
                }else motion.candidate=null;
                const edge=projected[motion.corner];if(!edge){node.hidden=true;line.style.display='none';continue;}
                let leader={x:edge.x,y:edge.y};
                if(motion.transition&&motion.leader){leader={x:motion.leader.x+(edge.x-motion.leader.x)*.24,y:motion.leader.y+(edge.y-motion.leader.y)*.24};if(Math.hypot(leader.x-edge.x,leader.y-edge.y)<2)motion.transition=false;else animateLabels=true;}
                motion.leader=leader;node.hidden=false;line.style.display='';
                const labelWidth=node.offsetWidth||100,targetX=Math.max(labelWidth+12,Math.min(width-12,edge.x+labelWidth+24));
                let targetY=Math.max(22,Math.min(height-22,edge.y+(side<0?-18:18)));
                if(side>0&&pair.negative.position&&Math.abs(targetY-pair.negative.position.y)<34)targetY=Math.max(22,Math.min(height-22,pair.negative.position.y+(targetY>=pair.negative.position.y?34:-34)));
                const previous=motion.position,position=previous?{x:previous.x+(targetX-previous.x)*.16,y:previous.y+(targetY-previous.y)*.16}:{x:targetX,y:targetY};motion.position=position;
                if(Math.hypot(targetX-position.x,targetY-position.y)>.3)animateLabels=true;
                node.style.left=`${position.x}px`;node.style.top=`${position.y}px`;node.style.transform='translate(-100%,-50%)';
                line.setAttribute('x1',String(Math.max(0,Math.min(width,leader.x))));line.setAttribute('y1',String(Math.max(0,Math.min(height,leader.y))));line.setAttribute('x2',String(Math.max(0,position.x-node.offsetWidth-5)));line.setAttribute('y2',String(position.y));
            }
            if(animateLabels&&!labelFrame)labelFrame=requestAnimationFrame(()=>{labelFrame=0;draw();});
        }
        function fit() {
            if(!cloudItems.length)return;
            const box=new THREE.Box3();for(const item of cloudItems)box.expandByPoint(new THREE.Vector3(item.position.x,item.position.y,item.position.z));
            const direction=camera.position.clone().sub(cameraTarget||new THREE.Vector3()).normalize();cameraTarget=box.getCenter(new THREE.Vector3()); distance=Math.max(10,box.getSize(new THREE.Vector3()).length()*1.7);camera.position.copy(cameraTarget).add(direction.multiplyScalar(distance));draw();
        }
        function gizmoAxes() {
            const normals=[],seen=new Set();
            for(const item of selection){
                const rotation=new THREE.Euler(item.model.pose.rotation.x*Math.PI/180,item.model.pose.rotation.y*Math.PI/180,item.model.pose.rotation.z*Math.PI/180,'ZYX');
                for(const [index,axis] of (item.model.symmetryAxes||[]).entries()){
                    if(item.chain&&!axis.chains.includes(item.chain.id))continue;const key=`${item.model.id}:${index}`;if(seen.has(key))continue;seen.add(key);
                    const n=new THREE.Vector3(...axis.normal).applyEuler(rotation);if(n.lengthSq()>1e-12)normals.push(n.toArray());
                }
            }
            const z=new THREE.Vector3(...state.averageSymmetryAxes(normals)),rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),z);
            return [['x',new THREE.Vector3(1,0,0).applyQuaternion(rotation),0xf87171],['y',new THREE.Vector3(0,1,0).applyQuaternion(rotation),0x4ade80],['z',z,0x60a5fa]];
        }
        function rotationFit(axis,angle,center){
            const matrix=new THREE.Matrix4().makeRotationAxis(axis,angle),e=matrix.elements,p=center.clone().applyMatrix4(matrix),shift=center.clone().sub(p);
            return {R:[[e[0],e[4],e[8]],[e[1],e[5],e[9]],[e[2],e[6],e[10]]],t:[shift.x,shift.y,shift.z]};
        }
        function applyGizmoRotation(pointer,angle){
            for(const entry of pointer.initial){entry.target.pose.translation={...entry.translation};entry.target.pose.rotation={...entry.rotation};}
            if(pointer.pivotMode==='selection')applyAlignment(selection,rotationFit(pointer.axis,angle,pointer.center));
            else {
                const done=new Set();for(const item of selection){const target=item.chain||item.model;if(done.has(target))continue;done.add(target);
                    const center=item.chain?state.transformModelPoint(item.model,{x:item.chain.centre.x+item.chain.pose.translation.x,y:item.chain.centre.y+item.chain.pose.translation.y,z:item.chain.centre.z+item.chain.pose.translation.z}):{x:item.model.shared.centre.x+item.model.pose.translation.x,y:item.model.shared.centre.y+item.model.pose.translation.y,z:item.model.shared.centre.z+item.model.pose.translation.z};
                    applyAlignment([item],rotationFit(pointer.axis,angle,new THREE.Vector3(center.x,center.y,center.z)));
                }
            }
        }
        function updateGizmo() {
            if(gizmo){scene.remove(gizmo);gizmo.traverse(object=>{object.geometry?.dispose();if(object.material){(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>material.dispose());}});gizmo=null;}
            const points=[];for(const model of state.models)for(const item of state.atoms(model))if(model.visible&&!model.hiddenChains.has(item.chain.id)&&selected(item))points.push(item.position);
            if(!points.length)return;
            const box=new THREE.Box3();for(const p of points)box.expandByPoint(new THREE.Vector3(p.x,p.y,p.z));
            const center=new THREE.Vector3();for(const point of points)center.add(new THREE.Vector3(point.x,point.y,point.z));center.multiplyScalar(1/points.length);const size=box.getSize(new THREE.Vector3()),radius=Math.max(4,Math.max(size.x,size.y,size.z)*.6),axes=gizmoAxes();
            gizmo=new THREE.Group();gizmo.position.copy(center);
            for(const [axis,vector,color] of axes){
                for(const sign of [-1,1]){
                    const direction=vector.clone().multiplyScalar(sign),key=`translation:${axis}:${sign}`,active=hoveredHandle===key||draggedHandle===key,shade=new THREE.Color(color);if(draggedHandle===key)shade.lerp(new THREE.Color(0xffffff),.35);
                    const handle={kind:'translation',axis,sign,vector:direction.clone(),key},shaftLength=radius*.4,shaftRadius=Math.max(radius*.012,.1)*(active?1.5:1);
                    const material=()=>new THREE.MeshBasicMaterial({color:shade,depthTest:false});
                    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius,shaftRadius,shaftLength,8),material());shaft.position.copy(direction).multiplyScalar(radius*.85+shaftLength/2);shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);shaft.userData.handle=handle;shaft.renderOrder=10;gizmo.add(shaft);
                    const cone=new THREE.Mesh(new THREE.ConeGeometry(Math.max(radius*.07,.3)*(active?1.4:1),Math.max(radius*.15,.5),10),material());cone.position.copy(direction).multiplyScalar(radius*1.32);cone.quaternion.copy(shaft.quaternion);cone.userData.handle=handle;cone.renderOrder=10;gizmo.add(cone);
                }
                const key=`rotation:${axis}`,active=hoveredHandle===key||draggedHandle===key,shade=new THREE.Color(color);if(draggedHandle===key)shade.lerp(new THREE.Color(0xffffff),.35);
                const curve=new THREE.EllipseCurve(0,0,radius,radius,0,Math.PI*1.7,false,0),curvePoints=curve.getPoints(64).map(p=>new THREE.Vector3(p.x,p.y,0));
                const path=new THREE.CatmullRomCurve3(curvePoints),ring=new THREE.Mesh(new THREE.TubeGeometry(path,64,Math.max(radius*.01,.08)*(active?1.7:1),6,false),new THREE.MeshBasicMaterial({color:shade,depthTest:false}));
                ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),vector);ring.userData.handle={kind:'rotation',axis,vector:vector.clone(),key};ring.renderOrder=11;gizmo.add(ring);
                const tip=curvePoints[curvePoints.length-1], previous=curvePoints[curvePoints.length-2], tangent=tip.clone().sub(previous).normalize();
                const head=new THREE.Mesh(new THREE.ConeGeometry(Math.max(radius*.055,.3)*(active?1.4:1),Math.max(radius*.18,.7),8),new THREE.MeshBasicMaterial({color:shade,depthTest:false}));
                head.position.copy(tip).applyQuaternion(ring.quaternion);head.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent.applyQuaternion(ring.quaternion));
                head.userData.handle={kind:'rotation',axis,vector:vector.clone(),key};head.renderOrder=11;gizmo.add(head);
            }
            scene.add(gizmo);
        }
        function render() {
            if(!renderer)return;
            if(selectionGlow){scene.remove(selectionGlow);selectionGlow.dispose?.();selectionGlow.geometry.dispose();selectionGlow.material.dispose();selectionGlow=null;}
            if(cloud){scene.remove(cloud);cloud.dispose?.();cloud.geometry.dispose();cloud.material.dispose();cloud=null;}if(bonds){scene.remove(bonds);bonds.dispose?.();bonds.geometry.dispose();bonds.material.dispose();bonds=null;}
            for(const gpu of lipidRenderers){gpu.atomMesh.dispose?.();gpu.stickMesh.dispose?.();gpu.atomGlowMesh.geometry.dispose();gpu.atomGlowMesh.material.dispose();for(const geometries of gpu.variants.values())for(const geometry of geometries)geometry.dispose();}lipidRenderers=[];
            if(membraneGroup){scene.remove(membraneGroup);membraneGroup.traverse(item=>{item.geometry?.dispose();item.material?.dispose();});}
            membraneGroup=new THREE.Group();scene.add(membraneGroup);membraneLabels.replaceChildren();membraneLeaders.replaceChildren();membraneLabelEntries=[];
            for(const model of state.models){
                if(!model.visible)continue;
                const modelRotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(model.pose.rotation.x*Math.PI/180,model.pose.rotation.y*Math.PI/180,model.pose.rotation.z*Math.PI/180,'ZYX'));
                const centre=new THREE.Vector3(model.shared.centre.x,model.shared.centre.y,model.shared.centre.z),translation=new THREE.Vector3(model.pose.translation.x,model.pose.translation.y,model.pose.translation.z);
                const modelTransform=new THREE.Matrix4().makeTranslation(centre.x+translation.x,centre.y+translation.y,centre.z+translation.z).multiply(modelRotation).multiply(new THREE.Matrix4().makeTranslation(-centre.x,-centre.y,-centre.z));
                for(const membrane of model.membranes||[]){
                    if(model.membraneVisible!==false)for(const side of [-1,1]){
                        const mesh=state.membraneMesh(model,membrane,side,32),geometry=new THREE.BufferGeometry();
                        geometry.setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices.flatMap(point=>[point.x,point.y,point.z]),3));geometry.setIndex(mesh.indices);geometry.computeVertexNormals();
                        const material=new THREE.MeshPhongMaterial({color:side<0?0x38bdf8:0x2dd4bf,transparent:true,opacity:.24,side:THREE.DoubleSide,depthWrite:false,shininess:20});
                        const leaflet=new THREE.Mesh(geometry,material);leaflet.renderOrder=1;membraneGroup.add(leaflet);
                    }
                    if(model.lipidsVisible!==false&&membrane.lipids?.length){
                        const molecular=q('[data-style]').value==='balls',dummy=new THREE.Object3D(),basis=new THREE.Matrix4();
                        let lipids,gpu;
                        if(molecular){
                            const radii=Object.fromEntries(Object.entries(atomCovalentRadii).map(([element,radius])=>[element,radius/atomCovalentRadii.C]));
                            gpu=LipidRenderer.create(LIPID_ATOMS,LIPID_BONDS,membrane.lipids.length,radii,renderer);lipidRenderers.push(gpu);
                            const colorMode=q('[data-colour]').value==='element'?'element':'chain';
                            LipidRenderer.colors(gpu,LIPID_ATOMS,LIPID_BONDS,(atom,index)=>new THREE.Color(lipidAtomColor(colorMode,atom,index)));
                            gpu.uniforms.lipidDepth.value=Math.min(1,Math.max(.5,(membrane.halfThickness-1)/20));
                            gpu.uniforms.lipidAtomSize.value=viewerSizes.physics.atom;gpu.uniforms.lipidStickSize.value=viewerSizes.physics.stick;gpu.uniforms.lipidElementSize.value=atomSizeByElement;
                            gpu.atomMesh.count=gpu.stickMesh.count=membrane.lipids.length;membraneGroup.add(gpu.atomMesh,gpu.stickMesh);
                        }else{
                            const geometry=simplifiedLipidGeometry(),colors=geometry.attributes.color,head=new THREE.Color(0x4b5563),tail=new THREE.Color(0x94a3b8);
                            for(let i=0;i<colors.count;i++){const c=i<geometry.userData.headVertexCount?head:tail;colors.setXYZ(i,c.r,c.g,c.b);}colors.needsUpdate=true;
                            lipids=new THREE.InstancedMesh(geometry,new THREE.MeshPhongMaterial({vertexColors:true,shininess:6,specular:0x080a0d}),membrane.lipids.length);lipids.frustumCulled=false;membraneGroup.add(lipids);
                        }
                        membrane.lipids.forEach((particle,index)=>{
                            const point=membranePlatePoint(membrane,particle.x,particle.y,particle.side),axes=lipidMoleculeAxes(membrane,particle.x,particle.y,particle.side);
                            basis.makeBasis(new THREE.Vector3(...axes.tangent),new THREE.Vector3(...axes.bitangent),new THREE.Vector3(...axes.inward));dummy.position.set(...point);dummy.quaternion.setFromRotationMatrix(basis);
                            if(molecular){dummy.scale.set(1,1,1);dummy.updateMatrix();const matrix=modelTransform.clone().multiply(dummy.matrix);gpu.atomMesh.setMatrixAt(index,matrix);gpu.stickMesh.setMatrixAt(index,matrix);gpu.params.setXYZ(index,0,particle.angle||0,0);}
                            else{dummy.rotateZ(particle.angle||0);dummy.scale.set(1,1,Math.min(1,Math.max(.5,(membrane.halfThickness-1)/20)));dummy.updateMatrix();lipids.setMatrixAt(index,modelTransform.clone().multiply(dummy.matrix));}
                        });
                        if(molecular){gpu.atomMesh.instanceMatrix.needsUpdate=true;gpu.stickMesh.instanceMatrix.needsUpdate=true;gpu.params.needsUpdate=true;}else lipids.instanceMatrix.needsUpdate=true;
                    }
                    if(model.membraneLabelsVisible!==false&&(model.membraneVisible!==false||model.lipidsVisible!==false))for(const side of [-1,1]){
                        const node=document.createElement('span');node.className='edit-membrane-label';node.textContent=(side<0?membrane.labels?.negative:membrane.labels?.positive)||(side<0?'Side 1':'Side 2');membraneLabels.append(node);const line=document.createElementNS('http://www.w3.org/2000/svg','line');membraneLeaders.append(line);membraneLabelEntries.push({model,membrane,side,node,line});
                    }
                }
            }
            cloudItems=[];const positions=[],colours=[];let chainIndex=0;
            state.models.forEach((model,mi)=>{if(!model.visible)return;const sourceColors=model.homologyGeneration===modelBuildGeneration?buildProteinChainColors():null;const chainColours=new Map(model.shared.chains.map(chain=>[chain,sourceColors?.get(chain.id)||palette[chainIndex++%palette.length]]));
                for(const item of state.atoms(model)){if(model.hiddenChains.has(item.chain.id)||!item.chain.visible)continue;
                    if(q('[data-style]').value==='backbone' && !['CA','P',"C4'",'C4*'].includes(item.atom.atomName))continue;
                    cloudItems.push(item);positions.push(item.position.x,item.position.y,item.position.z);
                    let color=q('[data-colour]').value==='element'?(elementColours[item.atom.element]||0x94a3b8):q('[data-colour]').value==='model'?palette[mi%palette.length]:chainColours.get(item.chain);
                    const shade=1-(1-(item.atom.occlusionFactor??1))*physicsMaterialSettings.occlusion;
                    const c=new THREE.Color(color).multiplyScalar(shade);colours.push(c.r,c.g,c.b);
                }});
            if(cloudItems.length){
                const atomStyle=q('[data-style]').value==='balls',impostors=MolecularImpostors.supported(renderer),colour=new THREE.Color();
                cloud=impostors?MolecularImpostors.create(cloudItems.length,atomStyle?.34:.85,false,{shininess:atomStyle?6:50}):new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshPhongMaterial({shininess:atomStyle?6:50,specular:0x080a0d}),cloudItems.length);
                const matrix=new THREE.Matrix4();
                for(let i=0;i<cloudItems.length;i++){
                    const item=cloudItems[i],p=item.position,r=atomStyle?.34*viewerSizes.physics.atom*elementAtomScale(item.atom.element):.85*viewerSizes.physics.residue;
                    if(impostors)cloud.setPositionAt(i,p.x,p.y,p.z,r);else{matrix.makeScale(r,r,r);matrix.setPosition(p.x,p.y,p.z);cloud.setMatrixAt(i,matrix);}
                    colour.setRGB(colours[i*3],colours[i*3+1],colours[i*3+2]);cloud.setColorAt(i,colour);
                }
                cloud.instanceMatrix.needsUpdate=true;if(cloud.instanceColor)cloud.instanceColor.needsUpdate=true;scene.add(cloud);
                const selectedIndices=glowVisible?cloudItems.flatMap((item,index)=>selected(item)?[index]:[]):[];
                if(selectedIndices.length){
                    const light=document.body.classList.contains('light-mode');
                    selectionGlow=impostors?MolecularImpostors.create(selectedIndices.length,1,false,{glow:true,color:0xffe85a,opacity:.56}):new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshBasicMaterial({color:0xffe85a,transparent:true,opacity:.45,depthWrite:false,blending:light?THREE.NormalBlending:THREE.AdditiveBlending}),selectedIndices.length);
                    if(light)selectionGlow.material.blending=THREE.NormalBlending;selectionGlow.renderOrder=15;
                    selectedIndices.forEach((index,i)=>{const item=cloudItems[index],p=item.position,r=atomStyle?.40*viewerSizes.physics.atom*elementAtomScale(item.atom.element)*1.24:.85*viewerSizes.physics.residue*1.24;if(impostors)selectionGlow.setPositionAt(i,p.x,p.y,p.z,r);else{matrix.makeScale(r,r,r);matrix.setPosition(p.x,p.y,p.z);selectionGlow.setMatrixAt(i,matrix);}});
                    selectionGlow.instanceMatrix.needsUpdate=true;scene.add(selectionGlow);
                }
                const pairs=[],grid=new Map(),cellSize=2.2;
                if(atomStyle)for(let i=0;i<cloudItems.length;i++){
                    const p=cloudItems[i].position,cell=[Math.floor(p.x/cellSize),Math.floor(p.y/cellSize),Math.floor(p.z/cellSize)];
                    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const j of grid.get(`${cell[0]+dx},${cell[1]+dy},${cell[2]+dz}`)||[]){const a=cloudItems[j],b=cloudItems[i];if(a.model!==b.model||a.chain!==b.chain)continue;const d=Math.hypot(p.x-a.position.x,p.y-a.position.y,p.z-a.position.z);if(d>.4&&d<1.9)pairs.push([j,i]);}
                    const key=cell.join(',');if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
                }
                if(pairs.length){
                    bonds=impostors?MolecularImpostors.create(pairs.length,1,true,{shininess:6}):new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,6),new THREE.MeshPhongMaterial({shininess:6,specular:0x080a0d}),pairs.length);
                    const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),first=new THREE.Color(),second=new THREE.Color();
                    pairs.forEach(([i,j],index)=>{const a=new THREE.Vector3(...positions.slice(i*3,i*3+3)),b=new THREE.Vector3(...positions.slice(j*3,j*3+3)),radius=.07*viewerSizes.physics.stick;
                        if(impostors)bonds.setBondAt(index,a,b,radius);else{const direction=b.clone().sub(a),length=direction.length();dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,direction.normalize());dummy.scale.set(radius,length,radius);dummy.updateMatrix();bonds.setMatrixAt(index,dummy.matrix);}
                        first.setRGB(...colours.slice(i*3,i*3+3));second.setRGB(...colours.slice(j*3,j*3+3));bonds.setColorAt(index,first.lerp(second,.5));
                    });bonds.instanceMatrix.needsUpdate=true;if(bonds.instanceColor)bonds.instanceColor.needsUpdate=true;scene.add(bonds);
                }
            }
            updateGizmo();draw();
        }
        function pick(event) {
            if(!cloud)return;const rect=renderer.domElement.getBoundingClientRect(),mouse=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();
            ray.params.Points.threshold=Math.max(.7,distance/300);ray.setFromCamera(mouse,camera);const hit=ray.intersectObject(cloud)[0];if(!hit){if(!event.shiftKey)selection=[];}else{const item=cloudItems[hit.instanceId],chain=q('[data-mode]').value==='model'?null:item.chain;if(!event.shiftKey)selection=[];if(!selection.some(s=>s.model===item.model&&s.chain===chain))selection.push({model:item.model,chain});}
            updateFields();render();
        }
        function visibility() {
            const box=q('[data-visibility]');box.replaceChildren();
            const makeButton=(label,visible,color,handler)=>{const button=document.createElement('button');button.type='button';button.className='edit-visibility-toggle';button.setAttribute('aria-pressed',String(visible));button.title=`${visible?'Hide':'Show'} ${label}`;const dot=document.createElement('span');dot.className='edit-visibility-dot';dot.style.backgroundColor=color;const icon=document.createElement('i');icon.className=`fa-solid ${visible?'fa-eye':'fa-eye-slash'}`;icon.setAttribute('aria-hidden','true');button.append(dot,document.createTextNode(label),icon);button.addEventListener('click',handler);return button;};
            const structures=document.createElement('div');structures.className='edit-visibility-row';const structureLabel=document.createElement('span');structureLabel.className='edit-visibility-label';structureLabel.textContent='Structure toggles:';structures.append(structureLabel);
            state.models.forEach((model,index)=>{
                structures.append(makeButton(model.name,model.visible,`#${palette[index%palette.length].toString(16).padStart(6,'0')}`,()=>{model.visible=!model.visible;visibility();render();}));
                if(model.membranes?.length){
                    structures.append(makeButton(`${model.name}: Membrane planes`,model.membraneVisible!==false,'#2dd4bf',()=>{model.membraneVisible=model.membraneVisible===false;visibility();render();}));
                    structures.append(makeButton(`${model.name}: Membrane lipids`,model.lipidsVisible!==false,'#94a3b8',()=>{model.lipidsVisible=model.lipidsVisible===false;visibility();render();}));
                    structures.append(makeButton(`${model.name}: Membrane labels`,model.membraneLabelsVisible!==false,'#7dd3fc',()=>{model.membraneLabelsVisible=model.membraneLabelsVisible===false;visibility();render();}));
                }
            });box.append(structures);
            const chains=document.createElement('div');chains.className='edit-visibility-row';const chainLabel=document.createElement('span');chainLabel.className='edit-visibility-label';chainLabel.textContent='Chain toggles:';chains.append(chainLabel);let index=0;
            const water=[];
            for(const model of state.models)for(const chain of model.shared.chains){
                if(['HOH','WAT','H2O','DOD'].includes(String(chain.atoms[0]?.resName||'').toUpperCase())){water.push({model,chain});continue;}
                const visible=!model.hiddenChains.has(chain.id),color=`#${palette[index++%palette.length].toString(16).padStart(6,'0')}`;chains.append(makeButton(`${model.name}: ${chain.id}`,visible,color,()=>{if(visible)model.hiddenChains.add(chain.id);else model.hiddenChains.delete(chain.id);visibility();render();}));
            }
            if(water.length){const visible=water.some(({model,chain})=>!model.hiddenChains.has(chain.id));chains.append(makeButton('Water',visible,'#7dd3fc',()=>{for(const {model,chain} of water)if(visible)model.hiddenChains.add(chain.id);else model.hiddenChains.delete(chain.id);visibility();render();}));}
            for(const visible of [true,false]){const button=document.createElement('button');button.type='button';button.className='edit-visibility-all';button.textContent=visible?'Show all':'Hide all';button.addEventListener('click',()=>{for(const model of state.models)for(const chain of model.shared.chains)if(visible)model.hiddenChains.delete(chain.id);else model.hiddenChains.add(chain.id);visibility();render();});chains.append(button);}box.append(chains);
        }
        function sequences() {
            const box=q('[data-sequence-content]');box.replaceChildren();const codes={ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLN:'Q',GLU:'E',GLY:'G',HIS:'H',ILE:'I',LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',THR:'T',TRP:'W',TYR:'Y',VAL:'V',A:'A',C:'C',G:'G',U:'U',DA:'A',DC:'C',DG:'G',DT:'T'};
            for(const model of state.models)for(const chain of model.shared.chains){const seen=new Set(),seq=[];for(const atom of chain.atoms){const key=`${atom.resSeq}:${atom.insertionCode||''}`;if(!seen.has(key)){seen.add(key);if(codes[atom.resName])seq.push(codes[atom.resName]);}}if(seq.length){const p=document.createElement('p');p.textContent=`${model.name} · ${chain.id}: ${seq.join('')}`;box.append(p);}}
        }
        const alignmentGroups = [null,null];
        function updateAlignmentGroups() {
            alignmentGroups.forEach((group,index)=>{q(`[data-group-assignment="${index+1}"]`).textContent=group?.length?group.map(item=>item.chain?`${item.model.name} (chain ${item.chain.id})`:`${item.model.name} (whole model)`).join(', '):'Not set';});
        }
        function groupChains(group) {
            const chains = {}, codes={ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLN:'Q',GLU:'E',GLY:'G',HIS:'H',ILE:'I',LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',THR:'T',TRP:'W',TYR:'Y',VAL:'V',A:'A',C:'C',G:'G',U:'U',DA:'A',DC:'C',DG:'G',DT:'T',DU:'U'};
            for(const model of state.models){
                const chosen=group.filter(item=>item.model===model);if(!chosen.length)continue;
                const byChain=new Map();
                for(const item of state.atoms(model)){
                    if(!chosen.some(entry=>!entry.chain||entry.chain===item.chain))continue;
                    const atom=item.atom, key=`${atom.resSeq}:${atom.insertionCode||''}`, name=String(atom.resName||'').toUpperCase(), code=codes[name];
                    if(!code)continue;const nucleotide=/^(?:[ACGU]|D[ACGTU])$/.test(name), wanted=nucleotide?['P',"C4'",'C4*']:['CA'];
                    if(!wanted.includes(atom.atomName))continue;
                    if(!byChain.has(item.chain))byChain.set(item.chain,new Map());const residues=byChain.get(item.chain);
                    if(!residues.has(key)||atom.atomName==='P')residues.set(key,{...item.position,resName:name,singleChar:code,resSeq:atom.resSeq,entityType:nucleotide?'nucleotide':'protein',sourceAtoms:[]});
                }
                for(const [chain,residues] of byChain)if(residues.size)chains[`${model.id}:${chain.id}`]=[...residues.values()];
            }
            return chains;
        }
        function applyAlignment(group, fit) {
            const fitMatrix=new THREE.Matrix4().set(fit.R[0][0],fit.R[0][1],fit.R[0][2],0,fit.R[1][0],fit.R[1][1],fit.R[1][2],0,fit.R[2][0],fit.R[2][1],fit.R[2][2],0,0,0,0,1);
            const rotationMatrix=pose=>new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pose.rotation.x*Math.PI/180,pose.rotation.y*Math.PI/180,pose.rotation.z*Math.PI/180,'ZYX'));
            const vec=value=>new THREE.Vector3(value.x,value.y,value.z), done=new Set();
            for(const item of group){const target=item.chain||item.model;if(done.has(target))continue;done.add(target);const model=item.model, parent=item.chain?rotationMatrix(model.pose):new THREE.Matrix4();
                const before=rotationMatrix(target.pose),worldBefore=parent.clone().multiply(before),worldAfter=fitMatrix.clone().multiply(worldBefore),localAfter=parent.clone().invert().multiply(worldAfter);
                const euler=new THREE.Euler().setFromRotationMatrix(localAfter,'ZYX');target.pose.rotation={x:euler.x*180/Math.PI,y:euler.y*180/Math.PI,z:euler.z*180/Math.PI};
                let origin;if(item.chain){origin=vec(item.chain.centre).add(vec(item.chain.pose.translation)).sub(vec(model.shared.centre)).applyMatrix4(parent).add(vec(model.shared.centre)).add(vec(model.pose.translation));}
                else origin=vec(model.shared.centre).add(vec(model.pose.translation));
                const moved=origin.clone().applyMatrix4(fitMatrix).add(new THREE.Vector3(...fit.t)),shift=moved.sub(origin);if(item.chain)shift.applyMatrix4(parent.clone().invert());target.pose.translation.x+=shift.x;target.pose.translation.y+=shift.y;target.pose.translation.z+=shift.z;
            }
        }
        for(const button of panel.querySelectorAll('[data-group]'))button.addEventListener('click',()=>{
            const index=Number(button.dataset.group)-1;if(!selection.length){q('[data-align-status]').textContent='Select at least one chain or model first.';return;}
            alignmentGroups[index]=selection.map(item=>({...item}));updateAlignmentGroups();q('[data-align-status]').textContent=`Group ${index+1} set (${selection.length} selected ${selection.length===1?'item':'items'}).`;
        });
        q('[data-align]').addEventListener('click',()=>{
            const [moving,fixed]=alignmentGroups,out=q('[data-align-status]');
            if(!fixed||!moving){out.textContent='Set both groups first.';return;}
            if(!state.groupsCanMoveIndependently(fixed,moving)){out.textContent='Cannot align: the groups overlap or contain linked copies of the same chain. Choose groups that can move independently.';return;}
            out.textContent='Aligning Group 1 onto Group 2…';alignmentBusy=true;updateFields();
            requestAnimationFrame(()=>setTimeout(()=>{try{const a=groupChains(fixed),b=groupChains(moving);if(!Object.keys(a).length||!Object.keys(b).length)throw new Error('Both groups need protein or nucleotide backbone atoms.');const fit=window.alignEditModelsDrafts(a,b);applyAlignment(moving,fit);updateFields();render();out.textContent=`Aligned ${fit.numEquiv} residues; TM-score ${fit.tmScore.toFixed(3)}, RMSD ${fit.rmsd.toFixed(2)} Å.`;}catch(error){out.textContent=`Alignment failed: ${error.message}`;}finally{alignmentBusy=false;updateFields();}},0));
        });
        q('[data-fetch-form]').addEventListener('submit', async event => {
            event.preventDefault();
            const ids = [...new Set(q('[data-pdb-ids]').value.trim().toUpperCase().split(/[\s,;]+/).filter(Boolean))];
            if (!ids.length || ids.some(id => !/^[A-Z0-9]{4}$/.test(id))) { status('Enter one or more four-character PDB IDs, separated by spaces or commas.'); return; }
            const button=q('[data-fetch]'); button.disabled=true; const loaded=[], failed=[];
            status(`Fetching ${ids.join(', ')}…`);
            try {
                for (const id of ids) {
                    try {
                        const response=await fetch(`https://files.rcsb.org/download/${id}.cif`);
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        const atoms=window.parseEditModelsStructure(await response.text(),'mmcif');
                        const model=state.addModel(id,atoms);state.detectSymmetry(model,hornQuaternionSuperposition); loaded.push(id);
                    } catch(error) { failed.push(`${id} (${error.message})`); }
                }
                visibility(); sequences(); render(); if (loaded.length) fit();
                status([loaded.length?`Loaded ${loaded.join(', ')}.`:'',failed.length?`Could not load ${failed.join(', ')}.`:''].filter(Boolean).join(' '));
            } finally { button.disabled=false; }
        });
        q('[data-upload]').addEventListener('click',()=>q('[data-files]').click());
        q('[data-files]').addEventListener('change',async event=>{for(const file of event.target.files){try{const format=/\.(cif|mmcif)$/i.test(file.name)?'mmcif':'pdb',text=await file.text();const atoms=window.parseEditModelsStructure(text,format),membranes=format==='mmcif'?window.EditModelsState.parseMembranes(text):[];const model=state.addModel(file.name,atoms,membranes);state.detectSymmetry(model,hornQuaternionSuperposition);status(`Loaded ${file.name}.`);}catch(error){status(`Could not load ${file.name}: ${error.message}`);}}event.target.value='';visibility();sequences();render();fit();});
        q('[data-duplicate]').addEventListener('click',()=>{if(!selection.length||selection.some(item=>item.model!==selection[0].model))return;const source=selection[0].model, chains=selection.some(item=>!item.chain)?source.shared.chains:selection.map(item=>item.chain);const model=state.duplicateModel(source,chains);selection=[{model,chain:null}];visibility();sequences();updateFields();render();fit();});
        function deleteSelection(){
            if(!selection.length||alignmentBusy)return;
            state.deleteSelection(selection);selection=[];
            for(let i=0;i<alignmentGroups.length;i++)if(alignmentGroups[i]?.some(item=>!state.models.includes(item.model)||(item.chain&&!item.model.shared.chains.includes(item.chain))))alignmentGroups[i]=null;
            updateAlignmentGroups();visibility();sequences();updateFields();render();status('Selection deleted.');
        }
        q('[data-delete]').addEventListener('click',deleteSelection);
        document.addEventListener('keydown',event=>{
            const target=event.target;
            if(event.key!=='Delete'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||viewer.hidden||!selection.length||document.querySelector('dialog[open]')||target?.isContentEditable||target?.closest?.('input, textarea, select, [contenteditable]'))return;
            event.preventDefault();deleteSelection();
        });
        q('[data-sequences]').addEventListener('click',()=>{const box=q('[data-sequence-content]');box.hidden=!box.hidden;if(!box.hidden)sequences();});
        for(const name of ['style','colour'])q(`[data-${name}]`).addEventListener('change',render);
        q('[data-mode]').addEventListener('change',()=>{selection=[];updateFields();render();});
        const downloadButton=q('[data-download]'),downloadMenu=q('#editDownloadMenu');
        function closeDownload(){downloadMenu.hidden=true;downloadButton.setAttribute('aria-expanded','false');}
        downloadButton.addEventListener('click',()=>{downloadMenu.hidden=!downloadMenu.hidden;downloadButton.setAttribute('aria-expanded',String(!downloadMenu.hidden));});
        document.addEventListener('click',event=>{if(!downloadMenu.contains(event.target)&&!downloadButton.contains(event.target))closeDownload();});
        document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!downloadMenu.hidden){closeDownload();downloadButton.focus();}});
        downloadMenu.addEventListener('click',async event=>{
            const button=event.target.closest('[data-format]');if(!button)return;
            const format=button.dataset.format,selectionOnly=q('[data-selection-only]').checked,visibleOnly=q('[data-visible-only]').checked;closeDownload();
            if(format==='session'){document.getElementById('sessionDownload').click();return;}
            try{
                if(selectionOnly&&!selection.length)throw new Error('Select a model or chain first.');
                let data,type;
                if(format==='cif'||format==='mvsj'){const options={selection:selectionOnly?selected:null,visibleOnly};data=format==='cif'?state.exportCif(options):state.exportMolViewSpec(options);type=format==='cif'?'chemical/x-mmcif':'application/json';}
                else {
                    const chains=[],vdw={H:1.2,D:1.2,C:1.7,N:1.55,O:1.52,S:1.8,P:1.8,SE:1.9};let chainIndex=0;
                    for(const model of state.models){if(visibleOnly&&!model.visible)continue;const groups=new Map();for(const item of state.atoms(model)){
                        if((selectionOnly&&!selected(item))||(visibleOnly&&(model.hiddenChains.has(item.chain.id)||!item.chain.visible)))continue;
                        if(!groups.has(item.chain))groups.set(item.chain,[]);
                        const color=new THREE.Color(palette[chainIndex%palette.length]);groups.get(item.chain).push({...item.position,nodeIndex:0,r:(vdw[item.atom.element]||1.7)+1.4,c:[color.r,color.g,color.b]});
                    }for(const atoms of groups.values()){chains.push(atoms);chainIndex++;}}
                    status(`Preparing .${format} surface…`);data=await window.exportEditModelsSurface(chains,format);type=format==='glb'?'model/gltf-binary':format==='stl'?'model/stl':'text/plain';
                }
                const url=URL.createObjectURL(new Blob([data],{type})),link=document.createElement('a');link.href=url;link.download=`edited-model.${format}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status(`Downloaded ${link.download}.`);
            }catch(error){status(`Download failed: ${error.message}`);}
        });
        window.editModelsSessionSnapshot=()=>({models:state.models,nextId:state.nextId,firstSnapshot});
        window.restoreEditModelsSession=data=>{
            if(!data){state.models=[];state.nextId=1;firstSnapshot=false;}else{if(!Array.isArray(data.models)||!Number.isInteger(data.nextId))throw new Error('Invalid model editor session data.');state.models=data.models;state.nextId=data.nextId;firstSnapshot=!!data.firstSnapshot;}
            selection=[];alignmentGroups[0]=alignmentGroups[1]=null;updateAlignmentGroups();visibility();sequences();updateFields();render();
        };
        updateFields();
        return {panel,viewer,show(){try{
            init();
            if(!firstSnapshot){
                const atoms=window.getEditModelsSnapshot();if(atoms.length){const source=window.getEditModelsMembraneSnapshot(),model=state.addModel('Homology model',atoms,source.membranes,source.planesVisible);model.lipidsVisible=source.lipidsVisible;model.membraneLabelsVisible=source.labelsVisible;model.homologyGeneration=source.generation;const symmetry=window.getEditModelsSymmetrySnapshot();model.symmetryAxes=symmetry.generation===source.generation&&symmetry.axes.length?symmetry.axes:state.detectSymmetry(model,hornQuaternionSuperposition);firstSnapshot=true;visibility();sequences();render();fit();}
            } else {
                const model=state.models.find(item=>item.homologyGeneration!==undefined);
                if(model&&!model.symmetryAxes?.length){const symmetry=window.getEditModelsSymmetrySnapshot();if(symmetry.generation===model.homologyGeneration&&symmetry.axes.length)model.symmetryAxes=symmetry.axes;}
                if(model&&(!model.membranes?.length||model.membranes.some(membrane=>!membrane.lipids))){const source=window.getEditModelsMembraneSnapshot();if(model.homologyGeneration===source.generation&&source.membranes.length){model.membranes=source.membranes;model.membraneVisible=source.planesVisible;model.lipidsVisible=source.lipidsVisible;model.membraneLabelsVisible=source.labelsVisible;visibility();}}
            }
            render();requestAnimationFrame(draw);
        }catch(error){status(`Editor unavailable: ${error.message}`);}}};
    };
})();
