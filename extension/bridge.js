// Only a connected, explicitly approved origin can use the bridge.
window.addEventListener('message', async event => {
  if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'motion-studio-request') return;
  const {id, action, payload} = event.data;
  if (typeof id !== 'string' || !['status','search','download'].includes(action)) return;
  try {
    const response = await chrome.runtime.sendMessage({action,payload});
    window.postMessage({source:'motion-studio-response',id,response}, location.origin);
  } catch (error) {window.postMessage({source:'motion-studio-response',id,response:{error:error.message}}, location.origin);}
});
