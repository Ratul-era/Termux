/* ==========================================================================
   toolbox.js - Portfolio AI Control Panel & Live GitHub Pages Publisher
   - Zero API keys stored in repository (all keys stay in browser localStorage)
   - Live GitHub Contents API read/write (never deletes previous projects)
   - Free Google Apps Script Drive Folder Scanner (100+ files & subfolders)
   - Free AI: Google Gemini Free Tier / Local Ollama / Built-in Smart Classifier
   - Interactive Missing-Field & Ambiguous-File Q&A
   - Full CRUD for 3Dvis/AW (4 parts), Models, and Academic Studio
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'akash_toolbox_config_v2';
  const PART_KEYS = ['3Dvis_ext', '3Dvis_int', 'AW_ext', 'AW_int'];
  const PART_META = {
    '3Dvis_ext': { title: '3D Visualization — Exterior', tag: 'Exterior', isAW: false },
    '3Dvis_int': { title: '3D Visualization — Interior', tag: 'Interior', isAW: false },
    'AW_ext':    { title: 'Animation Walkthrough — Exterior', tag: 'Exterior', isAW: true },
    'AW_int':    { title: 'Animation Walkthrough — Interior', tag: 'Interior', isAW: true }
  };

  let config = loadConfig();
  let projectMode = 'add'; // 'add' | 'edit'
  let editSubMode = 'manual'; // 'manual' | 'ai'
  let currentProject = createEmptyProject();
  let pendingQuestions = [];
  let pendingAmbiguousFiles = [];

  let liveCatalog = { version: 2, updatedAt: '', projects: [] };
  let liveModels = { version: 2, updatedAt: '', models: [] };
  let liveStudio = { version: 2, updatedAt: '', items: [] };
  let editingModelIdx = -1;
  let currentModelAdditionals = [];

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
    // Fallback to local/live site relative fetch (read-only preview)
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
     Drive Folder Scanner & YouTube/URL Parsing
     ------------------------------------------------------------------------ */
  async function scanDriveFolder(folderUrl) {
    if (!folderUrl || !folderUrl.trim()) return { files: [], folderName: '' };
    if (!config.driveScanner) {
      throw new Error('Drive Scanner Web App URL is not set. Deploy workers/drive-folder-scanner.gs (2 min, 100% free) and paste its URL in Connect & AI Setup.');
    }
    const endpoint = config.driveScanner.trim() + (config.driveScanner.includes('?') ? '&' : '?') +
      'folder=' + encodeURIComponent(folderUrl.trim());
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Drive Scanner HTTP ' + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Drive Scanner failed');
    return json;
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
    const line = rawLine.trim();
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
    if (/\.(blend|skp|ls|ls\d+|dwg|rvt|max|fbx|obj)(\?|$)/i.test(cleanUrl)) {
      return { type: 'file3d', url: cleanUrl, ext: cleanUrl.split('.').pop().toUpperCase(), name: cleanUrl.split('/').pop(), folderPath: '' };
    }
    return { type: 'image', url: cleanUrl, thumb: cleanUrl, name: cleanUrl.split('/').pop() || 'Image', folderPath: '' };
  }

  /* ------------------------------------------------------------------------
     AI Classification & Detail Extraction (Smart / Gemini Free / Local Ollama)
     ------------------------------------------------------------------------ */
  function smartHeuristicClassify(items, contextText) {
    const extRegex = /\b(ext|exterior|facade|elevation|front|outdoor|site|aerial|rooftop|landscape|street|garden|pool|driveway|balcony)\b/i;
    const intRegex = /\b(int|interior|living|bedroom|bed|kitchen|dining|bath|toilet|foyer|lounge|office|study|lobby|ceiling|furniture|room|hall|stair)\b/i;
    const bothRegex = /\b(both|full\s*tour|complete\s*walkthrough|ext\s*[\+&]\s*int|int\s*[\+&]\s*ext|interior\s*and\s*exterior|exterior\s*and\s*interior)\b/i;

    const assigned = { '3Dvis_ext': [], '3Dvis_int': [], 'AW_ext': [], 'AW_int': [] };
    const ambiguous = [];

    items.forEach(function (it, idx) {
      const hay = ((it.folderPath || '') + ' ' + (it.name || '') + ' ' + (it.title || '')).toLowerCase();
      const isVid = it.type === 'video' || it.type === 'youtube' || it.type === 'facebook' || it.type === 'drive_video';
      const hasExt = extRegex.test(hay);
      const hasInt = intRegex.test(hay);
      const isBoth = it.bothHint || bothRegex.test(hay) || (hasExt && hasInt);

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

    // Extract details strictly from provided text/filenames (blank if not found)
    const corpus = contextText + '\n' + items.map(function (x) { return (x.folderPath || '') + ' ' + (x.name || ''); }).join('\n');
    const knownTools = ['AutoCAD', 'SketchUp', 'Lumion', 'Adobe Photoshop', 'Photoshop', 'Blender', 'V-Ray', 'Enscape', '3ds Max', 'Revit', 'D5 Render', 'Camtasia', 'Premiere Pro'];
    const tools = [];
    knownTools.forEach(function (t) {
      const norm = t === 'Photoshop' ? 'Adobe Photoshop' : t;
      if (new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(corpus) && tools.indexOf(norm) === -1) {
        tools.push(norm);
      }
    });
    if (/\.skp\b/i.test(corpus) && tools.indexOf('SketchUp') === -1) tools.push('SketchUp');
    if (/\.ls\d*\b/i.test(corpus) && tools.indexOf('Lumion') === -1) tools.push('Lumion');
    if (/\.blend\b/i.test(corpus) && tools.indexOf('Blender') === -1) tools.push('Blender');
    if (/\.dwg\b/i.test(corpus) && tools.indexOf('AutoCAD') === -1) tools.push('AutoCAD');

    const dateMatch = corpus.match(/\b(202[0-9]|201[5-9])\b/);
    const scaleMatch = corpus.match(/\b(\d[\d,\.]*\s*(?:sq\.?\s*ft|sft|katha|bigha|acre|sqm|m2)|g\+\d+|1\s*:\s*\d{2,4})\b/i);

    const kwPool = ['Duplex', 'Residential', 'Commercial', 'RAJUK', 'Jalshiri', 'Cantonment', 'Modern', 'Minimalist', 'Twilight', 'Daylight', 'Villa', 'Apartment', 'Penthouse', 'Resort', 'Landscape', 'Interior', 'Exterior', '4K 60fps'];
    const keywords = kwPool.filter(function (kw) {
      return new RegExp('\\b' + kw + '\\b', 'i').test(corpus);
    });

    return {
      assigned: assigned,
      ambiguous: ambiguous,
      details: {
        date: dateMatch ? dateMatch[1] : '',
        scale: scaleMatch ? scaleMatch[0] : '',
        tools: tools,
        keywords: keywords
      }
    };
  }

  async function callExternalAi(items, contextText) {
    const prompt = [
      'You are an architectural portfolio organizer. Analyze these files and notes for one architecture project.',
      'Classify each item index into ONE of: "3Dvis_ext", "3Dvis_int", "AW_ext", "AW_int", "AW_both" (if a walkthrough video covers BOTH exterior & interior), or "unsure".',
      'Also extract ONLY verified details from the text (leave empty string "" or [] if NOT explicitly found — never invent): date, scale, tools (array), keywords (array).',
      'Return STRICT JSON ONLY with keys: {"classifications":{"0":"3Dvis_ext",...},"details":{"date":"","scale":"","tools":[],"keywords":[]}}',
      'CONTEXT NOTES:\n' + contextText.slice(0, 3500),
      'FILES:\n' + items.map(function (it, i) { return i + ': [' + it.type + '] ' + (it.folderPath ? it.folderPath + '/' : '') + (it.name || it.url); }).join('\n')
    ].join('\n\n');

    if (config.aiMode === 'gemini' && config.aiKey) {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(config.aiKey.trim()), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      if (!res.ok) throw new Error('Gemini API error ' + res.status);
      const data = await res.json();
      const txt = data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
      return JSON.parse(txt);
    }

    if (config.aiMode === 'ollama') {
      const model = (config.aiKey || 'llama3.2').trim();
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model, prompt: prompt, format: 'json', stream: false })
      });
      if (!res.ok) throw new Error('Ollama local error ' + res.status);
      const data = await res.json();
      return JSON.parse(data.response);
    }

    return null;
  }


  async function imageUrlToInlinePart(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.type || !blob.type.startsWith('image/')) return null;
      return await new Promise(function (resolve) {
        const reader = new FileReader();
        reader.onloadend = function () {
          const dataUrl = String(reader.result || '');
          const b64 = dataUrl.split(',')[1];
          resolve(b64 ? { inlineData: { mimeType: blob.type, data: b64 } } : null);
        };
        reader.onerror = function () { resolve(null); };
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  }

  function buildSmartFallbackDescription(proj, extraNotes) {
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
      if (p.cover && p.cover.url) {
        if (PART_META[k].isAW) vidCount++; else imgCount++;
      }
      (p.additionals || []).forEach(function (a) {
        if (a.type === 'video' || a.type === 'youtube' || a.type === 'facebook' || a.type === 'drive_video') vidCount++;
        else if (a.type === 'image') imgCount++;
      });
    });

    const scopeStr = partNames.length ? (' featuring ' + partNames.join(', ')) : '';
    const scaleStr = scale ? (' (' + scale + ')') : '';
    const s1 = title + scaleStr + ' is an architectural showcase' + scopeStr + '.';
    const mediaBits = [];
    if (imgCount) mediaBits.push(imgCount + ' visual render' + (imgCount > 1 ? 's' : ''));
    if (vidCount) mediaBits.push(vidCount + ' walkthrough video' + (vidCount > 1 ? 's' : ''));
    const toolStr = tools.length ? (' produced with ' + tools.join(', ')) : '';
    const kwStr = kws.length ? (' highlighting ' + kws.slice(0, 4).join(', ').toLowerCase()) : '';
    const s2 = (mediaBits.length || toolStr || kwStr)
      ? ('The presentation includes ' + (mediaBits.length ? mediaBits.join(' and ') : 'curated architectural media') + toolStr + kwStr + '.')
      : '';
    return [s1, s2].filter(Boolean).join(' ');
  }


  function collectAllProjectSourceItems() {
    const items = [];
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
    // Also include any pasted links not yet sorted
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

  async function autoGenerateFormDetails(targetField, silent) {
    const modeLabel = targetField === 'all' ? 'all project details' : targetField;
    if (!silent) showLog('aiSortLog', 'Analyzing source images, videos & contents to auto-generate ' + modeLabel + '...', '');

    const items = collectAllProjectSourceItems();
    const extraText = [
      $('pTitle').value.trim(),
      $('pLabelSlug').value.trim(),
      $('pDriveFolder').value.trim(),
      $('pExtraText').value.trim()
    ].filter(Boolean).join('\n');

    // Enrich with YouTube titles if any YouTube links are present
    const ytTitles = [];
    for (let i = 0; i < items.length && ytTitles.length < 4; i++) {
      if (items[i].type === 'youtube' && items[i].url) {
        const t = await fetchYouTubeTitle(items[i].url);
        if (t) ytTitles.push(t);
      }
    }
    const fullContext = [extraText, ytTitles.join('\n')].filter(Boolean).join('\n');

    // Compute smart heuristic baseline first
    const smart = smartHeuristicClassify(items, fullContext);
    let generated = {
      title: $('pTitle').value.trim() || ytTitles[0] || currentProject.title || '',
      date: smart.details.date || '',
      scale: smart.details.scale || '',
      tools: smart.details.tools || [],
      keywords: smart.details.keywords || [],
      description: buildSmartFallbackDescription(currentProject, fullContext)
    };

    // Upgrade via Multimodal Gemini Free Tier or Local Ollama when configured
    const imgUrls = [];
    items.forEach(function (it) {
      const src = it.thumb || (it.type === 'image' ? it.url : '');
      if (src && /^https?:|^assets\//i.test(src) && imgUrls.length < 4 && imgUrls.indexOf(src) === -1) {
        imgUrls.push(src);
      }
    });

    const promptText = [
      'You are an expert architectural portfolio assistant. Analyze the attached source images/thumbnails, videos, filenames, and notes.',
      'Return STRICT JSON ONLY with keys: {"title":"","date":"","scale":"","tools":[],"keywords":[],"description":""}',
      'Rules:',
      '- Leave date or scale as "" if not explicitly found in the images/videos/notes (do not invent numbers).',
      '- Infer architectural keywords and a crisp 2-3 sentence description from the visual content of the images/videos and filenames.',
      '- Infer software tools from file extensions (.skp, .ls12, .blend, .dwg) or notes.',
      'NOTES & CONTEXT:\n' + fullContext.slice(0, 2000),
      'ALL SOURCE CONTENTS (' + items.length + ' items):\n' + items.slice(0, 40).map(function (it) {
        return '[' + (it.part || 'src') + ':' + it.type + '] ' + (it.name || it.url);
      }).join('\n')
    ].join('\n\n');

    try {
      if (config.aiMode === 'gemini' && config.aiKey) {
        const parts = [{ text: promptText }];
        for (let i = 0; i < imgUrls.length; i++) {
          const inlinePart = await imageUrlToInlinePart(imgUrls[i]);
          if (inlinePart) parts.push(inlinePart);
        }
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(config.aiKey.trim()), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: parts }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });
        if (res.ok) {
          const data = await res.json();
          const txt = data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
          const parsed = JSON.parse(txt);
          generated = {
            title: parsed.title || generated.title,
            date: parsed.date || generated.date,
            scale: parsed.scale || generated.scale,
            tools: (Array.isArray(parsed.tools) && parsed.tools.length) ? parsed.tools : generated.tools,
            keywords: (Array.isArray(parsed.keywords) && parsed.keywords.length) ? parsed.keywords : generated.keywords,
            description: parsed.description || generated.description
          };
        }
      } else if (config.aiMode === 'ollama') {
        const model = (config.aiKey || 'llama3.2').trim();
        const res = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model, prompt: promptText, format: 'json', stream: false })
        });
        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(data.response);
          generated = {
            title: parsed.title || generated.title,
            date: parsed.date || generated.date,
            scale: parsed.scale || generated.scale,
            tools: (Array.isArray(parsed.tools) && parsed.tools.length) ? parsed.tools : generated.tools,
            keywords: (Array.isArray(parsed.keywords) && parsed.keywords.length) ? parsed.keywords : generated.keywords,
            description: parsed.description || generated.description
          };
        }
      }
    } catch (err) {
      console.warn('Unified AI generator fallback:', err);
    }

    // Apply to requested field or ALL fields
    const applyAll = targetField === 'all';
    if ((applyAll || targetField === 'title') && generated.title) $('pTitle').value = generated.title;
    if ((applyAll || targetField === 'date') && generated.date) $('dDate').value = generated.date;
    if ((applyAll || targetField === 'scale') && generated.scale) $('dScale').value = generated.scale;
    if ((applyAll || targetField === 'tools') && generated.tools.length) $('dTools').value = generated.tools.join(', ');
    if ((applyAll || targetField === 'keywords') && generated.keywords.length) $('dKeywords').value = generated.keywords.join(', ');
    if ((applyAll || targetField === 'description') && generated.description) $('dDescription').value = generated.description;

    if (!silent) {
      showLog('aiSortLog', 'Auto-generated ' + modeLabel + ' from ' + items.length + ' source items. You can edit any box before pushing live.', 'ok');
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
        showLog('modelLog', 'No scale ratio (e.g. 1:200) found in links yet — scan a Drive folder or type it manually.', '');
      }
    }
  }

  async function autoGenerateProjectDescription(silent) {
    if (!silent) showLog('aiSortLog', 'Generating project description from source images & videos...', '');
    const proj = currentProject;
    const title = $('pTitle').value.trim() || proj.title || '';
    const extraText = $('pExtraText').value.trim();

    // Collect media summary & up to 4 image URLs for multimodal inspection
    const imgUrls = [];
    const mediaSummary = [];
    PART_KEYS.forEach(function (k) {
      const p = proj.parts[k];
      if (!p || !p.enabled) return;
      if (p.cover && p.cover.url) {
        mediaSummary.push('[' + k + ' cover: ' + p.cover.type + '] ' + (p.title || p.cover.url));
        if (p.cover.type === 'image' && imgUrls.length < 4) imgUrls.push(p.cover.url);
        else if (p.cover.thumbnail && imgUrls.length < 4) imgUrls.push(p.cover.thumbnail);
      }
      (p.additionals || []).slice(0, 12).forEach(function (a) {
        mediaSummary.push('[' + k + ': ' + a.type + '] ' + (a.title || a.url));
        if (a.type === 'image' && imgUrls.length < 4) imgUrls.push(a.url);
      });
    });

    const promptText = [
      'Write a concise, natural 2-to-3 sentence architectural portfolio description for this project.',
      'Base it strictly on the attached source images/thumbnails, video titles, filenames, and notes below. Do not invent locations, client names, or measurements not present.',
      'Project Title: ' + title,
      'Scale: ' + ($('dScale').value.trim() || 'Not specified'),
      'Tools: ' + ($('dTools').value.trim() || 'Not specified'),
      'Keywords: ' + ($('dKeywords').value.trim() || 'Not specified'),
      'Notes: ' + extraText.slice(0, 1200),
      'Source Media:
' + mediaSummary.slice(0, 30).join('
'),
      'Return ONLY the plain-text description paragraph with no markdown, bullets, or quotes.'
    ].join('
');

    try {
      if (config.aiMode === 'gemini' && config.aiKey) {
        const parts = [{ text: promptText }];
        for (let i = 0; i < imgUrls.length; i++) {
          const inlinePart = await imageUrlToInlinePart(imgUrls[i]);
          if (inlinePart) parts.push(inlinePart);
        }
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(config.aiKey.trim()), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: parts }] })
        });
        if (res.ok) {
          const data = await res.json();
          const out = data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
          if (out && out.trim()) {
            $('dDescription').value = out.trim();
            if (!silent) showLog('aiSortLog', 'Auto-generated description from your source images & videos via Gemini.', 'ok');
            return;
          }
        }
      } else if (config.aiMode === 'ollama') {
        const model = (config.aiKey || 'llama3.2').trim();
        const res = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model, prompt: promptText, stream: false })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.response && data.response.trim()) {
            $('dDescription').value = data.response.trim();
            if (!silent) showLog('aiSortLog', 'Auto-generated description via Local Ollama AI.', 'ok');
            return;
          }
        }
      }
    } catch (e) {
      console.warn('AI description fallback:', e);
    }

    $('dDescription').value = buildSmartFallbackDescription(proj, extraText);
    if (!silent) showLog('aiSortLog', 'Auto-generated description from your source images, videos & project details.', 'ok');
  }

  /* ------------------------------------------------------------------------
     Project Workflow: Scan, Sort, Q&A, Manual/AI Edit, Push Live
     ------------------------------------------------------------------------ */
  async function runAiScanAndSort() {
    showLog('aiSortLog', 'Scanning sources and running AI classifier...', '');
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
      let contextNotes = [title, labelSlug, extraText].join('\n');

      // 1. Scan Drive folder if provided
      if (driveUrl) {
        const scan = await scanDriveFolder(driveUrl);
        if (scan.folderName) contextNotes += '\nFolder: ' + scan.folderName;
        (scan.files || []).forEach(function (f) { allItems.push(f); });
      }

      // 2. Parse YouTube links + fetch titles via free oEmbed
      for (let i = 0; i < ytLines.length; i++) {
        const item = normalizeSingleUrlItem(ytLines[i]);
        if (item) {
          const ytTitle = await fetchYouTubeTitle(item.url);
          if (ytTitle) {
            item.name = ytTitle;
            contextNotes += '\nYouTube: ' + ytTitle;
          }
          allItems.push(item);
        }
      }

      // 3. Parse Facebook links
      fbLines.forEach(function (l) {
        const item = normalizeSingleUrlItem(l);
        if (item) allItems.push(item);
      });

      // 4. Parse any raw URLs inside extraText
      extraText.split('\n').forEach(function (l) {
        if (/^https?:\/\//i.test(l.trim())) {
          const item = normalizeSingleUrlItem(l);
          if (item) allItems.push(item);
        }
      });

      // 5. Classify (External AI if configured, with smart fallback)
      let result = smartHeuristicClassify(allItems, contextNotes);
      if (config.aiMode === 'gemini' || config.aiMode === 'ollama') {
        try {
          const aiJson = await callExternalAi(allItems, contextNotes);
          if (aiJson && aiJson.classifications) {
            const assigned = { '3Dvis_ext': [], '3Dvis_int': [], 'AW_ext': [], 'AW_int': [] };
            const ambiguous = [];
            allItems.forEach(function (it, idx) {
              const cls = aiJson.classifications[String(idx)] || 'unsure';
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
            if (aiJson.details) {
              result.details = {
                date: aiJson.details.date || result.details.date || '',
                scale: aiJson.details.scale || result.details.scale || '',
                tools: (aiJson.details.tools && aiJson.details.tools.length) ? aiJson.details.tools : result.details.tools,
                keywords: (aiJson.details.keywords && aiJson.details.keywords.length) ? aiJson.details.keywords : result.details.keywords
              };
            }
          }
        } catch (aiErr) {
          console.warn('External AI fallback to Smart Classifier:', aiErr);
        }
      }

      // 6. Populate or Merge into currentProject
      if (projectMode === 'add') {
        currentProject = createEmptyProject();
        currentProject.id = slugify(labelSlug || title);
        currentProject.projectId = projectId;
        currentProject.title = title || labelSlug;
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

      // Fill shared details inputs (never overwrite existing details in Edit-AI mode if already filled)
      if (!$('dDate').value && result.details.date) $('dDate').value = result.details.date;
      if (!$('dScale').value && result.details.scale) $('dScale').value = result.details.scale;
      if (!$('dTools').value && result.details.tools.length) $('dTools').value = result.details.tools.join(', ');
      if (!$('dKeywords').value && result.details.keywords.length) $('dKeywords').value = result.details.keywords.join(', ');
      if (!$('dDescription').value.trim()) await autoGenerateProjectDescription(true);

      // Build Missing-Field & Ambiguous-File Q&A
      pendingQuestions = [];
      if (!$('dDate').value) pendingQuestions.push({ field: 'dDate', label: 'Project Date (Year/Month) was not found — enter or leave blank:' });
      if (!$('dScale').value) pendingQuestions.push({ field: 'dScale', label: 'Project Scale (e.g. 5 Katha • G+8) was not found — enter or leave blank:' });
      if (!$('dTools').value) pendingQuestions.push({ field: 'dTools', label: 'Tools Used (e.g. SketchUp, Lumion) were not found — enter or leave blank:' });
      if (!$('dKeywords').value) pendingQuestions.push({ field: 'dKeywords', label: 'Keywords (comma-separated) were not found — enter or leave blank:' });
      pendingAmbiguousFiles = result.ambiguous || [];

      renderQaBox();
      renderFourPartsEditor();
      showLog('aiSortLog', 'Sorted ' + allItems.length + ' items across 4 parts. ' +
        (pendingQuestions.length + pendingAmbiguousFiles.length > 0 ? 'Please review AI clarification questions below.' : 'All fields ready to push!'), 'ok');
    } catch (err) {
      showLog('aiSortLog', err.message || String(err), 'err');
    }
  }

  function renderQaBox() {
    const box = $('aiQaBox');
    const list = $('aiQaList');
    if (!pendingQuestions.length && !pendingAmbiguousFiles.length) {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'block';
    let html = '';

    pendingQuestions.forEach(function (q, i) {
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

    // Bind live state updates
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
    const proj = finalizeProjectObject();
    showLog('pushProjectLog', 'Pushing ' + proj.id + ' live to GitHub Pages (preserving all existing projects)...', '');
    try {
      // 1. Always fetch latest catalog.json first so existing projects are NEVER deleted!
      const catRes = await ghReadJson('data/catalog.json');
      const catalog = (catRes && catRes.data) ? catRes.data : { version: 2, updatedAt: '', projects: [] };
      const entry = buildCatalogEntry(proj);
      const existingIdx = catalog.projects.findIndex(function (x) { return x.id === proj.id; });
      if (existingIdx >= 0) catalog.projects[existingIdx] = entry;
      else catalog.projects.push(entry);
      catalog.updatedAt = new Date().toISOString();

      // 2. Write per-project chunk & updated catalog
      await ghWriteJson('data/projects/' + proj.id + '.json', proj, 'Toolbox: Save project ' + proj.id);
      await ghWriteJson('data/catalog.json', catalog, 'Toolbox: Update catalog for ' + proj.id);

      liveCatalog = catalog;
      showLog('pushProjectLog', 'Published "' + proj.title + '" live to GitHub Pages! Your site updates automatically in ~30–60 seconds.', 'ok');
    } catch (err) {
      showLog('pushProjectLog', err.message || String(err), 'err');
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
     Model Making Tab Workflow
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
        currentModelAdditionals = (m.additionals || []).slice();
        $('mExtraUrls').value = currentModelAdditionals.map(function (x) { return x.url; }).join('\n');
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
    showLog('modelLog', 'Scanning model folder...', '');
    try {
      const scan = await scanDriveFolder($('mDriveFolder').value.trim());
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
      currentModelAdditionals = files.map(function (f) { return { type: f.type, url: f.url, thumb: f.thumb || '', title: f.name }; });
      $('mExtraUrls').value = currentModelAdditionals.map(function (x) { return x.url; }).join('\n');
      showLog('modelLog', 'Loaded ' + files.length + ' model photos/videos. Click "Save & Push Models Live" to publish.', 'ok');
    } catch (err) {
      showLog('modelLog', err.message || String(err), 'err');
    }
  }

  async function saveAndPushModels() {
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
    }
  }

  /* ------------------------------------------------------------------------
     Academic Studio Tab Workflow
     ------------------------------------------------------------------------ */
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
    showLog('studioLog', 'Scanning studio items...', '');
    try {
      const added = [];
      if ($('sDriveFolder').value.trim()) {
        const scan = await scanDriveFolder($('sDriveFolder').value.trim());
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
    }
  }

  async function pushStudioLive() {
    try {
      liveStudio.updatedAt = new Date().toISOString();
      await ghWriteJson('data/studio.json', liveStudio, 'Toolbox: Update Academic Studio gallery');
      showLog('studioLog', 'Published Studio Gallery live to GitHub Pages!', 'ok');
    } catch (err) {
      showLog('studioLog', err.message || String(err), 'err');
    }
  }

  /* ------------------------------------------------------------------------
     Initialization & Event Bindings
     ------------------------------------------------------------------------ */
  function hydrateSettingsUI() {
    $('cfgOwner').value = config.owner || '';
    $('cfgRepo').value = config.repo || '';
    $('cfgBranch').value = config.branch || 'main';
    $('cfgToken').value = config.token || '';
    $('cfgDriveScanner').value = config.driveScanner || '';
    $('cfgAiMode').value = config.aiMode || 'smart';
    $('cfgAiKey').value = config.aiKey || '';
  }

  function init() {
    // Theme sync with main portfolio
    try {
      if ((localStorage.getItem('akash_portfolio_theme') || localStorage.getItem('theme')) === 'dark') {
        document.body.classList.add('dark-theme');
      }
    } catch (e) {}

    $('themeToggleBtn').addEventListener('click', function () {
      const dark = document.body.classList.toggle('dark-theme');
      try { localStorage.setItem('akash_portfolio_theme', dark ? 'dark' : 'light'); } catch (e) {}
    });

    // Main Tabs
    document.querySelectorAll('.tb-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const target = tab.getAttribute('data-tab');
        document.querySelectorAll('.tb-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
        document.querySelectorAll('.tb-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'panel-' + target); });
        if (target === 'models') loadExistingModels();
        if (target === 'studio') loadExistingStudio();
      });
    });

    // Project Add vs Edit Mode
    document.querySelectorAll('#projModeToggle button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        projectMode = btn.getAttribute('data-projmode');
        document.querySelectorAll('#projModeToggle button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        $('existingProjectsBox').style.display = projectMode === 'edit' ? 'block' : 'none';
        $('projectIngestBox').style.display = (projectMode === 'add' || editSubMode === 'ai') ? 'block' : 'none';
        if (projectMode === 'edit') loadExistingProjectsList();
      });
    });

    // Edit Manual vs AI Mode
    document.querySelectorAll('#editSubModeToggle button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        editSubMode = btn.getAttribute('data-editmode');
        document.querySelectorAll('#editSubModeToggle button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        $('projectIngestBox').style.display = editSubMode === 'ai' ? 'block' : 'none';
      });
    });

    // Buttons
    $('runAiSortBtn').addEventListener('click', runAiScanAndSort);
    const allBtn = $('autoGenAllBtn');
    if (allBtn) {
      allBtn.addEventListener('click', function () { autoGenerateFormDetails('all', false); });
    }
    document.querySelectorAll('[data-autogen-field]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        autoGenerateFormDetails(btn.getAttribute('data-autogen-field'), false);
      });
    });
    document.querySelectorAll('[data-autogen-model]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        autoGenerateModelField(btn.getAttribute('data-autogen-model'));
      });
    });
    $('applyQaBtn').addEventListener('click', applyQaAnswers);
    $('clearProjectFormBtn').addEventListener('click', function () {
      currentProject = createEmptyProject();
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

    // Models & Studio Buttons
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

    // Settings Buttons
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
