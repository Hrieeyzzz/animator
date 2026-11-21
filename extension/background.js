let exportInProgress = false;
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const {approvedOrigin, characterId} = await chrome.storage.local.get(['approvedOrigin','characterId']);
    let origin; try { origin = new URL(sender.url).origin; } catch { throw Error('Invalid application page.'); }
    if (!approvedOrigin || approvedOrigin !== origin || !characterId) throw Error('Open the extension on this app tab and connect it first.');
    if (!['status','search','download'].includes(msg.action)) throw Error('Unsupported request.');
    if (msg.action === 'status') return {ok:true};
    const tabs = await chrome.tabs.query({url:'https://www.mixamo.com/*'});
    if (!tabs.length) throw Error('Open Mixamo in another tab and sign in first.');
    const payload = msg.payload || {};
    const query = typeof payload.query === 'string' ? payload.query.slice(0,100) : '';
    const page = Math.max(1, Math.min(100, Number(payload.page) || 1));
    const productId = String(payload.id || '');
    const name = String(payload.name || 'Animation').slice(0,120);
    if (msg.action === 'download' && !/^[a-zA-Z0-9_-]{1,100}$/.test(productId)) throw Error('Invalid animation ID.');
    if (msg.action === 'download' && exportInProgress) throw Error('Another Mixamo export is in progress. Please wait.');
    if (msg.action === 'download') exportInProgress = true;
    try {
      const [result] = await chrome.scripting.executeScript({target:{tabId:tabs[0].id},world:'MAIN',func: mixamoRequest,args:[msg.action,{query,page,productId,name,characterId}]});
      return result.result;
    } finally { if (msg.action === 'download') exportInProgress = false; }
  })().then(sendResponse).catch(error => sendResponse({error:error.message}));
  return true;
});

// Executed only inside a Mixamo tab. The access token never leaves that tab.
async function mixamoRequest(action, p) {
 try {
  const token = localStorage.getItem('access_token');
  if (!token) throw Error('Sign in to Mixamo, then try again.');
  const headers = {'Accept':'application/json','Content-Type':'application/json','Authorization':`Bearer ${token}`,'X-Api-Key':'mixamo2'};
  async function api(path, options={}) { const r=await fetch(path,{...options,headers:{...headers,...options.headers}}); if(!r.ok) throw Error(`Mixamo returned HTTP ${r.status}. Your session may have expired or its service may have changed.`); return r.json(); }
  if(action==='search') {
    const data=await api(`/api/v1/products?page=${p.page}&limit=24&order=&type=Motion%2CMotionPack&query=${encodeURIComponent(p.query)}`);
    if(!Array.isArray(data.results)) throw Error('Mixamo returned an unexpected catalog format.');
    return {results:data.results.map(x=>({id:String(x.id),name:String(x.description || x.name || 'Animation')})),pagination:data.pagination};
  }
  const product=await api(`/api/v1/products/${encodeURIComponent(p.productId)}?similar=0&character_id=${encodeURIComponent(p.characterId)}`);
  const hash=product.details?.gms_hash;
  if(!hash || !Array.isArray(hash.params)) throw Error('This animation cannot be exported for the selected character.');
  const gms={...hash,params:hash.params.map(param=>param[1]).join(',')};
  await api('/api/v1/animations/export',{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest'},body:JSON.stringify({character_id:p.characterId,gms_hash:[gms],preferences:{format:'fbx7',skin:'false',fps:'30',reducekf:'0'},product_name:p.name,type:'Motion'})});
  for(let i=0;i<60;i++) {
    await new Promise(r=>setTimeout(r,2000));
    const job=await api(`/api/v1/characters/${encodeURIComponent(p.characterId)}/monitor`);
    if(job.status==='failed') throw Error('Mixamo could not create the animation.');
    if(job.status==='completed') {
      const url=new URL(job.job_result,location.origin);
      if(url.protocol!=='https:') throw Error('Mixamo returned an invalid download URL.');
      const r=await fetch(url.href); if(!r.ok) throw Error(`Animation download failed (HTTP ${r.status}).`);
      const bytes=new Uint8Array(await r.arrayBuffer());
      if(bytes.length>35*1024*1024) throw Error('Animation is too large to import through the bridge.');
      let binary=''; for(let j=0;j<bytes.length;j+=32768) binary+=String.fromCharCode(...bytes.subarray(j,j+32768));
      return {data:btoa(binary),name:p.name};
    }
  }
  throw Error('Mixamo export timed out. Try again.');
 } catch(error) {return {error:error.message};}
}
