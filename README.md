# WireUnWired Video Studio v0.8

A static installable PWA that turns a WireUnWired AI-generated script into a portrait news video on the device. It does not upload stories or videos to any platform and does not use paid AI APIs.

## v0.8 changes

- **No silent body/headline truncation:** the app no longer cuts text to a fixed character count or quietly takes only the first ten scenes. Oversized headlines move their overflow into body copy. Long bodies are split into continuation slides while preserving all words. The app returns a clear error if the source or expanded story exceeds the supported slide/runtime limits.
- **Reader-first timing:** default pacing is 115 WPM, Relaxed is 100 WPM and Fast is 145 WPM. Timing includes headline typing, supporting-text typing, headline + body word count, punctuation pauses and a 3.5-second reading buffer. Auto timing is not capped at 75 seconds. Each body is split at 24 words / 190 characters to keep it readable on a phone. A video may be up to six minutes; longer scripts should be split editorially rather than cut.
- **Three independent live audio controls:** Background Music, Sound Effects, and Master Volume. Controls update the active preview/render engine with a short gain ramp and apply to exported audio. A compressor and final limiter control peaks; high slider settings do not guarantee higher perceived loudness on every phone.
- **Optional local audio files:** select a background track (loops for the length of the story) and/or a short transition/impact effect. The selected files are read and decoded locally and replace the generated layer. They are not uploaded or retained after a reload. Maximum input size is 25 MB per file. “Use generated music/effects” returns to the built-in fallback.
- **MP4 validation:** conversion normalizes frame timestamps by frame number, encodes 30 fps H.264 + AAC at 48 kHz stereo, sets a 90 kHz video track timescale and writes `faststart` metadata. The browser checks the converted MP4 duration against the scene timeline and rejects an export whose metadata is unreadable or whose duration differs too much. The original recording remains available on a failed validation.
- **Offline cache version:** v8. First-time MP4 conversion still downloads FFmpeg.wasm files when the user taps conversion; an internet connection is required for that initial download.

## Deploy to GitHub Pages

Replace `app.js`, `index.html`, `styles.css`, `sw.js`, and `WIREUNWIRED_AI_GENERATOR_PROMPT.txt` in the root of your existing repository. Keep `manifest.webmanifest`, `.nojekyll`, and `icons/`. Commit the changes, wait for GitHub Pages to deploy, open the website once while online, refresh, then reopen the installed PWA.

## Script behavior

- Paste JSON from WireUnWired's AI Generator or plain text with blank lines between scene blocks.
- If `timing_mode` / `duration_mode` is not `fixed`, the app treats `duration_sec` as a suggested minimum and expands the scene for the complete text. Do not use fixed timing unless you intentionally want to override reading-time calculation.
- Input may have up to 18 source scenes; long bodies are split automatically into continuation slides. Up to 24 final slides and six minutes are supported. If limits are exceeded, the app explains the problem instead of silently discarding content.
- Prefer 4–6 source scenes with one idea per scene and 8–18 words per body. Some stories may expand to more slides if a body is too long.

## Audio files and rights

The included synthesized music/effects are an offline fallback. To use a real track, select a file you have permission to use. The app offers audio-library links as starting points, not a blanket licence for every file: check the particular asset's current licence and attribution/usage conditions, save a record of the licence, and avoid using copyrighted commercial music without permission.

- Pixabay music: https://pixabay.com/music/
- Pixabay sound effects: https://pixabay.com/sound-effects/
- Mixkit music: https://mixkit.co/free-stock-music/
- Mixkit sound effects: https://mixkit.co/free-sound-effects/
- YouTube Audio Library: https://www.youtube.com/audiolibrary

Uploaded music loops automatically. Use a track that loops cleanly, or trim it before uploading. For the transition/effect slot, use a short single effect (ideally 0.2–2 seconds); it replaces the built-in cue for non-soft scene transitions.

## MP4 social export

Use **Convert to MP4 for social apps** (WebM source) or **Optimize MP4 for social apps** (native MP4 source). The app writes constant-frame-rate H.264/AAC MP4, resets presentation timestamps based on the decoded frame sequence, and verifies the reported output duration. Keep the app in the foreground during recording/conversion; mobile video conversion is memory-intensive. If conversion fails the app keeps the original file and explains why it did not mark the result ready.

## Testing checklist

1. Prepare a short story with one normal scene and one body longer than 30 words. Verify all body text appears across original/continuation slides, and reading time increases with the text.
2. Preview the generated mix; change Music, Effects and Master sliders while audio is playing. Each control should be immediately audible.
3. Upload a licensed MP3/WAV soundtrack and a short effect; the file names should appear and the preview should use the supplied audio. Clear either file to restore the synthesized fallback.
4. Render a short story and confirm video plus audio playback.
5. Optimize/export the MP4 and verify duration is close to the displayed timeline. Test 15-, 30-, 60- and 90-second videos before relying on the file for social publishing.
6. Test the output directly in target apps on the phone. The app does not upload anything and cannot guarantee that a platform's transcoder/preview will behave identically on every account or device.
