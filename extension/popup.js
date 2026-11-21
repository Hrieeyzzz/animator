const status = document.querySelector('#status');
chrome.storage.local.get(['characterId','approvedOrigin']).then(data => { document.querySelector('#character').value = data.characterId || ''; if(data.approvedOrigin) status.textContent = `Connected: ${data.approvedOrigin}`; });
document.querySelector('#connect').onclick = async () => {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  let url; try { url = new URL(tab.url); } catch { status.textContent='Open Motion Studio first.'; return; }
  const allowed = (url.protocol === 'https:' && url.hostname.endsWith('.e2b.app')) || (url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname));
  const characterId = document.querySelector('#character').value.trim();
  if (!allowed) {status.textContent='Open Motion Studio on a supported preview or localhost first.';return;}
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(characterId)) {status.textContent='Enter a valid Mixamo character ID.';return;}
  await chrome.storage.local.set({approvedOrigin:url.origin, characterId}); status.textContent=`Connected ${url.origin}. Return to the app and press Connect.`;
};
document.querySelector('#disconnect').onclick = async () => {await chrome.storage.local.remove(['approvedOrigin','characterId']);status.textContent='Disconnected.';};
