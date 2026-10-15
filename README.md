# WireUnWired Video Studio (PWA MVP)

A phone-friendly progressive web app that turns a WireUnWired AI Generator script into a short, portrait news video. It runs in the browser and does not send the pasted script to a server.

## MVP features

- Paste the expected WireUnWired JSON (`title`, `category`, `music_mood`, `scenes[]`) or paste a plain-text script with scene paragraphs separated by blank lines.
- Review scene headlines, body copy, scene durations, and audio cues before rendering.
- Generate animated 9:16 motion-graphic scenes, a typewriter-style headline/body reveal with a blinking cursor, a segmented slide-progress indicator, optional thumbnail imagery when a CORS-accessible image URL is provided, and a louder compressed audio mix with scene-specific sound effects.
- Record a local video with browser MediaRecorder; save or share the file from a compatible mobile browser.
- Install as a PWA on Android or iOS after hosting over HTTPS. App shell can be cached for offline access after first load.

## Important limitations

- There is deliberately no voice-over, AI image API, cloud rendering, social upload, or WordPress integration in this first version.
- Current export is the browser's supported recording format: normally WebM in Chromium; some Safari versions may export MP4. Playback and editing support vary by platform.
- The initial visual system uses branded motion graphics. It does not invent photorealistic images; it will use an explicitly supplied, CORS-accessible thumbnail if available.
- Keep the app in the foreground during rendering. Short videos (roughly 20–40 seconds) are the best mobile starting point. The app currently caps total duration at 90 seconds.
- Generated audio is procedural synthesized music/effects; it is not a human-composed soundtrack. The mix is boosted and dynamically compressed for better phone-speaker audibility, but device volume and speaker quality still affect playback.
- If a remote image doesn't allow cross-origin display, the scene automatically falls back to abstract motion graphics.

## Test locally on a computer

You need Python 3 installed. In this folder run:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. To test installability, hosting must use HTTPS or localhost. Open the app, tap **Load sample**, tap **Prepare video**, review the scenes, and tap **Render video**. Keep the tab visible until rendering finishes.

## Publish for free with GitHub Pages (so the phone can install it)

1. Create a new GitHub repository, for example `wireunwired-video-studio`.
2. Upload the *contents* of this folder to the repository root. Ensure `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `sw.js`, and `icons/` are at the root.
3. In repository **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, and save.
4. Wait for GitHub Pages to show the HTTPS site URL. Open it on your Android phone in Chrome.
5. Use Chrome's **Install app** option or menu → **Install app / Add to Home screen**. On iPhone, open the URL in Safari, tap Share → **Add to Home Screen**.

GitHub Pages is a static hosting option; it needs no API key and does not upload your article text to a rendering backend. GitHub account/repository visibility and the current Pages terms/settings still apply.

## Input JSON shape

```json
{
  "title": "A clear news headline",
  "category": "TECHNOLOGY",
  "source_url": "https://example.com/article",
  "thumbnail_url": "https://example.com/thumbnail.jpg",
  "music_mood": "futuristic",
  "scenes": [
    {
      "headline": "The main development",
      "body": "One short, verified explanation of what happened.",
      "duration_sec": 5,
      "audio_cue": "impact",
      "visual_direction": "Glowing data lines on a dark background"
    }
  ]
}
```

Supported sound cues: `impact`, `whoosh`, `pulse`, `riser`, `soft`. Supported music moods: `cinematic`, `soft`, `tense`, `futuristic`, `hopeful`, `none`. Scene fields can be omitted where appropriate. A script with 4–6 scenes generally gives the best pacing.

## Files

- `index.html`, `styles.css`: app UI
- `app.js`: parsing, scene layout, Web Audio sound generation, canvas animation, recording and save/share
- `manifest.webmanifest`, `sw.js`: PWA install metadata and offline app shell
- `icons/`: app icons

## Version 0.2 changes

- Increased soundtrack and scene-effect levels; added dynamic compression to help avoid harsh peaks.
- Added a low + mid-frequency impact so scene transitions are less likely to disappear on phone speakers.
- Animated headline and body copy using a typewriter reveal and blinking cursor.
- Replaced the continuous timeline with segmented scene progress and a persistent `SLIDE 01 OF 05`-style counter.
- Bumped the service-worker cache name to `v2` so installed copies can pick up the updated files.
