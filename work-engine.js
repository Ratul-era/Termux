/* ==========================================================================
   work-engine.js - Modular Work Showcase, Lazy-Loading, Modals & Protection
   Powers:
   - 3D Visualization (Exterior / Interior / All Renders)
   - Animation Walkthrough (Exterior / Interior / All Walkthroughs)
   - Model Making Gallery & 3-per-row Modal
   - Academic Studio Gallery
   - Zero-URL-Mutation Near-Fullscreen Floating Modals
   - 6-Item Batch Lazy Loading from External Cloud Sources
   - Browser-Level Content Protection (Anti-Download / Anti-Capture Deterrents)
   ========================================================================== */

(function () {
  'use strict';

  const BATCH_SIZE = 6;
  const PART_LABELS = {
    '3Dvis_ext': 'See its exterior 3D designs',
    '3Dvis_int': 'See its interior 3D designs',
    'AW_ext': 'See its exterior animation walkthrough',
    'AW_int': 'See its interior animation walkthrough'
  };

  const PART_ORDER_FOR = {
    '3Dvis_ext': ['3Dvis_int', 'AW_ext', 'AW_int'],
    '3Dvis_int': ['3Dvis_ext', 'AW_int', 'AW_ext'],
    'AW_ext': ['AW_int', '3Dvis_ext', '3Dvis_int'],
    'AW_int': ['AW_ext', '3Dvis_int', '3Dvis_ext']
  };

  const cache = {
    catalog: null,
    models: null,
    studio: null,
    projects: {}
  };

  let baseHref = './';
  let activeObserver = null;
  let currentLightboxList = [];
  let currentLightboxIdx = 0;

  function resolveUrl(relPath) {
    if (!relPath) return '';
    if (/^(https?:|data:|blob:|\/\/)/i.test(relPath)) return relPath;
    try {
      return new URL(relPath, baseHref).href;
    } catch (e) {
      return relPath;
    }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ------------------------------------------------------------------------
     External Media URL Normalizer (Google Drive, YouTube, Facebook, Direct)
     ------------------------------------------------------------------------ */
  function extractDriveId(url) {
    if (!url) return null;
    const m1 = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
    if (m1) return m1[1];
    const m2 = url.match(/drive\.google\.com\/(?:open|uc|thumbnail)\?[^#]*\bid=([a-zA-Z0-9_-]+)/i);
    if (m2) return m2[1];
    const m3 = url.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i);
    if (m3) return m3[1];
    return null;
  }

  function extractYouTubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    return m ? m[1] : null;
  }

  function isFacebookVideo(url) {
    return /facebook\.com|fb\.watch/i.test(url || '');
  }

  function getImageSrc(url, width) {
    if (!url) return resolveUrl('assets/card1.jpg');
    const ytId = extractYouTubeId(url);
    if (ytId) return 'https://i.ytimg.com/vi/' + ytId + '/hqdefault.jpg';
    const driveId = extractDriveId(url);
    if (driveId) return 'https://lh3.googleusercontent.com/d/' + driveId + '=w' + (width || 1400);
    return resolveUrl(url);
  }

  function detectMediaType(item) {
    if (!item) return 'image';
    if (item.type) return item.type;
    const url = (item.url || '').toLowerCase();
    if (extractYouTubeId(url)) return 'youtube';
    if (isFacebookVideo(url)) return 'facebook';
    if (/\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url)) return 'video';
    if (/\.(blend|skp|ls|ls\d+|dwg|dxf|rvt|max|fbx|obj|3dm|c4d|zip|rar)(\?|$)/i.test(url)) return 'file3d';
    return 'image';
  }

  function buildVideoEmbedHtml(item, opts) {
    const o = opts || {};
    const type = detectMediaType(item);
    const url = item.url || '';
    const autoplay = o.autoplay !== false;

    if (type === 'youtube' || extractYouTubeId(url)) {
      const ytId = extractYouTubeId(url);
      if (ytId) {
        const params = autoplay
          ? 'autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=' + ytId
          : 'autoplay=0&mute=1&playsinline=1&rel=0&modestbranding=1';
        return '<iframe src="https://www.youtube.com/embed/' + ytId + '?' + params + '" ' +
          'allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy" ' +
          'title="' + escapeHtml(item.title || 'Walkthrough Video') + '"></iframe>';
      }
    }

    if (type === 'facebook' || isFacebookVideo(url)) {
      const enc = encodeURIComponent(url);
      return '<iframe src="https://www.facebook.com/plugins/video.php?href=' + enc +
        '&show_text=false&autoplay=' + (autoplay ? '1' : '0') + '&mute=1" ' +
        'allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen loading="lazy" ' +
        'title="' + escapeHtml(item.title || 'Facebook Video') + '"></iframe>';
    }

    const driveId = extractDriveId(url);
    if (driveId && (type === 'video' || type === 'drive_video')) {
      return '<iframe src="https://drive.google.com/file/d/' + driveId + '/preview" ' +
        'allow="autoplay; encrypted-media" allowfullscreen loading="lazy" ' +
        'title="' + escapeHtml(item.title || 'Drive Video') + '"></iframe>';
    }

    if (type === 'video') {
      const posterAttr = item.thumb || item.thumbnail ? ' poster="' + escapeHtml(getImageSrc(item.thumb || item.thumbnail, 900)) + '"' : '';
      return '<video src="' + escapeHtml(resolveUrl(url)) + '"' + posterAttr +
        (autoplay ? ' autoplay muted loop playsinline' : ' muted playsinline') +
        ' controls controlsList="nodownload noremoteplayback noplaybackrate" disablePictureInPicture oncontextmenu="return false;"></video>';
    }

    // Fallback to image if no video URL present
    return '<div class="media-protect" style="width:100%;height:100%;">' +
      '<img src="' + escapeHtml(getImageSrc(item.thumbnail || item.thumb || url, 1600)) + '" alt="' + escapeHtml(item.title || '') + '" draggable="false" />' +
      '<div class="media-shield"></div>' +
    '</div>';
  }

  /* ------------------------------------------------------------------------
     Data Loaders (Cached JSON Fetch)
     ------------------------------------------------------------------------ */
  async function fetchJson(relPath) {
    const res = await fetch(resolveUrl(relPath) + '?v=' + Math.floor(Date.now() / 60000));
    if (!res.ok) throw new Error('Failed to load ' + relPath);
    return res.json();
  }

  async function loadCatalog() {
    if (cache.catalog) return cache.catalog;
    cache.catalog = await fetchJson('data/catalog.json');
    return cache.catalog;
  }

  async function loadProjectDetail(projectId) {
    if (cache.projects[projectId]) return cache.projects[projectId];
    const data = await fetchJson('data/projects/' + encodeURIComponent(projectId) + '.json');
    cache.projects[projectId] = data;
    return data;
  }

  async function loadModels() {
    if (cache.models) return cache.models;
    cache.models = await fetchJson('data/models.json');
    return cache.models;
  }

  async function loadStudio() {
    if (cache.studio) return cache.studio;
    cache.studio = await fetchJson('data/studio.json');
    return cache.studio;
  }

  /* ------------------------------------------------------------------------
     Modal & Lightbox DOM Scaffolding
     ------------------------------------------------------------------------ */
  function ensureModalsExist() {
    if (!document.getElementById('workShowcaseModal')) {
      const modal = document.createElement('div');
      modal.id = 'workShowcaseModal';
      modal.className = 'wsm-backdrop';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML =
        '<div class="wsm-shell" role="dialog" aria-modal="true">' +
          '<button type="button" class="wsm-close-btn" id="wsmCloseBtn" aria-label="Close showcase">&times;</button>' +
          '<div id="wsmContent" style="height:100%;display:flex;flex-direction:column;overflow:hidden;"></div>' +
        '</div>';
      document.body.appendChild(modal);

      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeShowcaseModal();
      });
      document.getElementById('wsmCloseBtn').addEventListener('click', closeShowcaseModal);
    }

    if (!document.getElementById('wsLightbox')) {
      const lb = document.createElement('div');
      lb.id = 'wsLightbox';
      lb.className = 'ws-lightbox';
      lb.setAttribute('aria-hidden', 'true');
      lb.innerHTML =
        '<button type="button" class="wsm-close-btn" id="wsLbClose" aria-label="Close preview" style="position:fixed;top:18px;right:18px;z-index:2920;">&times;</button>' +
        '<button type="button" class="ws-lightbox-nav ws-lightbox-prev" id="wsLbPrev" aria-label="Previous">&#8249;</button>' +
        '<div class="ws-lightbox-inner">' +
          '<div class="ws-lightbox-media media-protect" id="wsLbMedia"></div>' +
          '<div class="ws-lightbox-cap" id="wsLbCap"></div>' +
        '</div>' +
        '<button type="button" class="ws-lightbox-nav ws-lightbox-next" id="wsLbNext" aria-label="Next">&#8250;</button>';
      document.body.appendChild(lb);

      lb.addEventListener('click', function (e) {
        if (e.target === lb) closeLightbox();
      });
      document.getElementById('wsLbClose').addEventListener('click', closeLightbox);
      document.getElementById('wsLbPrev').addEventListener('click', function () { stepLightbox(-1); });
      document.getElementById('wsLbNext').addEventListener('click', function () { stepLightbox(1); });
    }

    if (!document.getElementById('privacyToast')) {
      const toast = document.createElement('div');
      toast.id = 'privacyToast';
      toast.className = 'privacy-toast';
      toast.textContent = 'Protected Portfolio Content — © Ataur Rahman Akash';
      document.body.appendChild(toast);
    }
  }

  function closeShowcaseModal() {
    const modal = document.getElementById('workShowcaseModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    const content = document.getElementById('wsmContent');
    if (content) content.innerHTML = ''; // stops videos immediately
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }
    document.body.style.overflow = '';
  }

  function openLightbox(items, startIndex) {
    ensureModalsExist();
    currentLightboxList = items || [];
    currentLightboxIdx = Math.max(0, Math.min(startIndex || 0, currentLightboxList.length - 1));
    renderLightboxItem();
    const lb = document.getElementById('wsLightbox');
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
  }

  function closeLightbox() {
    const lb = document.getElementById('wsLightbox');
    if (!lb) return;
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    const media = document.getElementById('wsLbMedia');
    if (media) media.innerHTML = '';
  }

  function stepLightbox(delta) {
    if (!currentLightboxList.length) return;
    currentLightboxIdx = (currentLightboxIdx + delta + currentLightboxList.length) % currentLightboxList.length;
    renderLightboxItem();
  }

  function renderLightboxItem() {
    const item = currentLightboxList[currentLightboxIdx];
    const mediaEl = document.getElementById('wsLbMedia');
    const capEl = document.getElementById('wsLbCap');
    const prevBtn = document.getElementById('wsLbPrev');
    const nextBtn = document.getElementById('wsLbNext');
    if (!item || !mediaEl) return;

    const showNav = currentLightboxList.length > 1;
    if (prevBtn) prevBtn.style.display = showNav ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = showNav ? 'flex' : 'none';

    const type = detectMediaType(item);
    if (type === 'video' || type === 'youtube' || type === 'facebook' || type === 'drive_video') {
      mediaEl.innerHTML = buildVideoEmbedHtml(item, { autoplay: true });
    } else if (type === 'file3d') {
      const driveId = extractDriveId(item.url || '');
      const ext = item.ext || ((item.title || item.url || '').split('.').pop() || '3D').toUpperCase();
      if (driveId) {
        mediaEl.innerHTML =
          '<iframe src="https://drive.google.com/file/d/' + driveId + '/preview" allow="autoplay" allowfullscreen title="' + escapeHtml(item.title || '3D Render File') + '"></iframe>';
      } else {
        mediaEl.innerHTML =
          '<div class="ws-lb-file3d-wide">' +
            '<span class="wsm-file3d-ext" style="font-size:0.9rem;padding:6px 14px;">' + escapeHtml(ext) + '</span>' +
            '<i class="fa-solid fa-cubes" style="font-size:3.6rem;color:#ff8a3d;"></i>' +
            '<h3 style="font-size:1.35rem;font-weight:800;color:#fff;">' + escapeHtml(item.title || '3D Render / Model File') + '</h3>' +
            '<p style="max-width:480px;font-size:0.9rem;color:#cbd5e1;line-height:1.55;">Protected 3D source asset (' + escapeHtml(ext) + '). Connect a Google Drive preview link via the Toolbox to inspect interactively, or use the Inquiry button to request project deliverables.</p>' +
          '</div>';
      }
    } else {
      mediaEl.innerHTML =
        '<img src="' + escapeHtml(getImageSrc(item.url, 2200)) + '" alt="' + escapeHtml(item.title || '') + '" draggable="false" />' +
        '<div class="media-shield"></div>';
    }
    if (capEl) {
      const idxText = currentLightboxList.length > 1 ? ' (' + (currentLightboxIdx + 1) + ' / ' + currentLightboxList.length + ')' : '';
      capEl.textContent = (item.title || 'Portfolio Media') + idxText;
    }
  }

  /* ------------------------------------------------------------------------
     Subpage Grid Renderers (3Dvis, AW, Models, Studio)
     ------------------------------------------------------------------------ */
  async function render3DOrAW(grid, pageKey, filterKey) {
    grid.className = 'ws-grid';
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 16px;opacity:0.75;font-weight:600;">Loading portfolio gallery...</div>';

    try {
      const catalog = await loadCatalog();
      const projects = catalog.projects || [];
      const cards = [];

      const wantedParts = pageKey === '3Dvis'
        ? (filterKey === 'exterior' ? ['3Dvis_ext'] : filterKey === 'interior' ? ['3Dvis_int'] : ['3Dvis_ext', '3Dvis_int'])
        : (filterKey === 'exterior' ? ['AW_ext'] : filterKey === 'interior' ? ['AW_int'] : ['AW_ext', 'AW_int']);

      projects.forEach(function (proj) {
        wantedParts.forEach(function (partKey) {
          const part = proj.parts && proj.parts[partKey];
          if (part && part.enabled) {
            cards.push({
              projectId: proj.id,
              partKey: partKey,
              label: part.label || ((partKey.endsWith('_ext') ? 'Exterior' : 'Interior') + ' • ' + proj.id),
              title: part.title || proj.title || proj.id,
              cover: part.cover || 'assets/card1.jpg',
              isVideo: pageKey === 'AW'
            });
          }
        });
      });

      grid.innerHTML = '';
      if (!cards.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:56px 20px;opacity:0.75;font-weight:600;">No projects added in this category yet. Use the Toolbox to publish your first project.</div>';
        return;
      }

      cards.forEach(function (c, idx) {
        const card = document.createElement('article');
        card.className = 'ws-card media-protect';
        card.style.setProperty('--proj-delay', (Math.min(idx, 12) * 0.05) + 's');
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', c.label + ' — ' + c.title);

        card.innerHTML =
          '<img class="ws-card-img" src="' + escapeHtml(getImageSrc(c.cover, 800)) + '" alt="' + escapeHtml(c.title) + '" loading="lazy" decoding="async" draggable="false" />' +
          '<div class="media-shield"></div>' +
          '<div class="ws-card-scrim"></div>' +
          '<span class="ws-card-label">' + escapeHtml(c.label) + '</span>' +
          (c.isVideo ? '<div class="ws-play-badge" aria-hidden="true"><i class="fa-solid fa-play" style="margin-left:3px;"></i></div>' : '') +
          '<h3 class="ws-card-title">' + escapeHtml(c.title) + '</h3>';

        const openHandler = function () {
          openProjectShowcaseModal(c.projectId, c.partKey);
        };
        card.addEventListener('click', openHandler);
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openHandler();
          }
        });
        grid.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:#e11d48;font-weight:700;">Could not load project catalog. Make sure the site is served via GitHub Pages or a local web server.</div>';
    }
  }

  async function renderModelsPage(grid) {
    grid.className = 'ws-model-gallery';
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 16px;opacity:0.75;font-weight:600;">Loading architectural models...</div>';

    try {
      const data = await loadModels();
      const models = data.models || [];
      grid.innerHTML = '';

      if (!models.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:56px 20px;opacity:0.75;font-weight:600;">No physical models added yet. Use the Toolbox to add models.</div>';
        return;
      }

      models.forEach(function (mdl, idx) {
        const card = document.createElement('article');
        card.className = 'ws-model-card media-protect';
        card.style.setProperty('--proj-delay', (Math.min(idx, 12) * 0.05) + 's');
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        const labelText = [mdl.scale, mdl.modelId].filter(Boolean).join(' • ') || mdl.id;
        card.setAttribute('aria-label', labelText);

        card.innerHTML =
          '<img class="ws-card-img" src="' + escapeHtml(getImageSrc(mdl.cover, 850)) + '" alt="' + escapeHtml(labelText) + '" loading="lazy" decoding="async" draggable="false" />' +
          '<div class="media-shield"></div>' +
          '<span class="ws-model-label">' + escapeHtml(labelText) + '</span>';

        const openHandler = function () {
          openModelShowcaseModal(mdl);
        };
        card.addEventListener('click', openHandler);
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openHandler();
          }
        });
        grid.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:#e11d48;font-weight:700;">Could not load models data.</div>';
    }
  }

  async function renderStudioPage(grid) {
    grid.className = 'ws-studio-gallery';
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 16px;opacity:0.75;font-weight:600;">Loading academic studio gallery...</div>';

    try {
      const data = await loadStudio();
      const items = data.items || [];
      grid.innerHTML = '';

      if (!items.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:56px 20px;opacity:0.75;font-weight:600;">No studio works added yet. Upload pictures or videos via the Toolbox.</div>';
        return;
      }

      let rendered = 0;
      const loadMoreWrap = document.createElement('div');
      loadMoreWrap.className = 'wsm-load-more-wrap';
      loadMoreWrap.style.gridColumn = '1 / -1';

      function appendStudioBatch() {
        const slice = items.slice(rendered, rendered + BATCH_SIZE);
        slice.forEach(function (item, localIdx) {
          const globalIdx = rendered + localIdx;
          const card = document.createElement('article');
          card.className = 'ws-studio-item media-protect';
          const type = detectMediaType(item);

          if (type === 'video') {
            card.innerHTML =
              '<video src="' + escapeHtml(resolveUrl(item.url)) + '" autoplay muted loop playsinline controlsList="nodownload noremoteplayback" disablePictureInPicture></video>' +
              '<div class="media-shield"></div>';
          } else if (type === 'youtube' || type === 'facebook' || type === 'drive_video') {
            card.innerHTML =
              '<img src="' + escapeHtml(getImageSrc(item.thumb || item.url, 800)) + '" alt="' + escapeHtml(item.title || 'Studio Work') + '" loading="lazy" draggable="false" />' +
              '<div class="media-shield"></div>' +
              '<div class="ws-play-badge"><i class="fa-solid fa-play" style="margin-left:3px;"></i></div>';
          } else {
            card.innerHTML =
              '<img src="' + escapeHtml(getImageSrc(item.url, 850)) + '" alt="' + escapeHtml(item.title || 'Studio Work') + '" loading="lazy" decoding="async" draggable="false" />' +
              '<div class="media-shield"></div>';
          }

          card.addEventListener('click', function () {
            openLightbox(items, globalIdx);
          });
          grid.insertBefore(card, loadMoreWrap);
        });
        rendered += slice.length;

        if (rendered >= items.length) {
          loadMoreWrap.remove();
        } else {
          loadMoreWrap.innerHTML = '<button type="button" class="wsm-load-more-btn">Load More (' + (items.length - rendered) + ' remaining)</button>';
          loadMoreWrap.querySelector('button').addEventListener('click', appendStudioBatch);
        }
      }

      grid.appendChild(loadMoreWrap);
      appendStudioBatch();
    } catch (err) {
      console.error(err);
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:#e11d48;font-weight:700;">Could not load studio gallery.</div>';
    }
  }

  /* ------------------------------------------------------------------------
     Near-Fullscreen Project Showcase Modal (3Dvis & AW)
     Zero URL Mutation + 2-Col Scrollable Left + Fixed Right + 6-Batch Lazy Load
     ------------------------------------------------------------------------ */
  async function openProjectShowcaseModal(projectId, partKey) {
    ensureModalsExist();
    const modal = document.getElementById('workShowcaseModal');
    const content = document.getElementById('wsmContent');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    content.innerHTML = '<div style="margin:auto;padding:40px;font-weight:700;opacity:0.75;">Loading project details...</div>';

    try {
      const project = await loadProjectDetail(projectId);
      renderProjectPartInModal(project, partKey);
    } catch (err) {
      console.error(err);
      content.innerHTML = '<div style="margin:auto;padding:40px;color:#e11d48;font-weight:700;">Could not load details for ' + escapeHtml(projectId) + '.</div>';
    }
  }

  function renderProjectPartInModal(project, partKey) {
    const content = document.getElementById('wsmContent');
    if (!content || !project || !project.parts) return;

    const part = project.parts[partKey];
    if (!part || !part.enabled) return;

    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }

    const isAW = partKey.indexOf('AW_') === 0;
    const tagText = part.tag || (partKey.endsWith('_ext') ? 'Exterior' : 'Interior');
    const details = part.details || {};
    const projectCode = details.projectId || project.projectId || project.id;
    const additionals = Array.isArray(part.additionals) ? part.additionals : [];
    const totalContents = additionals.length + (part.cover && part.cover.url ? 1 : 0);
    const titleText = part.title || project.title || project.id;
    const inquiryRef = projectCode + ' — ' + titleText + ' (' + (part.label || tagText) + ')';

    // Build cover media HTML
    let coverHtml = '';
    if (isAW) {
      coverHtml = '<div class="wsm-cover-video-box">' + buildVideoEmbedHtml(part.cover || {}, { autoplay: true }) +
        '<button type="button" class="ws-expand-btn" id="wsmCoverVideoExpand" title="Open video widely" aria-label="Open video widely"><i class="fa-solid fa-expand"></i> Wide View</button></div>';
    } else {
      const coverUrl = (part.cover && part.cover.url) || 'assets/card1.jpg';
      coverHtml =
        '<div class="media-protect" id="wsmCoverClick" style="cursor:pointer;">' +
          '<img src="' + escapeHtml(getImageSrc(coverUrl, 1600)) + '" alt="' + escapeHtml(titleText) + '" draggable="false" />' +
          '<div class="media-shield"></div>' +
        '</div>';
    }

    // Build right-column details
    const kwChips = (details.keywords || []).filter(Boolean).map(function (k) {
      return '<span class="wsm-chip">' + escapeHtml(k) + '</span>';
    }).join('');

    const toolChips = (details.tools || []).filter(Boolean).map(function (t) {
      return '<span class="wsm-chip">' + escapeHtml(t) + '</span>';
    }).join('');

    // Build dynamic anchored cross-links for other available parts of the same project
    const otherKeys = (PART_ORDER_FOR[partKey] || []).filter(function (k) {
      return project.parts[k] && project.parts[k].enabled;
    });

    const crossLinksHtml = otherKeys.length
      ? '<div class="wsm-cross-links">' +
          '<div class="wsm-cross-title">Explore Other Parts of This Project</div>' +
          otherKeys.map(function (k) {
            return '<button type="button" class="wsm-cross-btn" data-switch-part="' + k + '">' +
              '<span>' + escapeHtml(PART_LABELS[k]) + '</span>' +
              '<span>&rarr;</span>' +
            '</button>';
          }).join('') +
        '</div>'
      : '';

    content.innerHTML =
      '<div class="wsm-split">' +
        '<!-- 2-COLUMN WIDE SCROLLABLE LEFT SIDE -->' +
        '<div class="wsm-left" id="wsmLeftScroll">' +
          '<div class="wsm-left-header">' +
            '<div>' +
              '<div class="wsm-badges-row">' +
                '<span class="wsm-tag-pill">' + escapeHtml(tagText) + '</span>' +
                '<span class="wsm-count-pill">ID: ' + escapeHtml(projectCode) + '</span>' +
                '<span class="wsm-count-pill">' + totalContents + ' Contents</span>' +
              '</div>' +
              '<h2 class="wsm-title">' + escapeHtml(titleText) + '</h2>' +
            '</div>' +
            '<button type="button" class="wsm-inquiry-btn" id="wsmInquiryBtn">' +
              '<i class="fa-solid fa-paper-plane"></i>' +
              '<span>Inquiry</span>' +
            '</button>' +
          '</div>' +

          '<div class="wsm-cover-wrap">' + coverHtml + '</div>' +

          '<div class="wsm-additionals">' +
            '<div class="wsm-add-header">' +
              '<h3 class="wsm-add-title">Additionals</h3>' +
              '<span class="wsm-count-pill" id="wsmAddCounter">Showing 0 of ' + additionals.length + '</span>' +
            '</div>' +
            '<div class="wsm-add-grid" id="wsmAddGrid"></div>' +
            '<div class="wsm-load-more-wrap" id="wsmLoadMoreWrap"></div>' +
          '</div>' +
        '</div>' +

        '<!-- 1-COLUMN FIXED RIGHT SIDE: PROJECT DETAILS + ANCHORED CROSS-LINKS -->' +
        '<aside class="wsm-right">' +
          '<div>' +
            '<h3 class="wsm-details-heading">' + escapeHtml((project.id || 'Project').replace(/^p/, 'P')) + ' Details</h3>' +
            '<div class="wsm-detail-list">' +
              (details.description ? '<div class="wsm-detail-row"><div class="wsm-detail-label">Description</div><div class="wsm-detail-val" style="font-weight:500;opacity:0.9;">' + escapeHtml(details.description) + '</div></div>' : '') +
              '<div class="wsm-detail-row"><div class="wsm-detail-label">Project ID</div><div class="wsm-detail-val">' + escapeHtml(projectCode || '—') + '</div></div>' +
              '<div class="wsm-detail-row"><div class="wsm-detail-label">Date</div><div class="wsm-detail-val">' + escapeHtml(details.date || '—') + '</div></div>' +
              '<div class="wsm-detail-row"><div class="wsm-detail-label">Project Scale</div><div class="wsm-detail-val">' + escapeHtml(details.scale || '—') + '</div></div>' +
              '<div class="wsm-detail-row"><div class="wsm-detail-label">Tools Used</div><div class="wsm-chips">' + (toolChips || '<span class="wsm-detail-val">—</span>') + '</div></div>' +
              '<div class="wsm-detail-row" style="border-bottom:none;"><div class="wsm-detail-label">Keywords</div><div class="wsm-chips">' + (kwChips || '<span class="wsm-detail-val">—</span>') + '</div></div>' +
            '</div>' +
          '</div>' +
          crossLinksHtml +
        '</aside>' +
      '</div>';

    // Bind Inquiry button -> opens exact same Contact / Reach Me! modal
    const inqBtn = document.getElementById('wsmInquiryBtn');
    if (inqBtn) {
      inqBtn.addEventListener('click', function () {
        if (typeof window.openContactModal === 'function') {
          window.openContactModal({ updateAddress: false, inquiryRef: inquiryRef });
        }
      });
    }

    // Bind cover click for lightbox (images only)
    const coverClick = document.getElementById('wsmCoverClick');
    if (coverClick && part.cover && part.cover.url) {
      coverClick.addEventListener('click', function () {
        const coverItem = { type: 'image', url: part.cover.url, title: titleText + ' (Cover)' };
        openLightbox([coverItem].concat(additionals), 0);
      });
    }
    const coverVidExpand = document.getElementById('wsmCoverVideoExpand');
    if (coverVidExpand && part.cover) {
      coverVidExpand.addEventListener('click', function (e) {
        e.stopPropagation();
        const coverVid = Object.assign({}, part.cover, { title: titleText + ' (Cover Video)' });
        openLightbox([coverVid].concat(additionals), 0);
      });
    }

    // Bind anchored cross-links to switch parts smoothly without touching URL
    content.querySelectorAll('[data-switch-part]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const nextPart = btn.getAttribute('data-switch-part');
        renderProjectPartInModal(project, nextPart);
      });
    });

    // Setup 6-item batch lazy loading for Additionals
    setupBatchedAdditionals(
      additionals,
      document.getElementById('wsmAddGrid'),
      document.getElementById('wsmLoadMoreWrap'),
      document.getElementById('wsmAddCounter'),
      document.getElementById('wsmLeftScroll')
    );
  }

  /* ------------------------------------------------------------------------
     Near-Fullscreen Model Making Modal (Cover + 3-per-row Additionals)
     ------------------------------------------------------------------------ */
  function openModelShowcaseModal(mdl) {
    ensureModalsExist();
    const modal = document.getElementById('workShowcaseModal');
    const content = document.getElementById('wsmContent');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }

    const additionals = Array.isArray(mdl.additionals) ? mdl.additionals : [];
    const labelText = [mdl.scale, mdl.modelId].filter(Boolean).join(' • ') || mdl.id;
    const inquiryRef = 'Physical Model ' + (mdl.modelId || mdl.id) + (mdl.scale ? ' (' + mdl.scale + ')' : '');

    content.innerHTML =
      '<div class="wsm-model-body" id="wsmModelScroll">' +
        '<div class="wsm-left-header" style="padding-right:42px;">' +
          '<div>' +
            '<div class="wsm-badges-row">' +
              (mdl.scale ? '<span class="wsm-tag-pill">' + escapeHtml(mdl.scale) + '</span>' : '') +
              '<span class="wsm-count-pill">Model ID: ' + escapeHtml(mdl.modelId || mdl.id) + '</span>' +
              '<span class="wsm-count-pill">' + (additionals.length + 1) + ' Contents</span>' +
            '</div>' +
            '<h2 class="wsm-title">' + escapeHtml(labelText) + '</h2>' +
          '</div>' +
          '<button type="button" class="wsm-inquiry-btn" id="wsmModelInquiryBtn">' +
            '<i class="fa-solid fa-paper-plane"></i>' +
            '<span>Inquiry</span>' +
          '</button>' +
        '</div>' +

        '<div class="wsm-cover-wrap">' +
          '<div class="media-protect" id="wsmModelCoverClick" style="cursor:pointer;">' +
            '<img src="' + escapeHtml(getImageSrc(mdl.cover, 1600)) + '" alt="' + escapeHtml(labelText) + '" draggable="false" />' +
            '<div class="media-shield"></div>' +
          '</div>' +
        '</div>' +

        '<div class="wsm-additionals">' +
          '<div class="wsm-add-header">' +
            '<h3 class="wsm-add-title">Model Gallery</h3>' +
            '<span class="wsm-count-pill" id="wsmModelCounter">Showing 0 of ' + additionals.length + '</span>' +
          '</div>' +
          '<div class="wsm-add-grid model-grid-3" id="wsmModelGrid"></div>' +
          '<div class="wsm-load-more-wrap" id="wsmModelLoadWrap"></div>' +
        '</div>' +
      '</div>';

    document.getElementById('wsmModelInquiryBtn').addEventListener('click', function () {
      if (typeof window.openContactModal === 'function') {
        window.openContactModal({ updateAddress: false, inquiryRef: inquiryRef });
      }
    });

    document.getElementById('wsmModelCoverClick').addEventListener('click', function () {
      openLightbox([{ type: 'image', url: mdl.cover, title: labelText + ' (Cover)' }], 0);
    });

    setupBatchedAdditionals(
      additionals,
      document.getElementById('wsmModelGrid'),
      document.getElementById('wsmModelLoadWrap'),
      document.getElementById('wsmModelCounter'),
      document.getElementById('wsmModelScroll')
    );
  }

  /* ------------------------------------------------------------------------
     Shared 6-Item Batch Lazy Loader (IntersectionObserver + Button Fallback)
     ------------------------------------------------------------------------ */
  function setupBatchedAdditionals(items, gridEl, loadWrapEl, counterEl, scrollRoot) {
    if (!gridEl || !loadWrapEl) return;

    if (!items.length) {
      gridEl.innerHTML = '<div style="grid-column:1/-1;padding:24px;text-align:center;opacity:0.65;font-size:0.9rem;">No additional contents added yet.</div>';
      if (counterEl) counterEl.textContent = '0 items';
      return;
    }

    let rendered = 0;

    function loadNextBatch() {
      const slice = items.slice(rendered, rendered + BATCH_SIZE);
      if (!slice.length) return;

      slice.forEach(function (item, localIdx) {
        const itemIdx = rendered + localIdx;
        const type = detectMediaType(item);
        const card = document.createElement('div');
        card.className = 'wsm-add-item media-protect';

        if (type === 'file3d') {
          const ext = item.ext || ((item.title || item.url || '').split('.').pop() || '3D').toUpperCase();
          card.innerHTML =
            '<div class="wsm-file3d-card">' +
              '<span class="wsm-file3d-ext">' + escapeHtml(ext) + '</span>' +
              '<i class="fa-solid fa-cubes" style="font-size:1.8rem;opacity:0.75;"></i>' +
              '<div class="wsm-file3d-name">' + escapeHtml(item.title || '3D Source File') + '</div>' +
              '<span style="font-size:0.72rem;opacity:0.65;">Click to Open Wide Preview</span>' +
            '</div>';
        } else if (type === 'video' || type === 'youtube' || type === 'facebook' || type === 'drive_video') {
          card.innerHTML =
            buildVideoEmbedHtml(item, { autoplay: true }) +
            '<div class="media-shield" style="cursor:pointer;" title="Click to open video widely"></div>' +
            '<span class="ws-expand-pill" aria-hidden="true"><i class="fa-solid fa-expand"></i></span>' +
            (item.title ? '<div class="wsm-add-caption">' + escapeHtml(item.title) + '</div>' : '');
        } else {
          card.innerHTML =
            '<img src="' + escapeHtml(getImageSrc(item.url, 900)) + '" alt="' + escapeHtml(item.title || '') + '" loading="lazy" decoding="async" draggable="false" />' +
            '<div class="media-shield"></div>' +
            (item.title ? '<div class="wsm-add-caption">' + escapeHtml(item.title) + '</div>' : '');
        }

        card.addEventListener('click', function () {
          openLightbox(items, itemIdx);
        });

        gridEl.appendChild(card);
      });

      rendered += slice.length;
      if (counterEl) counterEl.textContent = 'Showing ' + rendered + ' of ' + items.length;

      if (rendered >= items.length) {
        loadWrapEl.innerHTML = '';
        if (activeObserver) {
          activeObserver.disconnect();
          activeObserver = null;
        }
      } else {
        loadWrapEl.innerHTML = '<button type="button" class="wsm-load-more-btn">Load Next ' + Math.min(BATCH_SIZE, items.length - rendered) + ' (' + (items.length - rendered) + ' more)</button>';
        loadWrapEl.querySelector('button').addEventListener('click', loadNextBatch);
      }
    }

    loadNextBatch();

    if ('IntersectionObserver' in window && items.length > BATCH_SIZE) {
      activeObserver = new IntersectionObserver(function (entries) {
        if (entries[0] && entries[0].isIntersecting) {
          loadNextBatch();
        }
      }, { root: scrollRoot || null, rootMargin: '180px' });
      activeObserver.observe(loadWrapEl);
    }
  }

  /* ------------------------------------------------------------------------
     Browser-Level Content Protection (Deterrents)
     ------------------------------------------------------------------------ */
  let protectionBound = false;
  let toastTimer = null;

  function showPrivacyToast(msg) {
    ensureModalsExist();
    const toast = document.getElementById('privacyToast');
    if (!toast) return;
    if (msg) toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  function triggerBriefPrivacyCurtain() {
    document.body.classList.add('privacy-blur-active');
    showPrivacyToast('Protected Portfolio Content — © Ataur Rahman Akash');
    setTimeout(function () {
      document.body.classList.remove('privacy-blur-active');
    }, 1500);
  }

  function initContentProtection() {
    if (protectionBound) return;
    protectionBound = true;

    // 1. Block right-click on media & showcase containers
    document.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.media-protect, #workShowcaseModal, #wsLightbox, .ws-card, .ws-model-card, .ws-studio-item') ||
          e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
        e.preventDefault();
        showPrivacyToast('Downloading or saving portfolio media is disabled.');
      }
    });

    // 2. Block dragging images/videos
    document.addEventListener('dragstart', function (e) {
      if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.closest('.media-protect')) {
        e.preventDefault();
      }
    });

    // 3. Block common Save / Print / View-Source / DevTools / PrintScreen keys
    document.addEventListener('keydown', function (e) {
      const key = (e.key || '').toLowerCase();
      if (key === 'escape') {
        const lb = document.getElementById('wsLightbox');
        if (lb && lb.classList.contains('open')) { closeLightbox(); return; }
        const sm = document.getElementById('workShowcaseModal');
        if (sm && sm.classList.contains('open')) { closeShowcaseModal(); return; }
      }
      if (key === 'printscreen') {
        e.preventDefault();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('Protected Portfolio — © Ataur Rahman Akash').catch(function () {});
        }
        triggerBriefPrivacyCurtain();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (key === 's' || key === 'p' || key === 'u')) {
        e.preventDefault();
        showPrivacyToast('Saving and printing are disabled on this portfolio.');
        return;
      }
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'i' || key === 'j' || key === 'c' || key === 's'))) {
        e.preventDefault();
        triggerBriefPrivacyCurtain();
      }
    });

    // 4. Blur protected showcase when user leaves tab/window
    document.addEventListener('visibilitychange', function () {
      const sm = document.getElementById('workShowcaseModal');
      const lb = document.getElementById('wsLightbox');
      const open = (sm && sm.classList.contains('open')) || (lb && lb.classList.contains('open'));
      if (document.hidden && open) {
        document.body.classList.add('privacy-blur-active');
      } else {
        document.body.classList.remove('privacy-blur-active');
      }
    });
  }

  /* ------------------------------------------------------------------------
     Public API consumed by script.js
     ------------------------------------------------------------------------ */
  window.WorkShowcaseEngine = {
    init: function (siteBaseUrl) {
      if (siteBaseUrl) baseHref = siteBaseUrl;
      ensureModalsExist();
      initContentProtection();
    },
    renderSubpage: function (pageKey, filterKey, gridEl) {
      if (!gridEl) return false;
      ensureModalsExist();
      initContentProtection();
      if (pageKey === '3Dvis' || pageKey === 'AW') {
        render3DOrAW(gridEl, pageKey, filterKey || 'all');
        return true;
      }
      if (pageKey === 'model') {
        renderModelsPage(gridEl);
        return true;
      }
      if (pageKey === 'studio') {
        renderStudioPage(gridEl);
        return true;
      }
      return false;
    },
    closeAll: function () {
      closeLightbox();
      closeShowcaseModal();
    }
  };
})();
