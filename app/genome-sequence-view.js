/* One continuously scrollable, virtualised gene-to-protein alignment. */
(function () {
    'use strict';
    const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
    const iconButton=(icon,text)=>{const b=el('button');b.type='button';const i=el('i');i.className=`fa-solid ${icon}`;i.setAttribute('aria-hidden','true');b.append(i,document.createTextNode(' '+text));return b;};
    let worker,nextId=0;const pending=new Map(),cache=new WeakMap();
    function compute(gene,dna,protein) {
        if(!cache.has(gene))cache.set(gene,new Map());
        const models=cache.get(gene),key=protein||'';if(models.has(key))return models.get(key);
        const promise=new Promise((resolve,reject)=>{
            if(!worker){
                worker=new Worker('genome-sequence-worker.js');
                worker.onmessage=({data})=>{const job=pending.get(data.id);if(!job)return;pending.delete(data.id);data.error?job.reject(Error(data.error)):job.resolve(data.model);};
                worker.onerror=()=>{for(const p of pending.values())p.reject(Error('Sequence analysis failed.'));pending.clear();worker.terminate();worker=null;};
            }
            const id=++nextId;pending.set(id,{resolve,reject});worker.postMessage({id,gene,dna,protein});
        });models.set(key,promise);promise.catch(()=>models.delete(key));return promise;
    }
    function copyButton(label,text) {
        const b=iconButton('fa-copy',label);b.className='genome-copy-button';
        b.onclick=async()=>{try{await navigator.clipboard.writeText(text);b.setAttribute('aria-label',`${label} copied`);b.lastChild.textContent=' Copied';setTimeout(()=>{b.lastChild.textContent=' '+label;b.removeAttribute('aria-label');},1500);}catch{b.lastChild.textContent=' Copy unavailable';}};return b;
    }
    let codonTooltip, codonTimer;
    function hideCodonTooltip(){clearTimeout(codonTimer);if(codonTooltip)codonTooltip.hidden=true;}
    function showCodonTooltip(target,gene,model){
        if(!target.isConnected)return;
        if(!codonTooltip){codonTooltip=el('div',null,'genome-gene-tooltip genome-codon-tooltip');codonTooltip.setAttribute('role','tooltip');document.body.append(codonTooltip);}
        const index=target.dataset.codon==null?null:Number(target.dataset.codon),codon=index==null?null:model.codons[index];
        codonTooltip.replaceChildren(el('div',codon?'Codon '+(index+1):target.classList.contains('genome-base-intron')?'Intron':'Sequence segment','genome-tooltip-gene'));
        const grid=el('dl',null,'genome-tooltip-grid'),entries=[['Gene',gene.name]];
        if(codon){
            entries.push(['Genomic positions',codon.positions.map(p=>p.toLocaleString()).join(' — ')],['DNA codon',codon.dna],['mRNA codon',codon.dna.replace(/T/g,'U')],['Predicted amino acid',codon.aa]);
            const exons=codon.positions.map(pos=>(model.exonRanges||[]).findIndex(e=>pos>=e.start&&pos<=e.end));
            const unique=[...new Set(exons.filter(i=>i>=0))];
            entries.push(['Splicing',unique.length>1?'Exon-junction codon: bases from '+unique.map(i=>'exon '+(i+1)).join(' and ')+' join after the intervening intron is removed.':model.hasIntrons?'Within exon '+(unique[0]+1)+'; no splice junction within this codon.':'No introns in this annotated transcript.']);
        }else entries.push(['Details',target.mappingDescription||'STRING-only amino acid; no corresponding genomic codon.']);
        for(const [name,value] of entries)grid.append(el('dt',name),el('dd',value));codonTooltip.append(grid);codonTooltip.hidden=false;
        const rect=target.getBoundingClientRect(),box=codonTooltip.getBoundingClientRect();
        const right=rect.right+14,left=rect.left-box.width-14;
        codonTooltip.style.left=Math.max(12,Math.min(innerWidth-box.width-12,right+box.width<=innerWidth-12?right:left))+'px';codonTooltip.style.top=Math.max(12,Math.min(innerHeight-box.height-12,rect.top))+'px';
    }
    function mappingTracks(host,gene,model,proteinName) {
        const layout=GenomeSequence.mappingLayout(gene,model),baseWidth=9,labelWidth=190,blockSize=60;
        const viewport=el('div',null,'genome-full-mapping');viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label',`${gene.name} full gene to protein mapping; scroll horizontally`);
        const plane=el('div',null,'genome-mapping-plane');plane.style.width=`${labelWidth+layout.slots.length*baseWidth}px`;viewport.append(plane);host.append(viewport);
        const rows=[['Genomic coordinate','coordinate'],[gene.name+' · DNA','dna'],[model.hasIntrons?'RNA · pre-mRNA':'RNA','rna'],['mRNA · spliced','mrna'],['Predicted · '+(model.product||proteinName),'predicted'],['STRING protein · '+proteinName,'app-protein']];
        const layers=new Map();
        for(const [label,type] of rows){
            const row=el('div',null,'genome-mapping-row '+(type==='coordinate'?'genome-mapping-ruler':'')),name=el('div',null,'genome-mapping-label'),text=el('span',label);
            name.title=label;name.append(text);const cells=el('div',null,'genome-mapping-cells');row.dataset.sequenceType=type;row.append(name,cells);plane.append(row);layers.set(type,cells);
        }
        const nav=el('div',null,'genome-sequence-pagination'),previous=iconButton('fa-chevron-left','Previous'),next=iconButton('fa-chevron-right','Next'),status=el('span');
        previous.setAttribute('aria-label','Previous mapping block');next.setAttribute('aria-label','Next mapping block');nav.append(previous,status,next);host.append(nav);
        const exons=model.exonRanges||[],exonSearch=exons.map((e,index)=>({...e,index})).sort((a,b)=>a.start-b.start);
        const membership=pos=>{let lo=0,hi=exonSearch.length-1;while(lo<=hi){const mid=(lo+hi)>>1,e=exonSearch[mid];if(pos<e.start)hi=mid-1;else if(pos>e.end)lo=mid+1;else return e.index;}return -1;};
        function baseClass(i) {
            const pos=GenomeSequence.coordinate(gene,i),exon=membership(pos);
            if(pos<model.transcriptStart||pos>model.transcriptEnd)return 'genome-base-outside';
            if(exon<0)return 'genome-base-intron';
            return layout.baseCodons[i]<0?'genome-base-utr':`genome-base-exon-${exon%2}`;
        }
        // Five structural bars share the mapping's fills; the outline tracks its visible columns.
        const overview=el('div',null,'genome-mapping-overview'),overviewLabels=el('div',null,'genome-overview-labels'),overviewPlot=el('div',null,'genome-overview-plot'),canvas=el('canvas'),windowBox=el('div',null,'genome-overview-window');
        for(const name of ['DNA','RNA','mRNA','Predicted','STRING'])overviewLabels.append(el('div',name));
        canvas.width=1200;canvas.height=110;canvas.setAttribute('aria-hidden','true');overviewPlot.append(canvas,windowBox);overview.append(overviewLabels,overviewPlot);host.insertBefore(overview,viewport);
        overviewPlot.tabIndex=0;overviewPlot.setAttribute('role','slider');overviewPlot.setAttribute('aria-label','Visible mapping region; drag or use arrow keys to move');overviewPlot.setAttribute('aria-valuemin','1');overviewPlot.setAttribute('aria-valuemax',String(Math.max(1,layout.slots.length)));overviewPlot.setAttribute('aria-orientation','horizontal');
        const ctx=canvas.getContext('2d'),colors=new Map();
        function fillColor(cls,row){const key=cls+':'+row;if(!colors.has(key)){const sample=el('span',null,'genome-mapping-cell '+cls);sample.dataset.sequenceType=['dna','rna','mrna','predicted','app-protein'][row];sample.style.visibility='hidden';host.append(sample);const fill=getComputedStyle(sample).backgroundColor,numbers=fill.match(/[\d.]+/g)?.map(Number);const light=document.body.dataset.appMode==='light'||document.body.classList.contains('light-mode');if(numbers?.length>=3){const rgb=numbers.slice(0,3).map(v=>Math.round(light?v*.9:v+(255-v)*.12));colors.set(key,`rgba(${rgb.join(',')},${numbers[3]??1})`);}else colors.set(key,fill);sample.remove();}return colors.get(key);}
        const overviewSteps=Math.min(1200,layout.slots.length),overviewSamples=Array.from({length:overviewSteps+1},(_,sample)=>{const col=Math.floor(sample*layout.slots.length/Math.max(1,overviewSteps)),i=layout.slots[col];return {col,i,base:i>=0?baseClass(i):'genome-residue-difference',codon:i>=0?layout.baseCodons[i]:-1};});
        function paintOverview(){
            colors.clear();ctx.clearRect(0,0,canvas.width,canvas.height);const total=Math.max(1,layout.slots.length),scale=canvas.width/total;
            function run(row,start,end,cls){if(end<=start)return;ctx.fillStyle=fillColor(cls,row);ctx.fillRect(start*scale,row*22+4,Math.max(.6,(end-start)*scale),14);}
            for(let row=0;row<5;row++){
                ctx.save();ctx.beginPath();ctx.roundRect(0,row*22+4,canvas.width,14,4);ctx.clip();
                let start=0,prior;
                for(const {col,i,base,codon} of overviewSamples){
                    let cls=row<3?base:codon>=0?'genome-amino-cell'+(row===4?' genome-string-fill':''):base==='genome-base-intron'?base:'genome-base-outside';
                    if(i<0&&col<total)cls='genome-residue-difference';
                    if(col===total||cls!==prior){if(col)run(row,start,col,prior);start=col;prior=cls;}
                }
                for(const residue of layout.residues)if(row>=3&&residue.difference)run(row,Math.max(0,residue.center-1),Math.min(total,residue.center+2),'genome-residue-difference');
                ctx.restore();
            }
        }
        function syncOverview(){
            const total=Math.max(1,layout.slots.length),visible=Math.min(total,Math.max(0,viewport.clientWidth-labelWidth)/baseWidth),start=Math.min(Math.max(0,total-visible),viewport.scrollLeft/baseWidth);
            windowBox.style.left=(start/total*100)+'%';windowBox.style.width=(visible/total*100)+'%';overviewPlot.setAttribute('aria-valuenow',String(Math.floor(start)+1));overviewPlot.setAttribute('aria-valuetext',`Columns ${Math.floor(start)+1}–${Math.min(total,Math.ceil(start+visible))} of ${total}`);
        }
        let dragOffset=null;
        function moveOverview(event){const rect=overviewPlot.getBoundingClientRect(),total=layout.slots.length,visible=Math.max(0,viewport.clientWidth-labelWidth)/baseWidth;const column=(event.clientX-rect.left)/rect.width*total-(dragOffset??visible/2);viewport.scrollLeft=Math.max(0,column*baseWidth);syncOverview();}
        overviewPlot.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();const box=windowBox.getBoundingClientRect();dragOffset=event.target===windowBox?(event.clientX-box.left)/overviewPlot.clientWidth*layout.slots.length:null;overviewPlot.setPointerCapture(event.pointerId);moveOverview(event);});
        overviewPlot.addEventListener('pointermove',event=>{if(overviewPlot.hasPointerCapture(event.pointerId))moveOverview(event);});
        overviewPlot.addEventListener('pointerup',event=>{if(overviewPlot.hasPointerCapture(event.pointerId))overviewPlot.releasePointerCapture(event.pointerId);dragOffset=null;});
        overviewPlot.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();viewport.scrollLeft=event.key==='Home'?0:event.key==='End'?viewport.scrollWidth:viewport.scrollLeft+(event.key==='ArrowLeft'?-1:1)*blockSize*baseWidth;syncOverview();}});
        paintOverview();
        const themeObserver=new MutationObserver(()=>{if(!overview.isConnected){themeObserver.disconnect();return;}paintOverview();});themeObserver.observe(document.body,{attributes:true,attributeFilter:['data-app-mode','class']});
        function cell(type,start,width,text,cls='',title='',codon=null) {
            const node=el('span',null,'genome-mapping-cell '+cls);
            if(['dna','rna','mrna','predicted','app-protein'].includes(type)&&!cls.includes('genome-unmapped-note'))for(const char of text){const letter=el('span',char,'genome-sequence-letter');letter.dataset.symbol=char;letter.dataset.alphabet=['predicted','app-protein'].includes(type)?'protein':'nucleotide';node.append(letter);}else node.textContent=text;node.style.left=`${start*baseWidth}px`;node.style.width=`${width*baseWidth}px`;node.dataset.sequenceType=type;
            if(title)node.mappingDescription=title;if(codon!=null){node.dataset.codon=codon;node.dataset.mappingKey='codon-'+codon;}layers.get(type).append(node);return node;
        }
        function render() {
            if(!viewport.isConnected)return;
            const first=Math.max(0,Math.floor(viewport.scrollLeft/baseWidth)-3),last=Math.min(layout.slots.length,Math.ceil((viewport.scrollLeft+viewport.clientWidth-labelWidth)/baseWidth)+6);
            for(const layer of layers.values())layer.replaceChildren();
            // Include the immediately preceding base so triplet boxes survive scroll boundaries.
            let start=first;
            if(start&&layout.slots[start]>=0){const p=layout.baseCodons[layout.slots[start]];while(start>0&&p>=0&&layout.slots[start-1]>=0&&layout.baseCodons[layout.slots[start-1]]===p)start--;}
            for(let column=start;column<last;){
                const i=layout.slots[column];
                if(i<0){column++;continue;}
                const codon=layout.baseCodons[i],cls=baseClass(i);let count=1;
                while(count<3&&column+count<layout.slots.length&&layout.slots[column+count]===i+count&&layout.baseCodons[i+count]===codon&&baseClass(i+count)===cls)count++;
                const positions=Array.from({length:count},(_,j)=>GenomeSequence.coordinate(gene,i+j)),diff=layout.differences.has(codon),extra=cls+(diff?' genome-residue-difference':'');
                const title=`Genomic ${positions.join(' — ')}${codon>=0?' · codon '+(codon+1):cls==='genome-base-intron'?' · intron':' · untranslated / noncoding'}`;
                const dna=model.geneDNA.slice(i,i+count),rna=(model.rnaProjection||model.preRNA).slice(i,i+count),mrna=positions.map((p,j)=>membership(p)>=0&&p>=model.transcriptStart&&p<=model.transcriptEnd?rna[j]:'·').join('');
                cell('dna',column,count,dna,extra,title,codon>=0?codon:null);
                cell('rna',column,count,rna,extra,title,codon>=0?codon:null);
                cell('mrna',column,count,mrna,extra,title,codon>=0?codon:null);
                column+=count;
            }
            const rulerStart=Math.floor(first/30)*30;
            for(let column=rulerStart;column<last;column+=30){const i=layout.slots[column];if(i>=0)cell('coordinate',column,10,GenomeSequence.coordinate(gene,i).toLocaleString(),'genome-mapping-tick');}
            for(const residue of layout.residues){
                if(residue.center<first-2||residue.center>last+2)continue;
                const codon=residue.p==null?null:model.codons[residue.p],observed=residue.q==null?'—':model.observed[residue.q];
                const cls='genome-amino-cell'+(residue.difference?' genome-residue-difference':'')+(residue.junction?' genome-junction-codon':'');
                const title=codon?`Codon ${residue.p+1} · genomic ${codon.positions.join(' — ')} · ${codon.dna} → ${codon.aa}${residue.q!=null?' · STRING residue '+(residue.q+1)+' '+observed:''}`:'STRING-only amino acid; no corresponding genomic codon';
                for(const [type,text] of [['predicted',codon?.aa||'—'],['app-protein',layout.aligned?observed:'·']]){
                    const node=cell(type,residue.center-1,3,text,cls,title,residue.p);if(residue.p==null)node.dataset.mappingKey='insertion-'+residue.q;
                }
                if(residue.p==null)for(const type of ['dna','rna','mrna'])cell(type,residue.insertionStart,3,'———','genome-residue-difference',title).dataset.mappingKey='insertion-'+residue.q;
            }
            if(!model.codons.length)cell('predicted',first,40,'No annotated CDS','genome-unmapped-note');
            if(!layout.aligned)cell('app-protein',first,55,model.observed?'Unaligned STRING sequence below':'STRING sequence unavailable','genome-unmapped-note');
            syncOverview();
            const leading=Math.floor(viewport.scrollLeft/baseWidth),max=Math.max(0,viewport.scrollWidth-viewport.clientWidth);
            previous.disabled=viewport.scrollLeft<1;next.disabled=viewport.scrollLeft>=max-1;
            status.textContent=`Block ${Math.floor(leading/blockSize)+1} · columns ${leading+1}–${Math.min(layout.slots.length,Math.ceil((viewport.scrollLeft+viewport.clientWidth-labelWidth)/baseWidth))} of ${layout.slots.length.toLocaleString()}`;
        }
        function jump(direction) {
            const block=Math.floor((viewport.scrollLeft+.1)/(blockSize*baseWidth));
            viewport.scrollTo({left:Math.max(0,(block+direction)*blockSize*baseWidth),behavior:'instant'});
        }
        previous.onclick=()=>jump(-1);next.onclick=()=>jump(1);
        let frame;viewport.addEventListener('scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(render);},{passive:true});
        const resize=new ResizeObserver(()=>{if(!viewport.isConnected){resize.disconnect();return;}render();});resize.observe(viewport);render();
        const clearGlow=()=>viewport.querySelectorAll('.genome-codon-glow').forEach(n=>n.classList.remove('genome-codon-glow'));
        viewport.addEventListener('pointerover',event=>{const target=event.target.closest('.genome-mapping-cell:not(.genome-mapping-tick):not(.genome-unmapped-note)');if(!target||target.contains(event.relatedTarget))return;clearTimeout(codonTimer);clearGlow();if(target.dataset.mappingKey)viewport.querySelectorAll('[data-mapping-key]').forEach(n=>n.classList.toggle('genome-codon-glow',n.dataset.mappingKey===target.dataset.mappingKey));if(codonTooltip&&!codonTooltip.hidden)showCodonTooltip(target,gene,model);else codonTimer=setTimeout(()=>showCodonTooltip(target,gene,model),180);});
        viewport.addEventListener('pointerout',event=>{const target=event.target.closest('.genome-mapping-cell');if(target?.contains(event.relatedTarget))return;clearTimeout(codonTimer);codonTimer=setTimeout(hideCodonTooltip,120);clearGlow();});
        viewport.addEventListener('scroll',()=>{hideCodonTooltip();clearGlow();},{passive:true});
        viewport.addEventListener('pointerleave',()=>{hideCodonTooltip();clearGlow();});
    }
    function mount(card,chromosome,gene,protein) {
        const host=el('div',null,'genome-sequence-diagram');card.append(host);
        const dna=GenomeSequence.extract(chromosome,gene);
        if(!dna){host.append(el('p','Genomic sequence unavailable. Upload the matching genomic FASTA to display RNA and codon mapping.','genome-sequence-notice'));return;}
        host.append(el('p','Matching annotated transcripts to the STRING protein…','genome-sequence-loading'));
        return compute(gene,dna,protein?.sequence||'').then(model=>{
            if(!host.isConnected)return;host.replaceChildren();
            const actions=el('div',null,'genome-sequence-actions');actions.append(copyButton('Gene sequence',model.geneDNA));
            if(model.splicedRNA)actions.append(copyButton('mRNA sequence',model.splicedRNA));
            const copiedProtein=model.observed||GenomeSequence.cleanProtein(model.predicted);if(copiedProtein)actions.append(copyButton('Protein Sequence',copiedProtein));host.append(actions);
            const choiceText={exact:'Annotated transcript matches the STRING protein exactly.',closest:'Closest annotated transcript selected by protein alignment; differences are shown below.',limited:'Sequences cannot be aligned automatically; the STRING sequence is shown separately.',unavailable:'No annotated CDS available for protein mapping.','no-app-protein':'STRING protein sequence unavailable; showing the annotated prediction.'};
            host.append(el('p',`${model.id||'No annotated transcript'}${model.proteinId?' · '+model.proteinId:''} · ${choiceText[model.choice]||'Transcript annotation unavailable.'}`,'genome-sequence-match'));
            if(model.alternatives?.length>1){const details=el('details',null,'genome-isoform-details');details.append(el('summary',`Compared ${model.alternatives.length} annotated transcript candidates`));for(const t of model.alternatives)details.append(el('p',`${t.id}${t.proteinId?' · '+t.proteinId:''}: ${t.differences==null?'comparison unavailable':t.differences+' amino-acid differences'}`));host.append(details);}
            for(const warning of model.warnings||[])host.append(el('p',warning.replace(/\bapp protein\b/gi,'STRING protein'),'genome-sequence-notice'));
            const mapping=el('section',null,'genome-mapping-stage'),heading=el('h3'),arrow=el('i');arrow.className='fa-solid fa-arrow-right';arrow.setAttribute('aria-hidden','true');heading.append(document.createTextNode('Gene '),arrow,document.createTextNode(' protein mapping'));mapping.append(heading);
            const notes=[`5′ → 3′ coding-strand orientation · ${gene.strand==='-'?'negative strand (reverse complement); genomic coordinates descend.':'positive strand; genomic coordinates ascend.'}`];
            if(model.splicedRNA)notes.push(`${model.hasIntrons?'Introns removed':'mRNA length'} · ${model.splicedRNA.length.toLocaleString()} nt${model.annotatedExons?' including annotated untranslated regions.':'; exon/UTR boundaries were not explicitly annotated.'}`);
            if(model.codons?.length)notes.push(`Translation table ${model.tableId}: ${model.tableName}.`);
            mapping.append(el('p',notes.join(' '),'genome-mapping-notes'));
            const diff=model.comparison?.differences;
            mapping.append(el('p',diff==null?'Predicted translation shown where CDS annotation is available.':diff===0?'Predicted and STRING protein sequences match.':`${diff.toLocaleString()} amino-acid difference(s) · substitutions and insertions/deletions highlighted in coral.`,'genome-sequence-match'));
            host.append(mapping);mappingTracks(mapping,gene,model,protein?.name||model.product||gene.name);
            if(model.observed&&(!model.codons?.length||model.comparison?.limited)){mapping.append(el('h4','STRING protein · '+(protein?.name||gene.name)),el('pre',model.observed,'genome-protein-raw'));}
        }).catch(error=>{if(host.isConnected)host.replaceChildren(el('p',error.message,'genome-sequence-notice'));});
    }
    window.GenomeSequenceView={mount};
})();
