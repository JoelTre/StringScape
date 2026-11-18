(() => {
    'use strict';
    window.createMobilePhysicsSheet=({main,layer,burger,viewer,content,heading,chatInput})=>{
        const narrow=window.matchMedia('(max-width: 768px)');
        const handle=document.createElement('div');handle.className='mobile-sheet-handle';handle.setAttribute('aria-hidden','true');layer.append(handle);
        let page=1,height=0,expanded=false,drag=null,viewerPointer=null;
        const minimum=88,gap=56;
        function active(){return narrow.matches&&page===3;}
        function bounds(){
            const rect=main.getBoundingClientRect(),viewport=window.visualViewport;
            const visibleTop=Math.max(rect.top,viewport?.offsetTop||0);
            const visibleBottom=Math.min(rect.bottom,viewport?(viewport.offsetTop+viewport.height):window.innerHeight);
            const bottom=Math.max(0,rect.bottom-visibleBottom);
            return {min:Math.min(minimum,Math.max(0,visibleBottom-visibleTop-gap)),max:Math.max(0,visibleBottom-visibleTop-gap),bottom};
        }
        function applyHeight(value,resetScroll=false){
            if(!active())return;
            const limit=bounds();height=Math.max(limit.min,Math.min(limit.max,value));
            expanded=height>limit.min+8;
            layer.style.setProperty('--mobile-sheet-height',`${height}px`);
            layer.style.setProperty('--mobile-sheet-bottom',`${limit.bottom}px`);
            main.classList.toggle('mobile-sheet-expanded',expanded);
            heading.setAttribute('aria-expanded',String(expanded));
            if(resetScroll)content.scrollTop=0;
        }
        function expand(){if(active())applyHeight(bounds().max,true);}
        function collapse(){if(active())applyHeight(bounds().min,true);}
        function syncViewport(){
            if(!active())return;
            const focused=document.activeElement===chatInput;
            applyHeight(focused?bounds().max:(expanded?height:bounds().min));
            if(focused)requestAnimationFrame(()=>{
                if(!active()||document.activeElement!==chatInput)return;
                const input=chatInput.getBoundingClientRect(),box=content.getBoundingClientRect();
                const visibleBottom=Math.min(box.bottom,window.visualViewport?window.visualViewport.offsetTop+window.visualViewport.height:window.innerHeight);
                if(input.bottom>visibleBottom-12)content.scrollTop+=input.bottom-visibleBottom+12;
            });
        }
        function syncLayout(){
            if(narrow.matches){if(burger.parentNode!==main)main.append(burger);}
            else if(burger.parentNode!==layer)layer.prepend(burger);
            if(active()){
                heading.setAttribute('role','button');heading.setAttribute('tabindex','0');
                if(!height)collapse();else syncViewport();
            }else{
                heading.removeAttribute('role');heading.removeAttribute('tabindex');heading.removeAttribute('aria-expanded');
                layer.style.removeProperty('--mobile-sheet-height');layer.style.removeProperty('--mobile-sheet-bottom');
                main.classList.remove('mobile-sheet-expanded','mobile-sheet-dragging');drag=null;
            }
        }
        function startDrag(event){
            if(!active()||main.classList.contains('menu-open')||(event.pointerType==='mouse'&&event.button!==0))return;
            drag={id:event.pointerId,startY:event.clientY,startHeight:height,moved:false,target:event.currentTarget};
            event.currentTarget.setPointerCapture?.(event.pointerId);
        }
        function moveDrag(event){
            if(!drag||event.pointerId!==drag.id)return;
            const delta=drag.startY-event.clientY;
            if(Math.abs(delta)>4)drag.moved=true;
            if(drag.moved){main.classList.add('mobile-sheet-dragging');applyHeight(drag.startHeight+delta);event.preventDefault();}
        }
        function endDrag(event){
            if(!drag||event.pointerId!==drag.id)return;
            const moved=drag.moved;drag=null;main.classList.remove('mobile-sheet-dragging');
            if(!moved&&!expanded)expand();
            if(moved&&!expanded)collapse();
        }
        for(const target of [heading,handle]){
            target.addEventListener('pointerdown',startDrag);
            target.addEventListener('pointermove',moveDrag);
            target.addEventListener('pointerup',endDrag);
            target.addEventListener('pointercancel',()=>{drag=null;main.classList.remove('mobile-sheet-dragging');});
        }
        heading.addEventListener('keydown',event=>{if(active()&&(event.key==='Enter'||event.key===' ')){event.preventDefault();if(!expanded)expand();else collapse();}});
        chatInput.addEventListener('focus',()=>{if(active()){expand();syncViewport();}});
        window.addEventListener('resize',syncLayout);
        window.visualViewport?.addEventListener('resize',syncViewport);
        window.visualViewport?.addEventListener('scroll',syncViewport);
        viewer.addEventListener('pointerdown',event=>{
            if(!active()||!expanded||main.classList.contains('menu-open')||event.target.closest('button,input,select,textarea,a,#physicsViewerKey,#physicsSelectionInfo'))return;
            viewerPointer={id:event.pointerId,x:event.clientX,y:event.clientY};
        },true);
        viewer.addEventListener('pointerup',event=>{
            if(!viewerPointer||viewerPointer.id!==event.pointerId)return;
            const tapped=Math.hypot(event.clientX-viewerPointer.x,event.clientY-viewerPointer.y)<6;viewerPointer=null;
            if(active()&&expanded&&tapped){event.preventDefault();event.stopPropagation();chatInput.blur();collapse();}
        },true);
        viewer.addEventListener('pointercancel',()=>{viewerPointer=null;},true);
        narrow.addEventListener?.('change',syncLayout);
        return {setPage(number){const entering=page!==3&&number===3;page=number;if(entering){height=0;expanded=false;}syncLayout();},expand,collapse};
    };
})();
