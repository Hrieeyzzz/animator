# Motion Studio

A browser-based workspace for adding several Mixamo animations to a single rigged character, previewing them and exporting them as separate clips in one GLB.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. `npm run build` creates a production build. Run the retargeting checks with `node tests/retarget.test.mjs`.

## Workflow

1. Upload a Mixamo-rigged FBX or self-contained GLB character. For an unrigged model, rig it on Mixamo and download the character first.
2. On [Mixamo](https://www.mixamo.com/), download each desired animation as FBX **Without Skin**, preferably for the same character.
3. Import those FBX files (multiple files can be selected), preview and organize the clips, then export the character and all listed clips as a GLB.

Files are processed locally in the browser. Mixamo is a separate Adobe service; the app does not sign in, search its catalog, or download its animations directly. Animation retargeting is best suited to matching Mixamo rigs; results can vary on other skeletons and should be checked in preview. External resources referenced by separate GLTF/FBX files are not supported; self-contained GLB is recommended. Export is GLB, not FBX. The Mixamo animation content is subject to Adobe's terms.

For Unity, see [docs/unity.md](docs/unity.md) — import settings, the Avatar/Apply Root Motion rules, and the controller wiring to avoid a T-posed walk.

## Experimental Mixamo browser bridge

The optional Chrome extension in `extension/` can search Mixamo and request an animation using your own signed-in session. It uses undocumented Mixamo endpoints, not an official integration, and may stop working. It has not been tested with a live authenticated account. Install it by unzipping the app's bridge download and using Chrome's **Load unpacked** in Developer mode. Open and sign into Mixamo in a separate tab, select an already rigged character, then find its `character_id` in a Mixamo product request in browser Developer Tools. Open the extension on the Motion Studio tab, enter that ID, and explicitly connect the page. The bridge only accepts requests from the origin you approve, and does not send the Mixamo access token to Motion Studio. Disconnect using the extension popup.

The bridge does not upload or rig characters. It exports animations using the Mixamo character ID you supply, then retargets them to the model already loaded in the app. Use the matching character for best results. Keep the Mixamo tab open while searching and exporting; download URLs and Mixamo's authentication and endpoints can change or prevent the bridge from working. You can always use the manual FBX import instead.

The bridge supports `https://animator-wine.vercel.app`, Arena preview URLs, and local development. After updating the extension, reload it in `chrome://extensions` and refresh the Motion Studio tab before connecting again. Other deployment domains need to be explicitly added to the extension.

The bridge fetches completed exports in the extension service worker from Mixamo's known S3 export bucket, rather than from the Mixamo webpage, to avoid browser cross-origin restrictions. This requires the storage host permissions listed in the extension manifest. If Mixamo switches download hosts, the bridge will report an unsupported host and need an update. After an extension update, download and unzip the new ZIP, reload (or reinstall) the unpacked extension from that folder in `chrome://extensions`, and refresh both Mixamo and Motion Studio tabs.
