# WireUnWired Video Studio v0.5 — conversion feedback and Share fixes

This static PWA turns a WireUnWired scene script into an audio-led portrait video locally. No social uploads or AI APIs are used.

## Fixes in v0.5

- Conversion now reports every stage visibly and never silently returns if the video is missing or already MP4.
- The converter attempts two CDN hosts for the FFmpeg wrapper and single-thread core, with retryable error handling.
- Conversion progress updates the progress bar and stage label.
- Share is visible after rendering for both WebM and MP4. It attempts to share the actual current file through the phone's native share sheet when supported; otherwise it explains how to save and attach it manually.
- Service-worker cache is v5, now uses network-first fetch for same-origin app files with offline cache fallback, and no longer masks third-party CDN failures with index.html.

## Deploy

Replace `app.js`, `index.html`, `styles.css` (can remain unchanged but keep it) and `sw.js` in the root of the existing GitHub Pages repo. Keep `manifest.webmanifest`, `.nojekyll`, and `icons/`. Commit and wait for GitHub Pages.

On the phone, close the installed PWA completely, reopen it with an internet connection, and refresh. The new service worker is `wireunwired-video-studio-v5`. If it still appears stale, open the website URL in Chrome once and refresh before reopening the installed app.

## Expected flow

1. Render a video.
2. Tap **Convert to MP4 for social apps**. Status text should immediately say conversion has started. First-time setup downloads the FFmpeg converter; keep the app open.
3. If conversion finishes, **Save MP4 to phone** and **Share MP4 video…** become available. If conversion fails, a visible error message will tell you why and the original WebM remains saveable.
4. Share sends the actual available file to the native share sheet if the browser supports file sharing. X and YouTube may still require selecting the saved video from inside their upload flows.

## Limits

- FFmpeg.wasm downloads a large converter on first run and can be slow or memory-intensive on phones.
- WebM-to-MP4 encoding is only available if the browser can load the converter assets and supports the required WebAssembly features.
- The Share button's presence does not guarantee a target app accepts that container; MP4 is preferred for compatibility.
