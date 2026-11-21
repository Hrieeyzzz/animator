// Only a connected, explicitly approved origin can use the bridge.
window.addEventListener('message', async event => {
  if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'motion-studio-request') return;
  const {id, action, payload} = event.data;
  if (typeof id !== 'string' || !['status','search','download'].includes(action)) return;
  const respond = response => window.postMessage({source:'motion-studio-response',id,response}, location.origin);
  try {
    // Chrome invalidates existing content scripts when an extension is reloaded.
    if (!chrome.runtime?.id || typeof chrome.runtime.sendMessage !== 'function') {
      respond({error:'The extension was reloaded or removed. Refresh this Motion Studio tab, then reconnect.', code:'BRIDGE_INVALIDATED'});
      return;
    }
    const response = await chrome.runtime.sendMessage({action,payload});
    respond(response);
  } catch (error) {
    if (!chrome.runtime?.id || /extension context invalidated/i.test(error?.message || '')) {
      respond({error:'The extension was reloaded or removed. Refresh this Motion Studio tab, then reconnect.', code:'BRIDGE_INVALIDATED'});
    } else {
      respond({error:error?.message || 'The extension could not send the request.'});
    }
  }
});
