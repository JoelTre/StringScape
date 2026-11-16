'use strict';
const plotIds=['plot','removed-plot','rmsd-plot','confidence-rmsd','confidence-removed-rmsd','missing-rmsd','removed-rmsd','kept-rmsd','torsion-plot','lddt-plot'];
const colourOptions=[['id','PDB ID'],['usedAlphaFold','Used AlphaFold'],['removed','Count of removed residues'],['removedPercent','Percentage of removed residues'],['missing','Count of missing residues'],['missingPercent','Percentage of missing residues'],['density','Density']];
const scoreAxes=['Model confidence','Local structure confidence','Placement confidence (2 Å)','Placement confidence (5 Å)','AlphaFold PAE (Å)'];
const scorePlotIds=['plot','removed-plot','confidence-rmsd','confidence-removed-rmsd','torsion-plot','lddt-plot'];
const plotControls={};let imageEntries=[],imageUrls=[],imageRevision=0,activeFilteredSummary=null;
for(const id of plotIds){
    const canvas=document.getElementById(id),card=canvas.closest('.card'),heading=card.querySelector('h2'),bar=document.createElement('div');bar.className='plot-heading';heading.before(bar);bar.append(heading);
    const controls=document.createElement('div');controls.className='plot-controls';
    if(['plot','removed-plot','torsion-plot','lddt-plot'].includes(id)){const label=document.createElement('label');label.textContent='Points';const select=document.createElement('select');select.id=id==='plot'?'plot-granularity':`${id}-granularity`;for(const [value,text] of [['residue','Per residue'],['pdb','Per PDB ID'],['xmean','Per x-axis value mean']])select.add(new Option(text,value));label.append(select);controls.append(label);select.addEventListener('change',redrawBenchmarkPlots);}
    if(id==='missing-rmsd'||id==='removed-rmsd'||id==='kept-rmsd'){const label=document.createElement('label');label.textContent='X-axis';const select=document.createElement('select');select.id=`${id}-measure`;for(const [value,text] of [['percent','Percentage'],['count','Count']])select.add(new Option(text,value));label.append(select);controls.append(label);select.addEventListener('change',redrawBenchmarkPlots);}
    let axis=null;if(scorePlotIds.includes(id)){const label=document.createElement('label');label.textContent='X-axis';axis=document.createElement('select');axis.setAttribute('aria-label',`X-axis for ${heading.textContent}`);for(const name of scoreAxes)axis.add(new Option(name,name));label.append(axis);controls.append(label);axis.addEventListener('change',redrawBenchmarkPlots);}
    const label=document.createElement('label');label.textContent='Colour by';const select=document.createElement('select');select.setAttribute('aria-label',`Colour ${heading.textContent} by`);for(const [value,text] of colourOptions)select.add(new Option(text,value));label.append(select);controls.append(label);select.addEventListener('change',redrawBenchmarkPlots);const disorderLabel=document.createElement('label');disorderLabel.className='disorder-toggle';const disorder=document.createElement('input');disorder.type='checkbox';disorder.setAttribute('aria-label',`Exclude disordered residues from ${heading.textContent}`);disorderLabel.append(disorder,document.createTextNode('Exclude disordered residues'));controls.append(disorderLabel);disorder.addEventListener('change',redrawBenchmarkPlots);bar.append(controls);
    const disorderNote=document.createElement('p');disorderNote.className='muted disorder-note';disorderNote.hidden=true;disorderNote.textContent='Only residues marked non-disordered are included; unknown annotations are excluded. Model-level confidence, RMSD, and kept/removed counts and percentages are recalculated from eligible reference residue rows. Original reference missing-residue values remain unchanged.';
    let legend=card.querySelector('.legend');if(!legend){legend=document.createElement('div');legend.className='legend';canvas.after(legend);}legend.after(disorderNote);plotControls[id]={select,legend,disorder,disorderNote,axis,heading};
}
function benchmarkColourMetadata(summary){const result=new Map();for(const row of summary){const id=normalisePdbId(row['PDB ID']);if(!id)continue;const existing=result.get(id);if(existing&&benchmarkNumber(row['Overall RMSD (Å)'])===null)continue;result.set(id,row);}return result;}
function colourForPoints(points,mode,summary){
    if(mode==='density'){
        const counts=benchmarkPointDensity(points),min=counts.length?counts.reduce((a,b)=>Math.min(a,b),Infinity):0,max=counts.length?counts.reduce((a,b)=>Math.max(a,b),-Infinity):0;
        return {points:points.map((p,i)=>{const t=max===min?0:(Math.log1p(counts[i])-Math.log1p(min))/(Math.log1p(max)-Math.log1p(min));const red=Math.round(110+145*Math.min(1,t*2)),green=Math.round(220*Math.max(0,(t-.5)*2));return {...p,color:`rgb(${red}, ${green}, 0)`};}),type:'density',min,max};
    }
    const meta=benchmarkColourMetadata(summary),ids=[...new Set(summary.map(row=>normalisePdbId(row['PDB ID'])).concat(points.map(p=>normalisePdbId(p.id))).filter(Boolean))];
    if(mode==='id')return {points:points.map(p=>({...p,color:benchmarkColours[ids.indexOf(normalisePdbId(p.id))%benchmarkColours.length]})),type:'id'};
    if(mode==='usedAlphaFold'){const sources=new Map();for(const row of loadedResults?.residues||[]){const id=normalisePdbId(row['PDB ID']),source=String(row['Input source']||'').trim().toLowerCase();if(!id||!['alphafold','uniprot sequence'].includes(source))continue;if(!sources.has(id))sources.set(id,new Set());sources.get(id).add(source);}const categories=new Map([['AlphaFold only','#4097e1'],['UniProt only','#f8b23e'],['Both','#bd8bfa'],['Unknown','#8192a1']]);const category=id=>{const known=sources.get(normalisePdbId(id));return !known?'Unknown':known.size>1?'Both':known.has('alphafold')?'AlphaFold only':'UniProt only';};return {points:points.map(p=>({...p,color:categories.get(category(p.id))})),type:'category',categories:[...new Set(points.map(p=>category(p.id)))].map(name=>[name,categories.get(name)])};}
    const keys={removed:'Residues removed',removedPercent:'Residues removed (%)',missing:'Missing residues (known subtotal)',missingPercent:'Missing residues (%)'},percentage=mode.endsWith('Percent');
    const get=id=>{const row=meta.get(normalisePdbId(id)),v=row?.[keys[mode]];const n=percentage?benchmarkPercentage(v):benchmarkNumber(v);return n!==null&&n>=0&&(!percentage||n<=100)?n:null;};
    const values=points.map(p=>get(p.id)).filter(Number.isFinite),min=values.length?values.reduce((a,b)=>Math.min(a,b),Infinity):null,max=values.length?values.reduce((a,b)=>Math.max(a,b),-Infinity):null;
    const color=v=>{if(v===null)return '#8192a1';const t=max===min?.5:(v-min)/(max-min),lo=[64,151,225],hi=[248,178,62];return `rgb(${lo.map((v,i)=>Math.round(v+(hi[i]-v)*t)).join(',')})`;};
    return {points:points.map(p=>({...p,color:color(get(p.id))})),type:'scale',min,max,missing:points.some(p=>get(p.id)===null),label:colourOptions.find(([v])=>v===mode)?.[1]||''};
}
function benchmarkEquation({quadratic,linear,constant}){const format=value=>Number(value.toPrecision(4)).toString();const signed=(value,term)=>`${value<0?'−':'+'} ${format(Math.abs(value))}${term}`;return `y = ${format(quadratic)}x² ${signed(linear,'x')} ${signed(constant,'')}`;}
function setColourLegend(legend,coloured,trend=false){legend.replaceChildren();const add=(text,color)=>{const s=document.createElement('span');s.textContent=text;if(color)s.style.color=color;legend.append(s);};
    if(coloured.type==='density'){add(`Low: ${coloured.min} neighbours`);const ramp=document.createElement('span');ramp.className='density-gradient';ramp.setAttribute('aria-label','Density colour gradient from dark red to bright yellow');legend.append(ramp);add(`High: ${coloured.max} neighbours`);add('Neighbours lie within 5% of the axis ranges; colours use a logarithmic scale.');}
    else if(coloured.type==='mean')add('● Mean Y per x-axis value','#168273');
    else if(coloured.type==='id'){for(const [id,color] of new Map(coloured.points.map(point=>[point.id,point.color])))add(`● ${id}`,color);}
    else if(coloured.type==='category'){for(const [name,color] of coloured.categories)add(`● ${name}`,color);}
    else if(coloured.min!==null){add(`● ${coloured.label}: ${coloured.min.toFixed(1)}`,'#4097e1');add(`● ${coloured.max.toFixed(1)}`,'#f8b23e');}else add(`${coloured.label}: unavailable`,'#8192a1');
    if(coloured.missing)add('● Unavailable','#8192a1');if(trend){const fit=benchmarkQuadratic(coloured.points);add(fit?`⋯ Quadratic trend: ${benchmarkEquation(fit.coefficients)}`:'Quadratic trend unavailable (three distinct x values required)',benchmarkPlotColours().emphasis);}
}
function setPlotLegend(id,coloured,trend=false){setColourLegend(plotControls[id].legend,coloured,trend);}
function scatter(id,points,options){const aggregated=options.xMean,mode=plotControls[id].select.value;plotControls[id].select.title=aggregated?'PDB-based colours are unavailable for combined x-axis means; choose Density to colour by point concentration.':'';const coloured=aggregated&&mode!=='density'?{points:points.map(p=>({...p,color:'#168273'})),type:'mean'}:colourForPoints(points,mode,(plotControls[id].disorder.checked?activeFilteredSummary:loadedResults?.summary)||[]);benchmarkScatter(document.getElementById(id),coloured.points,options);setPlotLegend(id,coloured,Boolean(options.trend));}
function validScore(x,key){return x!==null&&x>=0&&(key==='AlphaFold PAE (Å)'||x<=1);}
function axisKey(id){return plotControls[id].axis.value;}
function validResiduePoints(rows,id){const key=axisKey(id);return rows.map(row=>({id:row['PDB ID'],x:benchmarkNumber(row[key]),y:benchmarkNumber(row['Reference-to-predicted distance'])})).filter(p=>p.id&&validScore(p.x,key)&&p.y!==null&&p.y>=0);}
function scoreScatter(id,points,options){const key=axisKey(id);scatter(id,points,{...options,xLabel:(options.mean?'Mean ':'')+key,xMax:key==='AlphaFold PAE (Å)'?points.reduce((m,p)=>Math.max(m,p.x),1)*1.05:1});}
function meanPdbPoints(points){const groups=new Map();for(const p of points){const key=normalisePdbId(p.id);if(!groups.has(key))groups.set(key,{id:p.id,x:0,y:0,n:0});const g=groups.get(key);g.x+=p.x;g.y+=p.y;g.n++;}return [...groups.values()].map(g=>({id:g.id,x:g.x/g.n,y:g.y/g.n}));}
function disorderEligible(rows){return rows.filter(row=>String(row['Non-disordered?']??'').trim().toLowerCase()==='yes');}
function disorderFilteredSummary(summary,residues){
    const grouped=new Map();for(const row of disorderEligible(residues)){const id=normalisePdbId(row['PDB ID']);if(!id)continue;if(!grouped.has(id))grouped.set(id,{confidence:[],all:[],removed:[],keptCount:0,removedCount:0});const group=grouped.get(id),kept=String(row['Kept?']??'').trim().toLowerCase();if(kept==='yes')group.keptCount++;else if(kept==='no')group.removedCount++;const confidence=benchmarkNumber(row['Model confidence']),distance=benchmarkNumber(row['Reference-to-predicted distance']);if(confidence!==null&&confidence>=0&&confidence<=1)group.confidence.push(confidence);if(distance!==null&&distance>=0){group.all.push(distance);if(String(row['Kept?']??'').trim().toLowerCase()==='no')group.removed.push(distance);}}
    const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null,rmsd=values=>values.length?Math.sqrt(values.reduce((a,b)=>a+b*b,0)/values.length):null;
    return summary.map(row=>{const group=grouped.get(normalisePdbId(row['PDB ID']));return {...row,'Overall confidence':group?mean(group.confidence):null,'Overall RMSD (Å)':group?rmsd(group.all):null,'Removed residues RMSD (Å)':group?rmsd(group.removed):null,'Residues kept':group?group.keptCount:null,'Residues removed':group?group.removedCount:null,'Residues kept (%)':group&&(group.keptCount+group.removedCount)?100*group.keptCount/(group.keptCount+group.removedCount):null,'Residues removed (%)':group&&(group.keptCount+group.removedCount)?100*group.removedCount/(group.keptCount+group.removedCount):null};});
}
function selectedSourceRows(data){
    const alpha=$('#plot-source-alphafold').checked,uniprot=$('#plot-source-uniprot').checked,source=row=>String(row['Input source']||'').trim().toLowerCase();
    const matches=row=>{const value=source(row);return value==='alphafold'?alpha:value==='uniprot sequence'?uniprot:alpha||uniprot;};
    const sources=new Map();for(const row of data.residues){const id=normalisePdbId(row['PDB ID']),value=source(row);if(!id||!['alphafold','uniprot sequence'].includes(value))continue;if(!sources.has(id))sources.set(id,new Set());sources.get(id).add(value);}
    const summary=data.summary.filter(row=>{const known=sources.get(normalisePdbId(row['PDB ID']));return known?(alpha&&known.has('alphafold'))||(uniprot&&known.has('uniprot sequence')):alpha||uniprot;});
    return {summary,residues:data.residues.filter(matches)};
}
for(const id of ['plot-source-alphafold','plot-source-uniprot'])document.getElementById(id).addEventListener('change',()=>{if(!loadedResults)return;redrawBenchmarkPlots();renderBuildTiming(loadedResults);renderAlphaConfidence(loadedResults);drawFeaturePlot();featureSummaryRows=[];$('#feature-summary').replaceChildren();$('#download-feature-summary').disabled=true;$('#copy-feature-summary').disabled=true;$('#copy-feature-summary-status').textContent='';});
function redrawBenchmarkPlots(){if(!loadedResults)return;const {summary,residues}=selectedSourceRows(loadedResults);for(const control of Object.values(plotControls))control.disorderNote.hidden=!control.disorder.checked;
    for(const id of scorePlotIds){const heading=plotControls[id].heading;heading.textContent=({plot:'Reference-to-predicted distance', 'removed-plot':'Removed residues: distance', 'confidence-rmsd':'Overall RMSD', 'confidence-removed-rmsd':'Removed-residue RMSD', 'torsion-plot':'Torsion angle difference', 'lddt-plot':'lDDT-Cα'})[id]+' vs '+axisKey(id);}
    const filteredSummary=activeFilteredSummary=Object.values(plotControls).some(control=>control.disorder.checked)?disorderFilteredSummary(summary,residues):null;
    const rowsFor=id=>plotControls[id].disorder.checked?disorderEligible(residues):residues,summaryFor=id=>plotControls[id].disorder.checked?filteredSummary:summary;
    let points=validResiduePoints(rowsFor('plot'),'plot');const plotGranularity=$('#plot-granularity').value;if(plotGranularity==='pdb')points=meanPdbPoints(points);else if(plotGranularity==='xmean')points=benchmarkMeanByX(points);
    scoreScatter('plot',points,{mean:plotGranularity==='pdb',xMean:plotGranularity==='xmean',yLabel:plotGranularity!=='residue'?'Mean residue distance (Å)':'Reference-to-predicted distance (Å)',trend:true});
    const removed=residues.filter(row=>String(row['Kept?']??'').trim().toLowerCase()==='no'),eligible=rowsFor('removed-plot').filter(row=>String(row['Kept?']??'').trim().toLowerCase()==='no'),removedPoints=validResiduePoints(eligible,'removed-plot'),removedGranularity=$('#removed-plot-granularity').value,removedPerPdb=removedGranularity==='pdb',displayPoints=removedPerPdb?meanPdbPoints(removedPoints):removedGranularity==='xmean'?benchmarkMeanByX(removedPoints):removedPoints;scoreScatter('removed-plot',displayPoints,{mean:removedPerPdb,xMean:removedGranularity==='xmean',yLabel:removedGranularity!=='residue'?'Mean residue distance (Å)':'Reference-to-predicted distance (Å)',trend:true});
    const unknown=residues.filter(row=>!['yes','no'].includes(String(row['Kept?']??'').trim().toLowerCase())).length;$('#removed-plot-status').textContent=`${removedPoints.length} of ${removed.length} removed residues have comparable eligible values${removedPerPdb?` across ${displayPoints.length} PDB IDs`:''}; ${unknown} rows have no kept/removed classification.`;
    const confidencePoints=(id,key)=>{const axis=axisKey(id),groups=new Map();for(const row of rowsFor(id)){const pdb=normalisePdbId(row['PDB ID']),x=benchmarkNumber(row[axis]);if(!pdb||!validScore(x,axis))continue;if(!groups.has(pdb))groups.set(pdb,[]);groups.get(pdb).push(x);}return summaryFor(id).map(row=>{const xs=groups.get(normalisePdbId(row['PDB ID']));return {id:row['PDB ID'],x:xs?xs.reduce((a,b)=>a+b,0)/xs.length:null,y:benchmarkNumber(row[key])};}).filter(p=>p.id&&p.x!==null&&p.y!==null&&p.y>=0);};
    scoreScatter('confidence-rmsd',confidencePoints('confidence-rmsd','Overall RMSD (Å)'),{mean:true,yLabel:'Overall RMSD (Å)',trend:true});
    scoreScatter('confidence-removed-rmsd',confidencePoints('confidence-removed-rmsd','Removed residues RMSD (Å)'),{mean:true,yLabel:'Removed-residue RMSD (Å)',trend:true});
    plotResidueAmountRmsd(summaryFor('missing-rmsd'),'missing-rmsd','Missing residues (%)','Missing residues (known subtotal)','Reference missing residues');
    plotResidueAmountRmsd(summaryFor('removed-rmsd'),'removed-rmsd','Residues removed (%)','Residues removed','Removed residues');
    plotResidueAmountRmsd(summaryFor('kept-rmsd'),'kept-rmsd','Residues kept (%)','Residues kept','Kept residues');
    drawColourRmsd(summaryFor('rmsd-plot'));
    plotLocalMetric(rowsFor('torsion-plot'),'torsion-plot','Torsion angle difference (degrees)','Torsion angle difference (degrees)',180);
    plotLocalMetric(rowsFor('lddt-plot'),'lddt-plot','lDDT-Cα','lDDT-Cα',1);
}
function plotLocalMetric(rows,id,key,label,max){
    const axis=axisKey(id);let points=rows.map(row=>({id:row['PDB ID'],x:benchmarkNumber(row[axis]),y:benchmarkNumber(row[key])})).filter(p=>p.id&&validScore(p.x,axis)&&p.y!==null&&p.y>=0&&p.y<=max);
    const granularity=document.getElementById(`${id}-granularity`).value,perPdb=granularity==='pdb';if(perPdb)points=meanPdbPoints(points);else if(granularity==='xmean')points=benchmarkMeanByX(points);
    scoreScatter(id,points,{mean:perPdb,xMean:granularity==='xmean',yLabel:granularity!=='residue'?`Mean ${label}`:label,trend:true});
}
function plotResidueAmountRmsd(rows,id,percentKey,countKey,label){
    const percent=document.getElementById(`${id}-measure`).value==='percent';
    const points=rows.map(row=>({id:row['PDB ID'],x:percent?benchmarkPercentage(row[percentKey]):benchmarkNumber(row[countKey]),y:benchmarkNumber(row['Removed residues RMSD (Å)'])})).filter(p=>p.id&&p.x!==null&&p.x>=0&&(!percent||p.x<=100)&&p.y!==null&&p.y>=0);
    const xMax=percent?100:Math.max(1,Math.ceil(points.reduce((max,p)=>Math.max(max,p.x),0)*1.05));
    scatter(id,points,{xLabel:`${label} (${percent?'%':'count'})`,yLabel:'Removed-residue RMSD (Å)',xMax,trend:true});
    document.getElementById(`${id}-status`).textContent=`${points.length} of ${rows.length} summary rows plotted; rows without a valid ${percent?'percentage':'count'} and removed-residue RMSD are excluded.`;
}
function drawColourRmsd(rows){const colours=benchmarkPlotColours(),canvas=$('#rmsd-plot'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,p=60;ctx.clearRect(0,0,w,h);ctx.fillStyle=colours.background;ctx.fillRect(0,0,w,h);
    const valid=rows.filter(r=>benchmarkNumber(r['Overall RMSD (Å)'])!==null),coloured=colourForPoints(valid.map((r,i)=>({id:r['PDB ID'],x:i,y:benchmarkNumber(r['Overall RMSD (Å)'])})),plotControls['rmsd-plot'].select.value,rows),max=valid.reduce((m,r)=>Math.max(m,benchmarkNumber(r['Overall RMSD (Å)'])||0,benchmarkNumber(r['Removed residues RMSD (Å)'])||0),1);
    ctx.strokeStyle=colours.axis;ctx.beginPath();ctx.moveTo(p,20);ctx.lineTo(p,h-p);ctx.lineTo(w-20,h-p);ctx.stroke();ctx.font='12px system-ui';ctx.fillStyle=colours.text;ctx.fillText(`${max.toFixed(1)} Å`,4,28);ctx.fillText('Overall: solid · Removed: translucent',w-240,18);
    const width=(w-p-25)/Math.max(valid.length,1);valid.forEach((r,i)=>{const x=p+i*width+width*.12,bar=Math.max(1,Math.min(22,width*.3));for(const [j,key] of ['Overall RMSD (Å)','Removed residues RMSD (Å)'].entries()){const v=benchmarkNumber(r[key]);if(v===null)continue;ctx.globalAlpha=j?.45:1;ctx.fillStyle=coloured.points[i].color;const height=v/max*(h-p-25);ctx.fillRect(x+j*bar,h-p-height,bar,height);}ctx.globalAlpha=1;ctx.save();ctx.translate(x,h-p+17);ctx.rotate(.65);ctx.fillStyle=colours.text;ctx.fillText(String(r['PDB ID']||''),0,0);ctx.restore();});setPlotLegend('rmsd-plot',coloured);
}
function renderBuildCounts(rows,residues){
    const counts=[0,0,0,0,0];
    const missingAlphaFoldIds=new Set(residues.filter(row=>String(row['Fallback reason']||'').trim().toLowerCase()==='alphafold-unavailable').map(row=>normalisePdbId(row['PDB ID'])).filter(Boolean));
    for(const row of rows){
        const status=String(row.Status||'').trim().toLowerCase(),error=String(row.Error||'');
        if(status==='completed'||status==='processed'||(!status&&!error&&benchmarkNumber(row['Overall RMSD (Å)'])!==null))counts[0]++;
        if(missingAlphaFoldIds.has(normalisePdbId(row['PDB ID']))||(status==='failed'&&/missing alphafold model for protein chains?\b/i.test(error)))counts[2]++;
        if(status!=='failed')continue;
        counts[1]++;
        if(/only uniprot accessions are allowed/i.test(error))counts[3]++;
        if(/no uniprot mapping for reference chain\b/i.test(error))counts[4]++;
    }
    const disorderedIds=new Set(residues.filter(row=>String(row['Non-disordered?']??'').trim().toLowerCase()==='no').map(row=>normalisePdbId(row['PDB ID'])).filter(Boolean));counts.push(disorderedIds.size);
    const labels=['Successful builds','Failed builds','PDB IDs missing an AlphaFold model for a protein chain','Only UniProt accessions are allowed','No UniProt mapping for reference chain','PDB IDs with disordered regions'];
    const host=$('#build-counts');host.replaceChildren();
    labels.forEach((label,i)=>{const box=document.createElement('div'),number=document.createElement('strong'),title=document.createElement('span');box.className='build-count';number.textContent=counts[i];title.textContent=label;box.append(number,title);host.append(box);});
    host.hidden=false;
}
function renderBuildTiming(data){
    const rows=selectedSourceRows(data).summary.filter(row=>['completed','processed'].includes(String(row.Status||'').trim().toLowerCase())||(!row.Status&&!row.Error&&benchmarkNumber(row['Overall RMSD (Å)'])!==null));
    const timings=rows.map(row=>({seconds:benchmarkNumber(row['Build time (seconds)']),chains:benchmarkNumber(row['Protein chain count'])}));
    const pdb=timings.filter(row=>row.seconds!==null&&row.seconds>=0).map(row=>row.seconds);
    const chain=timings.filter(row=>row.seconds!==null&&row.seconds>=0&&row.chains!==null&&row.chains>0).map(row=>row.seconds/row.chains);
    const average=values=>values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1)+' s':'Unavailable';
    $('#timing-averages').textContent=`Average per PDB ID: ${average(pdb)} (${pdb.length} builds) · Average per chain per PDB ID: ${average(chain)} (${chain.length} builds)`;
    const colours=benchmarkPlotColours(),values=$('#timing-mode').value==='chain'?chain:pdb,canvas=$('#timing-histogram'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,left=55,bottom=55,top=20,right=20;
    ctx.clearRect(0,0,w,h);ctx.fillStyle=colours.background;ctx.fillRect(0,0,w,h);ctx.fillStyle=colours.text;ctx.font='14px system-ui';
    if(!values.length){ctx.fillText('No build timing data available.',left,top+25);}else{
        const max=Math.max(...values),bins=Math.max(1,Math.ceil(max)),width=1,counts=Array(bins).fill(0);
        values.forEach(value=>counts[Math.min(bins-1,Math.floor(value/width))]++);
        const maxCount=Math.max(...counts),plotW=w-left-right,plotH=h-top-bottom;
        ctx.strokeStyle=colours.axis;ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,h-bottom);ctx.lineTo(w-right,h-bottom);ctx.stroke();
        counts.forEach((count,i)=>{const x=left+i*plotW/bins,barWidth=plotW/bins,barHeight=count/maxCount*plotH,gap=Math.min(2,barWidth*.1);ctx.fillStyle='#57d8c3';ctx.fillRect(x+gap,h-bottom-barHeight,barWidth-2*gap,barHeight);ctx.fillStyle=colours.text;ctx.textAlign='center';if(barWidth>=25&&count)ctx.fillText(String(count),x+barWidth/2,h-bottom-barHeight-4);if(i%Math.max(1,Math.ceil(bins/30))===0)ctx.fillText(String(i),x,h-bottom+18);});
        ctx.beginPath();for(let i=0;i<=bins;i++){const x=left+i*plotW/bins;ctx.moveTo(x,h-bottom);ctx.lineTo(x,h-bottom+5);}ctx.stroke();
        ctx.textAlign='right';ctx.fillText(String(bins),w-right,h-bottom+18);ctx.textAlign='center';ctx.fillText('Time (seconds)',left+plotW/2,h-10);ctx.textAlign='left';
    }
    $('#timing-status').textContent=`${values.length} of ${rows.length} successful builds have the data needed for this view. Older results may not contain timing or chain counts.`;
    $('#timing-summary').hidden=false;
}
function renderAlphaConfidence(data){
    const rows=selectedSourceRows(data).residues;
    const seriesFor=(key,aligned)=>rows.filter(row=>String(row['Aligned?']??'').trim().toLowerCase()===(aligned?'yes':'no')).map(row=>benchmarkNumber(row[key])).filter(value=>value!==null&&value>=0&&(key!=='AlphaFold pLDDT'||value<=100));
    const groups=[['Aligned pLDDT','AlphaFold pLDDT',true],['Unaligned pLDDT','AlphaFold pLDDT',false],['Aligned PAE (Å)','AlphaFold PAE (Å)',true],['Unaligned PAE (Å)','AlphaFold PAE (Å)',false]].map(([label,key,aligned])=>({label,values:seriesFor(key,aligned)}));
    const colours=['#57d8c3','#f2a65a'];
    for(const [id,index,label] of [['alpha-plddt-histogram',0,'AlphaFold pLDDT'],['alpha-pae-histogram',2,'AlphaFold PAE (Å)']])benchmarkHistogram(document.getElementById(id),groups.slice(index,index+2).map((group,i)=>({values:group.values,color:colours[i]})),label,{binCount:120,normalise:$('#alpha-confidence-normalise').getAttribute('aria-pressed')==='true'});
    const host=$('#alpha-confidence-cards');host.replaceChildren();
    for(const group of groups){const stats=benchmarkDistributionStats(group.values),card=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('span');card.className='build-count';title.textContent=group.label;title.style.fontSize='1rem';detail.textContent=group.values.length?`Mean: ${stats.mean.toFixed(2)} · Median: ${stats.median.toFixed(2)} · n = ${group.values.length}`:'Mean: unavailable · Median: unavailable · n = 0';card.append(title,detail);host.append(card);}
    $('#alpha-confidence-summary').hidden=false;
}
$('#alpha-confidence-normalise').addEventListener('click',event=>{const button=event.currentTarget,enabled=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(enabled));button.textContent=`Normalise Y-axis: ${enabled?'True':'False'}`;if(loadedResults)renderAlphaConfidence(loadedResults);});
$('#timing-mode').addEventListener('change',()=>{if(loadedResults)renderBuildTiming(loadedResults);});
function refreshBenchmarkResults(data){loadedResults=data;const potentialIds=[...new Set(data.summary.filter(row=>String(row['Potential for AF-build']||'').toLowerCase()==='yes').map(row=>normalisePdbId(row['PDB ID'])).filter(Boolean))];const potentialKnown=data.summary.some(row=>['yes','no'].includes(String(row['Potential for AF-build']||'').toLowerCase()));const potentialUnknown=data.summary.some(row=>!['yes','no'].includes(String(row['Potential for AF-build']||'').toLowerCase()));$('#af-build-potential-list').textContent=(potentialIds.length?potentialIds.join(', '):potentialKnown?'No PDB IDs recorded.':'Information unavailable for these results.')+(potentialKnown&&potentialUnknown?' Some results have unavailable information.':'');renderBuildCounts(data.summary,data.residues);renderBuildTiming(data);renderAlphaConfidence(data);$('#download-summary').disabled=false;$('#download-residues').disabled=false;$('#results-status').textContent=`${data.summary.length} summary rows; ${data.residues.length} residue rows.`;table($('#summary'),data.summary);const select=$('#residue-select'),old=select.value,ids=[...new Set(data.residues.map(r=>r['PDB ID']).filter(Boolean))];select.replaceChildren(new Option('Select a PDB ID',''));for(const id of ids)select.add(new Option(id,id));select.value=ids.includes(old)?old:'';renderSelectedResidues();redrawBenchmarkPlots();}
function renderSelectedResidues(){const id=$('#residue-select').value;const rows=id?(loadedResults?.residues||[]).filter(r=>r['PDB ID']===id):[];table($('#residue-table'),rows);}
$('#residue-select').addEventListener('change',renderSelectedResidues);
function resetFolderViews(){++imageRevision;++comparisonRevision;imageEntries=[];comparisonData=null;for(const url of imageUrls)URL.revokeObjectURL(url);imageUrls=[];$('#image-display').replaceChildren();$('#image-select').replaceChildren(new Option('Select an image',''),new Option('Display all','__all__'));refreshComparisonChoices([]);clearComparison();$('#comparison-status').textContent='Select a PDB ID from the connected results folder.';$('#image-status').textContent='';}
async function refreshBenchmarkImages(){const previous=$('#image-select').value,revision=++imageRevision,entries=[],folder=directory;if(folder)for await(const [name,handle] of folder.entries())if(handle.kind==='directory'&&/^\d{4,}-/.test(name))entries.push({name,handle});if(revision!==imageRevision)return;imageEntries=entries;imageEntries.sort((a,b)=>a.name.localeCompare(b.name));refreshComparisonChoices(imageEntries);const select=$('#image-select');select.replaceChildren(new Option('Select an image',''),new Option('Display all','__all__'));for(const entry of imageEntries)select.add(new Option(entry.name,entry.name));select.value=previous==='__all__'||imageEntries.some(e=>e.name===previous)?previous:'';await renderSelectedImages();}
async function renderSelectedImages(){const revision=++imageRevision;for(const url of imageUrls)URL.revokeObjectURL(url);imageUrls=[];const host=$('#image-display');host.replaceChildren();const choice=$('#image-select').value,entries=choice==='__all__'?imageEntries:imageEntries.filter(e=>e.name===choice);host.classList.toggle('image-grid',choice==='__all__');let missing=0;for(const entry of entries){try{const file=await (await entry.handle.getFileHandle('overview.png')).getFile();if(revision!==imageRevision)return;const img=document.createElement('img'),title=document.createElement('h3'),item=document.createElement('div');item.className='overview-image-item';title.textContent=entry.name;img.className='preview';img.alt=`Model overview for ${entry.name}`;img.src=URL.createObjectURL(file);imageUrls.push(img.src);item.append(title,img);host.append(item);}catch(error){if(error.name==='NotFoundError')missing++;else throw error;}}if(revision===imageRevision)$('#image-status').textContent=missing?`${missing} selected image(s) unavailable.`:(!directory?'Connect a results folder to view images.':'');}
$('#image-select').addEventListener('change',()=>void renderSelectedImages());
function updateRunEtc(){const el=$('#run-etc');if(!running){el.textContent='ETC available after a PDB finishes.';return;}if(pauseRequested){el.textContent='ETC unavailable while paused or waiting to pause.';return;}const done=runQueue.filter(e=>e.status==='completed'&&e.startedAt&&e.completedAt).map(e=>Date.parse(e.completedAt)-Date.parse(e.startedAt)).filter(ms=>Number.isFinite(ms)&&ms>0);if(!done.length){el.textContent='ETC available after a PDB finishes.';return;}const known=runManifest?attemptedIds(runManifest):new Set(),current=runQueue.find(e=>e.status==='running'),currentId=normalisePdbId(current?.input?.['PDB ID']),pending=new Set(runQueue.filter(e=>e.status==='pending').map(e=>normalisePdbId(e.input['PDB ID'])).filter(id=>id&&id!==currentId&&!known.has(id))),avg=done.reduce((a,b)=>a+b,0)/done.length,remaining=avg*pending.size+(current?Math.max(0,avg-(Date.now()-Date.parse(current.startedAt))):0);el.textContent=`ETC ~${Math.ceil(remaining/60000)} min; based on ${done.length} completed PDB${done.length===1?'':'s'}`;}
setInterval(updateRunEtc,1000);updateRunEtc();

