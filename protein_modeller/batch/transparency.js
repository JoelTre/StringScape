'use strict';
// JPEG thumbnails from older runs have no alpha. Remove only neutral background
// connected to the image edge; foreground and isolated dark/white pixels remain.
function removeLegacyImageBackground(data,width,height){
 const pixels=data.data,count=width*height;if(!count)return false;
 for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)return false;
 const corners=[0,width-1,(height-1)*width,height*width-1],black=corners.filter(i=>Math.max(pixels[i*4],pixels[i*4+1],pixels[i*4+2])<=20).length,white=corners.filter(i=>Math.min(pixels[i*4],pixels[i*4+1],pixels[i*4+2])>=235).length;
 const target=black>=3?0:white>=3?255:null;if(target===null)return false;
 const seen=new Uint8Array(count),queue=new Uint32Array(count);let head=0,tail=0;
 function add(index){if(seen[index])return;seen[index]=1;const p=index*4,d=Math.max(Math.abs(pixels[p]-target),Math.abs(pixels[p+1]-target),Math.abs(pixels[p+2]-target));if(d>40)return;queue[tail++]=index;pixels[p+3]=d<=8?0:Math.round(255*(d-8)/32);}
 for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
 while(head<tail){const i=queue[head++],x=i%width;if(x)add(i-1);if(x<width-1)add(i+1);if(i>=width)add(i-width);if(i<count-width)add(i+width);}
 return tail>0;
}
async function transparentGallerySource(file,alreadyTransparent=false){
 let image,url;
 try{
  if(typeof createImageBitmap==='function')image=await createImageBitmap(file);
  else{url=URL.createObjectURL(file);image=new Image();image.src=url;await image.decode();}
  if(alreadyTransparent)return {source:image,dispose(){image.close?.();if(url)URL.revokeObjectURL(url);}};
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height);if(removeLegacyImageBackground(data,canvas.width,canvas.height))ctx.putImageData(data,0,0);
  image.close?.();if(url)URL.revokeObjectURL(url);return {source:canvas,dispose(){}};
 }catch(error){image?.close?.();if(url)URL.revokeObjectURL(url);throw error;}
}
async function transparentGalleryBlob(file,alreadyTransparent=false){
 if(alreadyTransparent)return file;
 const result=await transparentGallerySource(file,false);
 try{return await new Promise((resolve,reject)=>result.source.toBlob(blob=>blob?resolve(blob):reject(Error('Could not prepare transparent image.')),'image/png'));}finally{result.dispose();}
}
