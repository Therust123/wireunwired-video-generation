(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const els = {
    input: $('scriptInput'), charCount: $('charCount'), sampleBtn: $('sampleBtn'), prepareBtn: $('prepareBtn'),
    inputMessage: $('inputMessage'), themeSelect: $('themeSelect'), musicSelect: $('musicSelect'), readerPaceSelect: $('readerPaceSelect'), musicLevel: $('musicLevel'), musicLevelValue: $('musicLevelValue'), effectsLevel: $('effectsLevel'), effectsLevelValue: $('effectsLevelValue'), masterLevel: $('masterLevel'), masterLevelValue: $('masterLevelValue'), musicFile: $('musicFile'), musicFileName: $('musicFileName'), clearMusicFileBtn: $('clearMusicFileBtn'), sfxFile: $('sfxFile'), sfxFileName: $('sfxFileName'), clearSfxFileBtn: $('clearSfxFileBtn'), soundPreviewBtn: $('soundPreviewBtn'), previewPanel: $('previewPanel'),
    storyTitle: $('storyTitle'), storyCategory: $('storyCategory'), sceneCount: $('sceneCount'), sceneList: $('sceneList'),
    renderBtn: $('renderBtn'), renderPanel: $('renderPanel'), canvas: $('videoCanvas'), renderStatus: $('renderStatus'),
    progressLabel: $('progressLabel'), timeLabel: $('timeLabel'), progressBar: $('progressBar'), renderMessage: $('renderMessage'),
    resultActions: $('resultActions'), mp4Btn: $('mp4Btn'), downloadBtn: $('downloadBtn'), shareBtn: $('shareBtn'), exportHint: $('exportHint'), newVideoBtn: $('newVideoBtn'),
    cancelBtn: $('cancelBtn'), installBtn: $('installBtn'), toast: $('toast')
  };
  const SAMPLE = {
    title: 'The next wave of AI is moving beyond chat',
    category: 'ARTIFICIAL INTELLIGENCE',
    source_url: 'https://wireunwired.com/',
    music_mood: 'futuristic',
    scenes: [
      { headline: 'AI is moving beyond chat', body: 'The next chapter is about systems that can plan, use tools and take action.', duration_sec: 5, audio_cue: 'impact', visual_direction: 'A glowing network expanding across a dark digital grid.' },
      { headline: 'From answers to actions', body: 'AI products are increasingly being designed to complete multi-step tasks, not only respond to prompts.', duration_sec: 6, audio_cue: 'whoosh', visual_direction: 'Connected nodes and progress lines.' },
      { headline: 'The details matter', body: 'Reliability, permissions and human oversight remain important as these systems gain more autonomy.', duration_sec: 6, audio_cue: 'pulse', visual_direction: 'A sequence of three precise data panels.' },
      { headline: 'What comes next?', body: 'The most useful tools may be the ones that turn complex work into clear, verifiable steps.', duration_sec: 6, audio_cue: 'soft', visual_direction: 'A bright signal emerging from a calm field of data.' },
      { headline: 'Follow the signal', body: 'More technology stories and context at WireUnWired.', duration_sec: 5, audio_cue: 'impact', visual_direction: 'Minimal branded end card.' }
    ]
  };
  const THEMES = {
    tech: { a: '#07121d', b: '#102b3b', accent: '#82e7ff', secondary: '#3fbbdc', tag: 'TECH / FUTURE', glow: 'rgba(60,196,236,.18)' },
    breaking: { a: '#190d12', b: '#421c25', accent: '#ffad87', secondary: '#ff6b64', tag: 'THE LATEST', glow: 'rgba(255,87,91,.16)' },
    business: { a: '#0a1515', b: '#19342f', accent: '#a7f1c7', secondary: '#58c6a1', tag: 'BUSINESS BRIEF', glow: 'rgba(89,215,171,.15)' },
    science: { a: '#0d1022', b: '#20264a', accent: '#c5b5ff', secondary: '#8375ff', tag: 'SCIENCE / FUTURE', glow: 'rgba(133,115,255,.17)' }
  };
  // Increased local mix levels for phone speakers. The compressor below keeps peaks controlled.
  const MOODS = {
    cinematic: { notes: [110, 146.83, 174.61], filter: 900, volume: .155, cue: .96 },
    soft: { notes: [130.81, 164.81, 196], filter: 1150, volume: .105, cue: .82 },
    tense: { notes: [103.83, 123.47, 155.56], filter: 720, volume: .145, cue: 1.0 },
    futuristic: { notes: [116.54, 174.61, 233.08], filter: 1550, volume: .145, cue: .96 },
    hopeful: { notes: [130.81, 164.81, 220], filter: 1700, volume: .125, cue: .88 },
    none: { notes: [], filter: 1000, volume: 0, cue: .96 }
  };
  let prepared = null;
  let currentBlob = null;
  let originalBlob = null;
  let optimizedMp4 = false;
  let currentUrl = null;
  let ffmpegScriptPromise = null;
  let ffmpegInstance = null;
  let ffmpegFetchFile = null;
  let deferredInstallPrompt = null;
  let renderState = null;
  let soundPreviewEngine = null;
  let soundPreviewTimeout = null;
  let audioAssetFiles = { music: null, sfx: null };
  let toastTimer = null;

  function showMessage(target, message, type = '') {
    target.textContent = message;
    target.className = `inline-message${type ? ` ${type}` : ''}`;
  }
  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
  }
  function escapeText(value) { return String(value ?? '').trim(); }
  function cleanTitle(value, fallback = 'WireUnWired News') {
    const result = escapeText(value).replace(/[<>\u0000-\u001f]/g, '').slice(0, 150);
    return result || fallback;
  }
  function normalizeCue(value) {
    const cue = String(value || '').toLowerCase();
    if (/impact|hit|boom|dramatic|reveal/.test(cue)) return 'impact';
    if (/whoosh|transition|sweep|wind/.test(cue)) return 'whoosh';
    if (/pulse|digital|data|beep|tech/.test(cue)) return 'pulse';
    if (/soft|calm|ambient|none|silence/.test(cue)) return 'soft';
    if (/riser|build|tension/.test(cue)) return 'riser';
    return 'pulse';
  }
  function countWords(text) {
    const clean = String(text || '').trim();
    return clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  }
  function readerWordsPerMinute() {
    const pace = els.readerPaceSelect ? els.readerPaceSelect.value : 'normal';
    if (pace === 'relaxed') return 100;
    if (pace === 'fast') return 145;
    return 115;
  }
  function selectedAudioLevels() {
    return {
      music: clampNumber(Number(els.musicLevel?.value ?? 70) / 100, 0, 1.5),
      effects: clampNumber(Number(els.effectsLevel?.value ?? 100) / 100, 0, 1.5),
      master: clampNumber(Number(els.masterLevel?.value ?? 100) / 100, 0.5, 1.5)
    };
  }
  function updateAudioLevelLabels() {
    [['musicLevel', 'musicLevelValue'], ['effectsLevel', 'effectsLevelValue'], ['masterLevel', 'masterLevelValue']].forEach(([inputId, outputId]) => {
      const input = $(inputId), output = $(outputId);
      if (input && output) output.textContent = `${input.value}%`;
    });
  }
  async function readAudioAssetFile(kind, file) {
    if (!file) { audioAssetFiles[kind] = null; updateAudioAssetLabel(kind); return; }
    if (file.size > 25 * 1024 * 1024) {
      const input = kind === 'music' ? els.musicFile : els.sfxFile;
      if (input) input.value = '';
      showMessage(els.inputMessage, 'Choose an audio file smaller than 25 MB so it can be decoded reliably on a phone.', 'error');
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      audioAssetFiles[kind] = { name: file.name, type: file.type || 'application/octet-stream', bytes };
      updateAudioAssetLabel(kind);
      stopSoundPreview();
      showMessage(els.inputMessage, `${kind === 'music' ? 'Background soundtrack' : 'Transition effect'} loaded locally: ${file.name}. Preview the mix before rendering.`, 'success');
    } catch (error) {
      audioAssetFiles[kind] = null;
      showMessage(els.inputMessage, `Could not read that audio file. Try an MP3 or WAV. ${error.message || ''}`, 'error');
    }
  }
  function updateAudioAssetLabel(kind) {
    const target = kind === 'music' ? els.musicFileName : els.sfxFileName;
    if (!target) return;
    target.textContent = audioAssetFiles[kind]
      ? `Loaded locally · ${audioAssetFiles[kind].name}`
      : (kind === 'music' ? 'Built-in generated music' : 'Built-in generated effects');
    const clearButton = kind === 'music' ? els.clearMusicFileBtn : els.clearSfxFileBtn;
    if (clearButton) clearButton.hidden = !audioAssetFiles[kind];
  }
  async function decodeAudioAssets(ctx) {
    const decoded = { music: null, sfx: null };
    for (const kind of ['music', 'sfx']) {
      const asset = audioAssetFiles[kind];
      if (!asset) continue;
      try {
        decoded[kind] = await ctx.decodeAudioData(asset.bytes.slice().buffer);
      } catch (error) {
        throw new Error(`The uploaded ${kind === 'music' ? 'soundtrack' : 'effect'} could not be decoded by this browser. Try a standard MP3 or WAV file. (${error.message || 'unsupported audio format'})`);
      }
    }
    return decoded;
  }
  function clampNumber(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function normalizeScene(scene, index) {
    const s = typeof scene === 'string' ? { body: scene } : (scene || {});
    let headline = escapeText(s.headline || s.title || s.heading || s.text || `Key detail ${index + 1}`)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '') || `Key detail ${index + 1}`;
    let body = escapeText(s.body || s.subtitle || s.description || s.narration || s.copy || (s.text && s.text !== headline ? s.text : ''))
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

    // Keep headline typography readable without losing any source text: move any
    // overflow from an oversized heading into the body, where it will be split safely.
    if (headline.length > 72) {
      const words = headline.split(/\s+/);
      let first = [];
      let rest = [];
      for (const word of words) {
        if (!rest.length && (first.join(' ').length + word.length + (first.length ? 1 : 0)) <= 66) first.push(word);
        else rest.push(word);
      }
      if (first.length && rest.length) {
        headline = first.join(' ');
        body = [rest.join(' '), body].filter(Boolean).join(' ');
      }
    }
    let requestedDuration = Number(s.duration_sec ?? s.duration ?? s.seconds ?? 5);
    if (!Number.isFinite(requestedDuration)) requestedDuration = 5;
    requestedDuration = clampNumber(requestedDuration, 2, 180);
    const timingMode = String(s.timing_mode || s.duration_mode || '').toLowerCase();
    return {
      headline,
      body,
      requestedDuration,
      fixedTiming: timingMode === 'fixed' || timingMode === 'manual',
      audioCue: normalizeCue(s.audio_cue || s.audioCue || s.sound_effect || s.cue || ''),
      visualDirection: escapeText(s.visual_direction || s.visualDirection || s.visual || s.visual_prompt || ''),
      imageUrl: safeUrl(s.image_url || s.imageUrl || s.image || s.thumbnail_url || '')
    };
  }
  function chunkBodyText(text, maxWords = 24, maxChars = 190) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [''];
    const words = clean.split(' ');
    const chunks = [];
    let current = [];
    let length = 0;
    for (const word of words) {
      const extra = word.length + (current.length ? 1 : 0);
      if (current.length && (current.length >= maxWords || length + extra > maxChars)) {
        chunks.push(current.join(' '));
        current = [];
        length = 0;
      }
      // An unusually long token is kept whole instead of being silently discarded.
      current.push(word);
      length += word.length + (current.length > 1 ? 1 : 0);
    }
    if (current.length) chunks.push(current.join(' '));
    return chunks;
  }
  function continuationHeadline(headline, partNumber) {
    const clean = String(headline || 'Key detail').trim();
    const short = clean.length > 48 ? `${clean.slice(0, 45).replace(/\s+\S*$/, '')}…` : clean;
    return `Continued · ${short}`;
  }
  function timeScene(headline, body, base, partIndex, partCount) {
    const wpm = readerWordsPerMinute();
    // The renderer types characters at a fixed, readable pace. These durations are
    // not capped; long text is split into multiple scenes before timing is applied.
    const headlineTypingDuration = Math.max(0.9, headline.length / 24);
    const bodyTypingDuration = body ? Math.max(0.65, body.length / 32) : 0;
    const totalReadableWords = countWords(headline) + countWords(body);
    const punctuationMarks = (headline + ' ' + body).match(/[,.!?;:]/g)?.length || 0;
    const naturalPauses = Math.min(4.5, punctuationMarks * 0.20);
    const readingHoldDuration = (totalReadableWords / (wpm / 60)) + naturalPauses + 3.5;
    const minimumReadableDuration = headlineTypingDuration + 0.42 + bodyTypingDuration + readingHoldDuration + 1.1;
    const duration = base.fixedTiming && partCount === 1
      ? base.requestedDuration
      : Math.max(base.requestedDuration, minimumReadableDuration);
    return {
      headline, body, duration,
      headlineTypingDuration,
      bodyDelay: headlineTypingDuration + 0.28,
      bodyTypingDuration,
      readingHoldDuration,
      readWpm: wpm,
      autoTimed: !(base.fixedTiming && partCount === 1),
      audioCue: base.audioCue,
      visualDirection: base.visualDirection,
      imageUrl: base.imageUrl,
      continuationPart: partIndex > 0
    };
  }
  function expandAndTimeScene(base) {
    const chunks = chunkBodyText(base.body);
    return chunks.map((body, index) => {
      const headline = index === 0 ? base.headline : continuationHeadline(base.headline, index + 1);
      return timeScene(headline, body, base, index, chunks.length);
    });
  }
  function safeUrl(maybeUrl) {
    if (typeof maybeUrl !== 'string' || !maybeUrl.trim()) return '';
    try { const u = new URL(maybeUrl.trim()); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; }
    catch (_) { return ''; }
  }
  function sentenceChunks(text, max = 5) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
    if (sentences.length <= max) return sentences.map(x => x.trim()).filter(Boolean);
    const groups = Array.from({ length: max }, () => []);
    sentences.forEach((sentence, i) => groups[Math.min(max - 1, Math.floor(i * max / sentences.length))].push(sentence.trim()));
    return groups.map(g => g.join(' ').trim()).filter(Boolean);
  }
  function plainTextToStory(raw) {
    const blocks = raw.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean);
    if (!blocks.length) throw new Error('Paste a video script or story text first.');
    let title = blocks[0].replace(/^#\s*/, '').trim();
    let contentBlocks = blocks.slice(1);
    if (blocks.length === 1) {
      const lines = raw.split('\n').map(x => x.trim()).filter(Boolean);
      if (lines.length > 1) { title = lines[0].replace(/^#\s*/, ''); contentBlocks = lines.slice(1); }
      else {
        const sentences = sentenceChunks(raw, 6);
        title = sentences[0].length < 90 ? sentences.shift() : 'The story you need to know';
        contentBlocks = sentences;
      }
    }
    const combined = contentBlocks.join(' ');
    let segments;
    if (contentBlocks.length >= 3 && contentBlocks.length <= 8) segments = contentBlocks;
    else segments = sentenceChunks(combined || title, 5);
    if (!segments.length) segments = [title];
    const scenes = segments.map((part, i) => {
      const text = part.replace(/^[-*#\d.)\s]+/, '').trim();
      const firstClause = text.split(/[,;:.!?]/)[0].trim();
      const headline = firstClause.length >= 16 && firstClause.length <= 72 ? firstClause : (i === 0 ? 'Here is what happened' : `What to know · ${i + 1}`);
      return { headline, body: text, duration_sec: 5, audio_cue: i === 0 ? 'impact' : (i === segments.length - 1 ? 'soft' : 'whoosh') };
    });
    scenes.unshift({ headline: title, body: 'The story, the key detail and why it matters.', duration_sec: 4, audio_cue: 'impact' });
    scenes.push({ headline: 'Follow the signal', body: 'More context and technology stories at WireUnWired.', duration_sec: 4, audio_cue: 'soft' });
    return { title, category: 'WIREUNWIRED NEWS', scenes, music_mood: 'futuristic' };
  }
  function parseInput(raw) {
    const text = raw.trim();
    if (!text) throw new Error('Paste a script from WireUnWired AI Generator to begin.');
    let data;
    if (text.startsWith('{') || text.startsWith('[')) {
      try { data = JSON.parse(text); }
      catch (error) { throw new Error(`This looks like JSON, but it could not be read. Check commas and quotes. (${error.message})`); }
      if (Array.isArray(data)) data = { scenes: data };
      if (!data || typeof data !== 'object') throw new Error('The script should be a JSON object with a scenes array.');
      if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
        if (Array.isArray(data.storyboard)) data.scenes = data.storyboard;
        else if (Array.isArray(data.shots)) data.scenes = data.shots;
        else if (data.script || data.article_text || data.summary) data = plainTextToStory(String(data.script || data.article_text || data.summary));
        else throw new Error('No scenes found. Include a "scenes" array, or paste plain-text scene blocks.');
      }
    } else {
      // Allow markdown code fences around JSON when copied from an assistant.
      const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      if (unfenced !== text && (unfenced.startsWith('{') || unfenced.startsWith('['))) return parseInput(unfenced);
      data = plainTextToStory(text);
    }
    if (!Array.isArray(data.scenes) || data.scenes.length === 0) throw new Error('Could not find any scenes in the pasted script.');
    if (data.scenes.length > 18) throw new Error(`This script contains ${data.scenes.length} source scenes. Keep the input to 18 or fewer scenes; long bodies will be split automatically without losing text.`);
    const sourceScenes = data.scenes.map(normalizeScene);
    const scenes = sourceScenes.flatMap(expandAndTimeScene);
    if (!scenes.length) throw new Error('Add at least one scene to the script.');
    if (scenes.length > 24) throw new Error(`This story needs ${scenes.length} slides after splitting long text. Shorten the script or make each source scene more focused; no content has been silently discarded.`);
    const total = scenes.reduce((sum, s) => sum + s.duration, 0);
    if (total > 360) throw new Error(`This script needs about ${Math.ceil(total / 60)} minutes at the selected reading pace. For reliable local rendering on a phone, split it into shorter videos; no content has been silently discarded.`);
    const category = cleanTitle(data.category || data.topic || 'WIREUNWIRED NEWS', 'WIREUNWIRED NEWS').toUpperCase().slice(0, 42);
    return {
      title: cleanTitle(data.title || data.headline || data.story_title || scenes[0].headline),
      category,
      sourceUrl: safeUrl(data.source_url || data.url || ''),
      musicMood: String(data.music_mood || data.mood || 'futuristic').toLowerCase(),
      imageUrl: safeUrl(data.thumbnail_url || data.image_url || data.thumbnail || ''),
      scenes
    };
  }
  function renderSceneCards(story) {
    els.sceneList.replaceChildren();
    story.scenes.forEach((scene, index) => {
      const card = document.createElement('article'); card.className = 'scene-card';
      const number = document.createElement('div'); number.className = 'scene-number'; number.textContent = String(index + 1).padStart(2, '0');
      const main = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = scene.headline;
      const body = document.createElement('p'); body.textContent = scene.body || scene.visualDirection || 'Animated title scene';
      const tags = document.createElement('div'); tags.className = 'scene-tags';
      const cue = document.createElement('span'); cue.textContent = `SFX · ${scene.audioCue.toUpperCase()}`;
      const visual = document.createElement('span'); visual.textContent = scene.imageUrl ? 'IMAGE' : 'MOTION GRAPHIC';
      if (scene.continuationPart) { const continuation = document.createElement('span'); continuation.textContent = 'CONTINUED'; tags.append(continuation); }
      tags.append(cue, visual); main.append(title, body, tags);
      const duration = document.createElement('div'); duration.className = 'scene-duration'; duration.textContent = `${scene.duration.toFixed(1)} sec\nreadable`; duration.title = `Includes type-on animation and a reading window at ${scene.readWpm} words per minute`; 
      card.append(number, main, duration); els.sceneList.append(card);
    });
    const total = story.scenes.reduce((sum, s) => sum + s.duration, 0);
    els.sceneCount.textContent = `${story.scenes.length} SLIDES · ${Math.ceil(total)} SEC`;
    els.storyTitle.textContent = story.title;
    els.storyCategory.textContent = story.category;
  }
  function fmtTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5, revealCount = Infinity, showCursor = false, cursorTime = 0) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    const splitLongWord = (word) => {
      const parts = [];
      let part = '';
      for (const character of word) {
        if (part && ctx.measureText(part + character).width > maxWidth) { parts.push(part); part = character; }
        else part += character;
      }
      if (part) parts.push(part);
      return parts;
    };
    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) {
        if (line) { lines.push(line); line = ''; }
        const parts = splitLongWord(word);
        parts.slice(0, -1).forEach(part => lines.push(part));
        line = parts[parts.length - 1] || '';
        continue;
      }
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    // Never cut copy at the canvas boundary. Long bodies are split into continuation
    // slides before drawing; this final wrapper also handles an unusual long URL/token.
    const clipped = lines;
    let remaining = Number.isFinite(revealCount) ? Math.max(0, Math.floor(revealCount)) : Infinity;
    let lastVisible = null;
    clipped.forEach((ln, i) => {
      const shown = Number.isFinite(remaining) ? ln.slice(0, remaining) : ln;
      if (Number.isFinite(remaining)) remaining = Math.max(0, remaining - shown.length);
      if (shown.length) {
        ctx.fillText(shown, x, y + i * lineHeight);
        lastVisible = { text: shown, x, baseline: y + i * lineHeight };
      }
    });
    if (showCursor && lastVisible && Math.floor(cursorTime * 3.2) % 2 === 0) {
      const cursorX = x + ctx.measureText(lastVisible.text).width + 4;
      const cursorTop = lastVisible.baseline - Math.min(38, lineHeight - 12) + 5;
      roundedRect(ctx, cursorX, cursorTop, 3, Math.min(34, lineHeight - 14), 1.5, '#a4efff');
    } else if (showCursor && !lastVisible && Math.floor(cursorTime * 3.2) % 2 === 0) {
      roundedRect(ctx, x, y - Math.min(38, lineHeight - 12) + 5, 3, Math.min(34, lineHeight - 14), 1.5, '#a4efff');
    }
    return clipped.length;
  }
  function roundedRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function drawFrame(ctx, story, sceneIndex, localTime, globalTime, themeName) {
    const canvas = ctx.canvas; const W = canvas.width; const H = canvas.height; const theme = THEMES[themeName] || THEMES.tech;
    const scene = story.scenes[sceneIndex]; const duration = scene.duration;
    const p = Math.max(0, Math.min(1, localTime / duration)); const fade = Math.min(1, localTime / .42); const ease = 1 - Math.pow(1 - p, 3);
    const bg = ctx.createLinearGradient(0, 0, W * (.45 + Math.sin(globalTime * .14) * .15), H);
    bg.addColorStop(0, theme.a); bg.addColorStop(.58, theme.b); bg.addColorStop(1, '#070a11'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // Soft moving glow and fine grid create motion without stock footage.
    const gx = W * (.74 + Math.sin(globalTime * .27) * .13), gy = H * (.24 + Math.cos(globalTime * .22) * .055);
    const glow = ctx.createRadialGradient(gx, gy, 5, gx, gy, W * .72); glow.addColorStop(0, theme.glow); glow.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = .11; ctx.strokeStyle = theme.accent; ctx.lineWidth = 1;
    for (let x = -W; x < W * 2; x += 46) { ctx.beginPath(); ctx.moveTo(x + (globalTime * 3 % 46), 0); ctx.lineTo(x + (globalTime * 3 % 46), H); ctx.stroke(); }
    for (let y = 0; y < H; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.restore();
    // Large rings are a reusable abstract visual language for stories without images.
    ctx.save(); ctx.translate(W * .79, H * .29); ctx.rotate(globalTime * .06 + sceneIndex * .3); ctx.strokeStyle = theme.accent; ctx.globalAlpha = .12; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(0, 0, 68 + i * 37 + Math.sin(globalTime * .7 + i) * 5, .3, Math.PI * 1.56); ctx.stroke(); } ctx.restore();
    // Segmented progress makes the total number of slides obvious at a glance.
    const segmentGap = 8; const segmentWidth = (W - 108 - segmentGap * (story.scenes.length - 1)) / story.scenes.length;
    for (let i = 0; i < story.scenes.length; i++) {
      const sx = 54 + i * (segmentWidth + segmentGap);
      roundedRect(ctx, sx, 62, segmentWidth, 7, 3.5, 'rgba(255,255,255,.18)');
      const amount = i < sceneIndex ? 1 : (i === sceneIndex ? p : 0);
      if (amount > 0.015) roundedRect(ctx, sx, 62, Math.max(2, segmentWidth * amount), 7, 3.5, theme.accent);
    }
    // High-contrast slide counter stays visible in every scene (e.g. SLIDE 01 OF 05).
    roundedRect(ctx, W - 218, 84, 164, 35, 9, 'rgba(8,15,24,.78)', 'rgba(180,211,229,.24)');
    ctx.fillStyle = theme.accent; ctx.font = '800 12px system-ui, sans-serif'; ctx.letterSpacing = '1px'; ctx.textAlign = 'center';
    ctx.fillText(`SLIDE ${String(sceneIndex + 1).padStart(2, '0')} OF ${String(story.scenes.length).padStart(2, '0')}`, W - 136, 106); ctx.textAlign = 'left';
    ctx.fillStyle = theme.accent; ctx.font = '800 18px system-ui, sans-serif'; ctx.letterSpacing = '3px'; ctx.fillText('WIREUNWIRED', 54, 126);
    ctx.fillStyle = 'rgba(235,244,252,.66)'; ctx.font = '700 13px system-ui, sans-serif'; ctx.letterSpacing = '2px'; ctx.fillText((story.category || theme.tag).slice(0, 27).toUpperCase(), 54, 157);
    const intro = sceneIndex === 0; const outro = sceneIndex === story.scenes.length - 1;
    if (intro) {
      roundedRect(ctx, 54, 214, 220, 38, 8, theme.secondary);
      ctx.fillStyle = theme.a; ctx.font = '900 14px system-ui, sans-serif'; ctx.letterSpacing = '2px'; ctx.fillText('THE BIG STORY', 72, 239);
    } else {
      const label = outro ? 'THE SIGNAL CONTINUES' : `KEY DEVELOPMENT 0${Math.min(sceneIndex, 9)}`;
      ctx.fillStyle = theme.accent; ctx.font = '800 14px system-ui, sans-serif'; ctx.letterSpacing = '2px'; ctx.fillText(label, 54, 232);
    }
    const yBase = intro ? 355 : 320; const slide = (1 - fade) * 28; ctx.save(); ctx.globalAlpha = fade; ctx.translate(0, slide);
    const headlineText = scene.headline || '';
    const bodyText = scene.body || '';
    const headlineDuration = scene.headlineTypingDuration || Math.min(2.8, Math.max(.72, headlineText.length / 27));
    const bodyDelay = scene.bodyDelay ?? (headlineDuration + .24);
    const bodyDuration = bodyText ? (scene.bodyTypingDuration || Math.min(5, Math.max(.72, bodyText.length / 42))) : 0;
    const headlineProgress = Math.max(0, Math.min(1, localTime / headlineDuration));
    const bodyProgress = Math.max(0, Math.min(1, (localTime - bodyDelay) / bodyDuration));
    const headlineChars = Math.ceil(headlineText.length * headlineProgress);
    const bodyChars = Math.ceil(bodyText.length * bodyProgress);
    const titleTyping = headlineProgress < 1;
    const bodyTyping = bodyText.length > 0 && localTime >= bodyDelay && bodyProgress < 1;
    ctx.fillStyle = '#f5f8fc'; ctx.font = `850 ${intro ? 54 : 49}px system-ui, sans-serif`; ctx.letterSpacing = '-1.6px';
    const headlineLines = wrapText(ctx, headlineText, 54, yBase, W - 108, intro ? 68 : 62, 4, headlineChars, titleTyping, globalTime);
    const bodyY = yBase + headlineLines * (intro ? 68 : 62) + 33;
    ctx.fillStyle = '#bdcbd9'; ctx.font = '500 23px system-ui, sans-serif'; ctx.letterSpacing = '0px';
    wrapText(ctx, bodyText, 56, bodyY, W - 112, 34, 8, bodyChars, bodyTyping, globalTime + .4);
    ctx.restore();
    // Lower visual motif reacts to time and audio-cue family.
    const motifY = H - 300; ctx.save(); ctx.globalAlpha = .8;
    if (scene.imageUrl && renderState && renderState.images[sceneIndex] && renderState.images[sceneIndex].ok) {
      const image = renderState.images[sceneIndex].img; const iw = image.naturalWidth || image.width; const ih = image.naturalHeight || image.height;
      if (iw && ih) {
        roundedRect(ctx, 54, motifY - 8, W - 108, 174, 18, 'rgba(5,10,17,.7)', `rgba(255,255,255,.2)`);
        ctx.save(); ctx.beginPath(); ctx.roundRect(61, motifY - 1, W - 122, 160, 13); ctx.clip();
        const scale = Math.max((W - 122) / iw, 160 / ih) * (1.01 + p * .04); const sw = iw * scale, sh = ih * scale;
        const sx = (W - sw) / 2 + Math.sin(globalTime * .28) * 8, sy = motifY - 1 + (160 - sh) / 2;
        ctx.globalAlpha = .82; ctx.drawImage(image, sx, sy, sw, sh);
        const shade = ctx.createLinearGradient(0, motifY, 0, motifY + 160); shade.addColorStop(0, 'rgba(4,9,16,0)'); shade.addColorStop(1, 'rgba(4,9,16,.8)'); ctx.fillStyle = shade; ctx.fillRect(61, motifY - 1, W - 122, 160); ctx.restore();
      }
    } else {
      ctx.strokeStyle = theme.accent; ctx.lineWidth = 2; ctx.globalAlpha = .5;
      const base = motifY + 72;
      ctx.beginPath();
      for (let x = 56; x <= W - 56; x += 4) {
        const nx = (x - 56) / (W - 112); const envelope = Math.sin(nx * Math.PI) * .8 + .2;
        const wave = Math.sin(nx * 22 + globalTime * 2.8) * 20 + Math.sin(nx * 48 - globalTime * 1.8) * 9;
        const yy = base + wave * envelope * (scene.audioCue === 'impact' && p < .45 ? 1.3 : 1);
        if (x === 56) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      } ctx.stroke();
      ctx.globalAlpha = .12; ctx.fillStyle = theme.accent; ctx.fillRect(54, motifY + 30, W - 108, 84);
    }
    ctx.restore();
    const footerY = H - 83; ctx.strokeStyle = 'rgba(223,237,248,.18)'; ctx.beginPath(); ctx.moveTo(54, footerY - 28); ctx.lineTo(W - 54, footerY - 28); ctx.stroke();
    ctx.fillStyle = 'rgba(232,241,249,.64)'; ctx.font = '600 14px system-ui, sans-serif'; ctx.letterSpacing = '1px'; ctx.fillText(outro ? 'MORE CONTEXT. LESS NOISE.' : 'UNDERSTAND THE STORY.', 54, footerY);
    ctx.fillStyle = theme.accent; ctx.font = '800 14px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('WIREUNWIRED.COM', W - 54, footerY); ctx.textAlign = 'left';
    if (outro && story.sourceUrl) {
      let sourceLabel = story.sourceUrl; try { sourceLabel = new URL(story.sourceUrl).hostname.replace(/^www\./, ''); } catch (_) {}
      ctx.fillStyle = 'rgba(232,241,249,.5)'; ctx.font = '500 11px system-ui, sans-serif'; ctx.letterSpacing = '.4px'; ctx.fillText(`SOURCE: ${sourceLabel.slice(0, 54)}`, 54, footerY + 24);
    }
    // Tiny film grain-like specks are deterministic and subtle (not random each frame).
    ctx.save(); ctx.globalAlpha = .08; for (let i = 0; i < 34; i++) { const x = (i * 97 + Math.floor(globalTime * 14) * 19) % W; const y = (i * 173 + Math.floor(globalTime * 9) * 23) % H; ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 2, 2); } ctx.restore();
  }
  function getAudioMood(story) {
    const chosen = els.musicSelect.value;
    if (chosen !== 'auto') return chosen;
    const mood = String(story.musicMood || 'futuristic').toLowerCase();
    if (mood.includes('soft') || mood.includes('calm') || mood.includes('thoughtful')) return 'soft';
    if (mood.includes('tense') || mood.includes('urgent') || mood.includes('dark')) return 'tense';
    if (mood.includes('hope') || mood.includes('positive') || mood.includes('warm')) return 'hopeful';
    if (mood.includes('cinematic') || mood.includes('dramatic')) return 'cinematic';
    if (mood.includes('none') || mood.includes('silent')) return 'none';
    return 'futuristic';
  }
  async function preloadImages(story) {
    return Promise.all(story.scenes.map(async scene => {
      const url = scene.imageUrl || story.imageUrl || '';
      if (!url) return { ok: false };
      const img = new Image(); img.crossOrigin = 'anonymous';
      const loaded = await new Promise(resolve => {
        let done = false; const finish = ok => { if (!done) { done = true; resolve(ok); } };
        img.onload = () => finish(true); img.onerror = () => finish(false);
        img.src = url; setTimeout(() => finish(false), 4200);
      });
      return { img, ok: loaded };
    }));
  }
  function selectedMimeType() {
    if (!window.MediaRecorder) throw new Error('This browser cannot record videos. Use Chrome on Android or Safari on a supported iPhone.');
    // Prefer MP4 when the browser can record it natively. Chrome on many Android devices
    // falls back to WebM; the export screen then offers an actual MP4 transcode (not a rename).
    const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }
  async function startRender() {
    stopSoundPreview();
    if (!prepared || renderState?.running) return;
    let mimeType;
    try { mimeType = selectedMimeType(); }
    catch (error) { showMessage(els.renderMessage, error.message, 'error'); return; }
    currentBlob = null;
    optimizedMp4 = false;
    if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
    els.renderPanel.hidden = false; els.renderPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    els.resultActions.hidden = true; els.cancelBtn.hidden = false; els.renderBtn.disabled = true; els.renderMessage.textContent = '';
    els.progressBar.style.width = '0%'; els.progressLabel.textContent = '0% complete'; els.timeLabel.textContent = '00:00 / ' + fmtTime(prepared.total); els.renderStatus.textContent = 'Loading available visuals…';
    const canvas = els.canvas; canvas.width = 720; canvas.height = 1280; const ctx = canvas.getContext('2d', { alpha: false });
    const story = prepared.story; const themeName = els.themeSelect.value; const moodName = getAudioMood(story);
    const renderToken = { running: true, cancelled: false, raf: 0, recorder: null, streams: [], audio: null, audioCtx: null, wakeLock: null, startedAt: 0, total: prepared.total, images: [] }; renderState = renderToken;
    try {
      renderToken.images = await preloadImages(story);
      if (renderToken.cancelled) return;
      const canvasStream = canvas.captureStream(30); renderToken.streams.push(canvasStream);
      // One audio context feeds the recorder, keeping the soundtrack synchronized with the canvas stream.
      const AudioCtx = window.AudioContext || window.webkitAudioContext; const audioCtx = new AudioCtx(); renderToken.audioCtx = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();
      const decodedAssets = await decodeAudioAssets(audioCtx);
      if (renderToken.cancelled) { await audioCtx.close(); return; }
      const audioEngine = createAudioEngineInContext(audioCtx, moodName, destination, selectedAudioLevels(), decodedAssets); renderToken.audio = audioEngine;
      const combined = new MediaStream([...canvasStream.getVideoTracks(), ...destination.stream.getAudioTracks()]); renderToken.streams.push(destination.stream, combined);
      const options = { videoBitsPerSecond: 3_800_000, audioBitsPerSecond: 128_000 };
      if (mimeType) options.mimeType = mimeType;
      const recorder = new MediaRecorder(combined, options); renderToken.recorder = recorder;
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data && event.data.size) chunks.push(event.data); };
      recorder.onerror = (event) => { showMessage(els.renderMessage, 'Recorder error. Try a shorter video or close other apps.', 'error'); console.error('MediaRecorder error', event.error || event); };
      recorder.onstop = async () => {
        renderToken.running = false;
        renderToken.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
        try { await audioEngine.close(); } catch (_) {}
        if (renderToken.wakeLock) { try { await renderToken.wakeLock.release(); } catch (_) {} }
        els.cancelBtn.hidden = true; els.renderBtn.disabled = false;
        if (renderToken.cancelled) { showMessage(els.renderMessage, 'Render cancelled. Your original script is still here.'); return; }
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' });
        if (!blob.size) { showMessage(els.renderMessage, 'The browser produced an empty video. Try again in Chrome and keep the app in the foreground.', 'error'); return; }
        originalBlob = blob; currentBlob = blob; currentUrl = URL.createObjectURL(blob);
        els.progressBar.style.width = '100%'; els.progressLabel.textContent = '100% complete'; els.timeLabel.textContent = `${fmtTime(renderToken.total)} / ${fmtTime(renderToken.total)}`;
        els.renderStatus.textContent = 'Video ready'; els.resultActions.hidden = false;
        updateExportActions();
        const nativeMp4 = /mp4/i.test(blob.type);
        showMessage(els.renderMessage, `Your video is ready as ${nativeMp4 ? 'MP4' : 'WebM'} (${(blob.size / (1024 * 1024)).toFixed(1)} MB). ${nativeMp4 ? 'Before uploading, use Optimize MP4 for social apps to normalize frame rate and audio.' : 'Convert it to MP4 for better social-app compatibility.'}`, 'success');
        setShareVisibility(); els.resultActions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      try { if ('wakeLock' in navigator) renderToken.wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
      await audioCtx.resume();
      audioEngine.start();
      recorder.start(500);
      const startAt = performance.now(); renderToken.startedAt = startAt; const sceneStarts = []; let total = 0;
      story.scenes.forEach(s => { sceneStarts.push(total); total += s.duration; });
      let lastScene = -1;
      const theme = themeName;
      const draw = (now) => {
        if (renderToken.cancelled || !renderToken.running) return;
        const elapsed = Math.min(renderToken.total, (now - startAt) / 1000);
        let idx = story.scenes.length - 1;
        for (let i = 0; i < sceneStarts.length; i++) { if (elapsed < sceneStarts[i] + story.scenes[i].duration) { idx = i; break; } }
        if (idx !== lastScene) {
          const audioWhen = audioCtx.currentTime + .03;
          audioEngine.chord(idx, audioWhen); audioEngine.playCue(story.scenes[idx].audioCue, audioWhen + .08);
          lastScene = idx; els.renderStatus.textContent = `Scene ${idx + 1} of ${story.scenes.length} · ${story.scenes[idx].headline}`;
        }
        const local = Math.max(0, elapsed - sceneStarts[idx]);
        drawFrame(ctx, story, idx, local, elapsed, theme);
        const pct = Math.min(100, elapsed / renderToken.total * 100);
        els.progressBar.style.width = `${pct}%`; els.progressLabel.textContent = `${Math.floor(pct)}% complete`; els.timeLabel.textContent = `${fmtTime(elapsed)} / ${fmtTime(renderToken.total)}`;
        if (elapsed >= renderToken.total) { drawFrame(ctx, story, idx, story.scenes[idx].duration, elapsed, theme); setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 140); return; }
        renderToken.raf = requestAnimationFrame(draw);
      };
      renderToken.raf = requestAnimationFrame(draw);
    } catch (error) {
      console.error(error);
      renderToken.running = false; els.renderBtn.disabled = false; els.cancelBtn.hidden = true;
      renderToken.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
      if (renderToken.audio) { try { await renderToken.audio.close(); } catch (_) {} }
      else if (renderToken.audioCtx && renderToken.audioCtx.state !== 'closed') { try { await renderToken.audioCtx.close(); } catch (_) {} }
      showMessage(els.renderMessage, `Could not start the video renderer: ${error.message || error}. Try Chrome on Android and a shorter script.`, 'error');
    }
  }
  function createAudioEngineInContext(ctx, moodName, destination, initialLevels = selectedAudioLevels(), assets = {}) {
    // Separate buses allow independent live control of music, scene effects and master.
    // Optional user-supplied audio replaces the matching synthesized layer; the video
    // and audio still remain entirely local to the browser.
    const levels = { ...initialLevels };
    const master = ctx.createGain(); master.gain.value = levels.master;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -17; compressor.knee.value = 16; compressor.ratio.value = 4.2;
    compressor.attack.value = .008; compressor.release.value = .24;
    const makeup = ctx.createGain(); makeup.gain.value = 1.18;
    const safetyLimiter = ctx.createDynamicsCompressor();
    safetyLimiter.threshold.value = -2.5; safetyLimiter.knee.value = 2.5; safetyLimiter.ratio.value = 16;
    safetyLimiter.attack.value = .003; safetyLimiter.release.value = .16;
    master.connect(compressor); compressor.connect(makeup); makeup.connect(safetyLimiter); safetyLimiter.connect(destination);

    const presetMusicGain = moodName === 'futuristic' ? 1.0 : .92;
    let baseMusicGain = (assets.music ? 1.0 : presetMusicGain) * levels.music;
    const musicBus = ctx.createGain(); musicBus.gain.value = baseMusicGain; musicBus.connect(master);
    const sfxBus = ctx.createGain(); sfxBus.gain.value = levels.effects; sfxBus.connect(master);
    const mood = MOODS[moodName] || MOODS.futuristic;
    const oscillators = [];
    let schedulerTimer = null;
    let nextMusicTime = 0;
    let musicStep = 0;
    let futureTranspose = 0;
    let customMusicSource = null;

    // Keep non-futuristic presets as the earlier sustained-pad sound.
    if (!assets.music && mood.notes.length && moodName !== 'futuristic') {
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = mood.filter; filter.Q.value = .55; filter.connect(musicBus);
      ['sine', 'triangle', 'sine'].forEach((type, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = type; osc.frequency.value = mood.notes[i];
        gain.gain.value = mood.volume * [.52, .27, .18][i];
        osc.connect(gain); gain.connect(filter); osc.start();
        oscillators.push({ osc, gain, baseFrequency: mood.notes[i] });
      });
    }

    // Futuristic: warm D-major pad with gentle harmonics, without the watery filter sweep.
    if (!assets.music && moodName === 'futuristic') {
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass'; padFilter.frequency.value = 2850; padFilter.Q.value = .22; padFilter.connect(musicBus);
      const padNotes = [146.83, 185.00, 220.00, 293.66]; // D, F#, A, D
      const padTypes = ['sine', 'triangle', 'sine', 'sine'];
      const padLevels = [.048, .025, .029, .013];
      padNotes.forEach((frequency, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = padTypes[i]; osc.frequency.value = frequency;
        // Very slow, shallow detune adds width without making the sound wobble.
        osc.detune.value = i === 1 ? -2 : (i === 2 ? 2 : 0);
        gain.gain.value = padLevels[i]; osc.connect(gain); gain.connect(padFilter); osc.start();
        oscillators.push({ osc, gain, baseFrequency: frequency });
      });
    }

    function chord(index, when) {
      if (!oscillators.length) return;
      // A restrained D → C → G → D harmonic path stays musical rather than randomly detuning.
      const futureOffsets = [0, -2, 5, 0, 0];
      const generalOffsets = (moodName === 'tense' ? [0, 1, -1, 0, 2] : [0, 2, 4, 1, 3]);
      const semitones = (moodName === 'futuristic' ? futureOffsets : generalOffsets)[index % 5];
      if (moodName === 'futuristic') futureTranspose = semitones;
      oscillators.forEach((o) => {
        o.osc.frequency.cancelScheduledValues(when);
        o.osc.frequency.setTargetAtTime(o.baseFrequency * Math.pow(2, semitones / 12), when, .32);
      });
    }

    // Pleasant, short synth notes in a major-key pattern: warm and modern, not sharp or bubbly.
    const futurePattern = [293.66, 0, 440.00, 369.99, 0, 440.00, 329.63, 0, 493.88, 392.00, 0, 493.88];
    function playFutureNote(frequency, when, velocity = .12) {
      if (!frequency) return;
      const osc = ctx.createOscillator(); const overtone = ctx.createOscillator();
      const toneGain = ctx.createGain(); const overtoneGain = ctx.createGain();
      const toneFilter = ctx.createBiquadFilter();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(frequency, when);
      overtone.type = 'sine'; overtone.frequency.setValueAtTime(frequency * 2, when);
      toneFilter.type = 'lowpass'; toneFilter.frequency.setValueAtTime(2400, when); toneFilter.Q.value = .28;
      toneGain.gain.setValueAtTime(.0001, when);
      toneGain.gain.linearRampToValueAtTime(velocity, when + .022);
      toneGain.gain.exponentialRampToValueAtTime(.0001, when + .39);
      overtoneGain.gain.setValueAtTime(.0001, when);
      overtoneGain.gain.linearRampToValueAtTime(velocity * .19, when + .018);
      overtoneGain.gain.exponentialRampToValueAtTime(.0001, when + .24);
      osc.connect(toneFilter); toneFilter.connect(toneGain); toneGain.connect(musicBus);
      overtone.connect(overtoneGain); overtoneGain.connect(musicBus);
      osc.start(when); overtone.start(when); osc.stop(when + .42); overtone.stop(when + .27);
    }
    function duckMusic(when, strength = .68) {
      if (moodName === 'none' && !assets.music) return;
      const param = musicBus.gain;
      try {
        param.cancelScheduledValues(when);
        param.setValueAtTime(Math.max(.001, param.value), when);
        param.linearRampToValueAtTime(baseMusicGain * strength, when + .045);
        param.setValueAtTime(baseMusicGain * strength, when + .20);
        param.linearRampToValueAtTime(baseMusicGain, when + .72);
      } catch (_) {}
    }
    function playBassPulse(when, level) {
      // A very restrained warm pulse adds rhythm on phones without relying on sub-bass alone.
      const low = ctx.createOscillator(), harmonic = ctx.createOscillator();
      const lowGain = ctx.createGain(), harmonicGain = ctx.createGain();
      low.type = 'sine'; low.frequency.setValueAtTime(73.42, when);
      harmonic.type = 'triangle'; harmonic.frequency.setValueAtTime(146.83, when);
      lowGain.gain.setValueAtTime(.0001, when);
      lowGain.gain.linearRampToValueAtTime(level * .42, when + .018);
      lowGain.gain.exponentialRampToValueAtTime(.0001, when + .25);
      harmonicGain.gain.setValueAtTime(.0001, when);
      harmonicGain.gain.linearRampToValueAtTime(level * .32, when + .014);
      harmonicGain.gain.exponentialRampToValueAtTime(.0001, when + .18);
      low.connect(lowGain); lowGain.connect(musicBus); harmonic.connect(harmonicGain); harmonicGain.connect(musicBus);
      low.start(when); harmonic.start(when); low.stop(when + .27); harmonic.stop(when + .2);
    }
    function scheduleFutureMusic() {
      if (moodName !== 'futuristic' || assets.music || ctx.state === 'closed') return;
      const horizon = ctx.currentTime + .16;
      while (nextMusicTime < horizon) {
        const note = futurePattern[musicStep % futurePattern.length];
        if (note) playFutureNote(note * Math.pow(2, futureTranspose / 12), nextMusicTime, musicStep % futurePattern.length === 0 ? .16 : .128);
        if (musicStep % 2 === 0) playBassPulse(nextMusicTime, musicStep % 4 === 0 ? .045 : .032);
        nextMusicTime += .46;
        musicStep++;
      }
    }
    function start() {
      if (customMusicSource || schedulerTimer !== null) return;
      if (assets.music) {
        customMusicSource = ctx.createBufferSource();
        customMusicSource.buffer = assets.music;
        customMusicSource.loop = true;
        customMusicSource.connect(musicBus);
        customMusicSource.start(ctx.currentTime + .04);
      }
      if (moodName !== 'futuristic' || assets.music) return;
      nextMusicTime = ctx.currentTime + .06;
      scheduleFutureMusic();
      schedulerTimer = setInterval(scheduleFutureMusic, 45);
    }

    function playCue(cueName, when) {
      // Leave the scene-change whoosh intact: this was the effect that sounded best in testing.
      const cue = normalizeCue(cueName); if (cue === 'soft') return;
      if (assets.sfx) {
        duckMusic(when, cue === 'impact' ? .58 : .74);
        const source = ctx.createBufferSource();
        const envelope = ctx.createGain();
        const clipLength = Math.max(.12, Math.min(assets.sfx.duration, cue === 'impact' ? 1.05 : 1.35));
        source.buffer = assets.sfx;
        source.playbackRate.setValueAtTime(cue === 'impact' ? .92 : 1.0, when);
        envelope.gain.setValueAtTime(.0001, when);
        envelope.gain.linearRampToValueAtTime(cue === 'impact' ? .9 : .75, when + Math.min(.035, clipLength * .15));
        envelope.gain.setValueAtTime(cue === 'impact' ? .9 : .75, when + clipLength * .66);
        envelope.gain.exponentialRampToValueAtTime(.0001, when + clipLength);
        source.connect(envelope); envelope.connect(sfxBus);
        source.start(when, 0, clipLength);
        source.stop(when + clipLength + .02);
        return;
      }
      if (cue === 'impact') {
        duckMusic(when, .54);
        const osc = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
        osc.type = 'sine'; osc.frequency.setValueAtTime(125, when); osc.frequency.exponentialRampToValueAtTime(48, when + .36);
        filter.type = 'lowpass'; filter.frequency.value = 260;
        gain.gain.setValueAtTime(.0001, when); gain.gain.exponentialRampToValueAtTime(.31 * mood.cue, when + .018); gain.gain.exponentialRampToValueAtTime(.0001, when + .46);
        osc.connect(filter); filter.connect(gain); gain.connect(sfxBus); osc.start(when); osc.stop(when + .49);
        const n = Math.floor(ctx.sampleRate * .16); const buffer = ctx.createBuffer(1, n, ctx.sampleRate); const values = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) values[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const click = ctx.createBufferSource(), clickFilter = ctx.createBiquadFilter(), clickGain = ctx.createGain(); click.buffer = buffer;
        clickFilter.type = 'bandpass'; clickFilter.frequency.value = 950; clickFilter.Q.value = .85;
        clickGain.gain.setValueAtTime(.16 * mood.cue, when); clickGain.gain.exponentialRampToValueAtTime(.0001, when + .15);
        click.connect(clickFilter); clickFilter.connect(clickGain); clickGain.connect(sfxBus); click.start(when); click.stop(when + .16);
      } else if (cue === 'whoosh' || cue === 'riser') {
        duckMusic(when, cue === 'riser' ? .56 : .70);
        const sweepDuration = cue === 'riser' ? .92 : .66;
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sweepDuration), ctx.sampleRate); const values = buffer.getChannelData(0);
        for (let i = 0; i < values.length; i++) {
          const t = i / values.length;
          const envelope = Math.pow(Math.sin(Math.PI * t), 1.6);
          values[i] = (Math.random() * 2 - 1) * envelope;
        }
        const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), noiseGain = ctx.createGain(); source.buffer = buffer;
        filter.type = 'bandpass'; filter.frequency.setValueAtTime(360, when); filter.frequency.exponentialRampToValueAtTime(cue === 'riser' ? 2500 : 1850, when + sweepDuration * .78); filter.Q.value = 1.05;
        noiseGain.gain.setValueAtTime(.0001, when); noiseGain.gain.linearRampToValueAtTime((cue === 'riser' ? .105 : .078) * mood.cue, when + sweepDuration * .34); noiseGain.gain.exponentialRampToValueAtTime(.0001, when + sweepDuration);
        source.connect(filter); filter.connect(noiseGain); noiseGain.connect(sfxBus); source.start(when); source.stop(when + sweepDuration + .02);
        // A smooth tonal rise gives the transition a cleaner digital identity, so it feels less like a vacuum/water-filter noise.
        const tone = ctx.createOscillator(), toneFilter = ctx.createBiquadFilter(), toneGain = ctx.createGain();
        tone.type = 'triangle'; tone.frequency.setValueAtTime(cue === 'riser' ? 165 : 220, when); tone.frequency.exponentialRampToValueAtTime(cue === 'riser' ? 587.33 : 440, when + sweepDuration * .82);
        toneFilter.type = 'lowpass'; toneFilter.frequency.setValueAtTime(1500, when); toneFilter.Q.value = .25;
        toneGain.gain.setValueAtTime(.0001, when); toneGain.gain.linearRampToValueAtTime((cue === 'riser' ? .07 : .052) * mood.cue, when + .12); toneGain.gain.exponentialRampToValueAtTime(.0001, when + sweepDuration * .94);
        tone.connect(toneFilter); toneFilter.connect(toneGain); toneGain.connect(sfxBus); tone.start(when); tone.stop(when + sweepDuration + .02);
      } else {
        // Clean two-note digital marker instead of a watery downward blip.
        duckMusic(when, .72);
        [[660, 0], [990, .075]].forEach(([frequency, offset], idx) => {
          const osc = ctx.createOscillator(), gain = ctx.createGain();
          osc.type = 'sine'; osc.frequency.setValueAtTime(frequency, when + offset);
          gain.gain.setValueAtTime(.0001, when + offset);
          gain.gain.linearRampToValueAtTime((idx ? .052 : .065) * mood.cue, when + offset + .012);
          gain.gain.exponentialRampToValueAtTime(.0001, when + offset + .16);
          osc.connect(gain); gain.connect(sfxBus); osc.start(when + offset); osc.stop(when + offset + .18);
        });
      }
    }
    function setLevels(nextLevels) {
      levels.music = clampNumber(Number(nextLevels.music ?? levels.music), 0, 1.5);
      levels.effects = clampNumber(Number(nextLevels.effects ?? levels.effects), 0, 1.5);
      levels.master = clampNumber(Number(nextLevels.master ?? levels.master), .5, 1.5);
      baseMusicGain = (assets.music ? 1.0 : presetMusicGain) * levels.music;
      musicBus.gain.setTargetAtTime(baseMusicGain, ctx.currentTime, .035);
      sfxBus.gain.setTargetAtTime(levels.effects, ctx.currentTime, .035);
      master.gain.setTargetAtTime(levels.master, ctx.currentTime, .035);
    }
    return {
      ctx, chord, playCue, start, setLevels,
      close: () => {
        if (schedulerTimer !== null) clearInterval(schedulerTimer);
        oscillators.forEach(o => { try { o.osc.stop(); } catch (_) {} });
        try { if (customMusicSource) customMusicSource.stop(); } catch (_) {}
        return ctx.close();
      }
    };
  }
  function stopSoundPreview() {
    if (soundPreviewTimeout !== null) clearTimeout(soundPreviewTimeout);
    soundPreviewTimeout = null;
    const engine = soundPreviewEngine; soundPreviewEngine = null;
    if (engine) { try { engine.close().catch(() => {}); } catch (_) {} }
    if (els.soundPreviewBtn) els.soundPreviewBtn.textContent = '▶ Preview current mix + transitions';
  }
  async function previewSoundDesign() {
    if (soundPreviewEngine) { stopSoundPreview(); return; }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) { toast('Audio preview is not supported in this browser.'); return; }
    let previewCtx = null;
    try {
      const ctx = new AudioCtx(); previewCtx = ctx;
      const decodedAssets = await decodeAudioAssets(ctx);
      await ctx.resume();
      const engine = createAudioEngineInContext(ctx, getAudioMood({ musicMood: 'futuristic' }), ctx.destination, selectedAudioLevels(), decodedAssets);
      soundPreviewEngine = engine; engine.start();
      const now = ctx.currentTime + .035;
      engine.chord(0, now); engine.playCue('impact', now + .08); engine.playCue('whoosh', now + 2.45);
      engine.setLevels(selectedAudioLevels());
      els.soundPreviewBtn.textContent = '■ Stop sound preview';
      soundPreviewTimeout = setTimeout(stopSoundPreview, 6500);
    } catch (error) {
      stopSoundPreview();
      if (previewCtx && previewCtx.state !== 'closed') { try { await previewCtx.close(); } catch (_) {} }
      console.error(error); toast(error?.message || 'Could not play the audio preview. Tap again or check your phone volume.');
    }
  }
  function cancelRender() {
    if (!renderState || !renderState.running) return;
    renderState.cancelled = true; renderState.running = false;
    if (renderState.raf) cancelAnimationFrame(renderState.raf);
    if (renderState.recorder && renderState.recorder.state !== 'inactive') renderState.recorder.stop();
    else {
      renderState.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
      if (renderState.audio) renderState.audio.close().catch(() => {});
      else if (renderState.audioCtx && renderState.audioCtx.state !== 'closed') renderState.audioCtx.close().catch(() => {});
      els.renderBtn.disabled = false; els.cancelBtn.hidden = true;
      showMessage(els.renderMessage, 'Render cancelled. Your script is still here.');
    }
  }
  function filename() {
    return (prepared?.story?.title || 'wireunwired-video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 58) || 'wireunwired-video';
  }
  function videoExtension(blob = currentBlob) { return blob && /mp4/i.test(blob.type) ? 'mp4' : 'webm'; }
  function updateExportActions() {
    const isMp4 = videoExtension() === 'mp4';
    // Even native/browser-generated MP4s can have variable timestamps. Keep a normalizing
    // action available until we've re-encoded the file to constant 30 fps H.264 + AAC.
    els.mp4Btn.hidden = optimizedMp4;
    const convertLabel = els.mp4Btn.querySelector('span');
    if (convertLabel) convertLabel.textContent = isMp4 ? 'Optimize MP4 for social apps' : 'Convert to MP4 for social apps';
    els.downloadBtn.className = isMp4 ? 'primary-button' : 'secondary-button';
    const label = els.downloadBtn.querySelector('span');
    if (label) label.textContent = isMp4 ? 'Save MP4 to phone' : 'Save original WebM';
    const arrow = els.downloadBtn.querySelector('.button-arrow');
    if (arrow) arrow.textContent = '↓';
    els.shareBtn.textContent = `Share ${isMp4 ? 'MP4' : 'video'} file`;
    if (els.exportHint) {
      els.exportHint.textContent = optimizedMp4
        ? 'Social-ready export: constant-frame-rate 30 fps H.264 video + AAC audio. Save it to your phone, or use Share where file sharing is supported. This app does not upload anything.'
        : isMp4
          ? 'This browser recorded MP4, but its frame timing can still confuse social-app previews. Tap “Optimize MP4 for social apps” to normalize it to constant 30 fps H.264 + AAC.'
          : 'This browser recorded WebM. Convert it to constant 30 fps H.264 video + AAC audio for a more compatible social export. The first conversion downloads a converter; your video stays on this device.';
    }
  }
  function downloadVideo() {
    if (!currentBlob || !currentUrl) return;
    const a = document.createElement('a'); a.href = currentUrl; a.download = `${filename()}.${videoExtension()}`; document.body.append(a); a.click(); a.remove();
    toast(`Downloading ${videoExtension().toUpperCase()} video. Check your Downloads folder.`);
  }
  function setShareVisibility() {
    // Always expose Share after a video exists. WebM can still be shared to some
    // Android apps; MP4 is preferred but must not be a prerequisite for the button.
    els.shareBtn.hidden = false;
    els.shareBtn.disabled = false;
    els.shareBtn.textContent = `Share ${videoExtension().toUpperCase()} video…`;
    els.shareBtn.setAttribute('aria-label', `Share ${videoExtension().toUpperCase()} video`);
  }
  async function shareVideo() {
    if (!currentBlob) {
      showMessage(els.renderMessage, 'Render a video first, then you can share it.', 'error');
      return;
    }
    if (!navigator.share) {
      showMessage(els.renderMessage, 'Direct file sharing is not supported by this browser. Tap Save video, then attach it from WhatsApp or select it in X / YouTube.', 'error');
      toast('Save the video, then attach it from the platform app.');
      return;
    }
    const ext = videoExtension();
    const mime = currentBlob.type || (ext === 'mp4' ? 'video/mp4' : 'video/webm');
    try {
      const file = new File([currentBlob], `${filename()}.${ext}`, { type: mime });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        showMessage(els.renderMessage, `Your browser cannot share this ${ext.toUpperCase()} file directly. Save it to your phone, then attach it inside WhatsApp or select it in X / YouTube.`, 'error');
        return;
      }
      showMessage(els.renderMessage, `Opening your phone's share menu for the ${ext.toUpperCase()} video…`);
      await navigator.share({ title: prepared?.story?.title || 'WireUnWired video', text: 'Created with WireUnWired Video Studio', files: [file] });
      showMessage(els.renderMessage, 'Share menu closed. If you selected an app, complete the send/post action there.', 'success');
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      console.error('Video sharing failed', error);
      showMessage(els.renderMessage, `Could not open file sharing${error?.message ? `: ${error.message}` : '.'} Save the video and attach it from the destination app.`, 'error');
    }
  }
  function loadScriptOnce(src) {
    if (window.FFmpeg && typeof window.FFmpeg.createFFmpeg === 'function') return Promise.resolve();
    if (ffmpegScriptPromise) return ffmpegScriptPromise;
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) { script.remove(); reject(error); }
        else resolve();
      };
      const timeout = setTimeout(() => finish(new Error('The converter library took too long to load. Check your connection and retry.')), 25000);
      script.src = src; script.async = true; script.crossOrigin = 'anonymous';
      script.onload = () => window.FFmpeg && typeof window.FFmpeg.createFFmpeg === 'function'
        ? finish()
        : finish(new Error('The converter library loaded, but its API was not found.'));
      script.onerror = () => finish(new Error(`Could not load converter library from ${new URL(src).hostname}.`));
      document.head.appendChild(script);
    });
    ffmpegScriptPromise = promise.catch(error => {
      // Let the user retry, or let the fallback CDN try, after a failed attempt.
      ffmpegScriptPromise = null;
      throw error;
    });
    return ffmpegScriptPromise;
  }
  async function loadFFmpegLibrary() {
    const sources = [
      'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',
      'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js'
    ];
    let lastError;
    for (const src of sources) {
      try {
        await loadScriptOnce(src);
        if (window.FFmpeg && typeof window.FFmpeg.createFFmpeg === 'function') return window.FFmpeg;
      } catch (error) { lastError = error; }
    }
    throw new Error(`Could not load the MP4 converter from either CDN. ${lastError?.message || 'Check internet access and retry.'}`);
  }
  async function getMp4Converter() {
    if (ffmpegInstance && ffmpegInstance.isLoaded()) return { ffmpeg: ffmpegInstance, fetchFile: ffmpegFetchFile };
    const lib = await loadFFmpegLibrary();
    if (typeof lib.fetchFile !== 'function') throw new Error('The converter did not expose its file loader. Refresh the app and retry.');
    ffmpegFetchFile = lib.fetchFile;
    const corePaths = [
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
      'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js'
    ];
    let lastError;
    for (const corePath of corePaths) {
      let candidate;
      try {
        candidate = lib.createFFmpeg({ log: false, mainName: 'main', corePath });
        await candidate.load();
        ffmpegInstance = candidate;
        return { ffmpeg: ffmpegInstance, fetchFile: ffmpegFetchFile };
      } catch (error) {
        lastError = error;
        try { candidate?.exit(); } catch (_) {}
      }
    }
    throw new Error(`The MP4 engine could not start. ${lastError?.message || 'The browser may have blocked the converter files.'}`);
  }
  function readVideoDuration(blob) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.preload = 'metadata'; video.muted = true; video.playsInline = true;
      let settled = false;
      const timeout = setTimeout(() => finish(NaN), 10000);
      const finish = (duration) => {
        if (settled) return;
        settled = true; clearTimeout(timeout);
        video.onloadedmetadata = null; video.onerror = null;
        video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); resolve(duration);
      };
      video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? video.duration : NaN);
      video.onerror = () => finish(NaN);
      video.src = url;
    });
  }
  async function convertToMp4() {
    // Never silently return: explain the state, then visibly update the status before loading WASM.
    if (!currentBlob) {
      showMessage(els.renderMessage, 'No video is attached to this screen. Render a video first, then try MP4 conversion.', 'error');
      toast('Render a video before converting.');
      return;
    }
    if (optimizedMp4) {
      showMessage(els.renderMessage, 'This video has already been normalized to constant-frame-rate H.264 MP4. Save it or share it.', 'success');
      return;
    }
    if (currentBlob.size > 150 * 1024 * 1024) {
      showMessage(els.renderMessage, 'This video is too large for safe phone conversion. Try a shorter video, or save the WebM and convert it on a computer.', 'error');
      return;
    }
    const oldLabel = els.mp4Btn.querySelector('span');
    const originalLabel = oldLabel ? oldLabel.textContent : 'Convert to MP4 for social apps';
    els.mp4Btn.disabled = true;
    els.mp4Btn.setAttribute('aria-busy', 'true');
    if (oldLabel) oldLabel.textContent = 'Loading converter — keep app open…';
    els.renderStatus.textContent = 'Loading MP4 converter…';
    els.progressBar.style.width = '0%';
    els.progressLabel.textContent = 'Preparing converter';
    showMessage(els.renderMessage, 'MP4 conversion started. The first run downloads about 25 MB of converter files. Keep this screen open; your video stays on this device.', '');
    try {
      // Yield once so status text paints before starting large downloads / WASM initialization.
      await new Promise(resolve => setTimeout(resolve, 60));
      const { ffmpeg, fetchFile } = await getMp4Converter();
      const sourceBlob = currentBlob;
      const inputName = videoExtension(sourceBlob) === 'mp4' ? 'input.mp4' : 'input.webm';
      try { ffmpeg.FS('unlink', 'input.webm'); } catch (_) {}
      try { ffmpeg.FS('unlink', 'input.mp4'); } catch (_) {}
      try { ffmpeg.FS('unlink', 'output.mp4'); } catch (_) {}
      showMessage(els.renderMessage, 'Converter loaded. Preparing your video for MP4 encoding…', '');
      await ffmpeg.FS('writeFile', inputName, await fetchFile(sourceBlob));
      if (oldLabel) oldLabel.textContent = 'Converting video…';
      els.renderStatus.textContent = 'Converting video to MP4…';
      showMessage(els.renderMessage, 'Normalizing timestamps and encoding constant-frame-rate H.264 video + AAC audio for social apps. Keep the app in the foreground.', '');
      try {
        ffmpeg.setProgress(({ ratio }) => {
          if (Number.isFinite(ratio)) {
            const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
            els.renderStatus.textContent = `Converting to MP4 · ${pct}%`;
            els.progressBar.style.width = `${pct}%`;
            els.progressLabel.textContent = `MP4 conversion · ${pct}%`;
          }
        });
      } catch (_) {}
      // Browsers can write WebM/MP4 with variable or odd timestamps. Reset the start
      // timestamp, normalize to constant 30 fps, and export a common H.264/AAC profile
      // so social apps don't misread the timeline as a very short clip.
      const expectedSeconds = Math.max(1, Number(prepared?.total) || 1);
      await ffmpeg.run(
        '-fflags', '+genpts',
        '-i', inputName,
        '-map', '0:v:0', '-map', '0:a:0',
        '-vf', 'setpts=N/(30*TB),fps=30,setpts=N/(30*TB)',
        '-r', '30', '-vsync', '1',
        '-t', expectedSeconds.toFixed(3),
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
        '-profile:v', 'baseline', '-level:v', '3.2',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
        '-af', 'aresample=async=1:first_pts=0,asetpts=N/SR/TB',
        '-avoid_negative_ts', 'make_zero', '-video_track_timescale', '90000', '-movflags', '+faststart',
        '-metadata', 'title=WireUnWired Video',
        'output.mp4'
      );
      const fileData = ffmpeg.FS('readFile', 'output.mp4');
      if (!fileData || !fileData.length) throw new Error('The converter returned an empty MP4 file.');
      const safeBytes = new Uint8Array(fileData);
      const mp4Blob = new Blob([safeBytes], { type: 'video/mp4' });
      try { ffmpeg.FS('unlink', 'input.webm'); } catch (_) {}
      try { ffmpeg.FS('unlink', 'input.mp4'); } catch (_) {}
      try { ffmpeg.FS('unlink', 'output.mp4'); } catch (_) {}
      const convertedDuration = await readVideoDuration(mp4Blob);
      const expectedDuration = Number(prepared?.total) || 0;
      const durationTolerance = Math.max(2.5, expectedDuration * 0.04);
      if (!Number.isFinite(convertedDuration) || convertedDuration <= 0) {
        throw new Error('The browser could not verify the converted MP4 duration. The original video has been kept; try again in Chrome or save the original file.');
      }
      if (expectedDuration > 0 && Math.abs(convertedDuration - expectedDuration) > durationTolerance) {
        throw new Error(`MP4 duration validation failed: expected about ${Math.ceil(expectedDuration)} seconds, but the converted file reports ${convertedDuration.toFixed(1)} seconds. The app rejected the export instead of marking a short or incomplete video as ready. The original video has been kept.`);
      }
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentBlob = mp4Blob; currentUrl = URL.createObjectURL(mp4Blob); optimizedMp4 = true;
      updateExportActions(); setShareVisibility();
      els.progressBar.style.width = '100%';
      els.progressLabel.textContent = 'MP4 ready';
      showMessage(els.renderMessage, `MP4 conversion complete (${(mp4Blob.size / (1024 * 1024)).toFixed(1)} MB${Number.isFinite(convertedDuration) ? ` · ${Math.round(convertedDuration)} sec` : ''}). Constant 30 fps H.264 + AAC is ready to save or share. X and YouTube may still require uploading it from inside their apps.`, 'success');
      els.renderStatus.textContent = 'MP4 ready';
    } catch (error) {
      console.error('MP4 conversion failed', error);
      const detail = error && error.message ? ` Details: ${error.message}` : '';
      showMessage(els.renderMessage, `MP4 conversion did not complete.${detail} Your original source video is still available. Retry on a stable connection, or save the original and upload it from the destination app.`, 'error');
      els.renderStatus.textContent = 'MP4 conversion failed';
      els.progressLabel.textContent = 'Conversion failed';
    } finally {
      els.mp4Btn.disabled = false;
      els.mp4Btn.removeAttribute('aria-busy');
      if (oldLabel) oldLabel.textContent = originalLabel;
      setShareVisibility();
    }
  }
  function loadSample() {
    els.input.value = JSON.stringify(SAMPLE, null, 2); updateCharCount();
    showMessage(els.inputMessage, 'Sample loaded. Prepare it to review the five scenes.', 'success');
  }
  function updateCharCount() { els.charCount.textContent = `${els.input.value.length.toLocaleString()} characters`; }
  function prepare() {
    try {
      const story = parseInput(els.input.value);
      const total = story.scenes.reduce((sum, s) => sum + s.duration, 0);
      if (total > 360) throw new Error('This script exceeds the six-minute local-rendering limit. Split it into two videos.');
      if (story.scenes.length > 8) showMessage(els.inputMessage, `This story needs ${story.scenes.length} slides after timing/splitting. Review the sequence carefully; no text was dropped. For a tighter video, shorten copy rather than reducing reading time.`, '');
      prepared = { story, total };
      renderSceneCards(story); els.previewPanel.hidden = false; els.renderPanel.hidden = true;
      if (!els.inputMessage.textContent.startsWith('This story needs')) showMessage(els.inputMessage, `Ready: ${story.scenes.length} slides · about ${Math.ceil(total)} seconds. Review them below, then render.`, 'success');
      els.previewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { showMessage(els.inputMessage, error.message, 'error'); }
  }
  els.input.addEventListener('input', updateCharCount);
  els.sampleBtn.addEventListener('click', loadSample);
  els.prepareBtn.addEventListener('click', prepare);
  if (els.readerPaceSelect) els.readerPaceSelect.addEventListener('change', () => { if (prepared) showMessage(els.inputMessage, 'Reading pace changed. Tap Prepare video again to recalculate scene timing.', ''); });
  updateAudioLevelLabels();
  [els.musicLevel, els.effectsLevel, els.masterLevel].filter(Boolean).forEach(input => {
    input.addEventListener('input', () => {
      updateAudioLevelLabels();
      const activeAudioEngine = soundPreviewEngine || (renderState?.running ? renderState.audio : null);
      if (activeAudioEngine && typeof activeAudioEngine.setLevels === 'function') activeAudioEngine.setLevels(selectedAudioLevels());
    });
  });
  if (els.musicFile) els.musicFile.addEventListener('change', event => readAudioAssetFile('music', event.target.files?.[0] || null));
  if (els.sfxFile) els.sfxFile.addEventListener('change', event => readAudioAssetFile('sfx', event.target.files?.[0] || null));
  if (els.clearMusicFileBtn) els.clearMusicFileBtn.addEventListener('click', () => { audioAssetFiles.music = null; if (els.musicFile) els.musicFile.value = ''; updateAudioAssetLabel('music'); stopSoundPreview(); toast('Using generated background music.'); });
  if (els.clearSfxFileBtn) els.clearSfxFileBtn.addEventListener('click', () => { audioAssetFiles.sfx = null; if (els.sfxFile) els.sfxFile.value = ''; updateAudioAssetLabel('sfx'); stopSoundPreview(); toast('Using generated sound effects.'); });
  els.soundPreviewBtn.addEventListener('click', previewSoundDesign);
  els.renderBtn.addEventListener('click', startRender);
  els.cancelBtn.addEventListener('click', cancelRender);
  els.mp4Btn.addEventListener('click', convertToMp4);
  els.downloadBtn.addEventListener('click', downloadVideo);
  els.shareBtn.addEventListener('click', shareVideo);
  els.newVideoBtn.addEventListener('click', () => { cancelRender(); prepared = null; currentBlob = null; originalBlob = null; optimizedMp4 = false; if (currentUrl) URL.revokeObjectURL(currentUrl); currentUrl = null; els.renderPanel.hidden = true; els.previewPanel.hidden = true; els.input.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  window.addEventListener('pagehide', stopSoundPreview);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; els.installBtn.hidden = false; });
  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) { toast('On iPhone: use Share → Add to Home Screen. On Android: open the browser menu → Install app.'); return; }
    deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; els.installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { els.installBtn.hidden = true; toast('WireUnWired Video Studio installed.'); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Offline support was not registered', err)));
  updateCharCount();
})();