// General-purpose feature explorer; older bundles simply have no comparable rows.
const benchmarkFeatureNames=['Model confidence','Local structure confidence','Placement confidence (2 Å)','Placement confidence (5 Å)','AlphaFold pLDDT','AlphaFold PAE (Å)','Steps to nearest anchor','Steps to left anchor','Steps to right anchor','Gap length','Aligned anchor count','PAE residue to anchors mean (Å)','PAE anchors to residue mean (Å)','PAE residue to anchors count','PAE anchors to residue count','PAE residue to left anchor (Å)','PAE left anchor to residue (Å)','PAE residue to right anchor (Å)','PAE right anchor to residue (Å)','Steric clash score','Mean absolute restraint strain','Restraint count','Gap type','Alignment evidence','Secondary structure'];
for(const name of benchmarkFeatureNames)$('#feature-x').add(new Option(name,name));
function benchmarkFeatureValue(row,key){const codes={'Gap type':{'aligned':0,'internal':1,'N-terminal':2,'C-terminal':3,'no anchor':4},'Alignment evidence':{'unaligned':0,'exact':1,'substitution':2,'unknown':3},'Secondary structure':{'coil':0,'helix':1,'sheet':2}};return codes[key]?(codes[key][row[key]]??null):benchmarkNumber(row[key]);}
function benchmarkFeaturePoints(xkey,ykey,removed){const summary=new Map(loadedResults.summary.map(s=>[normalisePdbId(s['PDB ID']),s]));return selectedSourceRows(loadedResults).residues.filter(r=>!removed||String(r['Kept?']).toLowerCase()==='no').map(r=>({id:r['PDB ID'],x:benchmarkFeatureValue(r,xkey),y:benchmarkNumber(ykey==='removed-rmsd'?summary.get(normalisePdbId(r['PDB ID']))?.['Removed residues RMSD (Å)']:r[ykey])})).filter(p=>p.id&&p.x!==null&&p.y!==null&&p.x>=0&&p.y>=0);}
let featureSummaryRows=[];
function renderFeatureSummary(){if(!loadedResults)return;const removed=$('#feature-subset').value==='removed',outcomes=[...$('#feature-y').options];featureSummaryRows=[];for(const feature of benchmarkFeatureNames)for(const outcome of outcomes){const residuePoints=benchmarkFeaturePoints(feature,outcome.value,removed);for(const granularity of ['residue','pdb','xmean']){const forced=outcome.value==='removed-rmsd',base=granularity==='pdb'||forced?meanPdbPoints(residuePoints):residuePoints,points=granularity==='xmean'?benchmarkMeanByX(base):base,fit=['Gap type','Alignment evidence','Secondary structure'].includes(feature)?null:benchmarkQuadratic(points),n=points.length,mx=n?points.reduce((s,p)=>s+p.x,0)/n:0,my=n?points.reduce((s,p)=>s+p.y,0)/n:0,xx=points.reduce((s,p)=>s+(p.x-mx)**2,0),yy=points.reduce((s,p)=>s+(p.y-my)**2,0),xy=points.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0);featureSummaryRows.push({'Feature':feature,'Accuracy outcome':outcome.textContent,'Requested points':granularity==='residue'?'Per residue':granularity==='pdb'?'Per PDB ID mean':'Per x-axis value mean','Effective points':granularity==='xmean'?'Per x-axis value mean':granularity==='pdb'||forced?'Per PDB ID mean':'Per residue','Residues':removed?'Removed only':'All matched reference residues','Comparable residue rows':residuePoints.length,'Plotted points':n,'PDB IDs':new Set(residuePoints.map(p=>normalisePdbId(p.id))).size,'Quadratic trend':fit?benchmarkEquation(fit.coefficients):'','Fit RMSE':fit?Math.sqrt(points.reduce((s,p)=>s+(p.y-fit(p.x))**2,0)/n):'','Pearson r':xx&&yy?xy/Math.sqrt(xx*yy):''});}}table($('#feature-summary'),featureSummaryRows);$('#download-feature-summary').disabled=false;$('#copy-feature-summary').disabled=false;$('#copy-feature-summary-status').textContent='';}
$('#download-feature-summary').addEventListener('click',()=>downloadCSV(featureSummaryRows,'feature-accuracy-summary.csv'));
$('#copy-feature-summary').addEventListener('click',async()=>{const columns=Object.keys(featureSummaryRows[0]||{}),cell=value=>String(value??'').replace(/[\t\r\n]+/g,' '),text=[columns,...featureSummaryRows.map(row=>columns.map(column=>row[column]))].map(row=>row.map(cell).join('\t')).join('\n');try{await navigator.clipboard.writeText(text);$('#copy-feature-summary-status').textContent='Copied to clipboard.';}catch(error){$('#copy-feature-summary-status').textContent='Could not copy; use the CSV download instead.';}});
function drawFeaturePlot(){if(!loadedResults)return;const xkey=$('#feature-x').value,ykey=$('#feature-y').value,removed=$('#feature-subset').value==='removed';let points=benchmarkFeaturePoints(xkey,ykey,removed);const n=points.length,pdbCount=new Set(points.map(p=>normalisePdbId(p.id))).size,granularity=$('#feature-granularity').value;if(granularity==='pdb'||ykey==='removed-rmsd')points=meanPdbPoints(points);if(granularity==='xmean')points=benchmarkMeanByX(points);const coloured=granularity==='xmean'?{points:points.map(p=>({...p,color:'#168273'}))}:colourForPoints(points,'id',loadedResults.summary),max=Math.max(1,...points.map(p=>p.x));const numeric=!['Gap type','Alignment evidence','Secondary structure'].includes(xkey),fit=numeric?benchmarkQuadratic(points):null;benchmarkScatter($('#feature-plot'),coloured.points,{xLabel:xkey,yLabel:ykey==='removed-rmsd'?'Removed-residue RMSD (Å)':ykey,xMax:max*1.05,trend:numeric});const fitText=fit?`Quadratic trend: ${benchmarkEquation(fit.coefficients)}. Fit RMSE: ${Math.sqrt(points.reduce((sum,p)=>sum+(p.y-fit(p.x))**2,0)/points.length).toPrecision(4)} (outcome units; lower is closer).`:numeric?'Quadratic trend and fit RMSE unavailable (at least three distinct x values required).':'Quadratic trend and fit RMSE unavailable for categorical features.';const mx=points.reduce((s,p)=>s+p.x,0)/points.length,my=points.reduce((s,p)=>s+p.y,0)/points.length,xy=points.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0),xx=points.reduce((s,p)=>s+(p.x-mx)**2,0),yy=points.reduce((s,p)=>s+(p.y-my)**2,0),r=xx&&yy?xy/Math.sqrt(xx*yy):null;$('#feature-status').textContent=`${n} comparable residue rows; ${points.length} plotted points across ${pdbCount} PDB IDs. Pearson r: ${r===null?'unavailable':r.toFixed(3)}. ${fitText} RMSD uses one mean feature value per PDB.${xkey==='Gap type'?' Codes: aligned 0, internal 1, N-terminal 2, C-terminal 3, no anchor 4.':xkey==='Alignment evidence'?' Codes: unaligned 0, exact 1, substitution 2, unknown 3.':xkey==='Secondary structure'?' Codes: coil 0, helix 1, sheet 2.':''}`;}
for(const id of ['feature-x','feature-y','feature-granularity','feature-subset'])document.getElementById(id).addEventListener('change',()=>{drawFeaturePlot();if(id==='feature-subset'){featureSummaryRows=[];$('#feature-summary').replaceChildren();$('#download-feature-summary').disabled=true;$('#copy-feature-summary').disabled=true;}});
const previousRefreshBenchmarkResults=refreshBenchmarkResults;
refreshBenchmarkResults=function(data){previousRefreshBenchmarkResults(data);drawFeaturePlot();featureSummaryRows=[];$('#feature-summary').replaceChildren();$('#download-feature-summary').disabled=true;$('#copy-feature-summary').disabled=true;};
$('#calculate-feature-summary').addEventListener('click',renderFeatureSummary);

