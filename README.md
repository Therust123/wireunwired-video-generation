# WireUnWired Video Studio v0.4 — MP4 social export

This is a static progressive web app for turning a WireUnWired scene script into a vertical, audio-led news video. No platform uploads or AI APIs are used.

## What changed

- Prefer native MP4 recording when the browser supports it.
- When the browser only records WebM (common on Android Chrome), show **Convert to MP4 for social apps**.
- Conversion uses FFmpeg.wasm locally in the browser to create a real H.264/AAC MP4; it does not just rename the file.
- The first conversion downloads the FFmpeg converter from a public CDN (roughly 25–35 MB of assets depending on transfer compression). Conversion can take several minutes on a phone and needs an internet connection for the initial download. Video data stays on-device.
- Share MP4 via the native share sheet when the browser supports sharing files. Otherwise save the MP4 and attach it inside WhatsApp, X, or YouTube. The app does not publish anything directly.
- Updated the service-worker cache to v4.

## Deploy to the existing GitHub Pages repository

Upload/replace these files in the repository root: `app.js`, `index.html`, `styles.css`, and `sw.js`. Keep `manifest.webmanifest`, `.nojekyll`, and the existing `icons/` folder. The AI Generator prompt can remain unchanged. Commit the changes and wait for GitHub Pages to redeploy.

Then reopen the installed PWA and refresh. If the previous app remains cached, close its tabs and reopen after deployment.

## Use

1. Paste the JSON/script from WireUnWired's AI Generator.
2. Prepare, review, and render.
3. If the result says WebM, tap **Convert to MP4 for social apps** and keep the page in the foreground.
4. Save MP4, or tap Share MP4 if the phone/browser offers it. For YouTube and X, you may still need to open the respective app and upload/select the saved MP4 through its media picker.

## Notes

- The MP4 converter is optional and loads only when requested; ordinary video rendering remains lightweight.
- Very long/large files can exceed mobile memory. The app blocks conversion of source files larger than 150 MB; shorter videos are recommended.
- Browser, OS and platform restrictions vary. MP4 greatly improves compatibility but cannot guarantee that every target app exposes a share-sheet option.
- FFmpeg.wasm performance is much slower than native FFmpeg, so expect extra wait time on mobile.
