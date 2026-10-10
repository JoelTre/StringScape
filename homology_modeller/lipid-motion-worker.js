// Lipid particle dynamics. Independent of Three.js, DOM and protein physics.
function nearestLipidProtein(x,y,footprints){
    const {cell,grid}=footprints,gx=Math.floor(x/cell),gy=Math.floor(y/cell);
    let nearest=null,best=Infinity;
    for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(const p of grid.get(`${gx+dx}:${gy+dy}`)||[]){
        const d2=(x-p.x)**2+(y-p.y)**2;if(d2<best){best=d2;nearest=p;}
    }
    return nearest?{x:nearest.x,y:nearest.y,distance:Math.sqrt(best)}:null;
}
function stepLipidMotion(particles,leaves,previousExtent,targetExtent,dt,motionScale,rng=Math.random){
    const motionDt=dt*motionScale,currentExtent=previousExtent+(targetExtent-previousExtent)*(1-Math.exp(-dt/3.5));
    const extent=Math.max(2,currentExtent-2),scale=extent/Math.max(2,previousExtent-2);
    if(Math.abs(scale-1)>1e-6)for(const p of particles){p.x*=scale;p.y*=scale;}
    for(const leaf of leaves){
        const indices=[],grid=new Map(),cell=4;
        for(let i=0;i<particles.length;i++)if(particles[i].side===leaf.side){
            indices.push(i);const p=particles[i],key=`${Math.floor(p.x/cell)}:${Math.floor(p.y/cell)}`;
            if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
        }
        for(const i of indices){
            const p=particles[i],gx=Math.floor(p.x/cell),gy=Math.floor(p.y/cell);
            for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const j of grid.get(`${gx+dx}:${gy+dy}`)||[]){
                if(j<=i)continue;const q=particles[j],rx=p.x-q.x,ry=p.y-q.y;
                const distance=Math.max(.01,Math.hypot(rx,ry));if(distance>=3.8)continue;
                const impulse=(3.8-distance)*7*motionDt/distance;
                p.vx+=rx*impulse;p.vy+=ry*impulse;q.vx-=rx*impulse;q.vy-=ry*impulse;
            }
            const protein=nearestLipidProtein(p.x,p.y,leaf.footprints);
            if(protein&&protein.distance<6.2){
                const angle=i*2.399963229728653;
                const nx=protein.distance>.01?(p.x-protein.x)/protein.distance:Math.cos(angle);
                const ny=protein.distance>.01?(p.y-protein.y)/protein.distance:Math.sin(angle);
                const overlap=6.2-protein.distance;
                p.vx+=nx*overlap*12*motionDt;p.vy+=ny*overlap*12*motionDt;
                p.x+=nx*overlap*Math.min(1,motionDt*4);p.y+=ny*overlap*Math.min(1,motionDt*4);
            }
        }
    }
    const damping=Math.exp(-motionDt*1.5);
    for(const p of particles){
        p.vx=p.vx*damping+(rng()-.5)*4*Math.sqrt(motionDt);
        p.vy=p.vy*damping+(rng()-.5)*4*Math.sqrt(motionDt);
        const speed=Math.hypot(p.vx,p.vy);if(speed>4){p.vx*=4/speed;p.vy*=4/speed;}
        p.x+=p.vx*motionDt;p.y+=p.vy*motionDt;
        if(Math.abs(p.x)>extent){p.x=Math.sign(p.x)*extent;p.vx*=-.65;}
        if(Math.abs(p.y)>extent){p.y=Math.sign(p.y)*extent;p.vy*=-.65;}
    }
    return currentExtent;
}
if(typeof module!=='undefined')module.exports={stepLipidMotion,nearestLipidProtein};
if(typeof self!=='undefined'){
    let particles=[],leaves=[],extent=0;
    self.onmessage=({data})=>{
        try{
            if(data.init){particles=data.init.particles;extent=data.init.extent;}
            if(data.leaves)leaves=data.leaves;
            const started=performance.now();extent=stepLipidMotion(particles,leaves,extent,data.extent,data.dt,data.motionScale);
            const values=data.recycle?.byteLength===particles.length*32?new Float64Array(data.recycle):new Float64Array(particles.length*4);
            for(let i=0;i<particles.length;i++){
                const p=particles[i],j=i*4;values[j]=p.x;values[j+1]=p.y;values[j+2]=p.vx;values[j+3]=p.vy;
                if(!Number.isFinite(p.x+p.y+p.vx+p.vy))throw new Error('Non-finite lipid coordinates');
            }
            self.postMessage({id:data.id,values,extent,dt:data.dt,durationMs:performance.now()-started},[values.buffer]);
        }catch(error){self.postMessage({id:data.id,error:error.message});}
    };
}