const afHistogramDrawers=new Map();
for(const name of ['reference','improvement','movement','chunk-improvement','chunk-movement','initial-chunk-movement']){
    const button=$(`#af-test-${name}-log`);
    button.addEventListener('click',()=>{const enabled=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(enabled));button.textContent=`Y-axis log-scale: ${enabled?'On':'Off'}`;afHistogramDrawers.get(name)?.();});
}
function drawAfHistogram(name,series,label){
    const draw=()=>benchmarkHistogram($(`#af-test-${name}-histogram`),series,label,{binCount:180,xTicks:10,markZero:name.includes('improvement'),logScale:$(`#af-test-${name}-log`).getAttribute('aria-pressed')==='true'});
    afHistogramDrawers.set(name,draw);draw();
}
function renderAfStatistics(host,entries){
    host.replaceChildren();
    for(const [label,value] of entries){const card=document.createElement('div'),number=document.createElement('strong'),title=document.createElement('span');card.className='build-count';number.textContent=value===null?'Unavailable':`${value.toFixed(2)} Å`;title.textContent=label;card.append(number,title);host.append(card);}
}
function renderAfMeanTriangle(initial,final,movement){
    const host=$('#af-test-mean-triangle');host.replaceChildren();
    const triangle=benchmarkMeanTriangle(initial,final,movement);
    if(!triangle){host.textContent='Mean-distance triangle unavailable.';return;}
    const vertices=[triangle.initial,triangle.final,triangle.reference],xs=vertices.map(p=>p.x),ys=vertices.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),maxY=Math.max(...ys),scale=Math.min(200/(maxX-minX||1),165/(maxY||1));
    const coords=vertices.map(p=>({x:210+(p.x-(minX+maxX)/2)*scale,y:215-p.y*scale})),[a,b,r]=coords,ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 420 285');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Mean distances: initial AlphaFold to reference ${initial.toFixed(2)} Å, final model to reference ${final.toFixed(2)} Å, and initial AlphaFold to final model ${movement.toFixed(2)} Å`);
    const add=(name,attrs,text)=>{const element=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attrs))element.setAttribute(key,value);if(text!==undefined)element.textContent=text;svg.append(element);};
    add('path',{d:`M ${a.x} ${a.y} L ${b.x} ${b.y} L ${r.x} ${r.y} Z`,fill:'none',stroke:'var(--af-diagram-accent)','stroke-width':'2.5'});
    for(const p of coords)add('circle',{cx:p.x,cy:p.y,r:'4.5',fill:'var(--af-diagram-accent)'});
    const text=(x,y,value,anchor='middle')=>add('text',{x,y,'text-anchor':anchor,'font-size':'12',fill:'currentColor','paint-order':'stroke',stroke:'var(--af-diagram-bg, #101e30)','stroke-width':'4','stroke-linejoin':'round'},value);
    text(a.x-10,a.y+5,'Initial AlphaFold','end');text(b.x+10,b.y+5,'Final Model','start');text(r.x,r.y-14,'Reference');
    text((a.x+b.x)/2,(a.y+b.y)/2+23,`${movement.toFixed(2)} Å`);
    text((a.x+r.x)/2-8,(a.y+r.y)/2,`${initial.toFixed(2)} Å`,'end');
    text((b.x+r.x)/2+8,(b.y+r.y)/2,`${final.toFixed(2)} Å`,'start');
    host.append(svg);
}
let afDiagramPoints=[],afDiagram3d=false,afDiagramYaw=.55,afDiagramPitch=.35,afDiagramDrag=null;
$('#af-test-dimension-toggle').addEventListener('click',()=>{afDiagram3d=!afDiagram3d;const button=$('#af-test-dimension-toggle');button.setAttribute('aria-pressed',String(afDiagram3d));button.textContent=`3D view: ${afDiagram3d?'On':'Off'}`;renderAfFourPointDiagram(afDiagramPoints);});
const afDiagramHost=$('#af-test-mean-triangle');
afDiagramHost.addEventListener('pointerdown',event=>{if(!afDiagram3d)return;afDiagramDrag={x:event.clientX,y:event.clientY};afDiagramHost.setPointerCapture(event.pointerId);event.preventDefault();});
afDiagramHost.addEventListener('pointermove',event=>{if(!afDiagramDrag||!afDiagram3d)return;afDiagramYaw+=(event.clientX-afDiagramDrag.x)*.01;afDiagramPitch+=(event.clientY-afDiagramDrag.y)*.01;afDiagramDrag={x:event.clientX,y:event.clientY};renderAfFourPointDiagram(afDiagramPoints);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])afDiagramHost.addEventListener(type,()=>{afDiagramDrag=null;});
function renderAfFourPointDiagram(points){
    afDiagramPoints=points;const host=afDiagramHost;host.replaceChildren();host.style.touchAction=afDiagram3d?'none':'';host.style.cursor=afDiagram3d?'grab':'';
    if(!points.length){host.textContent='Four-position comparison unavailable: these results do not contain all chunked coordinates.';$('#af-test-diagram-status').textContent='Older results may lack chunked coordinates.';return;}
    const avg=key=>benchmarkDistributionStats(points.map(p=>p[key])).mean;
    const edges=[[0,1,avg('initialChunk')],[0,2,avg('x')],[1,3,avg('chunkMovement')],[2,3,avg('y')],[0,3,avg('movement')],[1,2,avg('chunk')]],matrix=Array.from({length:4},()=>Array(4).fill(0));
    for(const [i,j,value] of edges)matrix[i][j]=matrix[j][i]=value;
    const fit=benchmarkMds(matrix,afDiagram3d?3:2);
    if(!fit){host.textContent='Could not calculate a position diagram.';return;}
    const projected=fit.coordinates.map(([x,y,z=0])=>{if(!afDiagram3d)return {x,y};const cy=Math.cos(afDiagramYaw),sy=Math.sin(afDiagramYaw),cp=Math.cos(afDiagramPitch),sp=Math.sin(afDiagramPitch),xx=x*cy+z*sy,zz=-x*sy+z*cy;return {x:xx,y:y*cp-zz*sp};});
    const radius=Math.max(1e-9,...projected.map(p=>Math.hypot(p.x,p.y))),scale=115/radius,vertices=projected.map(p=>({x:270+p.x*scale,y:175-p.y*scale})),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 540 350');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${afDiagram3d?'Three':'Two'}-dimensional multidimensional scaling of mean distances between initial AlphaFold, chunked AlphaFold, reference and final model`);
    const add=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);};
    for(const [i,j] of edges)add('line',{x1:vertices[i].x,y1:vertices[i].y,x2:vertices[j].x,y2:vertices[j].y,stroke:'var(--af-diagram-accent)','stroke-width':'2'});
    const text=(x,y,value)=>add('text',{x,y,'text-anchor':'middle','font-size':'13',fill:'currentColor','paint-order':'stroke',stroke:'var(--af-diagram-bg, #101e30)','stroke-width':'5','stroke-linejoin':'round'},value);
    for(const [i,j,value] of edges){const a=vertices[i],b=vertices[j],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;text((a.x+b.x)/2-dy/length*8,(a.y+b.y)/2+dx/length*8,`${value.toFixed(2)} Å`);}
    const labels=['Initial AlphaFold','Chunked AlphaFold','Reference','Final Model'];
    vertices.forEach((p,i)=>{add('circle',{cx:p.x,cy:p.y,r:5,fill:'var(--af-diagram-accent)'});const dx=p.x-270,dy=p.y-175,len=Math.hypot(dx,dy)||1;text(Math.max(70,Math.min(470,p.x+dx/len*30)),Math.max(18,Math.min(335,p.y+dy/len*25)),labels[i]);});
    host.append(svg);
    $('#af-test-diagram-status').textContent=`Classical multidimensional scaling of six mean Cα distances; labels show the original means. ${afDiagram3d?'Drag to rotate the 3D view. The screen shows a projection.':'The 2D positions are a best-fit projection.'} ${afDiagram3d?'3D':'2D'} distance fit RMSE: ${fit.rmse.toFixed(3)} Å across the six distances. Mean distances may not embed exactly.`;
}
const afScatterControls=new Map();
for(const id of ['af-test-plot','af-test-initial-chunk-scatter','af-test-chunk-final-scatter','af-test-anchor-movement','af-test-anchor-improvement']){
    const canvas=document.getElementById(id),label=document.createElement('label'),select=document.createElement('select');
    const controls=document.createElement('div');controls.className='plot-controls';label.append('Points ');select.setAttribute('aria-label',`Points for ${canvas.getAttribute('aria-label')}`);
    for(const [value,text] of [['residue','Per residue'],['pdb','Per PDB ID mean'],['xmean','Per x-axis value mean']])select.add(new Option(text,value));
    label.append(select);const colourLabel=document.createElement('label'),colour=document.createElement('select'),legend=document.createElement('div');colourLabel.textContent='Colour by';colour.setAttribute('aria-label',`Colour ${canvas.getAttribute('aria-label')} by`);for(const [value,text] of colourOptions)colour.add(new Option(text,value));colourLabel.append(colour);legend.className='legend';controls.append(label,colourLabel);canvas.before(controls);canvas.after(legend);const control={select,colour,legend,draw:null};afScatterControls.set(id,control);select.addEventListener('change',()=>control.draw?.());colour.addEventListener('change',()=>control.draw?.());
}
function drawAfScatter(id,points,rows,options){
    const control=afScatterControls.get(id);
    control.draw=()=>{const mode=control.select.value,display=mode==='pdb'?meanPdbPoints(points):mode==='xmean'?benchmarkMeanByX(points):points;
        const coloured=mode==='xmean'&&control.colour.value!=='density'?{points:display.map(point=>({...point,color:'#168273'})),type:'mean'}:colourForPoints(display,control.colour.value,rows);
        control.colour.title=mode==='xmean'?'PDB-based colours are unavailable for combined x-axis means; choose Density to colour by point concentration.':'';
        benchmarkScatter(document.getElementById(id),coloured.points,options);
        setColourLegend(control.legend,coloured);
    };
    control.draw();
}
const refreshBeforeAlphaFoldTest=refreshBenchmarkResults;
refreshBenchmarkResults=function(data){
    refreshBeforeAlphaFoldTest(data);
    const testRows=data.summary.filter(row=>row['Protein input mode']==='modeller-vs-alphafold');
    const testOnly=testRows.length>0&&data.summary.every(row=>row['Protein input mode']==='modeller-vs-alphafold');
    $('#af-test-results').hidden=!testRows.length;
    for(const id of ['plot-source-filter','timing-summary','alpha-confidence-summary','af-build-potential','summary'])document.getElementById(id).hidden=testOnly;
    for(const id of ['plot','removed-plot','rmsd-plot','confidence-rmsd','confidence-removed-rmsd','missing-rmsd','removed-rmsd','kept-rmsd','torsion-plot','lddt-plot','feature-plot','feature-summary'])document.getElementById(id).closest('.card').hidden=testOnly;
    if(!testRows.length)return;
    const fields=['PDB ID','Status','Unaligned unlocked AlphaFold residues','Paired comparable residues','Unpaired unaligned AlphaFold residues','AlphaFold vs reference RMSD (Å)','Final vs reference RMSD (Å)','RMSD improvement (Å)','Mean AlphaFold to final displacement (Å)','AlphaFold to final displacement RMSD (Å)','Residues closer to reference','Residues farther from reference'];
    table($('#af-test-summary'),testRows.map(row=>Object.fromEntries(fields.map(field=>[field,row[field]??'']))));
    const ids=new Set(testRows.map(row=>normalisePdbId(row['PDB ID'])));
    const points=data.residues.filter(row=>ids.has(normalisePdbId(row['PDB ID']))&&row['Input source']==='AlphaFold'&&row['Aligned?']==='No'&&row['Locked?']==='No').map(row=>({id:row['PDB ID'],x:benchmarkNumber(row['AlphaFold-to-reference distance (Å)']),y:benchmarkNumber(row['Reference-to-predicted distance']),movement:benchmarkNumber(row['AlphaFold-to-final displacement (Å)']),chunk:benchmarkNumber(row['Chunked AlphaFold-to-reference distance (Å)']),chunkMovement:benchmarkNumber(row['Chunked AlphaFold-to-final displacement (Å)']),initialChunk:benchmarkNumber(row['Initial-to-chunked AlphaFold displacement (Å)']),anchor:benchmarkNumber(row['Steps to nearest anchor'])})).filter(p=>p.x!==null&&p.y!==null&&p.movement!==null);
    const coloured=colourForPoints(points,'id',testRows);
    drawAfScatter('af-test-plot',points,testRows,{xLabel:'Initial AlphaFold to reference (Å)',yLabel:'Final model to reference (Å)',identityLine:true});
    $('#af-test-status').textContent=`${points.length} paired residues available. Points below equal distances improved; individual displacement values are available in the residue CSV.${testOnly?'':' Other input modes are excluded from this test view.'}`;
    const chunkPoints=points.filter(p=>p.chunk!==null&&p.chunkMovement!==null&&p.initialChunk!==null);
    const scatterCompare=(id,source,xKey,yKey,xLabel,yLabel)=>drawAfScatter(id,source.map(p=>({...p,x:p[xKey],y:p[yKey]})),testRows,{xLabel,yLabel,identityLine:true});
    scatterCompare('af-test-initial-chunk-scatter',chunkPoints,'x','chunk','Initial AlphaFold to reference (Å)','Chunked AlphaFold to reference (Å)');
    scatterCompare('af-test-chunk-final-scatter',chunkPoints,'chunk','y','Chunked AlphaFold to reference (Å)','Final model to reference (Å)');
    const improvements=points.map(p=>p.x-p.y);
    const initialStats=benchmarkDistributionStats(points.map(p=>p.x)),finalStats=benchmarkDistributionStats(points.map(p=>p.y)),improvementStats=benchmarkDistributionStats(improvements);
    renderAfStatistics($('#af-test-reference-stats'),[['Mean initial AlphaFold distance to reference',initialStats.mean],['Median initial AlphaFold distance to reference',initialStats.median],['Mean final model distance to reference',finalStats.mean],['Median final model distance to reference',finalStats.median]]);
    renderAfStatistics($('#af-test-improvement-stats'),[['Mean per-residue error improvement',improvementStats.mean],['Median per-residue error improvement',improvementStats.median]]);
    const movementStats=benchmarkDistributionStats(points.map(p=>p.movement));
    renderAfStatistics($('#af-test-movement-stats'),[['Mean initial AlphaFold to final model displacement',movementStats.mean],['Median initial AlphaFold to final model displacement',movementStats.median]]);
    renderAfFourPointDiagram(chunkPoints);
    const distributionPoints=chunkPoints.length?chunkPoints:points,distInitial=benchmarkDistributionStats(distributionPoints.map(p=>p.x)),distFinal=benchmarkDistributionStats(distributionPoints.map(p=>p.y));
    const chunkStats=benchmarkDistributionStats(chunkPoints.map(p=>p.chunk));
    renderAfStatistics($('#af-test-reference-stats'),[['Mean initial AlphaFold distance to reference',distInitial.mean],['Median initial AlphaFold distance to reference',distInitial.median],['Mean chunked AlphaFold distance to reference',chunkStats.mean],['Median chunked AlphaFold distance to reference',chunkStats.median],['Mean final model distance to reference',distFinal.mean],['Median final model distance to reference',distFinal.median]]);
    drawAfHistogram('reference',[{values:distributionPoints.map(p=>p.x),color:'#57d8c3'},{values:distributionPoints.map(p=>p.y),color:'#f5af62'},{values:chunkPoints.map(p=>p.chunk),color:'#b694f4'}],'Distance to reference (Å)');
    drawAfHistogram('improvement',[{values:improvements,color:'#57d8c3'}],'Initial minus final distance to reference (Å)');
    drawAfHistogram('movement',[{values:points.map(p=>p.movement),color:'#57d8c3'}],'Initial AlphaFold to final model displacement (Å)');
    const extraDistributions=[['chunk-improvement',chunkPoints.map(p=>p.chunk-p.y),'Chunked minus final distance to reference (Å)','chunked-to-final error improvement'],['chunk-movement',chunkPoints.map(p=>p.chunkMovement),'Chunked AlphaFold to final model displacement (Å)','chunked-to-final displacement'],['initial-chunk-movement',chunkPoints.map(p=>p.initialChunk),'Initial to chunked AlphaFold displacement (Å)','initial-to-chunked displacement']];
    for(const [name,values,label,description] of extraDistributions){const stats=benchmarkDistributionStats(values);drawAfHistogram(name,[{values,color:'#b694f4'}],label);renderAfStatistics($(`#af-test-${name}-stats`),[[`Mean ${description}`,stats.mean],[`Median ${description}`,stats.median]]);}

    const anchors=coloured.points.filter(p=>p.anchor!==null&&p.anchor>=0);
    drawAfScatter('af-test-anchor-movement',anchors.map(p=>({...p,x:p.anchor,y:p.movement})),testRows,{xLabel:'Distance to closest aligned anchor (residue steps)',yLabel:'AlphaFold to final displacement (Å)'});
    const improvementPoints=anchors.map(p=>({...p,x:p.anchor,y:p.x-p.y}));
    drawAfScatter('af-test-anchor-improvement',improvementPoints,testRows,{xLabel:'Distance to closest aligned anchor (residue steps)',yLabel:'Error improvement (Å)',markYZero:true});
    $('#af-test-anchor-status').textContent=`${anchors.length} of ${points.length} paired residues have a closest anchor distance. Distance is measured in AlphaFold sequence steps to the nearest aligned anchor in the same chain; residues without an anchor or stored distance are excluded. Positive improvement means closer to the reference.`;
};

new MutationObserver(()=>{
    if(loadedResults){redrawBenchmarkPlots();renderBuildTiming(loadedResults);renderAlphaConfidence(loadedResults);drawFeaturePlot();}
    for(const canvas of document.querySelectorAll('#results canvas'))canvas._benchmarkRedrawScatter?.();
    for(const draw of afHistogramDrawers.values())draw();
}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
