(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const els = {
    input: $('scriptInput'), charCount: $('charCount'), sampleBtn: $('sampleBtn'), prepareBtn: $('prepareBtn'),
    inputMessage: $('inputMessage'), themeSelect: $('themeSelect'), musicSelect: $('musicSelect'), previewPanel: $('previewPanel'),
    storyTitle: $('storyTitle'), storyCategory: $('storyCategory'), sceneCount: $('sceneCount'), sceneList: $('sceneList'),
    renderBtn: $('renderBtn'), renderPanel: $('renderPanel'), canvas: $('videoCanvas'), renderStatus: $('renderStatus'),
    progressLabel: $('progressLabel'), timeLabel: $('timeLabel'), progressBar: $('progressBar'), renderMessage: $('renderMessage'),
    resultActions: $('resultActions'), downloadBtn: $('downloadBtn'), shareBtn: $('shareBtn'), newVideoBtn: $('newVideoBtn'),
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
  let currentUrl = null;
  let deferredInstallPrompt = null;
  let renderState = null;
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
  function normalizeScene(scene, index) {
    const s = typeof scene === 'string' ? { body: scene } : (scene || {});
    const headline = cleanTitle(s.headline || s.title || s.heading || s.text || `Key detail ${index + 1}`, `Key detail ${index + 1}`);
    const body = escapeText(s.body || s.subtitle || s.description || s.narration || s.copy || (s.text && s.text !== headline ? s.text : ''))
      .replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 420);
    let duration = Number(s.duration_sec ?? s.duration ?? s.seconds ?? 5);
    if (!Number.isFinite(duration)) duration = 5;
    duration = Math.max(3, Math.min(12, duration));
    return {
      headline, body, duration,
      audioCue: normalizeCue(s.audio_cue || s.audioCue || s.sound_effect || s.cue || ''),
      visualDirection: escapeText(s.visual_direction || s.visualDirection || s.visual || s.visual_prompt || '').slice(0, 350),
      imageUrl: safeUrl(s.image_url || s.imageUrl || s.image || s.thumbnail_url || '')
    };
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
    const scenes = segments.slice(0, 7).map((part, i) => {
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
    const scenes = data.scenes.slice(0, 10).map(normalizeScene);
    if (!scenes.length) throw new Error('Add at least one scene to the script.');
    const total = scenes.reduce((sum, s) => sum + s.duration, 0);
    if (total > 90) throw new Error('This first version is designed for videos up to 90 seconds. Reduce scene durations or use fewer scenes.');
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
      tags.append(cue, visual); main.append(title, body, tags);
      const duration = document.createElement('div'); duration.className = 'scene-duration'; duration.textContent = `${scene.duration.toFixed(0)} sec`;
      card.append(number, main, duration); els.sceneList.append(card);
    });
    const total = story.scenes.reduce((sum, s) => sum + s.duration, 0);
    els.sceneCount.textContent = `${story.scenes.length} SLIDES · ${Math.round(total)} SEC`;
    els.storyTitle.textContent = story.title;
    els.storyCategory.textContent = story.category;
  }
  function fmtTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5, revealCount = Infinity, showCursor = false, cursorTime = 0) {
    const words = String(text || '').split(/\s+/).filter(Boolean); const lines = []; let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    let clipped = lines.slice(0, maxLines);
    if (lines.length > maxLines && clipped.length) {
      let last = clipped[clipped.length - 1];
      while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 4) last = last.slice(0, -1);
      clipped[clipped.length - 1] = `${last.trim()}…`;
    }
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
    const bodyText = scene.body || scene.visualDirection || '';
    const headlineDuration = Math.min(1.65, Math.max(.62, headlineText.length / 31));
    const bodyDelay = Math.min(headlineDuration + .12, duration * .48);
    const bodyDuration = Math.min(2.15, Math.max(.65, bodyText.length / 48), Math.max(.5, duration - bodyDelay - .42));
    const headlineProgress = Math.max(0, Math.min(1, localTime / headlineDuration));
    const bodyProgress = Math.max(0, Math.min(1, (localTime - bodyDelay) / bodyDuration));
    const headlineChars = Math.ceil(headlineText.length * headlineProgress);
    const bodyChars = Math.ceil(bodyText.length * bodyProgress);
    const titleTyping = headlineProgress < 1;
    const bodyTyping = bodyText.length > 0 && localTime >= bodyDelay && bodyProgress < 1;
    ctx.fillStyle = '#f5f8fc'; ctx.font = `850 ${intro ? 54 : 49}px system-ui, sans-serif`; ctx.letterSpacing = '-1.6px';
    const headlineLines = wrapText(ctx, headlineText, 54, yBase, W - 108, intro ? 68 : 62, 4, headlineChars, titleTyping, globalTime);
    const bodyY = yBase + headlineLines * (intro ? 68 : 62) + 33;
    ctx.fillStyle = '#bdcbd9'; ctx.font = '500 25px system-ui, sans-serif'; ctx.letterSpacing = '0px';
    wrapText(ctx, bodyText, 56, bodyY, W - 112, 38, 5, bodyChars, bodyTyping, globalTime + .4);
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
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'];
    return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }
  async function startRender() {
    if (!prepared || renderState?.running) return;
    let mimeType;
    try { mimeType = selectedMimeType(); }
    catch (error) { showMessage(els.renderMessage, error.message, 'error'); return; }
    currentBlob = null;
    if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
    els.renderPanel.hidden = false; els.renderPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    els.resultActions.hidden = true; els.cancelBtn.hidden = false; els.renderBtn.disabled = true; els.renderMessage.textContent = '';
    els.progressBar.style.width = '0%'; els.progressLabel.textContent = '0% complete'; els.timeLabel.textContent = '00:00 / ' + fmtTime(prepared.total); els.renderStatus.textContent = 'Loading available visuals…';
    const canvas = els.canvas; canvas.width = 720; canvas.height = 1280; const ctx = canvas.getContext('2d', { alpha: false });
    const story = prepared.story; const themeName = els.themeSelect.value; const moodName = getAudioMood(story);
    const renderToken = { running: true, cancelled: false, raf: 0, recorder: null, streams: [], audio: null, wakeLock: null, startedAt: 0, total: prepared.total, images: [] }; renderState = renderToken;
    try {
      renderToken.images = await preloadImages(story);
      if (renderToken.cancelled) return;
      const canvasStream = canvas.captureStream(24); renderToken.streams.push(canvasStream);
      // One audio context feeds the recorder, keeping the soundtrack synchronized with the canvas stream.
      const AudioCtx = window.AudioContext || window.webkitAudioContext; const audioCtx = new AudioCtx();
      const destination = audioCtx.createMediaStreamDestination();
      const audioEngine = createAudioEngineInContext(audioCtx, moodName, destination); renderToken.audio = audioEngine;
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
        currentBlob = blob; currentUrl = URL.createObjectURL(blob);
        els.progressBar.style.width = '100%'; els.progressLabel.textContent = '100% complete'; els.timeLabel.textContent = `${fmtTime(renderToken.total)} / ${fmtTime(renderToken.total)}`;
        els.renderStatus.textContent = 'Video ready'; els.resultActions.hidden = false;
        showMessage(els.renderMessage, `Your video is ready (${(blob.size / (1024 * 1024)).toFixed(1)} MB). Save it to your phone to review the result.`, 'success');
        setShareVisibility(); els.resultActions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      try { if ('wakeLock' in navigator) renderToken.wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
      await audioCtx.resume();
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
      showMessage(els.renderMessage, `Could not start the video renderer: ${error.message || error}. Try Chrome on Android and a shorter script.`, 'error');
    }
  }
  function createAudioEngineInContext(ctx, moodName, destination) {
    // A compressor plus a stronger output bus helps the soundtrack stay audible on phones
    // without letting impacts peak uncontrollably in the exported recording.
    const master = ctx.createGain(); master.gain.value = .92;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -17; compressor.knee.value = 18; compressor.ratio.value = 5.5;
    compressor.attack.value = .004; compressor.release.value = .24;
    master.connect(compressor); compressor.connect(destination);
    const mood = MOODS[moodName] || MOODS.futuristic; const oscillators = [];
    if (mood.notes.length) {
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = mood.filter; filter.Q.value = .65; filter.connect(master);
      ['sine', 'triangle', 'sine'].forEach((type, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = type; osc.frequency.value = mood.notes[i];
        gain.gain.value = mood.volume * [.48, .31, .19][i]; osc.connect(gain); gain.connect(filter); osc.start(); oscillators.push({ osc, gain });
      });
    }
    function chord(index, when) {
      if (!oscillators.length) return;
      const semitones = (moodName === 'tense' ? [0, 1, -1, 0, 2] : [0, 2, 4, 1, 3])[index % 5];
      oscillators.forEach((o, i) => { o.osc.frequency.cancelScheduledValues(when); o.osc.frequency.setTargetAtTime(mood.notes[i] * Math.pow(2, semitones / 12), when, .5); });
    }
    function playCue(cueName, when) {
      const cue = normalizeCue(cueName); if (cue === 'soft') return;
      if (cue === 'impact') {
        // A low thump plus a short mid-frequency click makes the impact audible on small speakers.
        const osc = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
        osc.type = 'sine'; osc.frequency.setValueAtTime(125, when); osc.frequency.exponentialRampToValueAtTime(48, when + .36);
        filter.type = 'lowpass'; filter.frequency.value = 260;
        gain.gain.setValueAtTime(.0001, when); gain.gain.exponentialRampToValueAtTime(.31 * mood.cue, when + .018); gain.gain.exponentialRampToValueAtTime(.0001, when + .46);
        osc.connect(filter); filter.connect(gain); gain.connect(master); osc.start(when); osc.stop(when + .49);
        const n = Math.floor(ctx.sampleRate * .16); const buffer = ctx.createBuffer(1, n, ctx.sampleRate); const values = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) values[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const click = ctx.createBufferSource(), clickFilter = ctx.createBiquadFilter(), clickGain = ctx.createGain(); click.buffer = buffer;
        clickFilter.type = 'bandpass'; clickFilter.frequency.value = 950; clickFilter.Q.value = .85;
        clickGain.gain.setValueAtTime(.16 * mood.cue, when); clickGain.gain.exponentialRampToValueAtTime(.0001, when + .15);
        click.connect(clickFilter); clickFilter.connect(clickGain); clickGain.connect(master); click.start(when); click.stop(when + .16);
      } else if (cue === 'whoosh' || cue === 'riser') {
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .72), ctx.sampleRate); const values = buffer.getChannelData(0);
        for (let i = 0; i < values.length; i++) values[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / values.length);
        const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(); source.buffer = buffer;
        filter.type = 'bandpass'; filter.frequency.setValueAtTime(430, when); filter.frequency.exponentialRampToValueAtTime(cue === 'riser' ? 4200 : 3000, when + .58); filter.Q.value = .55;
        gain.gain.setValueAtTime(.0001, when); gain.gain.linearRampToValueAtTime(.19 * mood.cue, when + .22); gain.gain.exponentialRampToValueAtTime(.0001, when + .7);
        source.connect(filter); filter.connect(gain); gain.connect(master); source.start(when); source.stop(when + .73);
      } else {
        const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'triangle';
        osc.frequency.setValueAtTime(740, when); osc.frequency.exponentialRampToValueAtTime(360, when + .13);
        gain.gain.setValueAtTime(.0001, when); gain.gain.exponentialRampToValueAtTime(.13 * mood.cue, when + .01); gain.gain.exponentialRampToValueAtTime(.0001, when + .24);
        osc.connect(gain); gain.connect(master); osc.start(when); osc.stop(when + .26);
      }
    }
    return { ctx, chord, playCue, close: () => { oscillators.forEach(o => { try { o.osc.stop(); } catch (_) {} }); return ctx.close(); } };
  }
  function cancelRender() {
    if (!renderState || !renderState.running) return;
    renderState.cancelled = true; renderState.running = false;
    if (renderState.raf) cancelAnimationFrame(renderState.raf);
    if (renderState.recorder && renderState.recorder.state !== 'inactive') renderState.recorder.stop();
    else {
      renderState.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
      if (renderState.audio) renderState.audio.close().catch(() => {});
      els.renderBtn.disabled = false; els.cancelBtn.hidden = true;
      showMessage(els.renderMessage, 'Render cancelled. Your script is still here.');
    }
  }
  function filename() {
    return (prepared?.story?.title || 'wireunwired-video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 58) || 'wireunwired-video';
  }
  function videoExtension() { return currentBlob && /mp4/i.test(currentBlob.type) ? 'mp4' : 'webm'; }
  function downloadVideo() {
    if (!currentBlob || !currentUrl) return;
    const a = document.createElement('a'); a.href = currentUrl; a.download = `${filename()}.${videoExtension()}`; document.body.append(a); a.click(); a.remove();
    toast('Video download started. Check your Downloads folder.');
  }
  function setShareVisibility() {
    els.shareBtn.hidden = !(currentBlob && navigator.share && navigator.canShare && (() => { try { return navigator.canShare({ files: [new File([currentBlob], `${filename()}.${videoExtension()}`, { type: currentBlob.type || 'video/webm' })] }); } catch (_) { return false; } })());
  }
  async function shareVideo() {
    if (!currentBlob || !navigator.share) return;
    try {
      const file = new File([currentBlob], `${filename()}.${videoExtension()}`, { type: currentBlob.type || (videoExtension() === 'mp4' ? 'video/mp4' : 'video/webm') });
      await navigator.share({ title: prepared.story.title, text: 'Created with WireUnWired Video Studio', files: [file] });
    } catch (error) { if (error.name !== 'AbortError') toast('Sharing was not available. Save the video instead.'); }
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
      if (total > 90) throw new Error('Keep the total scene duration to 90 seconds or less.');
      if (story.scenes.length > 8) showMessage(els.inputMessage, 'Using the first 10 scenes can make the result busy. For best pacing, use 4–6 scenes.', '');
      prepared = { story, total };
      renderSceneCards(story); els.previewPanel.hidden = false; els.renderPanel.hidden = true;
      if (!els.inputMessage.textContent.startsWith('Using the first 10')) showMessage(els.inputMessage, `Ready: ${story.scenes.length} slides · about ${Math.round(total)} seconds. Review them below, then render.`, 'success');
      els.previewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { showMessage(els.inputMessage, error.message, 'error'); }
  }
  els.input.addEventListener('input', updateCharCount);
  els.sampleBtn.addEventListener('click', loadSample);
  els.prepareBtn.addEventListener('click', prepare);
  els.renderBtn.addEventListener('click', startRender);
  els.cancelBtn.addEventListener('click', cancelRender);
  els.downloadBtn.addEventListener('click', downloadVideo);
  els.shareBtn.addEventListener('click', shareVideo);
  els.newVideoBtn.addEventListener('click', () => { cancelRender(); prepared = null; currentBlob = null; if (currentUrl) URL.revokeObjectURL(currentUrl); currentUrl = null; els.renderPanel.hidden = true; els.previewPanel.hidden = true; els.input.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; els.installBtn.hidden = false; });
  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) { toast('On iPhone: use Share → Add to Home Screen. On Android: open the browser menu → Install app.'); return; }
    deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; els.installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { els.installBtn.hidden = true; toast('WireUnWired Video Studio installed.'); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Offline support was not registered', err)));
  updateCharCount();
})();
