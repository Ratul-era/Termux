/* ==========================================================================
   toolbox.js - Reliable Portfolio AI Control Panel & Live GitHub Publisher
   - Zero API keys stored in repo (all keys stay strictly in localStorage)
   - Multi-model Gemini Free Tier chain (2.5-flash -> 2.0-flash -> 1.5-flash)
   - Robust JSON extraction + explicit AI error diagnostics (no silent fails)
   - CORS-free visual analysis via Drive Scanner thumbnails + Local sample picker
   - Underscore-safe architectural classifier for high offline accuracy
   - Unified single-call AI sorting + details generation + button lock states
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'akash_toolbox_config_v2';
  const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
  const FAST_MODEL_CACHE_KEY = 'akash_gemini_fast_models_v1';
  let discoveredGeminiModels = null;
  let discoveredForKey = '';
  const PART_KEYS = ['3Dvis_ext', '3Dvis_int', 'AW_ext', 'AW_int'];
  const PART_META = {
    '3Dvis_ext': { title: '3D Visualization — Exterior', tag: 'Exterior', isAW: false },
    '3Dvis_int': { title: '3D Visualization — Interior', tag: 'Interior', isAW: false },
    'AW_ext':    { title: 'Animation Walkthrough — Exterior', tag: 'Exterior', isAW: true },
    'AW_int':    { title: 'Animation Walkthrough — Interior', tag: 'Interior', isAW: true }
  };

  let config = loadConfig();
  let projectMode = 'add';
  let editSubMode = 'manual';
  let currentProject = createEmptyProject();
  let pendingQuestions = [];
  let pendingAmbiguousFiles = [];

  let liveCatalog = { version: 2, updatedAt: '', projects: [] };
  let liveModels = { version: 2, updatedAt: '', models: [] };
  let liveStudio = { version: 2, updatedAt: '', items: [] };
  let editingModelIdx = -1;

  // Cached Drive scan & local visual samples for zero-CORS multimodal AI
  let driveScanCache = { url: '', folderName: '', files: [], sampleThumbs: [] };
  let localVisualParts = []; // [{ mimeType, data, name }]
  let isBusy = false;

  function $(id) { return document.getElementById(id); }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { owner: '', repo: '', branch: 'main', token: '', driveScanner: '', aiMode: 'smart', aiKey: '' };
  }

  function saveConfig(next) {
    config = Object.assign({}, config, next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (e) {}
    updateAiStatusPill();
  }

  function updateAiStatusPill() {
    const pill = $('aiStatusPill');
    if (!pill) return;
    if (config.aiMode === 'gemini') {
      const hasKey = !!(config.aiKey && config.aiKey.trim());
      pill.textContent = hasKey ? 'AI: Gemini Free' : 'AI: Gemini (No Key)';
      pill.classList.toggle('connected', hasKey);
    } else if (config.aiMode === 'ollama') {
      pill.textContent = 'AI: Ollama (' + (config.aiKey || 'llama3.2') + ')';
      pill.classList.add('connected');
    } else {
      pill.textContent = 'AI: Smart Built-in';
      pill.classList.add('connected');
    }
  }

  function setBusy(busy, activeBtn, labelWhileBusy) {
    isBusy = busy;
    ['runAiSortBtn', 'autoGenAllBtn', 'pushProjectBtn', 'scanModelBtn', 'saveModelLiveBtn', 'scanStudioBtn', 'pushStudioBtn', 'testAiBtn'].forEach(function (id) {
      const b = $(id);
      if (b) b.disabled = busy;
    });
    document.querySelectorAll('.tb-auto-chip').forEach(function (b) { b.disabled = busy; });
    if (activeBtn) {
      if (busy) {
        activeBtn.dataset.origHtml = activeBtn.innerHTML;
        activeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (labelWhileBusy || 'Working...');
      } else if (activeBtn.dataset.origHtml) {
        activeBtn.innerHTML = activeBtn.dataset.origHtml;
      }
    }
  }

  function showLog(id, msg, type) {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.className = 'tb-log show' + (type ? ' ' + type : '');
  }

  function slugify(str) {
    return String(str || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || ('project-' + Date.now());
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function createEmptyProject() {
    const parts = {};
    PART_KEYS.forEach(function (k) {
      parts[k] = {
        enabled: false,
        label: PART_META[k].tag + ' • Project',
        tag: PART_META[k].tag,
        title: '',
        cover: { type: PART_META[k].isAW ? 'youtube' : 'image', url: '', thumbnail: '' },
        details: { description: '', keywords: [], tools: [], date: '', projectId: '', scale: '' },
        additionals: []
      };
    });
    return { id: '', projectId: '', title: '', parts: parts };
  }

  /* ------------------------------------------------------------------------
     Robust JSON Extraction (handles markdown fences & stray prose from AI)
     ------------------------------------------------------------------------ */
  function extractJsonObject(rawText) {
    if (!rawText) throw new Error('Empty response from AI.');
    const cleaned = String(rawText).trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
      throw new Error('AI returned non-JSON text: ' + cleaned.slice(0, 120));
    }
  }

  /* ------------------------------------------------------------------------
     GitHub Contents API (Live Read & Non-Destructive Write)
     ------------------------------------------------------------------------ */
  function isGitHubConfigured() {
    return !!(config.owner && config.repo && config.token);
  }

  function ghHeaders() {
    return {
      'Authorization': 'Bearer ' + config.token.trim(),
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function ghReadJson(path) {
    if (isGitHubConfigured()) {
      const apiUrl = 'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' +
        encodeURIComponent(config.repo) + '/contents/' + path + '?ref=' + encodeURIComponent(config.branch || 'main');
      const res = await fetch(apiUrl, { headers: ghHeaders() });
      if (res.status === 404) return { data: null, sha: null };
      if (!res.ok) throw new Error('GitHub read error (' + res.status + ') for ' + path);
      const json = await res.json();
      return { data: JSON.parse(base64ToUtf8(json.content)), sha: json.sha };
    }
    const res = await fetch('../' + path + '?v=' + Date.now());
    if (!res.ok) return { data: null, sha: null };
    return { data: await res.json(), sha: null };
  }

  async function ghWriteJson(path, obj, message) {
    if (!isGitHubConfigured()) {
      throw new Error('GitHub is not connected. Open "Connect & AI Setup" tab and save your GitHub repo + Fine-Grained Token.');
    }
    const existing = await ghReadJson(path).catch(function () { return { sha: null }; });
    const apiUrl = 'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' +
      encodeURIComponent(config.repo) + '/contents/' + path;
    const body = {
      message: message || ('Update ' + path + ' via Portfolio Toolbox'),
      content: utf8ToBase64(JSON.stringify(obj, null, 2) + '\n'),
      branch: config.branch || 'main'
    };
    if (existing && existing.sha) body.sha = existing.sha;

    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: ghHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error('GitHub write failed (' + res.status + '): ' + errTxt.slice(0, 180));
    }
    return res.json();
  }

  async function testGitHubConnection() {
    const pill = $('ghStatusPill');
    if (!isGitHubConfigured()) {
      pill.textContent = 'GitHub: Not Connected';
      pill.classList.remove('connected');
      return false;
    }
    try {
      const res = await fetch('https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' + encodeURIComponent(config.repo), {
        headers: ghHeaders()
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      pill.textContent = 'GitHub: Connected (' + config.repo + ')';
      pill.classList.add('connected');
      return true;
    } catch (e) {
      pill.textContent = 'GitHub: Auth Error';
      pill.classList.remove('connected');
      return false;
    }
  }

  /* ------------------------------------------------------------------------
     Drive Folder Scanner & Local Visual Sample Processing (Zero CORS!)
     ------------------------------------------------------------------------ */
  async function scanDriveFolder(folderUrl, includeSamples) {
    const cleanUrl = (folderUrl || '').trim();
    if (!cleanUrl) return { files: [], folderName: '', sampleThumbs: [] };
    if (driveScanCache.url === cleanUrl && driveScanCache.files.length) {
      return driveScanCache;
    }
    if (!config.driveScanner) {
      throw new Error('Drive Scanner Web App URL is not set. Deploy workers/drive-folder-scanner.gs (2 min, 100% free) and paste its URL in Connect & AI Setup.');
    }
    const endpoint = config.driveScanner.trim() +
      (config.driveScanner.includes('?') ? '&' : '?') +
      'folder=' + encodeURIComponent(cleanUrl) +
      (includeSamples ? '&samples=1' : '');
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Drive Scanner HTTP ' + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Drive Scanner failed');
    driveScanCache = {
      url: cleanUrl,
      folderName: json.folderName || '',
      files: json.files || [],
      sampleThumbs: json.sampleThumbs || []
    };
    return driveScanCache;
  }

  function resizeImageBlobToBase64(fileOrBlob, maxDim) {
    return new Promise(function (resolve) {
      const img = new Image();
      const objUrl = URL.createObjectURL(fileOrBlob);
      img.onload = function () {
        URL.revokeObjectURL(objUrl);
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const cap = maxDim || 768;
        if (w > cap || h > cap) {
          if (w >= h) { h = Math.round(h * cap / w); w = cap; }
          else { w = Math.round(w * cap / h); h = cap; }
        }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = c.toDataURL('image/jpeg', 0.72);
        resolve({ mimeType: 'image/jpeg', data: dataUrl.split(',')[1] });
      };
      img.onerror = function () { URL.revokeObjectURL(objUrl); resolve(null); };
      img.src = objUrl;
    });
  }

  function extractVideoFrameToBase64(videoFile) {
    return new Promise(function (resolve) {
      const vid = document.createElement('video');
      const objUrl = URL.createObjectURL(videoFile);
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'metadata';
      vid.onloadeddata = function () {
        vid.currentTime = Math.min(2, (vid.duration || 2) * 0.25);
      };
      vid.onseeked = function () {
        try {
          const w = Math.min(512, vid.videoWidth || 640);
          const h = Math.round(w * ((vid.videoHeight || 360) / (vid.videoWidth || 640)));
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          c.getContext('2d').drawImage(vid, 0, 0, w, h);
          const dataUrl = c.toDataURL('image/jpeg', 0.72);
          URL.revokeObjectURL(objUrl);
          resolve({ mimeType: 'image/jpeg', data: dataUrl.split(',')[1] });
        } catch (e) {
          URL.revokeObjectURL(objUrl);
          resolve(null);
        }
      };
      vid.onerror = function () { URL.revokeObjectURL(objUrl); resolve(null); };
      vid.src = objUrl;
    });
  }

  async function handleLocalSamplePicker(fileList) {
    localVisualParts = [];
    const info = $('pLocalSamplesInfo');
    if (!fileList || !fileList.length) {
      if (info) info.textContent = '';
      return;
    }
    const picked = Array.from(fileList).slice(0, 4);
    for (let i = 0; i < picked.length; i++) {
      const f = picked[i];
      let part = null;
      if (f.type.startsWith('image/')) part = await resizeImageBlobToBase64(f, 512);
      else if (f.type.startsWith('video/')) part = await extractVideoFrameToBase64(f);
      if (part) localVisualParts.push({ mimeType: part.mimeType, data: part.data, name: f.name });
    }
    if (info) {
      info.textContent = localVisualParts.length
        ? ('Loaded ' + localVisualParts.length + ' visual sample(s) for accurate AI inspection: ' + localVisualParts.map(function (x) { return x.name; }).join(', '))
        : 'Could not read selected file(s).';
    }
  }

  const linkMetaCache = {};
  async function fetchRichLinkMetadata(url) {
    const clean = String(url || '').trim();
    if (!clean) return { title: '', description: '' };
    if (linkMetaCache[clean]) return linkMetaCache[clean];
    // Try Apps Script server-side metadata extractor first (gets full YouTube description & public FB caption!)
    if (config.driveScanner) {
      try {
        const ep = config.driveScanner.trim() + (config.driveScanner.includes('?') ? '&' : '?') + 'meta=' + encodeURIComponent(clean);
        const res = await fetch(ep);
        if (res.ok) {
          const j = await res.json();
          if (j && j.ok && (j.title || j.description)) {
            linkMetaCache[clean] = { title: j.title || '', description: j.description || '' };
            return linkMetaCache[clean];
          }
        }
      } catch (e) {}
    }
    // Fallback to YouTube oEmbed for YT title
    if (extractYtId(clean)) {
      const t = await fetchYouTubeTitle(clean);
      linkMetaCache[clean] = { title: t, description: '' };
      return linkMetaCache[clean];
    }
    return { title: '', description: '' };
  }

  async function fetchYouTubeTitle(url) {
    try {
      const res = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json');
      if (!res.ok) return '';
      const j = await res.json();
      return j.title || '';
    } catch (e) { return ''; }
  }

  function extractYtId(url) {
    const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    return m ? m[1] : null;
  }

  function extractDriveFileId(url) {
    const m = String(url || '').match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i) ||
              String(url || '').match(/[?&]id=([a-zA-Z0-9_-]+)/i);
    return m ? m[1] : null;
  }

  function normalizeSingleUrlItem(rawLine) {
    const line = String(rawLine || '').trim();
    if (!line || !/^https?:\/\//i.test(line)) return null;
    const isBoth = /\[both\]/i.test(line);
    const cleanUrl = line.replace(/\[both\]/ig, '').trim();

    const ytId = extractYtId(cleanUrl);
    if (ytId) {
      return {
        type: 'youtube',
        url: cleanUrl,
        thumb: 'https://i.ytimg.com/vi/' + ytId + '/hqdefault.jpg',
        name: 'YouTube Walkthrough ' + ytId,
        folderPath: '',
        bothHint: isBoth
      };
    }
    if (/facebook\.com|fb\.watch/i.test(cleanUrl)) {
      return {
        type: 'facebook',
        url: cleanUrl,
        thumb: '',
        name: 'Facebook Walkthrough Video',
        folderPath: '',
        bothHint: isBoth
      };
    }
    const driveId = extractDriveFileId(cleanUrl);
    if (driveId) {
      return {
        type: 'image',
        url: 'https://lh3.googleusercontent.com/d/' + driveId + '=w1600',
        thumb: 'https://lh3.googleusercontent.com/d/' + driveId + '=w800',
        name: 'Drive Asset ' + driveId.slice(0, 6),
        folderPath: '',
        bothHint: isBoth
      };
    }
    if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(cleanUrl)) {
      return { type: 'video', url: cleanUrl, thumb: '', name: cleanUrl.split('/').pop(), folderPath: '', bothHint: isBoth };
    }
    if (/\.(blend|skp|ls|ls\d+|dwg|dxf|rvt|max|fbx|obj|3dm)(\?|$)/i.test(cleanUrl)) {
      return { type: 'file3d', url: cleanUrl, ext: cleanUrl.split('.').pop().toUpperCase(), name: cleanUrl.split('/').pop(), folderPath: '' };
    }
    return { type: 'image', url: cleanUrl, thumb: cleanUrl, name: cleanUrl.split('/').pop() || 'Image', folderPath: '' };
  }

  /* ------------------------------------------------------------------------
     Underscore-Safe High-Accuracy Classifier & Detail Extractor
     ------------------------------------------------------------------------ */
  function tokenMatch(text, words) {
    const pattern = '(?:^|[^a-z0-9])(?:' + words.join('|') + ')(?:[^a-z0-9]|$)';
    return new RegExp(pattern, 'i').test(text);
  }

  function smartHeuristicClassify(items, contextText) {
    const extWords = ['ext', 'exterior', 'exteriors', 'facade', 'elevation', 'front', 'outdoor', 'site', 'aerial', 'rooftop', 'landscape', 'street', 'garden', 'pool', 'driveway', 'balcony', 'terrace', 'perspective', 'nightview', 'twilight', 'daylight', 'building', 'villa', 'duplex', 'tower', 'complex'];
    const intWords = ['int', 'interior', 'interiors', 'living', 'bedroom', 'bed', 'master', 'kitchen', 'dining', 'bath', 'washroom', 'toilet', 'foyer', 'lounge', 'office', 'study', 'lobby', 'ceiling', 'furniture', 'room', 'hall', 'stair', 'wardrobe', 'cabinet', 'reception', 'sofa'];
    const bothWords = ['both', 'full tour', 'complete walkthrough', 'ext and int', 'int and ext', 'exterior and interior', 'interior and exterior', 'ext+int', 'int+ext'];

    const assigned = { '3Dvis_ext': [], '3Dvis_int': [], 'AW_ext': [], 'AW_int': [] };
    const ambiguous = [];

    items.forEach(function (it, idx) {
      // Normalize underscores/hyphens to spaces so ext_01.jpg or Living-Room_02.png always matches cleanly!
      const rawHay = ((it.folderPath || '') + ' ' + (it.name || '') + ' ' + (it.title || ''));
      const hay = rawHay.replace(/[_\-]+/g, ' ').toLowerCase();
      const isVid = it.type === 'video' || it.type === 'youtube' || it.type === 'facebook' || it.type === 'drive_video';
      const hasExt = tokenMatch(hay, extWords);
      const hasInt = tokenMatch(hay, intWords);
      const isBoth = !!(it.bothHint || tokenMatch(hay, bothWords) || (hasExt && hasInt));

      if (isVid) {
        if (isBoth) {
          assigned['AW_ext'].push(it);
          assigned['AW_int'].push(it);
        } else if (hasInt && !hasExt) {
          assigned['AW_int'].push(it);
        } else if (hasExt && !hasInt) {
          assigned['AW_ext'].push(it);
        } else {
          ambiguous.push({ idx: idx, item: it, suggested: 'AW_ext' });
        }
      } else {
        if (hasInt && !hasExt) {
          assigned['3Dvis_int'].push(it);
        } else if (hasExt && !hasInt) {
          assigned['3Dvis_ext'].push(it);
        } else {
          ambiguous.push({ idx: idx, item: it, suggested: '3Dvis_ext' });
        }
      }
    });

    const corpus = (contextText + '\n' + items.map(function (x) { return (x.folderPath || '') + ' ' + (x.name || ''); }).join('\n')).replace(/[_\-]+/g, ' ');
    const toolMap = [
      ['AutoCAD', ['autocad', 'cad', 'dwg']],
      ['SketchUp', ['sketchup', 'skp']],
      ['Lumion', ['lumion', 'ls10', 'ls11', 'ls12', 'ls2023', 'ls2024']],
      ['Adobe Photoshop', ['photoshop', 'psd']],
      ['Blender', ['blender', 'blend']],
      ['V-Ray', ['vray', 'v ray']],
      ['Enscape', ['enscape']],
      ['D5 Render', ['d5 render', 'd5']],
      ['3ds Max', ['3ds max', '3dsmax']],
      ['Revit', ['revit', 'rvt']],
      ['Camtasia', ['camtasia']],
      ['Premiere Pro', ['premiere']]
    ];
    const tools = [];
    toolMap.forEach(function (pair) {
      if (tokenMatch(corpus, pair[1])) tools.push(pair[0]);
    });

    const dateMatch = corpus.match(/(?:^|[^0-9])(202[0-9]|201[6-9])(?:[^0-9]|$)/);
    const scaleMatch = corpus.match(/(\d[\d,\.]*\s*(?:sq\.?\s*ft|sft|katha|bigha|decimal|acre|sqm|m2)|g\s*\+\s*\d+|b\s*\+\s*g\s*\+\s*\d+|1\s*:\s*\d{2,4})/i);

    const kwPool = [
      'Duplex', 'Triplex', 'Residential', 'Commercial', 'Mosque', 'Resort', 'Villa', 'Apartment',
      'Penthouse', 'RAJUK', 'Jalshiri', 'Cantonment', 'DOHS', 'Modern', 'Minimalist', 'Contemporary',
      'Twilight', 'Daylight', 'Landscape', 'Interior', 'Exterior', 'Facade', 'Rooftop', '4K 60fps'
    ];
    const keywords = kwPool.filter(function (kw) {
      return tokenMatch(corpus, [kw.toLowerCase()]);
    });

    // Clean title inference from folder name if title blank
    let inferredTitle = '';
    if (driveScanCache.folderName && !/^project[\s\-_]*\d+$/i.test(driveScanCache.folderName.trim())) {
      inferredTitle = driveScanCache.folderName.replace(/[_\-]+/g, ' ').trim();
    }

    return {
      assigned: assigned,
      ambiguous: ambiguous,
      details: {
        title: inferredTitle,
        date: dateMatch ? dateMatch[1] : '',
        scale: scaleMatch ? scaleMatch[0].trim() : '',
        tools: tools,
        keywords: keywords
      }
    };
  }

  /* ------------------------------------------------------------------------
     Reliable Multi-Model Gemini & Ollama Client (Explicit Errors, Zero Silent Fail)
     ------------------------------------------------------------------------ */
  function gatherVisualPartsForAi() {
    // Prefer local user-picked samples + Drive Scanner CORS-free base64 thumbnails (up to 4 total)
    const out = [];
    localVisualParts.forEach(function (p) {
      if (out.length < 4) out.push({ inlineData: { mimeType: p.mimeType, data: p.data } });
    });
    (driveScanCache.sampleThumbs || []).forEach(function (t) {
      if (out.length < 4 && t.data) out.push({ inlineData: { mimeType: t.mimeType || 'image/jpeg', data: t.data } });
    });
    return out;
  }

  async function discoverGeminiModels(key) {
    if (discoveredGeminiModels && discoveredForKey === key) return discoveredGeminiModels;
    try {
      const cached = JSON.parse(localStorage.getItem(FAST_MODEL_CACHE_KEY) || 'null');
      if (cached && cached.keyTail === key.slice(-6) && Array.isArray(cached.models) && cached.models.length && (Date.now() - cached.ts < 86400000)) {
        discoveredGeminiModels = cached.models;
        discoveredForKey = key;
        return discoveredGeminiModels;
      }
    } catch (e) {}
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key));
      if (!res.ok) return GEMINI_FALLBACK_MODELS;
      const data = await res.json();
      const models = (data.models || [])
        .filter(function (m) {
          return Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.indexOf('generateContent') >= 0 &&
            /gemini/i.test(m.name || '') &&
            !/embedding|imagen|veo|tts|audio|robotics|computer-use|thinking/i.test(m.name || '');
        })
        .map(function (m) { return String(m.name).replace(/^models\//, ''); });

      if (!models.length) return GEMINI_FALLBACK_MODELS;

      // Prioritize fastest low-latency multimodal Flash models
      const rank = function (name) {
        if (/^gemini-2\.5-flash-lite$/i.test(name)) return 1;
        if (/^gemini-2\.5-flash$/i.test(name)) return 2;
        if (/^gemini-2\.0-flash$/i.test(name)) return 3;
        if (/^gemini-flash-latest$/i.test(name)) return 4;
        if (/flash-lite/i.test(name)) return 5;
        if (/flash/i.test(name)) return 6;
        return 10;
      };
      models.sort(function (a, b) { return rank(a) - rank(b); });
      discoveredGeminiModels = models.slice(0, 4);
      discoveredForKey = key;
      try {
        localStorage.setItem(FAST_MODEL_CACHE_KEY, JSON.stringify({ keyTail: key.slice(-6), models: discoveredGeminiModels, ts: Date.now() }));
      } catch (e) {}
      return discoveredGeminiModels;
    } catch (e) {
      return GEMINI_FALLBACK_MODELS;
    }
  }

  async function callGeminiJson(promptText, visualParts) {
    const key = (config.aiKey || '').trim();
    if (!key) throw new Error('Gemini API key is empty. Paste your free key from aistudio.google.com in Connect & AI Setup.');

    const candidateModels = await discoverGeminiModels(key);
    const parts = [{ text: promptText }].concat(visualParts || []);
    const errors = [];

    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
      try {
        let res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: parts }],
            generationConfig: Object.assign(
              { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 1024 },
              /gemini-2\.5/i.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}
            )
          })
        });

        // If responseMimeType caused a 400 on a specific model, retry cleanly without it
        if (res.status === 400) {
          const checkTxt = await res.clone().text();
          if (/API_KEY_INVALID/i.test(checkTxt)) {
            throw new Error('Invalid Gemini API key. Generate a fresh key at aistudio.google.com/apikey.');
          }
          if (/responseMimeType|JSON mode|modality|thinkingConfig|thinkingBudget/i.test(checkTxt)) {
            res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: parts }],
                generationConfig: { temperature: 0.2 }
              })
            });
          }
        }

        if (res.ok) {
          const data = await res.json();
          const txt = data && data.candidates && data.candidates[0] &&
            data.candidates[0].content && data.candidates[0].content.parts &&
            data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
          if (!txt) throw new Error('Empty response');
          return { json: extractJsonObject(txt), model: model };
        }

        const errBody = await res.text();
        let shortMsg = 'HTTP ' + res.status;
        try {
          const parsedErr = JSON.parse(errBody);
          if (parsedErr.error && parsedErr.error.message) shortMsg = res.status + ' ' + parsedErr.error.message.slice(0, 120);
        } catch (e) {}
        if (res.status === 401 || res.status === 403) {
          throw new Error('Gemini API key rejected (' + shortMsg + ').');
        }
        errors.push(model + ': ' + shortMsg);
      } catch (e) {
        if (/Invalid Gemini API key|rejected/i.test(e.message)) throw e;
        errors.push(model + ': ' + (e.message || String(e)));
      }
    }
    throw new Error('Gemini failed -> ' + errors.join(' | '));
  }

  async function callOllamaJson(promptText, visualParts) {
    const model = (config.aiKey || 'llama3.2').trim();
    const payload = {
      model: model,
      prompt: promptText,
      format: 'json',
      stream: false
    };
    if (visualParts && visualParts.length) {
      payload.images = visualParts.map(function (v) { return v.inlineData.data; });
    }
    let res;
    try {
      res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (netErr) {
      throw new Error('Cannot reach Local Ollama at http://localhost:11434. Start Ollama with OLLAMA_ORIGINS="*" and ensure it is running on this PC.');
    }
    if (!res.ok) throw new Error('Ollama error (' + res.status + '). Check model name "' + model + '".');
    const data = await res.json();
    return { json: extractJsonObject(data.response), model: 'ollama/' + model };
  }

  async function invokeConfiguredAi(promptText, visualParts) {
    if (config.aiMode === 'gemini') return await callGeminiJson(promptText, visualParts);
    if (config.aiMode === 'ollama') return await callOllamaJson(promptText, visualParts);
    return null;
  }

  function buildSmartFallbackDescription(proj) {
    const title = ($('pTitle').value.trim() || proj.title || 'This architectural project');
    const scale = $('dScale').value.trim();
    const tools = $('dTools').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    const kws = $('dKeywords').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    const enabledParts = PART_KEYS.filter(function (k) { return proj.parts[k] && proj.parts[k].enabled; });

    const partNames = [];
    if (enabledParts.indexOf('3Dvis_ext') >= 0) partNames.push('exterior 3D visualization');
    if (enabledParts.indexOf('3Dvis_int') >= 0) partNames.push('interior 3D design');
    if (enabledParts.indexOf('AW_ext') >= 0) partNames.push('exterior animation walkthrough');
    if (enabledParts.indexOf('AW_int') >= 0) partNames.push('interior animation walkthrough');

    let imgCount = 0, vidCount = 0;
    enabledParts.forEach(function (k) {
      const p = proj.parts[k];
      if (p.cover && p.cover.url) { if (PART_META[k].isAW) vidCount++; else imgCount++; }
      (p.additionals || []).forEach(function (a) {
        if (a.type === 'video' || a.type === 'youtube' || a.type === 'facebook' || a.type === 'drive_video') vidCount++;
        else if (a.type === 'image') imgCount++;
      });
    });

    const scopeStr = partNames.length ? (' featuring ' + partNames.join(', ')) : '';
    const scaleStr = scale ? (' (' + scale + ')') : '';
    const bullets = [];
    bullets.push('• Project Scope: ' + title + scaleStr + (partNames.length ? (' — ' + partNames.join(', ')) : '') + '.');
    if (imgCount || vidCount) {
      const m = [];
      if (imgCount) m.push(imgCount + ' visual render' + (imgCount > 1 ? 's' : ''));
      if (vidCount) m.push(vidCount + ' walkthrough video' + (vidCount > 1 ? 's' : ''));
      bullets.push('• Media Package: ' + m.join(' & ') + '.');
    }
    if (tools.length) bullets.push('• Software & Workflow: ' + tools.join(', ') + '.');
    if (kws.length) bullets.push('• Key Highlights: ' + kws.slice(0, 6).join(', ') + '.');
    return bullets.join('\n');
  }

  /* ------------------------------------------------------------------------
     Unified Single-Call Scan & AI Auto-Sort + Details Extraction
     ------------------------------------------------------------------------ */
  async function runAiScanAndSort() {
    if (isBusy) return;
    const btn = $('runAiSortBtn');
    setBusy(true, btn, 'Scanning & Analyzing...');
    showLog('aiSortLog', 'Scanning Drive folder, YouTube/FB links & running AI analysis...', '');
    $('aiQaBox').style.display = 'none';

    try {
      const title = $('pTitle').value.trim();
      const labelSlug = $('pLabelSlug').value.trim() || 'Project-' + ((liveCatalog.projects ? liveCatalog.projects.length : 0) + 1);
      const projectId = $('pProjectId').value.trim() || ('PRJ-' + String((liveCatalog.projects ? liveCatalog.projects.length : 0) + 1).padStart(3, '0'));
      const driveUrl = $('pDriveFolder').value.trim();
      const ytLines = $('pYoutubeLinks').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      const fbLines = $('pFbLinks').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      const extraText = $('pExtraText').value.trim();

      const allItems = [];
      let contextNotes = [title, labelSlug, extraText].filter(Boolean).join('\n');

      // 1. Scan Drive folder (request sample thumbnails when Gemini/Ollama is active)
      if (driveUrl) {
        const wantSamples = (config.aiMode === 'gemini' || config.aiMode === 'ollama');
        const scan = await scanDriveFolder(driveUrl, wantSamples);
        if (scan.folderName) contextNotes += '\nFolder Name: ' + scan.folderName;
        (scan.files || []).forEach(function (f) { allItems.push(f); });
      }

      // 2 & 3. Parse YouTube & Facebook links + fetch full YT descriptions & FB captions in parallel!
      const ytItems = ytLines.map(normalizeSingleUrlItem).filter(Boolean);
      const fbItems = fbLines.map(normalizeSingleUrlItem).filter(Boolean);
      const metaResults = await Promise.all(
        ytItems.concat(fbItems).map(function (it) { return fetchRichLinkMetadata(it.url); })
      );
      ytItems.concat(fbItems).forEach(function (item, idx) {
        const meta = metaResults[idx] || {};
        if (meta.title) {
          item.name = meta.title;
          contextNotes += '\n' + (item.type === 'youtube' ? 'YouTube Title: ' : 'Facebook Post Title: ') + meta.title;
        }
        if (meta.description) {
          contextNotes += '\n' + (item.type === 'youtube' ? 'YouTube Description: ' : 'Facebook Caption: ') + meta.description;
        }
        allItems.push(item);
      });
      extraText.split('\n').forEach(function (l) {
        if (/^https?:\/\//i.test(l.trim())) {
          const item = normalizeSingleUrlItem(l);
          if (item) allItems.push(item);
        }
      });

      // 4. Smart baseline + Single Unified Multimodal AI call (classification + ALL details in 1 call!)
      const result = smartHeuristicClassify(allItems, contextNotes);
      let aiEngineUsed = 'Built-in Smart Classifier';
      let aiWarning = '';

      if (config.aiMode === 'gemini' || config.aiMode === 'ollama') {
        const visualParts = gatherVisualPartsForAi();
        const unifiedPrompt = [
          'You are an expert architectural portfolio organizer. Analyze the attached render images/video frames (if any), file list, folder paths, YouTube titles, and notes.',
          'Tasks:',
          '1) Classify EACH file index (0 to ' + Math.max(0, allItems.length - 1) + ') into ONE of: "3Dvis_ext", "3Dvis_int", "AW_ext", "AW_int", "AW_both" (video showing BOTH exterior and interior), or "unsure".',
          '   - Images & 3D files go to 3Dvis_ext or 3Dvis_int.',
          '   - Videos (mp4/youtube/facebook/drive_video) go to AW_ext, AW_int, or AW_both.',
          '2) Extract accurate project details strictly from the images, videos, filenames, and notes:',
          '   - title: clean architectural project title (leave "" if unclear)',
          '   - date: year/date ONLY if explicitly present, else ""',
          '   - scale: building/plot scale ONLY if explicitly present (e.g. "5 Katha • G+8", "4,200 sq.ft"), else ""',
          '   - tools: array of software detected from filenames/extensions/notes (e.g. SketchUp, Lumion, AutoCAD, Photoshop, Blender)',
          '   - keywords: 4 to 8 accurate architectural keywords based on visual style & project type',
          '   - description: 4 to 6 concise, accurate bullet points (each starting with "• ", separated by \n) summarizing key architectural details, spatial design, materials, lighting, typology, and scope analyzed deeply from the images, videos, YouTube description, FB caption, and Drive folder. NO paragraph prose. Never invent unstated facts.',
          'Return STRICT JSON ONLY: {"classifications":{"0":"3Dvis_ext"},"details":{"title":"","date":"","scale":"","tools":[],"keywords":[],"description":""}}',
          'CONTEXT NOTES:\n' + contextNotes.slice(0, 3000),
          'FILES (' + allItems.length + ' total):\n' + allItems.slice(0, 120).map(function (it, i) {
            return i + ': [' + it.type + '] ' + (it.folderPath ? it.folderPath + '/' : '') + (it.name || it.url);
          }).join('\n')
        ].join('\n\n');

        try {
          const aiOut = await invokeConfiguredAi(unifiedPrompt, visualParts);
          if (aiOut && aiOut.json) {
            aiEngineUsed = aiOut.model + (visualParts.length ? (' + ' + visualParts.length + ' visual sample(s)') : '');
            const clsMap = aiOut.json.classifications || {};
            if (Object.keys(clsMap).length) {
              const assigned = { '3Dvis_ext': [], '3Dvis_int': [], 'AW_ext': [], 'AW_int': [] };
              const ambiguous = [];
              allItems.forEach(function (it, idx) {
                const cls = clsMap[String(idx)] || 'unsure';
                if (cls === 'AW_both') {
                  assigned['AW_ext'].push(it);
                  assigned['AW_int'].push(it);
                } else if (assigned[cls]) {
                  assigned[cls].push(it);
                } else {
                  ambiguous.push({ idx: idx, item: it, suggested: '3Dvis_ext' });
                }
              });
              result.assigned = assigned;
              result.ambiguous = ambiguous;
            }
            if (aiOut.json.details) {
              const d = aiOut.json.details;
              result.details = {
                title: d.title || result.details.title || '',
                date: d.date || result.details.date || '',
                scale: d.scale || result.details.scale || '',
                tools: (Array.isArray(d.tools) && d.tools.length) ? d.tools : result.details.tools,
                keywords: (Array.isArray(d.keywords) && d.keywords.length) ? d.keywords : result.details.keywords,
                description: Array.isArray(d.description) ? d.description.map(function(b){ return /^•/.test(String(b).trim()) ? String(b).trim() : ('• ' + String(b).trim()); }).join('\n') : (d.description || '')
              };
            }
          }
        } catch (aiErr) {
          aiWarning = ' [AI Note: ' + aiErr.message + ' — used Built-in Smart Classifier instead]';
        }
      }

      // 5. Populate or merge into currentProject
      if (projectMode === 'add') {
        currentProject = createEmptyProject();
        currentProject.id = slugify(labelSlug || title || result.details.title);
        currentProject.projectId = projectId;
        currentProject.title = title || result.details.title || labelSlug;
      } else {
        if (title) currentProject.title = title;
        if (projectId) currentProject.projectId = projectId;
      }

      PART_KEYS.forEach(function (k) {
        const part = currentProject.parts[k];
        const incoming = result.assigned[k] || [];
        if (projectMode === 'add') {
          part.label = PART_META[k].tag + ' • ' + labelSlug;
          part.title = currentProject.title;
        }
        if (incoming.length) {
          part.enabled = true;
          incoming.forEach(function (it) {
            const entry = {
              type: it.type || 'image',
              url: it.url,
              thumb: it.thumb || '',
              title: it.name || it.title || '',
              ext: it.ext || ''
            };
            if (!part.cover.url && (PART_META[k].isAW ? (entry.type !== 'file3d') : (entry.type === 'image'))) {
              part.cover = { type: entry.type, url: entry.url, thumbnail: entry.thumb || entry.url };
            } else {
              part.additionals.push(entry);
            }
          });
        }
      });

      // Fill form details
      if (!$('pTitle').value.trim() && result.details.title) $('pTitle').value = result.details.title;
      if (!$('dDate').value.trim() && result.details.date) $('dDate').value = result.details.date;
      if (!$('dScale').value.trim() && result.details.scale) $('dScale').value = result.details.scale;
      if (!$('dTools').value.trim() && result.details.tools.length) $('dTools').value = result.details.tools.join(', ');
      if (!$('dKeywords').value.trim() && result.details.keywords.length) $('dKeywords').value = result.details.keywords.join(', ');
      if (!$('dDescription').value.trim()) {
        $('dDescription').value = result.details.description || buildSmartFallbackDescription(currentProject);
      }

      // Build Missing-Field & Ambiguous-File Q&A
      pendingQuestions = [];
      if (!$('dDate').value.trim()) pendingQuestions.push({ field: 'dDate', label: 'Project Date was not found — enter or leave blank:' });
      if (!$('dScale').value.trim()) pendingQuestions.push({ field: 'dScale', label: 'Project Scale was not found — enter or leave blank:' });
      if (!$('dTools').value.trim()) pendingQuestions.push({ field: 'dTools', label: 'Tools Used were not found — enter or leave blank:' });
      if (!$('dKeywords').value.trim()) pendingQuestions.push({ field: 'dKeywords', label: 'Keywords were not found — enter or leave blank:' });
      pendingAmbiguousFiles = result.ambiguous || [];

      renderQaBox();
      renderFourPartsEditor();
      showLog(
        'aiSortLog',
        'Analyzed ' + allItems.length + ' items using ' + aiEngineUsed + '.' +
          (pendingQuestions.length + pendingAmbiguousFiles.length > 0 ? ' Review clarification items below.' : ' All details ready!') +
          aiWarning,
        aiWarning ? '' : 'ok'
      );
    } catch (err) {
      showLog('aiSortLog', err.message || String(err), 'err');
    } finally {
      setBusy(false, btn);
    }
  }

  /* ------------------------------------------------------------------------
     One-Click Auto-Generate All Details OR Single Box (Auto-scans Drive too!)
     ------------------------------------------------------------------------ */
  async function collectAllProjectSourceItemsAsync() {
    const items = [];
    // If user pasted a Drive folder link and clicked Auto BEFORE Scan & Sort, auto-scan it now!
    const driveUrl = $('pDriveFolder').value.trim();
    if (driveUrl && config.driveScanner && driveScanCache.url !== driveUrl) {
      try {
        const wantSamples = (config.aiMode === 'gemini' || config.aiMode === 'ollama');
        await scanDriveFolder(driveUrl, wantSamples);
      } catch (e) {}
    }
    if (driveScanCache.url === driveUrl && driveScanCache.files.length) {
      driveScanCache.files.forEach(function (f) { items.push(f); });
    }

    PART_KEYS.forEach(function (k) {
      const p = currentProject.parts[k];
      if (!p) return;
      if (p.cover && p.cover.url) {
        items.push({
          part: k,
          type: p.cover.type || (PART_META[k].isAW ? 'video' : 'image'),
          url: p.cover.url,
          thumb: p.cover.thumbnail || (p.cover.type === 'image' ? p.cover.url : ''),
          name: p.title || p.label || ''
        });
      }
      (p.additionals || []).forEach(function (a) {
        items.push({
          part: k,
          type: a.type || 'image',
          url: a.url || '',
          thumb: a.thumb || (a.type === 'image' ? a.url : ''),
          name: a.title || a.url || '',
          ext: a.ext || ''
        });
      });
    });

    ['pYoutubeLinks', 'pFbLinks', 'pExtraText'].forEach(function (id) {
      const el = $(id);
      if (!el || !el.value) return;
      el.value.split('\n').forEach(function (line) {
        const n = normalizeSingleUrlItem(line);
        if (n) items.push(n);
      });
    });
    return items;
  }

  async function autoGenerateFormDetails(targetField, triggerBtn) {
    if (isBusy) return;
    const modeLabel = targetField === 'all' ? 'all project details' : targetField;
    setBusy(true, triggerBtn, 'Analyzing...');
    showLog('aiSortLog', 'Analyzing source images, videos & contents for ' + modeLabel + '...', '');

    try {
      const items = await collectAllProjectSourceItemsAsync();
      const richTargets = items.filter(function (it) { return (it.type === 'youtube' || it.type === 'facebook') && it.url; }).slice(0, 4);
      const richMetas = await Promise.all(richTargets.map(function (it) { return fetchRichLinkMetadata(it.url); }));
      const ytTitles = richMetas.map(function (m) { return m.title; }).filter(Boolean);
      const richDescs = richMetas.map(function (m) {
        return [m.title ? ('Title: ' + m.title) : '', m.description ? ('Caption/Description: ' + m.description) : ''].filter(Boolean).join('\n');
      }).filter(Boolean);

      const fullContext = [
        $('pTitle').value.trim(),
        $('pLabelSlug').value.trim(),
        driveScanCache.folderName ? ('Folder: ' + driveScanCache.folderName) : '',
        $('pExtraText').value.trim(),
        richDescs.join('\n---\n')
      ].filter(Boolean).join('\n');

      const smart = smartHeuristicClassify(items, fullContext);
      let generated = {
        title: $('pTitle').value.trim() || ytTitles[0] || smart.details.title || currentProject.title || '',
        date: smart.details.date || '',
        scale: smart.details.scale || '',
        tools: smart.details.tools || [],
        keywords: smart.details.keywords || [],
        description: buildSmartFallbackDescription(currentProject)
      };

      let engineNote = 'Built-in Smart Analyzer';
      let warnNote = '';

      if (config.aiMode === 'gemini' || config.aiMode === 'ollama') {
        const visualParts = gatherVisualPartsForAi();
        const promptText = [
          'You are an expert architectural portfolio assistant. Analyze the attached source render images/video frames, video titles, filenames, and notes.',
          'Return STRICT JSON ONLY with keys: {"title":"","date":"","scale":"","tools":[],"keywords":[],"description":""}',
          'Accuracy Rules:',
          '- Leave date or scale as "" if NOT explicitly stated in the images/videos/notes (never invent numbers or dates).',
          '- Generate a concise architectural title if clear from the media/notes.',
          '- Extract software tools from file extensions (.skp, .ls12, .blend, .dwg) or notes.',
          '- Generate 4-8 accurate architectural keywords describing style, lighting, typology, and materials visible in the images/videos.',
          '- Write description as 4 to 6 concise, accurate bullet points (each starting with "• ", separated by \\n) capturing key architectural details, design features, materials, lighting, and scope from the images, videos, YT description, FB caption, and Drive folder. NO paragraph prose. Never invent unstated facts.',
          'CONTEXT:\n' + fullContext.slice(0, 2500),
          'SOURCE CONTENTS (' + items.length + ' items):\n' + items.slice(0, 50).map(function (it) {
            return '[' + (it.part || 'src') + ':' + it.type + '] ' + (it.folderPath ? it.folderPath + '/' : '') + (it.name || it.url);
          }).join('\n')
        ].join('\n\n');

        try {
          const aiOut = await invokeConfiguredAi(promptText, visualParts);
          if (aiOut && aiOut.json) {
            engineNote = aiOut.model + (visualParts.length ? (' + ' + visualParts.length + ' visual sample(s)') : '');
            const p = aiOut.json;
            generated = {
              title: p.title || generated.title,
              date: p.date || generated.date,
              scale: p.scale || generated.scale,
              tools: (Array.isArray(p.tools) && p.tools.length) ? p.tools : generated.tools,
              keywords: (Array.isArray(p.keywords) && p.keywords.length) ? p.keywords : generated.keywords,
              description: Array.isArray(p.description) ? p.description.map(function(b){ return /^•/.test(String(b).trim()) ? String(b).trim() : ('• ' + String(b).trim()); }).join('\n') : (p.description || generated.description)
            };
          }
        } catch (aiErr) {
          warnNote = ' [AI Error: ' + aiErr.message + ' — fell back to Smart Analyzer]';
        }
      }

      const applyAll = targetField === 'all';
      if ((applyAll || targetField === 'title') && generated.title) $('pTitle').value = generated.title;
      if ((applyAll || targetField === 'date') && generated.date) $('dDate').value = generated.date;
      if ((applyAll || targetField === 'scale') && generated.scale) $('dScale').value = generated.scale;
      if ((applyAll || targetField === 'tools') && generated.tools.length) $('dTools').value = generated.tools.join(', ');
      if ((applyAll || targetField === 'keywords') && generated.keywords.length) $('dKeywords').value = generated.keywords.join(', ');
      if ((applyAll || targetField === 'description') && generated.description) $('dDescription').value = generated.description;

      showLog(
        'aiSortLog',
        'Generated ' + modeLabel + ' via ' + engineNote + ' (' + items.length + ' source items).' + warnNote,
        warnNote ? 'err' : 'ok'
      );
    } catch (err) {
      showLog('aiSortLog', err.message || String(err), 'err');
    } finally {
      setBusy(false, triggerBtn);
    }
  }

  function autoGenerateModelField(field) {
    const raw = ($('mDriveFolder').value + ' ' + $('mExtraUrls').value + ' ' + $('mCover').value);
    if (field === 'modelId') {
      $('mModelId').value = 'MDL-' + String((liveModels.models ? liveModels.models.length : 0) + 1).padStart(2, '0');
      showLog('modelLog', 'Auto-generated next Model ID.', 'ok');
    } else if (field === 'scale') {
      const m = raw.match(/1\s*:\s*\d{2,4}/);
      if (m) {
        $('mScale').value = 'Scaling ' + m[0].replace(/\s/g, '');
        showLog('modelLog', 'Detected scale "' + $('mScale').value + '" from source links.', 'ok');
      } else {
        showLog('modelLog', 'No scale ratio (e.g. 1:200) found in links yet — scan a Drive folder or enter manually.', '');
      }
    }
  }

  /* ------------------------------------------------------------------------
     Q&A Box, 4-Part Editor, Live GitHub Push & Existing Projects
     ------------------------------------------------------------------------ */
  function renderQaBox() {
    const box = $('aiQaBox');
    const list = $('aiQaList');
    if (!pendingQuestions.length && !pendingAmbiguousFiles.length) {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'block';
    let html = '';

    pendingQuestions.forEach(function (q) {
      html += '<div class="tb-qa-item">' +
        '<div style="flex:1 1 260px;font-size:0.84rem;font-weight:600;">' + escapeHtml(q.label) + '</div>' +
        '<input class="tb-input" style="flex:1 1 220px;" data-qa-field="' + q.field + '" placeholder="Leave blank if unknown" />' +
      '</div>';
    });

    pendingAmbiguousFiles.forEach(function (amb, i) {
      html += '<div class="tb-qa-item">' +
        '<div style="flex:1 1 260px;font-size:0.83rem;"><strong>Unsure file:</strong> ' + escapeHtml(amb.item.name || amb.item.url) + '</div>' +
        '<select class="tb-select" style="flex:0 1 220px;" data-qa-file="' + i + '">' +
          '<option value="3Dvis_ext">3Dvis — Exterior</option>' +
          '<option value="3Dvis_int">3Dvis — Interior</option>' +
          '<option value="AW_ext">Walkthrough — Exterior</option>' +
          '<option value="AW_int">Walkthrough — Interior</option>' +
          '<option value="AW_both">Walkthrough — BOTH Ext &amp; Int</option>' +
          '<option value="skip">Skip this file</option>' +
        '</select>' +
      '</div>';
    });

    list.innerHTML = html;
  }

  function applyQaAnswers() {
    $('aiQaList').querySelectorAll('[data-qa-field]').forEach(function (inp) {
      const f = inp.getAttribute('data-qa-field');
      if (inp.value.trim()) $(f).value = inp.value.trim();
    });

    $('aiQaList').querySelectorAll('[data-qa-file]').forEach(function (sel) {
      const i = parseInt(sel.getAttribute('data-qa-file'), 10);
      const dest = sel.value;
      const amb = pendingAmbiguousFiles[i];
      if (!amb || dest === 'skip') return;
      const targets = dest === 'AW_both' ? ['AW_ext', 'AW_int'] : [dest];
      targets.forEach(function (k) {
        const part = currentProject.parts[k];
        part.enabled = true;
        const entry = {
          type: amb.item.type || 'image',
          url: amb.item.url,
          thumb: amb.item.thumb || '',
          title: amb.item.name || '',
          ext: amb.item.ext || ''
        };
        if (!part.cover.url) {
          part.cover = { type: entry.type, url: entry.url, thumbnail: entry.thumb || entry.url };
        } else {
          part.additionals.push(entry);
        }
      });
    });

    pendingQuestions = [];
    pendingAmbiguousFiles = [];
    $('aiQaBox').style.display = 'none';
    renderFourPartsEditor();
  }

  function renderFourPartsEditor() {
    const grid = $('fourPartsGrid');
    grid.innerHTML = '';

    PART_KEYS.forEach(function (k) {
      const part = currentProject.parts[k];
      const box = document.createElement('div');
      box.className = 'tb-part-box';

      const mediaRows = (part.additionals || []).map(function (m, idx) {
        const thumbUrl = m.thumb || (m.type === 'image' ? m.url : '');
        return '<div class="tb-media-row">' +
          '<div class="tb-media-row-left">' +
            (thumbUrl ? '<img class="tb-media-thumb" src="' + escapeHtml(thumbUrl) + '" onerror="this.style.display=\'none\'" />' : '<i class="fa-solid fa-file"></i>') +
            '<span class="tb-media-name" title="' + escapeHtml(m.title || m.url) + '">' + escapeHtml(m.title || m.url) + '</span>' +
          '</div>' +
          '<button type="button" class="tb-btn tb-btn-danger tb-btn-sm" data-del-media="' + k + ':' + idx + '">&times;</button>' +
        '</div>';
      }).join('');

      box.innerHTML =
        '<div class="tb-part-head">' +
          '<span class="tb-part-badge">' + PART_META[k].title + '</span>' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;font-weight:700;cursor:pointer;">' +
            '<input type="checkbox" data-part-enable="' + k + '"' + (part.enabled ? ' checked' : '') + ' /> Enabled' +
          '</label>' +
        '</div>' +
        '<div class="tb-field"><label>Top-Left Card Label</label><input class="tb-input" data-part-label="' + k + '" value="' + escapeHtml(part.label || '') + '" /></div>' +
        '<div class="tb-field"><label>Cover ' + (PART_META[k].isAW ? 'Video URL (YouTube / FB / Drive / MP4)' : 'Image URL') + '</label>' +
          '<input class="tb-input" data-part-cover="' + k + '" value="' + escapeHtml((part.cover && part.cover.url) || '') + '" /></div>' +
        (PART_META[k].isAW
          ? '<div class="tb-field"><label>Cover Thumbnail Image URL</label><input class="tb-input" data-part-thumb="' + k + '" value="' + escapeHtml((part.cover && part.cover.thumbnail) || '') + '" /></div>'
          : '') +
        '<div style="display:flex;gap:6px;margin-top:8px;">' +
          '<input class="tb-input" id="addUrl_' + k + '" placeholder="Manually add image/video/3D URL..." />' +
          '<button type="button" class="tb-btn tb-btn-primary tb-btn-sm" data-add-media="' + k + '">+ Add</button>' +
        '</div>' +
        '<div class="tb-media-list">' + (mediaRows || '<div style="font-size:0.78rem;opacity:0.6;padding:6px;">No additional contents yet.</div>') + '</div>';

      grid.appendChild(box);
    });

    grid.querySelectorAll('[data-part-enable]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        currentProject.parts[cb.getAttribute('data-part-enable')].enabled = cb.checked;
      });
    });
    grid.querySelectorAll('[data-part-label]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        currentProject.parts[inp.getAttribute('data-part-label')].label = inp.value;
      });
    });
    grid.querySelectorAll('[data-part-cover]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const k = inp.getAttribute('data-part-cover');
        const norm = normalizeSingleUrlItem(inp.value) || { type: PART_META[k].isAW ? 'video' : 'image', url: inp.value.trim(), thumb: inp.value.trim() };
        currentProject.parts[k].cover.url = norm.url;
        currentProject.parts[k].cover.type = norm.type;
        if (!currentProject.parts[k].cover.thumbnail && norm.thumb) currentProject.parts[k].cover.thumbnail = norm.thumb;
      });
    });
    grid.querySelectorAll('[data-part-thumb]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        currentProject.parts[inp.getAttribute('data-part-thumb')].cover.thumbnail = inp.value.trim();
      });
    });
    grid.querySelectorAll('[data-add-media]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const k = btn.getAttribute('data-add-media');
        const urlInp = $('addUrl_' + k);
        const val = urlInp.value.trim();
        if (!val) return;
        const norm = normalizeSingleUrlItem(val) || { type: 'image', url: val, thumb: val, name: val.split('/').pop() };
        currentProject.parts[k].enabled = true;
        currentProject.parts[k].additionals.push({ type: norm.type, url: norm.url, thumb: norm.thumb || '', title: norm.name || '', ext: norm.ext || '' });
        urlInp.value = '';
        renderFourPartsEditor();
      });
    });
    grid.querySelectorAll('[data-del-media]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const parts = btn.getAttribute('data-del-media').split(':');
        currentProject.parts[parts[0]].additionals.splice(parseInt(parts[1], 10), 1);
        renderFourPartsEditor();
      });
    });
  }

  function finalizeProjectObject() {
    const title = $('pTitle').value.trim() || currentProject.title || 'Untitled Project';
    const labelSlug = $('pLabelSlug').value.trim() || currentProject.id || slugify(title);
    const id = currentProject.id || slugify(labelSlug);
    const projectId = $('pProjectId').value.trim() || currentProject.projectId || id.toUpperCase();
    const dateVal = $('dDate').value.trim();
    const scaleVal = $('dScale').value.trim();
    const toolsArr = $('dTools').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    const kwArr = $('dKeywords').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    const descVal = $('dDescription').value.trim();

    currentProject.id = id;
    currentProject.projectId = projectId;
    currentProject.title = title;

    PART_KEYS.forEach(function (k) {
      const part = currentProject.parts[k];
      part.title = part.title || title;
      part.details = {
        description: descVal,
        keywords: kwArr,
        tools: toolsArr,
        date: dateVal,
        projectId: projectId,
        scale: scaleVal
      };
    });

    return currentProject;
  }

  function buildCatalogEntry(proj) {
    const partsSummary = {};
    PART_KEYS.forEach(function (k) {
      const p = proj.parts[k];
      if (p && p.enabled) {
        partsSummary[k] = {
          enabled: true,
          label: p.label,
          title: p.title || proj.title,
          cover: (p.cover && (p.cover.thumbnail || p.cover.url)) || 'assets/card1.jpg',
          count: (p.additionals ? p.additionals.length : 0) + (p.cover && p.cover.url ? 1 : 0)
        };
      } else {
        partsSummary[k] = { enabled: false };
      }
    });
    return {
      id: proj.id,
      projectId: proj.projectId,
      title: proj.title,
      date: $('dDate').value.trim(),
      parts: partsSummary
    };
  }

  async function pushProjectLive() {
    if (isBusy) return;
    const btn = $('pushProjectBtn');
    const proj = finalizeProjectObject();
    setBusy(true, btn, 'Pushing Live...');
    showLog('pushProjectLog', 'Pushing ' + proj.id + ' live to GitHub Pages (preserving all existing projects)...', '');
    try {
      const catRes = await ghReadJson('data/catalog.json');
      const catalog = (catRes && catRes.data) ? catRes.data : { version: 2, updatedAt: '', projects: [] };
      const entry = buildCatalogEntry(proj);
      const existingIdx = catalog.projects.findIndex(function (x) { return x.id === proj.id; });
      if (existingIdx >= 0) catalog.projects[existingIdx] = entry;
      else catalog.projects.push(entry);
      catalog.updatedAt = new Date().toISOString();

      await ghWriteJson('data/projects/' + proj.id + '.json', proj, 'Toolbox: Save project ' + proj.id);
      await ghWriteJson('data/catalog.json', catalog, 'Toolbox: Update catalog for ' + proj.id);

      liveCatalog = catalog;
      showLog('pushProjectLog', 'Published "' + proj.title + '" live to GitHub Pages! Updates go live in ~30–60 seconds.', 'ok');
    } catch (err) {
      showLog('pushProjectLog', err.message || String(err), 'err');
    } finally {
      setBusy(false, btn);
    }
  }

  function downloadJsonFile(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function loadExistingProjectsList() {
    const list = $('existingProjectsList');
    list.innerHTML = '<div style="opacity:0.7;">Loading projects...</div>';
    try {
      const res = await ghReadJson('data/catalog.json');
      liveCatalog = (res && res.data) ? res.data : { version: 2, projects: [] };
      list.innerHTML = '';
      if (!liveCatalog.projects.length) {
        list.innerHTML = '<div style="opacity:0.7;">No projects found yet.</div>';
        return;
      }
      liveCatalog.projects.forEach(function (p) {
        const cover = (p.parts['3Dvis_ext'] && p.parts['3Dvis_ext'].cover) ||
                      (p.parts['3Dvis_int'] && p.parts['3Dvis_int'].cover) ||
                      (p.parts['AW_ext'] && p.parts['AW_ext'].cover) || '../assets/card1.jpg';
        const imgSrc = /^https?:/.test(cover) ? cover : '../' + cover;
        const activeTags = PART_KEYS.filter(function (k) { return p.parts[k] && p.parts[k].enabled; })
          .map(function (k) { return '<span class="tb-mini-tag">' + k + '</span>'; }).join('');

        const card = document.createElement('div');
        card.className = 'tb-existing-card';
        card.innerHTML =
          '<img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(p.title) + '" />' +
          '<div class="tb-existing-body">' +
            '<div style="font-weight:800;">' + escapeHtml(p.title) + '</div>' +
            '<div style="font-size:0.76rem;opacity:0.7;">ID: ' + escapeHtml(p.projectId || p.id) + '</div>' +
            '<div class="tb-mini-tags">' + activeTags + '</div>' +
            '<button type="button" class="tb-btn tb-btn-primary tb-btn-sm" data-load-proj="' + escapeHtml(p.id) + '">Edit This Project</button>' +
          '</div>';
        list.appendChild(card);
      });

      list.querySelectorAll('[data-load-proj]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const pid = btn.getAttribute('data-load-proj');
          const res = await ghReadJson('data/projects/' + pid + '.json');
          if (!res || !res.data) return;
          currentProject = res.data;
          $('pTitle').value = currentProject.title || '';
          $('pLabelSlug').value = currentProject.id || '';
          $('pProjectId').value = currentProject.projectId || '';
          const firstEnabled = PART_KEYS.find(function (k) { return currentProject.parts[k] && currentProject.parts[k].enabled; });
          const d = (firstEnabled && currentProject.parts[firstEnabled].details) || {};
          $('dDate').value = d.date || '';
          $('dScale').value = d.scale || '';
          $('dTools').value = (d.tools || []).join(', ');
          $('dKeywords').value = (d.keywords || []).join(', ');
          $('dDescription').value = d.description || '';
          renderFourPartsEditor();
          showLog('pushProjectLog', 'Loaded "' + currentProject.title + '" for editing.', 'ok');
          $('fourPartsCard').scrollIntoView({ behavior: 'smooth' });
        });
      });
    } catch (err) {
      list.innerHTML = '<div style="color:var(--tb-red);">' + escapeHtml(err.message) + '</div>';
    }
  }

  /* ------------------------------------------------------------------------
     Model Making & Academic Studio Tabs
     ------------------------------------------------------------------------ */
  async function loadExistingModels() {
    const list = $('existingModelsList');
    list.innerHTML = '<div style="opacity:0.7;">Loading models...</div>';
    try {
      const res = await ghReadJson('data/models.json');
      liveModels = (res && res.data) ? res.data : { version: 2, models: [] };
      renderModelsList();
    } catch (err) {
      list.innerHTML = '<div style="color:var(--tb-red);">' + escapeHtml(err.message) + '</div>';
    }
  }

  function renderModelsList() {
    const list = $('existingModelsList');
    list.innerHTML = '';
    (liveModels.models || []).forEach(function (m, idx) {
      const imgSrc = /^https?:/.test(m.cover) ? m.cover : '../' + m.cover;
      const card = document.createElement('div');
      card.className = 'tb-existing-card';
      card.innerHTML =
        '<img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(m.modelId) + '" />' +
        '<div class="tb-existing-body">' +
          '<div style="font-weight:800;">' + escapeHtml([m.scale, m.modelId].filter(Boolean).join(' • ')) + '</div>' +
          '<div style="font-size:0.78rem;opacity:0.7;">' + (m.additionals ? m.additionals.length : 0) + ' gallery items</div>' +
          '<div style="display:flex;gap:6px;">' +
            '<button type="button" class="tb-btn tb-btn-primary tb-btn-sm" data-edit-mdl="' + idx + '">Edit</button>' +
            '<button type="button" class="tb-btn tb-btn-danger tb-btn-sm" data-del-mdl="' + idx + '">Delete</button>' +
          '</div>' +
        '</div>';
      list.appendChild(card);
    });

    list.querySelectorAll('[data-edit-mdl]').forEach(function (b) {
      b.addEventListener('click', function () {
        editingModelIdx = parseInt(b.getAttribute('data-edit-mdl'), 10);
        const m = liveModels.models[editingModelIdx];
        $('mModelId').value = m.modelId || '';
        $('mScale').value = m.scale || '';
        $('mCover').value = m.cover || '';
        $('mExtraUrls').value = (m.additionals || []).map(function (x) { return x.url; }).join('\n');
        showLog('modelLog', 'Editing Model ' + m.modelId + '. Update fields and click Save & Push Models Live.', 'ok');
      });
    });

    list.querySelectorAll('[data-del-mdl]').forEach(function (b) {
      b.addEventListener('click', function () {
        liveModels.models.splice(parseInt(b.getAttribute('data-del-mdl'), 10), 1);
        renderModelsList();
        showLog('modelLog', 'Removed model from queue. Click "Save & Push Models Live" to publish.', '');
      });
    });
  }

  async function scanModelFolder() {
    if (isBusy) return;
    const btn = $('scanModelBtn');
    setBusy(true, btn, 'Scanning...');
    showLog('modelLog', 'Scanning model folder...', '');
    try {
      const scan = await scanDriveFolder($('mDriveFolder').value.trim(), false);
      const files = scan.files || [];
      if (!files.length) throw new Error('No files found in folder.');
      if (!$('mScale').value) {
        const sm = (scan.folderName || '').match(/1\s*:\s*\d{2,4}/);
        if (sm) $('mScale').value = 'Scaling ' + sm[0].replace(/\s/g, '');
      }
      if (!$('mModelId').value) {
        $('mModelId').value = 'MDL-' + String((liveModels.models.length || 0) + 1).padStart(2, '0');
      }
      const firstImg = files.find(function (f) { return f.type === 'image'; });
      if (!$('mCover').value && firstImg) $('mCover').value = firstImg.url;
      $('mExtraUrls').value = files.map(function (x) { return x.url; }).join('\n');
      showLog('modelLog', 'Loaded ' + files.length + ' model photos/videos. Click "Save & Push Models Live" to publish.', 'ok');
    } catch (err) {
      showLog('modelLog', err.message || String(err), 'err');
    } finally {
      setBusy(false, btn);
    }
  }

  async function saveAndPushModels() {
    if (isBusy) return;
    const btn = $('saveModelLiveBtn');
    setBusy(true, btn, 'Publishing...');
    try {
      const modelId = $('mModelId').value.trim();
      const scale = $('mScale').value.trim();
      const coverRaw = $('mCover').value.trim();
      const extraLines = $('mExtraUrls').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);

      if (modelId || coverRaw) {
        const normCover = normalizeSingleUrlItem(coverRaw);
        const additionals = extraLines.map(function (l) {
          const n = normalizeSingleUrlItem(l);
          return n ? { type: n.type, url: n.url, thumb: n.thumb || '', title: n.name || '' } : { type: 'image', url: l, title: '' };
        });
        const mdlObj = {
          id: slugify(modelId || ('model-' + (liveModels.models.length + 1))),
          modelId: modelId || ('MDL-' + String(liveModels.models.length + 1).padStart(2, '0')),
          scale: scale,
          cover: (normCover && normCover.url) || coverRaw || (additionals[0] && additionals[0].url) || 'assets/card6.jpg',
          additionals: additionals
        };
        if (editingModelIdx >= 0) liveModels.models[editingModelIdx] = mdlObj;
        else liveModels.models.push(mdlObj);
        editingModelIdx = -1;
      }

      liveModels.updatedAt = new Date().toISOString();
      await ghWriteJson('data/models.json', liveModels, 'Toolbox: Update Model Making gallery');
      renderModelsList();
      showLog('modelLog', 'Published Model Making gallery live to GitHub Pages!', 'ok');
    } catch (err) {
      showLog('modelLog', err.message || String(err), 'err');
    } finally {
      setBusy(false, btn);
    }
  }

  async function loadExistingStudio() {
    const list = $('existingStudioList');
    list.innerHTML = '<div style="opacity:0.7;">Loading studio items...</div>';
    try {
      const res = await ghReadJson('data/studio.json');
      liveStudio = (res && res.data) ? res.data : { version: 2, items: [] };
      renderStudioList();
    } catch (err) {
      list.innerHTML = '<div style="color:var(--tb-red);">' + escapeHtml(err.message) + '</div>';
    }
  }

  function renderStudioList() {
    const list = $('existingStudioList');
    list.innerHTML = '';
    (liveStudio.items || []).forEach(function (it, idx) {
      const imgSrc = it.thumb || (it.type === 'image' ? it.url : '../assets/card5.jpg');
      const finalImg = /^https?:/.test(imgSrc) ? imgSrc : '../' + imgSrc;
      const card = document.createElement('div');
      card.className = 'tb-existing-card';
      card.innerHTML =
        '<img src="' + escapeHtml(finalImg) + '" alt="' + escapeHtml(it.title || 'Studio') + '" />' +
        '<div class="tb-existing-body">' +
          '<div style="font-weight:700;font-size:0.84rem;">' + escapeHtml(it.title || it.id) + '</div>' +
          '<button type="button" class="tb-btn tb-btn-danger tb-btn-sm" data-del-stu="' + idx + '">Remove</button>' +
        '</div>';
      list.appendChild(card);
    });

    list.querySelectorAll('[data-del-stu]').forEach(function (b) {
      b.addEventListener('click', function () {
        liveStudio.items.splice(parseInt(b.getAttribute('data-del-stu'), 10), 1);
        renderStudioList();
        showLog('studioLog', 'Item removed. Click "Push Studio Live to GitHub" to save.', '');
      });
    });
  }

  async function scanAndAddStudio() {
    if (isBusy) return;
    const btn = $('scanStudioBtn');
    setBusy(true, btn, 'Scanning...');
    showLog('studioLog', 'Scanning studio items...', '');
    try {
      const added = [];
      if ($('sDriveFolder').value.trim()) {
        const scan = await scanDriveFolder($('sDriveFolder').value.trim(), false);
        (scan.files || []).forEach(function (f) {
          if (f.type === 'image' || f.type === 'drive_video' || f.type === 'video') {
            added.push({ id: 'stu-' + Date.now() + '-' + added.length, type: f.type, url: f.url, thumb: f.thumb || '', title: f.name });
          }
        });
      }
      $('sExtraUrls').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (u) {
        const n = normalizeSingleUrlItem(u);
        if (n) added.push({ id: 'stu-' + Date.now() + '-' + added.length, type: n.type, url: n.url, thumb: n.thumb || '', title: n.name || 'Studio Work' });
      });
      if (!added.length) throw new Error('No photo or video URLs found.');
      liveStudio.items = liveStudio.items.concat(added);
      $('sDriveFolder').value = '';
      $('sExtraUrls').value = '';
      renderStudioList();
      showLog('studioLog', 'Added ' + added.length + ' items to Studio queue. Click "Push Studio Live to GitHub" to publish.', 'ok');
    } catch (err) {
      showLog('studioLog', err.message || String(err), 'err');
    } finally {
      setBusy(false, btn);
    }
  }

  async function pushStudioLive() {
    if (isBusy) return;
    const btn = $('pushStudioBtn');
    setBusy(true, btn, 'Publishing...');
    try {
      liveStudio.updatedAt = new Date().toISOString();
      await ghWriteJson('data/studio.json', liveStudio, 'Toolbox: Update Academic Studio gallery');
      showLog('studioLog', 'Published Studio Gallery live to GitHub Pages!', 'ok');
    } catch (err) {
      showLog('studioLog', err.message || String(err), 'err');
    } finally {
      setBusy(false, btn);
    }
  }

  /* ------------------------------------------------------------------------
     Settings & AI Connection Tester
     ------------------------------------------------------------------------ */
  function hydrateSettingsUI() {
    $('cfgOwner').value = config.owner || '';
    $('cfgRepo').value = config.repo || '';
    $('cfgBranch').value = config.branch || 'main';
    $('cfgToken').value = config.token || '';
    $('cfgDriveScanner').value = config.driveScanner || '';
    $('cfgAiMode').value = config.aiMode || 'smart';
    $('cfgAiKey').value = config.aiKey || '';
    updateAiStatusPill();
  }

  async function testAiConnection() {
    if (isBusy) return;
    saveConfig({ aiMode: $('cfgAiMode').value, aiKey: $('cfgAiKey').value.trim() });
    if (config.aiMode === 'smart') {
      showLog('settingsLog', 'Built-in Smart Classifier is active (100% free, zero API key needed).', 'ok');
      return;
    }
    const btn = $('testAiBtn');
    setBusy(true, btn, 'Testing AI...');
    showLog('settingsLog', 'Testing ' + config.aiMode + ' connection...', '');
    try {
      const res = await invokeConfiguredAi('Return STRICT JSON ONLY: {"status":"ok","note":"connected"}', []);
      showLog('settingsLog', 'AI Connected Successfully! Active model: ' + res.model, 'ok');
    } catch (err) {
      showLog('settingsLog', 'AI Connection Failed: ' + (err.message || String(err)), 'err');
    } finally {
      setBusy(false, btn);
    }
  }

  function init() {
    try {
      if ((localStorage.getItem('akash_portfolio_theme') || localStorage.getItem('theme')) === 'dark') {
        document.body.classList.add('dark-theme');
      }
    } catch (e) {}

    $('themeToggleBtn').addEventListener('click', function () {
      const dark = document.body.classList.toggle('dark-theme');
      try { localStorage.setItem('akash_portfolio_theme', dark ? 'dark' : 'light'); } catch (e) {}
    });

    document.querySelectorAll('.tb-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const target = tab.getAttribute('data-tab');
        document.querySelectorAll('.tb-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
        document.querySelectorAll('.tb-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'panel-' + target); });
        if (target === 'models') loadExistingModels();
        if (target === 'studio') loadExistingStudio();
      });
    });

    document.querySelectorAll('#projModeToggle button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        projectMode = btn.getAttribute('data-projmode');
        document.querySelectorAll('#projModeToggle button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        $('existingProjectsBox').style.display = projectMode === 'edit' ? 'block' : 'none';
        $('projectIngestBox').style.display = (projectMode === 'add' || editSubMode === 'ai') ? 'block' : 'none';
        if (projectMode === 'edit') loadExistingProjectsList();
      });
    });

    document.querySelectorAll('#editSubModeToggle button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        editSubMode = btn.getAttribute('data-editmode');
        document.querySelectorAll('#editSubModeToggle button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        $('projectIngestBox').style.display = editSubMode === 'ai' ? 'block' : 'none';
      });
    });

    $('pLocalSamples').addEventListener('change', function (e) { handleLocalSamplePicker(e.target.files); });
    $('runAiSortBtn').addEventListener('click', runAiScanAndSort);
    $('autoGenAllBtn').addEventListener('click', function () { autoGenerateFormDetails('all', $('autoGenAllBtn')); });
    document.querySelectorAll('[data-autogen-field]').forEach(function (btn) {
      btn.addEventListener('click', function () { autoGenerateFormDetails(btn.getAttribute('data-autogen-field'), btn); });
    });
    document.querySelectorAll('[data-autogen-model]').forEach(function (btn) {
      btn.addEventListener('click', function () { autoGenerateModelField(btn.getAttribute('data-autogen-model')); });
    });

    $('applyQaBtn').addEventListener('click', applyQaAnswers);
    $('clearProjectFormBtn').addEventListener('click', function () {
      currentProject = createEmptyProject();
      driveScanCache = { url: '', folderName: '', files: [], sampleThumbs: [] };
      localVisualParts = [];
      $('pLocalSamples').value = '';
      $('pLocalSamplesInfo').textContent = '';
      ['pTitle', 'pLabelSlug', 'pProjectId', 'pDriveFolder', 'pYoutubeLinks', 'pFbLinks', 'pExtraText', 'dDate', 'dScale', 'dTools', 'dKeywords', 'dDescription'].forEach(function (id) { $(id).value = ''; });
      $('aiQaBox').style.display = 'none';
      renderFourPartsEditor();
    });
    $('refreshProjectsBtn').addEventListener('click', loadExistingProjectsList);
    $('pushProjectBtn').addEventListener('click', pushProjectLive);
    $('downloadProjectJsonBtn').addEventListener('click', function () {
      const proj = finalizeProjectObject();
      downloadJsonFile(proj.id + '.json', proj);
    });

    $('refreshModelsBtn').addEventListener('click', loadExistingModels);
    $('scanModelBtn').addEventListener('click', scanModelFolder);
    $('saveModelLiveBtn').addEventListener('click', saveAndPushModels);
    $('resetModelFormBtn').addEventListener('click', function () {
      editingModelIdx = -1;
      ['mModelId', 'mScale', 'mCover', 'mDriveFolder', 'mExtraUrls'].forEach(function (id) { $(id).value = ''; });
    });

    $('refreshStudioBtn').addEventListener('click', loadExistingStudio);
    $('scanStudioBtn').addEventListener('click', scanAndAddStudio);
    $('pushStudioBtn').addEventListener('click', pushStudioLive);

    hydrateSettingsUI();
    $('saveSettingsBtn').addEventListener('click', async function () {
      saveConfig({
        owner: $('cfgOwner').value.trim(),
        repo: $('cfgRepo').value.trim(),
        branch: $('cfgBranch').value.trim() || 'main',
        token: $('cfgToken').value.trim(),
        driveScanner: $('cfgDriveScanner').value.trim(),
        aiMode: $('cfgAiMode').value,
        aiKey: $('cfgAiKey').value.trim()
      });
      const ok = await testGitHubConnection();
      showLog('settingsLog', ok ? 'Saved locally & verified GitHub repository access!' : 'Saved locally, but GitHub verification failed — check username, repo name, and token permissions.', ok ? 'ok' : 'err');
    });
    $('testAiBtn').addEventListener('click', testAiConnection);

    $('exportSettingsBtn').addEventListener('click', function () {
      const code = utf8ToBase64(JSON.stringify(config));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () {
          showLog('settingsLog', 'Sync code copied! Open this Toolbox on your mobile/PC -> Settings -> Import Sync Code.', 'ok');
        });
      } else {
        prompt('Copy this Sync Code:', code);
      }
    });

    $('importSettingsBtn').addEventListener('click', async function () {
      const raw = prompt('Paste your Toolbox Sync Code here:');
      if (!raw) return;
      try {
        const parsed = JSON.parse(base64ToUtf8(raw.trim()));
        saveConfig(parsed);
        hydrateSettingsUI();
        await testGitHubConnection();
        showLog('settingsLog', 'Imported settings & connected!', 'ok');
      } catch (e) {
        showLog('settingsLog', 'Invalid sync code.', 'err');
      }
    });

    $('clearSettingsBtn').addEventListener('click', function () {
      localStorage.removeItem(STORAGE_KEY);
      config = loadConfig();
      hydrateSettingsUI();
      testGitHubConnection();
      showLog('settingsLog', 'All local keys wiped from this browser.', 'ok');
    });

    renderFourPartsEditor();
    testGitHubConnection();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
