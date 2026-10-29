// Binary structured-clone persistence; never expand packed atom views into JSON.
(function(){
 let connection;
 function database(){return connection??=new Promise((resolve,reject)=>{const request=indexedDB.open('stringscape-animation-binary',1);request.onupgradeneeded=()=>request.result.createObjectStore('animations');request.onsuccess=()=>resolve(request.result);request.onerror=()=>{connection=null;reject(request.error);};});}
 async function read(key){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('animations','readonly'),request=tx.objectStore('animations').get(key);request.onsuccess=()=>resolve(request.result?MemoryData.wire(request.result,true):null);request.onerror=()=>reject(request.error);});}
 async function write(key,data){const encoded=MemoryData.wire(data),db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('animations','readwrite');tx.objectStore('animations').put(encoded,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Animation save aborted'));});}
 globalThis.AnimationStorage={read,write};
})();
