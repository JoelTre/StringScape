(() => {
    const outputs=[['local','Local structure confidence'],['p2','Placement confidence (2 Å)'],['p5','Placement confidence (5 Å)'],['model','Model confidence']];
    const config={
        alpha:{label:'AlphaFold-backed gap',rule:'Used before simulation for an unaligned internal or terminal gap with an AlphaFold atom and all required inputs. pLDDT must be 0–100, whole-chain PAE non-negative, and anchor count positive; otherwise the four scores are unavailable.', inputs:[
            ['p','p = cap(pLDDT / 100, 1)'],['n','n = ln(1 + cap(nearest anchor distance, 1000) / 100)'],['g','g = ln(1 + cap(gap length, 1500) / 100)'],['w','w = cap(mean residue PAE, 40) / 10'],['o','o = cap(mean residue → anchor PAE, 40) / 10'],['i','i = cap(mean anchor → residue PAE, 40) / 10'],['c','c = cap(clash score, 1)'],['a','a = cap(anchor count, 500) / 100'],['I','I = 1 for an internal gap, else 0'],['N','N = 1 for an N-terminal gap, else 0'],['C','C = 1 for a C-terminal gap, else 0']
        ], equations:[
            ['local','Local = cap(0.26307 + 0.74748p + 0.06646n − 0.02966g − 0.00023I − 0.00756N + 0.00779C + 0.01023w − 0.01794o − 0.08322i − 0.14674c − 0.00608a, 1)',['p','n','g','I','N','C','w','o','i','c','a']],
            ['z','z = −0.34459 + 3.16581p − 0.01946n − 0.00001g + 0.05690I − 0.23824N + 0.18134C + 0.24264w − 1.39938o − 2.48512i + 0.11038c + 0.57810a',['p','n','g','I','N','C','w','o','i','c','a']],
            ['p2','P₂ = σ(z)',['z']],['p5','P₅ = σ(z + 1.96074)',['z']],
            ['q','q = σ(−0.85142 + 4.69579p + 0.75707n + 0.20472g + 0.11413I − 0.42183N + 0.30770C + 0.03904w − 0.95667o − 0.95048i − 0.72048c + 0.10585a)',['p','n','g','I','N','C','w','o','i','c','a']],
            ['model','Model = P₅ × q',['p5','q']]
        ]},
        sequence:{label:'Sequence-only gap',rule:'Used before simulation for an unaligned internal or terminal gap represented by a sequence-only residue. The fit requires nearest-anchor distance, gap length, clash score, anchor count and alignment identity; internal gaps also require an anchor reach ratio. The anchor count must be positive.',inputs:[
            ['n','n = ln(1 + cap(nearest anchor distance, 1000))'],['g','g = ln(1 + cap(gap length, 1500))'],['r','r = cap(anchor reach ratio, 3) for internal gaps; otherwise 0'],['c','c = cap(clash score, 1)'],['a','a = ln(1 + cap(anchor count, 500))'],['u','u = cap(alignment identity (%), 100) / 100'],['I','I = 1 for an internal gap, else 0'],['N','N = 1 for an N-terminal gap, else 0'],['C','C = 1 for a C-terminal gap, else 0']
        ],equations:[
            ['local','Local = cap(0.604288 − 0.043393n − 0.001441g + 0.028163I − 0.008102N − 0.020061C + 0.153677r + 0.007329c − 0.013970a − 0.248128u, 1)',['n','g','I','N','C','r','c','a','u']],
            ['z5','z₅ = 1.213341 − 2.456795n + 0.069026g + 0.050973I + 0.255179N − 0.306152C + 1.602254r + 0.265441c + 0.041333a − 0.397577u',['n','g','I','N','C','r','c','a','u']],
            ['z2','z₂ = −0.233438 − 0.411834n − 0.402603g − 0.378421I − 0.446297N + 0.824718C + 1.848414r + 0.090025c − 0.134862a + 0.124280u',['n','g','I','N','C','r','c','a','u']],
            ['zj','zⱼ = 1.944474 − 0.737669n − 1.477569g + 0.810076I − 0.551773N − 0.258303C + 0.759341r − 0.043717c − 0.313608a − 0.030093u',['n','g','I','N','C','r','c','a','u']],
            ['p5','P₅ = σ(z₅)',['z5']],['p2','P₂ = P₅ × σ(z₂)',['p5','z2']],['model','Model = P₅ × σ(zⱼ)',['p5','zj']]
        ]},
        locked:{label:'Reference-locked residue',rule:'A protein residue with a reference lock uses this convention, rather than either gap fit. Only immediate same-block protein neighbours are considered. Aligned residues that are not locked do not automatically receive these values.',inputs:[
            ['self','S = 1 if the residue is aligned to a similar (non-identical) amino acid; else 0'],['neighbourSimilar','T = number of immediate same-chain neighbours aligned to a similar (non-identical) amino acid'],['neighbourMissing','U = number of immediate same-chain neighbours that are unaligned']
        ],equations:[
            ['penalty','penalty = 0.05S + 0.05T + 0.10U',['self','neighbourSimilar','neighbourMissing']],['score','Score = round(100 × (1 − penalty)) / 100',['penalty']],['local','Local = Score',['score']],['p2','P₂ = 1',[]],['p5','P₅ = 1',[]],['model','Model = P₅ × Score',['p5','score']]
        ]}
    };
    window.createConfidenceVisual=(multiReference=false)=>{
        const root=document.createElement('div');root.className='how-step-visual how-confidence';
        const intro=document.createElement('p');intro.textContent='Select the residue source to follow the actual inputs, equations, intermediate values and outputs. Lines show which values feed each calculation.';
        const controls=document.createElement('div');controls.className='how-confidence-tabs';controls.setAttribute('role','group');controls.setAttribute('aria-label','Residue source');
        const rule=document.createElement('p');rule.className='how-confidence-rule';
        const viewport=document.createElement('div');viewport.className='how-confidence-viewport';
        const graph=document.createElement('div');graph.className='how-confidence-graph';viewport.append(graph);
        const note=document.createElement('p');note.className='how-confidence-note';note.textContent='cap(x, m) = max(0, min(m, x)); σ(x) = 1 / (1 + e⁻ˣ). PAE is predicted aligned error. Anchor reach ratio compares the distance between flanking anchors with the approximate available backbone length. These are exploratory estimates, not experimentally measured accuracy. After simulation, unaligned gap-fit scores are unavailable in the current calculation. Non-protein residues and other unsupported or incomplete cases are unscored. Combined models can transfer confidence from drafts.';
        root.append(intro,controls,rule,viewport,note);
        if(multiReference){const combined=document.createElement('p');combined.className='how-confidence-rule';combined.textContent='Combined residue score (for each output) = Σ(wᵢ × available draft scoreᵢ) / Σwᵢ, with wᵢ = max(0, reference weightᵢ). Only draft origins with a finite value for that output participate. If their weights sum to zero, use their unweighted mean; if none are available, the result is unavailable. The rules above describe each contributing draft.';root.append(combined);}
        let current='alpha', drawFrame=0, graphObserver=null;const buttons=[];
        function render(){
            if(graphObserver){graphObserver.disconnect();graphObserver=null;}if(drawFrame){cancelAnimationFrame(drawFrame);drawFrame=0;}
            const c=config[current];buttons.forEach(({button,key})=>button.setAttribute('aria-pressed',String(key===current)));rule.textContent=c.rule;graph.replaceChildren();
            const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('how-confidence-lines');svg.setAttribute('aria-hidden','true');graph.append(svg);
            const columns=['Inputs and derived variables','Equations','Outputs'].map(text=>{const col=document.createElement('section');col.className='how-confidence-column';const title=document.createElement('h4');title.textContent=text;col.append(title);graph.append(col);return col;});
            const inputNodes=new Map(),equationNodes=new Map(),outNodes=new Map();
            function node(col,key,text,kind){const el=document.createElement('div');el.className='how-confidence-node '+kind;el.dataset.key=key;el.textContent=text;col.append(el);return el;}
            c.inputs.forEach(([key,text])=>inputNodes.set(key,node(columns[0],key,text,'how-confidence-input')));
            c.equations.forEach(([key,text])=>equationNodes.set(key,node(columns[1],key,text,'how-confidence-equation')));
            outputs.forEach(([key,text])=>outNodes.set(key,node(columns[2],key,text,'how-confidence-output')));
            function draw(){drawFrame=0;if(!graph.isConnected||!graph.getClientRects().length)return;const bounds=graph.getBoundingClientRect();svg.setAttribute('width',String(graph.scrollWidth));svg.setAttribute('height',String(graph.scrollHeight));svg.setAttribute('viewBox',`0 0 ${graph.scrollWidth} ${graph.scrollHeight}`);svg.replaceChildren();
                const connect=(from,to,internal=false)=>{if(!from||!to)return;const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();let x1=a.right-bounds.left,y1=a.top+a.height/2-bounds.top,x2=b.left-bounds.left,y2=b.top+b.height/2-bounds.top;const path=document.createElementNS('http://www.w3.org/2000/svg','path');if(internal){x1=a.right-bounds.left;x2=b.right-bounds.left;const x=Math.max(x1,x2)+18;path.setAttribute('d',`M${x1} ${y1} C${x} ${y1}, ${x} ${y2}, ${x2} ${y2}`);}else{const x=(x1+x2)/2;path.setAttribute('d',`M${x1} ${y1} C${x} ${y1}, ${x} ${y2}, ${x2} ${y2}`);}svg.append(path);};
                c.equations.forEach(([key,,deps])=>{const target=equationNodes.get(key);deps.forEach(dep=>connect(inputNodes.get(dep)||equationNodes.get(dep),target,equationNodes.has(dep)));});outputs.forEach(([key])=>connect(equationNodes.get(key),outNodes.get(key)));
            }
            function schedule(){if(!drawFrame)drawFrame=requestAnimationFrame(draw);}schedule();
            if(typeof ResizeObserver!=='undefined'){graphObserver=new ResizeObserver(()=>{if(!graph.isConnected){graphObserver?.disconnect();graphObserver=null;return;}schedule();});graphObserver.observe(graph);columns.forEach(col=>graphObserver.observe(col));}
        }
        for(const key of Object.keys(config)){const button=document.createElement('button');button.type='button';button.textContent=config[key].label;button.addEventListener('click',()=>{current=key;render();});controls.append(button);buttons.push({button,key});}
        render();return root;
    };
})();
