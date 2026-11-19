/* ==========================================================================
   script.js - Architect Ataur Rahman Akash Portfolio
   Loads nav.html and footer.html into the site shell, manages Light/Dark theme,
   Continuous Background Audio (audio.mp3 + WebAudio Synth Fallback),
   6-Card Interactive Selected Works Accordion, Subpage Routing,
   Synchronized Hero Entrance, Scroll-Reveal Animations, and Modals.
   ========================================================================== */

(function () {
  'use strict';

  // Software Tools & Logos
  const SOFTWARE_LOGOS = [
    { name: 'AutoCAD (2D & Working)', url: 'https://licono.com/wp-content/uploads/2026/06/alle-apps-autodesk-4_ff3520c5-01e0-46b1-8c82-dcb3e8aabd0d.jpg' },
    { name: 'SketchUp (3D Modeling)', url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR5eDMwgoearm4p1ETfbqMNJmr5tLSFi7BThh2P03-IS4uJ9FtBjJgdUsWV&s=10' },
    { name: 'Lumion (Rendering)', url: 'https://www.nicepng.com/png/detail/326-3268698_lumion-beautiful-renders-within-reach-south-africa-lumion.png' },
    { name: 'Adobe Photoshop', url: 'https://www.trustedreviews.com/wp-content/uploads/sites/7/2022/06/photoshop-logo.png' },
    { name: 'MS Office Suite', url: 'https://static.vecteezy.com/system/resources/previews/014/018/577/non_2x/ms-office-logo-on-transparent-background-free-vector.jpg' },
    { name: 'Camtasia Video Editing', url: 'https://w7.pngwing.com/pngs/770/895/png-transparent-camtasia-macos-bigsur-icon.png' },
    { name: 'AI Architectural Tools', url: 'https://png.pngtree.com/png-vector/20220606/ourmid/pngtree-adobe-illustrator-ai-icon-png-image_4899504.png' }
  ];

  // Direct card image map so subpages work even without duplicating #view-home in route stubs
  const CARD_IMAGES = [
    'assets/card1.jpg',
    'assets/card2.jpg',
    'assets/card4.jpg',
    'assets/card3.jpg',
    'assets/card5.jpg',
    'assets/card6.jpg'
  ];

  // Subpage Routing Data
  const SUBPAGES_DATA = {
    '3Dvis': {
      filename: '3Dvisualization',
      title: '3D Visualization',
      subtitle: 'Photorealistic Exterior & Interior 3D architectural renders created with SketchUp, Lumion & Adobe Photoshop.',
      filters: [
        { key: 'all', label: 'All Renders' },
        { key: 'exterior', label: 'Exterior >' },
        { key: 'interior', label: 'Interior >' }
      ],
      projects: [
        {
          category: 'exterior',
          tag: 'Exterior • RAJUK Residential',
          title: 'Hillside Duplex Residence',
          desc: 'Two-storey luxury family residence featuring warm timber soffits, floor-to-ceiling glazing, and twilight landscape lighting.',
          imageCardIdx: 0
        },
        {
          category: 'exterior',
          tag: 'Exterior • Jalshiri Abashon',
          title: 'Contemporary G+8 Apartment Complex',
          desc: 'Modern urban residential facade in Jalshiri with green terraces, brick screen louvers, and rooftop pavilion.',
          imageCardIdx: 3
        },
        {
          category: 'interior',
          tag: 'Interior • New DOHS Mohakhali',
          title: 'Minimalist Penthouse Living Lounge',
          desc: 'Bespoke interior design with travertine feature wall, recessed cove lighting, and custom walnut joinery.',
          imageCardIdx: 2
        },
        {
          category: 'interior',
          tag: 'Interior • Master Suite',
          title: 'Warm Contemporary Bedroom & Study',
          desc: 'Soft neutral palette with acoustic slatted paneling, warm pendant lighting, and ergonomic workspace.',
          imageCardIdx: 4
        }
      ]
    },
    'AW': {
      filename: 'Animation_Walkthrough',
      title: 'Animation Walkthrough',
      subtitle: 'Cinematic Exterior & Interior architectural walkthrough animations rendered in Lumion and edited in Camtasia.',
      filters: [
        { key: 'all', label: 'All Walkthroughs' },
        { key: 'exterior', label: 'Exterior >' },
        { key: 'interior', label: 'Interior >' }
      ],
      projects: [
        {
          category: 'exterior',
          tag: 'Exterior Walkthrough • 4K 60fps',
          title: 'Cantonment Luxury Villa Flythrough',
          desc: 'Complete daylight-to-twilight exterior camera path showcasing driveway arrival, infinity pool, and garden pergola.',
          imageCardIdx: 1
        },
        {
          category: 'interior',
          tag: 'Interior Walkthrough • Lumion',
          title: 'Duplex Foyer, Dining & Kitchen Tour',
          desc: 'Smooth steadicam interior walkthrough highlighting spatial flow, natural sunbeam dynamics, and material reflections.',
          imageCardIdx: 2
        }
      ]
    },
    'exp': {
      filename: 'experience',
      title: 'Professional Experiences',
      subtitle: '6+ Years of National (HORIZON - RAJUK, Cantonment, Jalshiri) and International (Fiverr & Upwork) architectural projects.',
      filters: [
        { key: 'all', label: 'All Experiences' },
        { key: 'national', label: 'National >' },
        { key: 'international', label: 'International >' }
      ],
      projects: [
        {
          category: 'national',
          tag: 'National • HORIZON (15 Sep 2020 – Present)',
          title: '23+ RAJUK, Cantonment & Jalshiri Projects',
          desc: 'An Enthusiast Architect (House # 229, Lane # 16, New DOHS, Mohakhali, Dhaka). Prepared AutoCAD working drawings, RAJUK approval sheets, and 3D models.',
          imageCardIdx: 3
        },
        {
          category: 'international',
          tag: 'International • Fiverr & Upwork',
          title: 'Global Residential & Commercial Visualization',
          desc: 'Delivered 2D floor plans, SketchUp 3D models, and Lumion walkthrough videos for clients across the USA, UK, UAE, and Australia.',
          imageCardIdx: 0
        }
      ]
    },
    'studio': {
      filename: 'studio',
      title: 'Architectural Studio',
      subtitle: 'Technical 2D AutoCAD working drawings, structural detailing, presentation plans, and B.Sc. Architecture studio works.',
      filters: [{ key: 'all', label: 'All Studio Works' }],
      projects: [
        {
          category: 'all',
          tag: 'AutoCAD Working Drawings',
          title: 'Detailed Floor Plans, Sections & Elevations',
          desc: 'Complete construction documentation packages with column grids, electrical/plumbing layouts, and municipal compliance.',
          imageCardIdx: 4
        },
        {
          category: 'all',
          tag: 'Sonargaon University • B.Sc. Studio',
          title: 'Cultural Complex & Urban Civic Center',
          desc: 'Academic thesis & studio design exploring climate-responsive Bangladeshi brick architecture and public courtyards.',
          imageCardIdx: 1
        }
      ]
    },
    'model': {
      filename: 'Models',
      title: 'Architectural Model Making',
      subtitle: 'Handcrafted physical architectural scale models, contour site topography, and illuminated presentation maquettes.',
      filters: [{ key: 'all', label: 'All Physical Models' }],
      projects: [
        {
          category: 'all',
          tag: 'Scale 1:100 • Balsa & Acrylic',
          title: 'High-Rise Residential Tower Maquette',
          desc: 'Precision laser-cut and hand-assembled architectural scale model with warm LED interior illumination and landscaping.',
          imageCardIdx: 5
        },
        {
          category: 'all',
          tag: 'Scale 1:200 • Topographic Site',
          title: 'Eco-Resort Masterplan Contour Model',
          desc: 'Layered cork and basswood site model illustrating natural terrain slopes, water bodies, and pavilion placement.',
          imageCardIdx: 1
        }
      ]
    }
  };

  const CARD_TO_PAGE = ['3Dvis', 'AW', 'exp', 'exp', 'studio', 'model'];
  const CARD_TO_FILTER = ['all', 'all', 'national', 'international', 'all', 'all'];

  const SCRIPT_NODE = document.currentScript || document.querySelector('script[src$="script.js"]');
  let SITE_BASE_URL;
  try {
    SITE_BASE_URL = (SCRIPT_NODE && SCRIPT_NODE.src)
      ? new URL('.', SCRIPT_NODE.src)
      : new URL('.', window.location.href);
  } catch (e) {
    SITE_BASE_URL = new URL('https://example.com/');
  }

  const ROUTE_SEGMENTS = {
    '3Dvis': '3Dvisualization',
    'AW': 'Animation_Walkthrough',
    'exp': 'experience',
    'model': 'Models',
    'studio': 'studio'
  };

  // Global Theme Toggle Function (callable immediately from nav.html onclick)
  window.toggleSiteTheme = function (event) {
    if (event && event.preventDefault) event.preventDefault();
    const isDark = document.body.classList.toggle('dark-theme');
    document.documentElement.classList.toggle('dark-theme-init', isDark);
    try {
      const val = isDark ? 'dark' : 'light';
      localStorage.setItem('akash_portfolio_theme', val);
      localStorage.setItem('theme', val);
    } catch (e) {}
  };

  // Synchronized Hero Entrance: Person's Image (from bottom-right, opacity 0->100%)
  // and "Ataur Rahman Akash" Header (from left, opacity 0->100%) at the exact same moment
  window.triggerHeroEntrance = function () {
    if (document.documentElement.classList.contains('preloading-active')) return;
    const portrait = document.getElementById('heroPortraitWrap') || document.querySelector('.hero-portrait-wrap');
    const title = document.getElementById('heroNameTitle') || document.querySelector('.hero-name-title');
    const heroItems = document.querySelectorAll('.reveal-hero-item');

    if (portrait) portrait.classList.remove('hero-enter-sync');
    if (title) title.classList.remove('hero-enter-sync');
    heroItems.forEach(function (el) { el.classList.remove('hero-enter-sync'); });

    // Force lightweight reflow so re-entering Home always replays both animations in lockstep
    if (portrait) void portrait.offsetWidth;
    if (title) void title.offsetWidth;

    if (portrait) portrait.classList.add('hero-enter-sync');
    if (title) title.classList.add('hero-enter-sync');
    heroItems.forEach(function (el, idx) {
      el.style.setProperty('--hero-item-delay', (0.12 + idx * 0.06) + 's');
      el.classList.add('hero-enter-sync');
    });
  };

  // Scroll-Reveal Observer for Cards & Sections
  let scrollObserver = null;
  function initScrollAnimations() {
    const targets = document.querySelectorAll('.reveal-on-scroll');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    if (!scrollObserver) {
      scrollObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });
    }

    targets.forEach(function (el) {
      scrollObserver.observe(el);
    });
  }

  function routeUrl(pageKey, filterKey) {
    const segment = ROUTE_SEGMENTS[pageKey];
    if (!segment) {
      // Main page root URL (www.example.com) with NO #home hash
      const homeUrl = new URL(SITE_BASE_URL.href);
      homeUrl.hash = '';
      return homeUrl;
    }
    const route = new URL(segment, SITE_BASE_URL);
    if (filterKey && filterKey !== 'all') {
      route.pathname = route.pathname.replace(/\/$/, '') + '/' + encodeURIComponent(filterKey);
    }
    return route;
  }

  function setBrowserUrl(url, replace) {
    const method = replace ? 'replaceState' : 'pushState';
    try {
      window.history[method]({ portfolioNavigation: true }, '', url.href || String(url));
    } catch (e) {}
  }

  function setCurrentPageHash(hash, replace) {
    try {
      const url = new URL(window.location.href);
      url.hash = hash ? '#' + hash : '';
      setBrowserUrl(url, replace);
    } catch (e) {}
  }

  function relativeRouteSegments() {
    let pathname = window.location.pathname;
    const rootPath = SITE_BASE_URL.pathname;
    if (pathname.indexOf(rootPath) === 0) pathname = pathname.slice(rootPath.length);
    return pathname.split('/').filter(Boolean).map(function (part) {
      try { return decodeURIComponent(part); } catch (e) { return part; }
    }).filter(function (part) {
      return part.toLowerCase() !== 'index.html';
    });
  }

  // Ensure #view-home exists even when starting from a lightweight subpage route shell
  let homeHydrationPromise = null;
  async function ensureHomeViewPresent() {
    if (document.getElementById('view-home')) return true;
    if (homeHydrationPromise) return homeHydrationPromise;

    homeHydrationPromise = (async function () {
      try {
        const res = await fetch(new URL('index.html', SITE_BASE_URL).href);
        if (!res.ok) return false;
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const fetchedHome = doc.getElementById('view-home');
        const appViews = document.getElementById('app-views');
        if (fetchedHome && appViews && !document.getElementById('view-home')) {
          fetchedHome.classList.add('hidden-view');
          appViews.insertBefore(fetchedHome, appViews.firstChild);
          initSelectedWorksAccordion();
          initScrollAnimations();
          return true;
        }
      } catch (e) {}
      return false;
    })();

    return homeHydrationPromise;
  }

  // 1. Dynamically load nav.html and footer.html into all pages
  async function loadModularPartials() {
    const navSlot = document.getElementById('nav-placeholder');
    const footerSlot = document.getElementById('footer-placeholder');

    const loadPartial = async function (slot, filename, label) {
      if (!slot) return false;
      try {
        const response = await fetch(new URL(filename, SITE_BASE_URL).href);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const markup = await response.text();
        if (!markup.trim()) throw new Error('Empty partial');
        slot.innerHTML = markup;
        slot.dataset.loaded = 'true';
        return true;
      } catch (error) {
        if (slot.children && slot.children.length > 0) {
          slot.dataset.loaded = 'true';
          return true;
        }
        console.error('Could not load ' + filename + ':', error);
        slot.innerHTML = '<div class="component-load-warning" role="status">' +
          label + ' could not load. Run this portfolio through a local web server ' +
          '(for example, VS Code Live Server), then refresh the page.</div>';
        return false;
      }
    };

    initNavigationAndTheme();
    initSelectedWorksAccordion();
    initWorksWaveDock();
    initArchDropCue();
    initModals();
    restoreRouteFromLocation();
    initScrollAnimations();

    if (!window.__showSitePreloader || window.__pendingHeroEntrance) {
      window.triggerHeroEntrance();
    }

    await Promise.all([
      loadPartial(navSlot, 'nav.html', 'Navigation bar'),
      loadPartial(footerSlot, 'footer.html', 'Footer')
    ]);

    bindNavbarControls();
    initScrollAnimations();

    // Warm up #view-home in background if started on a subpage route stub
    if (!document.getElementById('view-home')) {
      ensureHomeViewPresent();
    }
  }

  // 2. Continuous Background Audio (audio.mp3 + WebAudio Synth Fallback)
  let audioCtx = null;
  let isAudioPlaying = false;
  let chordTimer = null;

  function startAmbientSynthFallback() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtx) audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const chords = [
        [220.0, 277.18, 329.63, 440.0],
        [196.0, 246.94, 293.66, 392.0],
        [174.61, 220.0, 261.63, 349.23],
        [164.81, 207.65, 246.94, 329.63]
      ];
      let chordIdx = 0;

      const playChord = function () {
        if (!isAudioPlaying || !audioCtx) return;
        const now = audioCtx.currentTime;
        const notes = chords[chordIdx % chords.length];
        chordIdx++;

        notes.forEach(function (f) {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.025, now + 1.2);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);

          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 4.3);
        });
      };

      playChord();
      if (chordTimer) clearInterval(chordTimer);
      chordTimer = setInterval(playChord, 4000);
    } catch (e) {}
  }

  function stopAmbientSynthFallback() {
    if (chordTimer) {
      clearInterval(chordTimer);
      chordTimer = null;
    }
  }

  window.toggleBackgroundAudio = function () {
    const bgAudio = document.getElementById('bg-audio');
    const musicBtn = document.getElementById('musicToggleBtn');

    if (isAudioPlaying) {
      isAudioPlaying = false;
      if (bgAudio) bgAudio.pause();
      stopAmbientSynthFallback();
      if (musicBtn) musicBtn.classList.remove('playing');
      try { localStorage.setItem('akash_audio_playing', 'false'); } catch (e) {}
      return;
    }

    isAudioPlaying = true;
    if (musicBtn) musicBtn.classList.add('playing');
    try { localStorage.setItem('akash_audio_playing', 'true'); } catch (e) {}

    if (bgAudio && bgAudio.getAttribute('src')) {
      const playPromise = bgAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(function () {
          startAmbientSynthFallback();
        });
      } else {
        startAmbientSynthFallback();
      }
    } else {
      startAmbientSynthFallback();
    }
  };

  function setMenuDrawerOpen(open, restoreFocus) {
    const drawer = document.getElementById('navDropdownDrawer');
    const menuBtn = document.getElementById('menuToggleBtn');
    if (!drawer || !menuBtn) return;

    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    drawer.toggleAttribute('inert', !open);
    menuBtn.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute(
      'aria-label',
      open ? 'Close navigation menu' : 'Open navigation menu'
    );
    document.body.classList.toggle(
      'menu-drawer-open',
      open && window.matchMedia('(max-width: 900px)').matches
    );

    if (open) {
      const closeBtn = document.getElementById('drawerCloseBtn');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    } else if (restoreFocus) {
      menuBtn.focus({ preventScroll: true });
    }
  }

  window.closeMenuDrawer = function () {
    setMenuDrawerOpen(false, false);
  };

  // 3. Theme Toggle & Navbar Scroll
  function initNavigationAndTheme() {
    try {
      const savedTheme = localStorage.getItem('akash_portfolio_theme') || localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.documentElement.classList.add('dark-theme-init');
      } else if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.documentElement.classList.remove('dark-theme-init');
      }
    } catch (e) {}

    window.addEventListener('scroll', function () {
      const navbar = document.getElementById('siteNavbar');
      if (!navbar) return;
      if (window.scrollY > 30) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  function bindNavbarControls() {
    const navbar = document.getElementById('siteNavbar');
    if (navbar) {
      if (window.scrollY > 30) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');
    }

    const menuBtn = document.getElementById('menuToggleBtn');
    const drawer = document.getElementById('navDropdownDrawer');
    if (menuBtn && drawer && !menuBtn.dataset.bound) {
      menuBtn.dataset.bound = 'true';
      menuBtn.addEventListener('click', function () {
        setMenuDrawerOpen(!drawer.classList.contains('open'), true);
      });

      drawer.querySelectorAll('.drawer-category-toggle').forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          const item = button.closest('.drawer-category-item');
          const categoryLink = item && item.querySelector('.drawer-category-head a');
          if (!item || !categoryLink) return;

          const expanded = item.classList.toggle('expanded');
          button.setAttribute('aria-expanded', String(expanded));
          button.setAttribute(
            'aria-label',
            (expanded ? 'Hide ' : 'Show ') + categoryLink.textContent.trim() + ' options'
          );
        });
      });

      document.addEventListener('pointerdown', function (event) {
        if (
          drawer.classList.contains('open') &&
          !drawer.contains(event.target) &&
          !menuBtn.contains(event.target)
        ) {
          setMenuDrawerOpen(false, false);
        }
      });

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && drawer.classList.contains('open')) {
          setMenuDrawerOpen(false, true);
        }
      });
    }
  }

  // 4. Multi-Page Subpage Navigation
  let currentSubPageKey = '3Dvis';
  let currentSubFilter = 'all';

  function getCardImgSrc(cardIdx) {
    return CARD_IMAGES[cardIdx] || 'assets/card1.jpg';
  }

  window.navigateToSection = async function (sectionId) {
    await ensureHomeViewPresent();
    const homeView = document.getElementById('view-home');
    const subView = document.getElementById('view-subpage');
    if (homeView && subView) {
      subView.classList.add('hidden-view');
      homeView.classList.remove('hidden-view');
    }
    const url = new URL(SITE_BASE_URL.href);
    url.hash = sectionId && sectionId !== 'home' ? '#' + sectionId : '';
    setBrowserUrl(url, false);
    const target = document.getElementById(sectionId);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  };

  window.navigateToPage = async function (pageKey, filterKey, options) {
    const settings = options || {};
    const filter = filterKey || 'all';

    if (pageKey === 'home') {
      try {
        sessionStorage.setItem('ar_skip_next_preload', '1');
      } catch (e) {}
      await ensureHomeViewPresent();
    }

    const homeView = document.getElementById('view-home');
    const subView = document.getElementById('view-subpage');
    if (!subView) return;

    if (settings.updateAddress !== false) {
      if (pageKey === 'home') {
        const cleanHomeUrl = new URL(SITE_BASE_URL.href);
        cleanHomeUrl.hash = '';
        setBrowserUrl(cleanHomeUrl, !!settings.replaceHistory);
      } else {
        setBrowserUrl(routeUrl(pageKey, filter), !!settings.replaceHistory);
      }
    }

    if (pageKey === 'home') {
      subView.classList.add('hidden-view');
      if (homeView) homeView.classList.remove('hidden-view');
      if (settings.closeModal !== false && window.closePortfolioModal) {
        window.closePortfolioModal({ skipUrlUpdate: true });
      }
      if (settings.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
      window.triggerHeroEntrance();
      initScrollAnimations();
      return;
    }

    const data = SUBPAGES_DATA[pageKey];
    if (!data) return;

    currentSubPageKey = pageKey;
    currentSubFilter = filter;
    if (homeView) homeView.classList.add('hidden-view');
    subView.classList.remove('hidden-view');

    if (settings.closeModal !== false && window.closePortfolioModal) {
      window.closePortfolioModal({ skipUrlUpdate: true });
    }

    const fileEl = document.getElementById('subpage-filename');
    const titleEl = document.getElementById('subpage-title');
    const subEl = document.getElementById('subpage-subtitle');
    if (fileEl) fileEl.textContent = data.filename;
    if (titleEl) titleEl.textContent = data.title;
    if (subEl) subEl.textContent = data.subtitle;

    renderSubpageFilters(data);
    renderSubpageProjects(data, filter);
    if (settings.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Rebuild visible page & modal state from the address bar on first load and browser back/forward
  function restoreRouteFromLocation() {
    const parts = relativeRouteSegments();
    const hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
    const keyBySegment = Object.keys(ROUTE_SEGMENTS).reduce(function (map, key) {
      map[ROUTE_SEGMENTS[key].toLowerCase()] = key;
      return map;
    }, {});

    let matchedSubpage = false;
    if (parts.length) {
      const pageKey = keyBySegment[(parts[0] || '').toLowerCase()];
      if (pageKey) {
        matchedSubpage = true;
        const filter = parts[1] || 'all';
        window.navigateToPage(pageKey, filter, { updateAddress: false, scroll: false, closeModal: false });
      }
    }

    if (!matchedSubpage) {
      window.navigateToPage('home', null, { updateAddress: false, scroll: false, closeModal: false });
      if (hash === 'home') {
        const cleanHome = new URL(window.location.href);
        cleanHome.hash = '';
        setBrowserUrl(cleanHome, true);
      }
    }

    if (hash === 'resume') {
      window.openResumeModal(null, { updateAddress: false, restore: true });
    } else if (hash === 'contact') {
      window.openContactModal({ updateAddress: false, restore: true });
    } else if (hash === 'terms') {
      window.openTermsModal({ updateAddress: false });
    } else {
      window.closePortfolioModal({ skipUrlUpdate: true });
      if (!matchedSubpage && hash && hash !== 'home' && document.getElementById(hash)) {
        document.getElementById(hash).scrollIntoView({ behavior: 'auto' });
      }
    }
  }

  function renderSubpageFilters(data) {
    const bar = document.getElementById('subpage-filter-bar');
    if (!bar) return;
    bar.innerHTML = '';
    data.filters.forEach(function (f) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'subpage-filter-pill' + (f.key === currentSubFilter ? ' active' : '');
      btn.textContent = f.label;
      btn.addEventListener('click', function () {
        currentSubFilter = f.key;
        setBrowserUrl(routeUrl(currentSubPageKey, f.key), false);
        renderSubpageFilters(data);
        renderSubpageProjects(data, f.key);
      });
      bar.appendChild(btn);
    });
  }

  function renderSubpageProjects(data, filterKey) {
    const grid = document.getElementById('subpage-projects-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const filtered = filterKey === 'all'
      ? data.projects
      : data.projects.filter(function (p) { return p.category === filterKey; });

    filtered.forEach(function (proj, idx) {
      const imgSrc = getCardImgSrc(proj.imageCardIdx || 0);
      const card = document.createElement('article');
      card.className = 'subpage-proj-card';
      card.style.setProperty('--proj-delay', (idx * 0.08) + 's');
      card.innerHTML =
        '<div class="subpage-proj-img-wrap">' +
          '<img src="' + imgSrc + '" alt="' + proj.title + '" loading="lazy" decoding="async" />' +
          '<span class="subpage-proj-tag">' + proj.tag + '</span>' +
        '</div>' +
        '<div class="subpage-proj-body">' +
          '<div>' +
            '<h3 class="subpage-proj-title">' + proj.title + '</h3>' +
            '<p class="subpage-proj-desc">' + proj.desc + '</p>' +
          '</div>' +
          '<div class="subpage-proj-footer">' +
            '<span style="color:#10b981;">✓ Verified HORIZON / Portfolio Work</span>' +
            '<button type="button" onclick="openContactModal()" style="background:none;border:none;color:#ff6a18;font-weight:800;cursor:pointer;font-family:inherit;">Inquire &rarr;</button>' +
          '</div>' +
        '</div>';
      grid.appendChild(card);
    });
  }

  // 4b. Hero Works Wave Dock: 6 chained icons moving as one water wave
  function initWorksWaveDock() {
    const dock = document.getElementById('worksWaveDock');
    if (!dock || dock.dataset.bound === 'true') return;
    dock.dataset.bound = 'true';

    const track = dock.querySelector('.wwd-track');
    const items = Array.from(dock.querySelectorAll('.wwd-item'));
    const svg = dock.querySelector('.wwd-strand');
    const grad = svg.querySelector('#wwdGrad');
    const paths = ['.wwd-strand-glow', '.wwd-strand-body', '.wwd-strand-shine'].map(function (s) { return svg.querySelector(s); });
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1;

    let width = 0, height = 0, centers = [];
    let amp = 0, phase = 0, last = 0, raf = 0;
    let visible = true, engaged = false, lastType = 'mouse', wasOn = false;

    function measure() {
      width = track.offsetWidth;
      height = track.offsetHeight;
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      grad.setAttribute('x2', width);
      centers = items.map(function (it) { return it.offsetLeft + it.offsetWidth / 2; });
      draw(items.map(function () { return 0; }));
    }

    function draw(ys) {
      if (!centers.length) return;
      const cy = height / 2;
      const pts = [{ x: centers[0] - 26, y: cy + ys[0] }];
      centers.forEach(function (x, i) { pts.push({ x: x, y: cy + ys[i] }); });
      pts.push({ x: centers[centers.length - 1] + 26, y: cy + ys[ys.length - 1] });
      let d = 'M' + pts[0].x.toFixed(1) + ',' + pts[0].y.toFixed(1);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += ' C' + (p1.x + (p2.x - p0.x) / 6).toFixed(1) + ',' + (p1.y + (p2.y - p0.y) / 6).toFixed(1) +
             ' ' + (p2.x - (p3.x - p1.x) / 6).toFixed(1) + ',' + (p2.y - (p3.y - p1.y) / 6).toFixed(1) +
             ' ' + p2.x.toFixed(1) + ',' + p2.y.toFixed(1);
      }
      paths.forEach(function (p) { p.setAttribute('d', d); });
    }

    function frame(t) {
      raf = 0;
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      phase += dt * 2.1;
      const target = engaged ? 0 : (window.innerWidth <= 900 ? 9 : 13) * calm;
      amp += (target - amp) * Math.min(1, dt * 7);
      const ys = items.map(function (_, i) {
        return Math.sin(phase - i * 0.85) * amp + Math.sin(phase * 0.6 - i * 1.7 + 1.2) * amp * 0.35;
      });
      items.forEach(function (it, i) { it.style.transform = 'translate3d(0,' + ys[i].toFixed(2) + 'px,0)'; });
      draw(ys);
      if (visible) raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    function setOn(item) {
      items.forEach(function (it) { it.classList.toggle('is-on', it === item); });
      dock.classList.add('is-engaged');
      engaged = true;
      const label = item.querySelector('.wwd-label');
      label.style.setProperty('--shift', '0px');
      const r = label.getBoundingClientRect();
      const shift = Math.max(8 - r.left, 0) + Math.min(window.innerWidth - 8 - r.right, 0);
      label.style.setProperty('--shift', shift + 'px');
    }
    function clearOn() {
      items.forEach(function (it) { it.classList.remove('is-on'); });
      dock.classList.remove('is-engaged');
      engaged = false;
    }

    items.forEach(function (item) {
      item.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') setOn(item); });
      item.addEventListener('pointerdown', function (e) { lastType = e.pointerType; wasOn = item.classList.contains('is-on'); });
      item.addEventListener('click', function () {
        if (lastType === 'touch' && !wasOn) { setOn(item); return; }
        const idx = parseInt(item.dataset.index, 10);
        if (typeof window.activateWorkCard === 'function') window.activateWorkCard(idx);
        if (typeof window.navigateToPage === 'function') window.navigateToPage(item.dataset.page, item.dataset.filter);
      });
    });
    track.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') clearOn(); });
    dock.addEventListener('focusin', function (e) {
      const it = e.target.closest('.wwd-item');
      if (it && it.matches(':focus-visible')) setOn(it);
    });
    dock.addEventListener('focusout', function () {
      setTimeout(function () { if (!dock.contains(document.activeElement)) clearOn(); }, 0);
    });
    document.addEventListener('pointerdown', function (e) { if (!dock.contains(e.target)) clearOn(); });

    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(track);
    window.addEventListener('resize', measure);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting && !document.hidden;
        if (visible) { measure(); start(); }
      }, { threshold: 0.05 }).observe(dock);
    } else { visible = true; }
    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden && dock.getClientRects().length > 0;
      if (visible) start();
    });
    measure();
    start();
  }

  // 4c. PC only: scroll cue story. A colorful drop melts off the dock's left edge, swirls,
  // draws a fine-line modern tower in ribbon, then falls into the scroll button (impact every time)
  function initArchDropCue() {
    const svg = document.getElementById('wwdArch');
    const dock = document.getElementById('worksWaveDock');
    const cue = document.querySelector('.scroll-down-indicator');
    const canvas = document.querySelector('.hero-canvas');
    if (!svg || !dock || !cue || !canvas || svg.dataset.bound === 'true') return;
    svg.dataset.bound = 'true';

    const mq = window.matchMedia('(min-width: 901px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pA = svg.querySelector('.wwd-path-a');
    const pC = svg.querySelector('.wwd-path-c');
    const ribbons = Array.from(svg.querySelectorAll('.wwd-path-b'));
    const pB = ribbons[0];
    const grad = svg.querySelector('#wwdRibbonGrad');
    const drop = svg.querySelector('.wwd-drop');
    const body = svg.querySelector('.wwd-drop-body');
    const spec = svg.querySelector('.wwd-drop-spec');
    const splash = Array.from(svg.querySelectorAll('.wwd-splash'));
    const cap = svg.querySelector('.wwd-caption');
    const firstItem = dock.querySelector('.wwd-item');
    const track = dock.querySelector('.wwd-track');
    const cueSvg = cue.querySelector('svg');

    const T = 7000;
    let LA = 0, LB = 0, LC = 0, S = { x: 0, y: 0 }, IMP = { x: 0, y: 0 };
    let raf = 0, t0 = 0, lastCycle = -1, hit = false, visible = true, ready = false, hitTimer = 0;

    const easeIO = function (k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };
    const easeIn = function (k) { return k * k * k; };
    const easeOut = function (k) { return 1 - Math.pow(1 - k, 3); };
    const clamp01 = function (k) { return Math.max(0, Math.min(1, k)); };

    function layout() {
      if (!mq.matches || reduce.matches) return false;
      const c = canvas.getBoundingClientRect();
      const f = firstItem.getBoundingClientRect();
      const tr = track.getBoundingClientRect();
      const a = cueSvg.getBoundingClientRect();
      if (!c.width || !f.width || !a.width) return false;
      const sx = f.left - c.left - 6;
      const sy = tr.top - c.top + tr.height / 2;
      const ex = a.left - c.left + a.width / 2;
      const ey = a.top - c.top + a.height / 2;
      const k = 0.86;                              // tower scale
      const ax = ex + 6, ay = ey - 66;             // tower base center
      const X = function (v) { return (ax + v * k).toFixed(1); };
      const Y = function (v) { return (ay + v * k).toFixed(1); };
      const lx = ax + 34, ly = ay - 118, r = 12;
      S = { x: sx, y: sy };
      IMP = { x: ex, y: ey - 20 };
      svg.setAttribute('viewBox', '0 0 ' + c.width + ' ' + c.height);
      grad.setAttribute('x1', ax - 30); grad.setAttribute('x2', ax + 30);

      // drop route: dock edge -> swirl -> tower base-left
      pA.setAttribute('d',
        'M' + sx + ',' + sy + ' C' + (sx - 26) + ',' + (sy - 30) + ' ' + (lx + 30) + ',' + (ly + 10) + ' ' + lx + ',' + ly +
        ' a' + r + ',' + r + ' 0 1,1 ' + (-2 * r) + ',0 a' + r + ',' + r + ' 0 1,1 ' + (2 * r) + ',0' +
        ' C' + (lx - 6) + ',' + (ly + 34) + ' ' + (ax - 44) + ',' + (ay - 30) + ' ' + X(-32) + ',' + Y(0));

      // fine-line skyscraper that rises floor by floor: ground, podium, tower outline,
      // then floor lines stacking up in a serpentine, finishing with a spire
      const pts = [[-38,0],[38,0],[34,0],[34,-14],[-34,-14],[-34,0],[-14,0],[-14,-64],[14,-64],[14,0],[14,-14],
                   [-14,-14],[-14,-24],[14,-24],[14,-34],[-14,-34],[-14,-44],[14,-44],[14,-54],[-14,-54],[-14,-64],[0,-64],[0,-84]];
      const tower = 'M' + pts.map(function (p) { return X(p[0]) + ',' + Y(p[1]); }).join(' L');
      ribbons.forEach(function (p) { p.setAttribute('d', tower); });
      cap.setAttribute('x', ax.toFixed(1)); cap.setAttribute('y', (ay - 84 * k - 12).toFixed(1));

      // drop falls from the crown of the tower into the button
      const tx = ax, ty = ay - 84 * k;
      pC.setAttribute('d', 'M' + tx.toFixed(1) + ',' + ty.toFixed(1) + ' C' + tx.toFixed(1) + ',' + (ty + 50).toFixed(1) +
        ' ' + ex + ',' + (ey - 70) + ' ' + ex + ',' + (ey - 22));
      LA = pA.getTotalLength(); LB = pB.getTotalLength(); LC = pC.getTotalLength();
      return true;
    }

    function seg(p, L, from, to, op) {
      const len = to - from;
      if (len < 0.8) { p.style.opacity = 0; return; }
      p.style.opacity = op === undefined ? 1 : op;
      p.style.strokeDasharray = len + ' ' + (L * 2);
      p.style.strokeDashoffset = -from;
    }
    function hide(p) { p.style.opacity = 0; }

    function fireImpact() {
      hit = true;
      cue.classList.remove('is-hit');
      void cue.offsetWidth;                        // restart the CSS animation every time
      cue.classList.add('is-hit');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(function () { cue.classList.remove('is-hit'); }, 1100);
    }

    function render(q) {
      const hue = (q * 420 + 15) % 360;
      const col = 'hsl(' + hue + ' 95% 55%)';
      pA.style.stroke = col; pC.style.stroke = col;
      let pos = null, r = 0, stretch = 1, capOp = 0;
      hide(pA); hide(pC); ribbons.forEach(hide);

      if (q < 0.12) {                              // 1. MELT: edge swells and stretches
        const k = easeOut(q / 0.12);
        r = 7 * k; stretch = 1 + 0.4 * k;
        pos = { x: S.x, y: S.y + 3 * k };
      } else if (q < 0.32) {                       // 2. SWIRL: pinches off and loops
        const k = easeIO((q - 0.12) / 0.20);
        pos = pA.getPointAtLength(LA * k); r = 7 - 1.5 * k;
        seg(pA, LA, Math.max(0, LA * k - 48), LA * k, 0.7);
      } else if (q < 0.48) {                       // 3. BUILD: fast fine-line tower
        const k = easeIO(clamp01((q - 0.32) / 0.16));
        pos = pB.getPointAtLength(LB * k); r = 4.5;
        ribbons.forEach(function (p) { seg(p, LB, 0, LB * k); });
        capOp = clamp01((k - 0.7) / 0.3);
      } else if (q < 0.60) {                       // 4. HOLD
        const k = (q - 0.48) / 0.12;
        pos = pB.getPointAtLength(LB); r = 4.5 + Math.sin(k * Math.PI) * 1.4;
        pos = { x: pos.x, y: pos.y - Math.sin(k * Math.PI) * 4 };
        ribbons.forEach(function (p) { seg(p, LB, 0, LB); });
        capOp = 1;
      } else if (q < 0.72) {                       // 5. DROP: tower melts, drop falls in
        const k = clamp01((q - 0.60) / 0.12);
        const e = easeIn(k);
        pos = pC.getPointAtLength(LC * e); r = 4.5 + 1.2 * e;
        seg(pC, LC, Math.max(0, LC * e - 40), LC * e, 0.85);
        ribbons.forEach(function (p) { seg(p, LB, LB * easeIO(k), LB, 1 - k * 0.7); });
        capOp = clamp01(1 - k * 2);
      }

      cap.style.opacity = capOp;

      // 6. IMPACT: fires every cycle the moment the drop lands
      if (q >= 0.72 && q < 0.92 && !hit) fireImpact();
      if (q < 0.5) hit = false;
      if (q >= 0.72 && q < 0.86) {
        const k = (q - 0.72) / 0.14;
        splash.forEach(function (c, i) {
          const ang = (-165 + i * (150 / (splash.length - 1))) * Math.PI / 180;
          const d = easeOut(k) * (22 + (i % 3) * 7);
          c.setAttribute('cx', (IMP.x + Math.cos(ang) * d).toFixed(1));
          c.setAttribute('cy', (IMP.y + Math.sin(ang) * d + 26 * k * k).toFixed(1));
          c.setAttribute('r', (3.2 * (1 - k)).toFixed(2));
          c.style.fill = 'hsl(' + ((hue + i * 45) % 360) + ' 95% 58%)';
        });
      } else {
        splash.forEach(function (c) { c.setAttribute('r', 0); });
      }

      if (pos && r > 0.2) {
        drop.setAttribute('transform', 'translate(' + pos.x.toFixed(1) + ',' + pos.y.toFixed(1) + ')');
        body.setAttribute('rx', r.toFixed(2)); body.setAttribute('ry', (r * stretch).toFixed(2));
        body.style.fill = col;
        spec.setAttribute('r', (r * 0.3).toFixed(2));
        spec.setAttribute('cx', (-r * 0.35).toFixed(2)); spec.setAttribute('cy', (-r * 0.35 * stretch).toFixed(2));
      } else {
        body.setAttribute('rx', 0); body.setAttribute('ry', 0); spec.setAttribute('r', 0);
      }
    }

    function frame(now) {
      raf = 0;
      if (!visible) return;
      if (!t0) t0 = now;
      const elapsed = now - t0;
      const cycle = Math.floor(elapsed / T);
      if (cycle !== lastCycle) {
        if (lastCycle >= 0 && !hit && ready) fireImpact();   // never skip an impact (e.g. after a throttled frame)
        lastCycle = cycle; ready = layout(); hit = false;
      }
      if (ready) render((elapsed % T) / T);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && visible && mq.matches && !reduce.matches) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    function sync() {
      if (mq.matches && !reduce.matches) {
        svg.classList.add('is-on'); lastCycle = -1; start();
      } else {
        stop(); svg.classList.remove('is-on'); cue.classList.remove('is-hit');
      }
    }
    if (mq.addEventListener) { mq.addEventListener('change', sync); reduce.addEventListener('change', sync); }
    window.addEventListener('resize', function () { lastCycle = -1; });
    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden && canvas.getClientRects().length > 0;
      if (visible) { t0 = 0; lastCycle = -1; start(); } else stop();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting && !document.hidden;
        if (visible) { t0 = 0; lastCycle = -1; start(); } else stop();
      }, { threshold: 0.2 }).observe(canvas);
    }
    // wait for the hero entrance to settle before the first run
    setTimeout(sync, 1800);
  }

  // 5. Second Canvas: 6 Interactive Cards Accordion
  window.activateWorkCard = function (index) {
    const cards = document.querySelectorAll('.work-card');
    cards.forEach(function (card, idx) {
      card.classList.toggle('active', idx === index);
    });
  };

  function initSelectedWorksAccordion() {
    const cards = document.querySelectorAll('.work-card');
    if (!cards.length) return;

    cards.forEach(function (card, idx) {
      if (card.dataset.accordionBound === 'true') return;
      card.dataset.accordionBound = 'true';
      card.addEventListener('mouseenter', function () {
        window.activateWorkCard(idx);
      });
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-subpage]')) return;
        if (!card.classList.contains('active')) {
          window.activateWorkCard(idx);
        }
      });
    });

    const subnamesBtn = document.getElementById('openActiveProjectBtn');
    if (subnamesBtn && !subnamesBtn.dataset.bound) {
      subnamesBtn.dataset.bound = 'true';
      subnamesBtn.addEventListener('click', function () {
        const activeCard = document.querySelector('.work-card.active');
        const idx = activeCard ? parseInt(activeCard.getAttribute('data-index'), 10) : 0;
        const pageKey = CARD_TO_PAGE[idx] || '3Dvis';
        const filterKey = CARD_TO_FILTER[idx] || 'all';
        window.navigateToPage(pageKey, filterKey);
      });
    }
  }

  // 6. Modals: Direct Contact Card, Complete Resume PDF Viewer, and Terms & Conditions
  //    Opens right on top of whichever page the user is currently viewing (Home, 3Dvis, AW, etc.)
  //    and immediately removes #resume / #contact from the URL path when closed.
  function openModalWithHTML(htmlContent, extraCardClass) {
    const modal = document.getElementById('portfolioModal');
    const card = modal ? modal.querySelector('.portfolio-modal-card') : null;
    const body = document.getElementById('portfolioModalBody');
    if (!modal || !body) return;
    if (card) {
      card.classList.remove('contact-modal-card', 'resume-modal-card');
      if (extraCardClass) card.classList.add(extraCardClass);
    }
    body.innerHTML = htmlContent;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  window.closePortfolioModal = function (options) {
    const settings = options || {};
    const modal = document.getElementById('portfolioModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');

    // Immediately remove #resume, #contact, or #terms from the URL path when closing the modal
    if (!settings.skipUrlUpdate && window.location.hash) {
      const currentHash = window.location.hash.replace(/^#/, '').toLowerCase();
      if (currentHash === 'resume' || currentHash === 'contact' || currentHash === 'terms') {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.hash = '';
        setBrowserUrl(cleanUrl, true);
      }
    }
  };

  window.copyTextToClipboard = function (text, btnEl) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    if (btnEl) {
      const orig = btnEl.textContent;
      btnEl.textContent = 'Copied!';
      setTimeout(function () { btnEl.textContent = orig; }, 1800);
    }
  };

  window.openContactModal = function (options) {
    const settings = options || {};
    if (settings.updateAddress !== false) {
      // Stay on the current page (Home, 3Dvisualization, AW, etc.) and append #contact
      setCurrentPageHash('contact', false);
    }
    openModalWithHTML(
      '<div class="cc-header">' +
        '<div class="cc-avatar">AR</div>' +
        '<div class="cc-title-wrap">' +
          '<div class="cc-eyebrow">DIRECT CONTACT CARD</div>' +
          '<h2 class="cc-name">Ataur Rahman Akash</h2>' +
          '<p class="cc-sub"><span class="gibed-font">An Enthusiast Architect</span> &bull; IDEB ID: 68269</p>' +
        '</div>' +
      '</div>' +

      '<div class="cc-rows">' +
        '<div class="cc-row">' +
          '<div class="cc-row-left">' +
            '<div class="cc-icon cc-icon-purple">' +
              '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>' +
            '</div>' +
            '<div class="cc-meta">' +
              '<div class="cc-label">EMAIL ADDRESS (ANCHORED)</div>' +
              '<a href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=archarakash09@gmail.com" target="_blank" rel="noopener noreferrer" class="cc-val cc-val-amber">archarakash09@gmail.com</a>' +
            '</div>' +
          '</div>' +
          '<button type="button" onclick="copyTextToClipboard(\'archarakash09@gmail.com\', this)" class="cc-btn cc-btn-neutral">Copy</button>' +
        '</div>' +

        '<div class="cc-row">' +
          '<div class="cc-row-left">' +
            '<div class="cc-icon cc-icon-green">' +
              '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.01c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.65-.61-2.92-1.26-4.82-4.21-4.97-4.4-.15-.19-1.19-1.58-1.19-3.01 0-1.43.75-2.13 1.01-2.42.26-.29.58-.36.77-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.82 2.01.89 2.15.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.35 1.46.29.15.46.12.63-.07.17-.19.73-.85.92-1.14.19-.29.39-.24.65-.15.27.1 1.69.8 1.98.94.29.15.48.22.56.34.08.12.08.7-.16 1.38z"/></svg>' +
            '</div>' +
            '<div class="cc-meta">' +
              '<div class="cc-label">WHATSAPP NUMBER</div>' +
              '<a href="https://wa.me/8801792985959" target="_blank" rel="noopener noreferrer" class="cc-val cc-val-green">+88-01792985959</a>' +
            '</div>' +
          '</div>' +
          '<a href="https://wa.me/8801792985959" target="_blank" rel="noopener noreferrer" class="cc-btn cc-btn-green">Chat</a>' +
        '</div>' +

        '<div class="cc-row">' +
          '<div class="cc-row-left">' +
            '<div class="cc-icon cc-icon-blue">' +
              '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z"/></svg>' +
            '</div>' +
            '<div class="cc-meta">' +
              '<div class="cc-label">CONTACT NUMBER</div>' +
              '<a href="tel:+8801792985959" class="cc-val cc-val-blue">+88-01792985959</a>' +
            '</div>' +
          '</div>' +
          '<a href="tel:+8801792985959" class="cc-btn cc-btn-blue">Call</a>' +
        '</div>' +

        '<div class="cc-row cc-row-addr">' +
          '<div class="cc-row-left">' +
            '<div class="cc-icon cc-icon-orange">' +
              '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>' +
            '</div>' +
            '<div class="cc-meta">' +
              '<div class="cc-label">LOCATION / ADDRESS</div>' +
              '<div class="cc-addr-main">House # 05, Avenue # 01, Block-A, Chandrima Model Town, Mohammadpur, Dhaka, Bangladesh</div>' +
              '<div class="cc-addr-sub">Office (HORIZON): House # 229, Lane # 16, New DOHS, Mohakhali, Dhaka</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="cc-footer">' +
        '<span class="cc-footer-label">CONNECT ON SOCIALS:</span>' +
        '<div class="cc-socials">' +
          '<a href="https://facebook.com" target="_blank" rel="noopener noreferrer" class="cc-soc-btn cc-soc-fb" title="Facebook" aria-label="Facebook">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M15.12 5.32H17V2.14A26.11 26.11 0 0 0 14.26 2c-2.72 0-4.58 1.66-4.58 4.7v2.62H6.61v3.56h3.07V22h3.68v-9.12h3.06l.46-3.56h-3.52V6.65c0-1.05.29-1.73 1.76-1.73z"/></svg>' +
          '</a>' +
          '<a href="https://wa.me/8801792985959" target="_blank" rel="noopener noreferrer" class="cc-soc-btn cc-soc-wa" title="WhatsApp" aria-label="WhatsApp">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.01c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.65-.61-2.92-1.26-4.82-4.21-4.97-4.4-.15-.19-1.19-1.58-1.19-3.01 0-1.43.75-2.13 1.01-2.42.26-.29.58-.36.77-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.82 2.01.89 2.15.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.35 1.46.29.15.46.12.63-.07.17-.19.73-.85.92-1.14.19-.29.39-.24.65-.15.27.1 1.69.8 1.98.94.29.15.48.22.56.34.08.12.08.7-.16 1.38z"/></svg>' +
          '</a>' +
          '<a href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=archarakash09@gmail.com" target="_blank" rel="noopener noreferrer" class="cc-soc-btn cc-soc-mail" title="Email" aria-label="Email">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>' +
          '</a>' +
          '<a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" class="cc-soc-btn cc-soc-in" title="LinkedIn" aria-label="LinkedIn">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>' +
          '</a>' +
        '</div>' +
      '</div>',
      'contact-modal-card'
    );
  };

  window.openResumeModal = function (e, options) {
    if (e && e.preventDefault) e.preventDefault();
    const settings = options || {};
    if (settings.updateAddress !== false) {
      // Stay on the current page (Home, 3Dvisualization, AW, etc.) and append #resume
      setCurrentPageHash('resume', false);
    }
    const logosHtml = SOFTWARE_LOGOS.map(function (item) {
      return (
        '<div class="software-skill-chip">' +
          '<img src="' + item.url + '" alt="' + item.name + '" loading="lazy" onerror="this.style.display=\'none\'" />' +
          '<span>' + item.name + '</span>' +
        '</div>'
      );
    }).join('');

    openModalWithHTML(
      '<div class="resume-header-bar">' +
        '<div>' +
          '<span class="modal-tag">CURRICULUM VITAE — resume.pdf</span>' +
          '<h2 class="resume-header-title">Ataur Rahman Akash</h2>' +
          '<p class="resume-header-sub"><span class="gibed-font">An Enthusiast Architect</span> &bull; IDEB Membership ID: 68269</p>' +
        '</div>' +
        '<a href="resume.pdf" target="_blank" rel="noopener noreferrer" class="work-btn-primary" style="text-decoration:none;padding:9px 20px;font-size:0.84rem;">📄 Open resume.pdf</a>' +
      '</div>' +

      '<div class="resume-grid-3col">' +
        '<!-- Column 1: Work Experience -->' +
        '<div class="resume-col">' +
          '<div class="resume-section-card resume-sec-work">' +
            '<h4 class="resume-sec-heading" style="color:#10b981;">Work Experience</h4>' +
            '<div style="font-weight:800;"><span class="gibed-font">An Enthusiast Architect</span> (15 Sep 2020 – Present)</div>' +
            '<div style="font-size:0.78rem;opacity:0.78;margin-bottom:6px;">HORIZON &bull; House # 229, Lane # 16, New DOHS, Mohakhali, Dhaka</div>' +
            '<ul style="padding-left:18px;margin-bottom:10px;">' +
              '<li>Prepare 2D, technical and working drawings using AutoCAD.</li>' +
              '<li>Develop 3D architectural models using SketchUp.</li>' +
              '<li>Create visualizations and presentation views using Lumion.</li>' +
              '<li>Contribute to 23+ architectural projects in RAJUK, Cantonment &amp; Jalshiri.</li>' +
            '</ul>' +
            '<div style="font-weight:800;padding-top:8px;border-top:1px solid rgba(150,150,150,0.2);">Freelance Architectural Designer — Fiverr &amp; Upwork</div>' +
            '<p style="font-size:0.8rem;opacity:0.86;margin-top:3px;">2D drafting &amp; floor plans, 3D modeling, visualization, and Animation Walkthrough presentation videos for international clients.</p>' +
          '</div>' +
        '</div>' +

        '<!-- Column 2: Educational Qualification + References -->' +
        '<div class="resume-col">' +
          '<div class="resume-section-card resume-sec-edu">' +
            '<h4 class="resume-sec-heading" style="color:#0284c7;">Educational Qualification</h4>' +
            '<div style="margin-bottom:7px;"><strong>Bachelor of Science in Architecture</strong><br/><span style="font-size:0.79rem;opacity:0.84;">Sonargaon University (SU), Mohakhali, Dhaka &bull; 2026 &bull; CGPA: 3.20 / 4.00</span></div>' +
            '<div style="margin-bottom:7px;"><strong>Diploma-in-Engineering in Architecture</strong><br/><span style="font-size:0.79rem;opacity:0.84;">Dhaka Polytechnic Institute (BTEB) &bull; 2021 &bull; CGPA: 3.26 / 4.00</span></div>' +
            '<div><strong>Secondary School Certificate (S.S.C. / Dakhil)</strong><br/><span style="font-size:0.79rem;opacity:0.84;">Joynagar Amina Hamidia Fazil Madrasa, Satkhira &bull; 2016 &bull; GPA: 5.00 / 5.00</span></div>' +
          '</div>' +

          '<div class="resume-section-card resume-sec-ref">' +
            '<h4 class="resume-sec-heading" style="color:#e11d48;">References</h4>' +
            '<div style="margin-bottom:6px;"><strong>AR. MD. Abdus Sobhan</strong><br/><span style="font-size:0.79rem;opacity:0.84;">Architect, FIAB-529, HORIZON &bull; +88-01819238647</span></div>' +
            '<div><strong>Engr. MD. Aman Ullah</strong><br/><span style="font-size:0.79rem;opacity:0.84;">Asst. Architect, Eastern Housing LTD &bull; +88-01716355631</span></div>' +
          '</div>' +
        '</div>' +

        '<!-- Column 3: Technical & Software Skills + Membership & Personal Info -->' +
        '<div class="resume-col">' +
          '<div class="resume-section-card resume-sec-skills">' +
            '<h4 class="resume-sec-heading" style="color:#d97706;">Technical &amp; Software Skills</h4>' +
            '<div class="software-skill-grid">' + logosHtml + '</div>' +
          '</div>' +

          '<div class="resume-section-card resume-sec-info">' +
            '<h4 class="resume-sec-heading" style="color:#9333ea;">Membership &amp; Personal Info</h4>' +
            '<div><strong>IDEB Membership ID:</strong> 68269</div>' +
            '<div><strong>Freelancer Bangladesh ID:</strong> AT1634901985</div>' +
            '<div><strong>Date of Birth:</strong> 08 May 1999</div>' +
            '<div><strong>Nationality:</strong> Bangladeshi by Birth</div>' +
            '<div><strong>Blood Group:</strong> A+</div>' +
          '</div>' +
        '</div>' +
      '</div>',
      'resume-modal-card'
    );
  };

  window.openTermsModal = function (options) {
    const settings = options || {};
    if (settings.updateAddress !== false) {
      setCurrentPageHash('terms', false);
    }
    openModalWithHTML(
      '<span class="modal-tag">LEGAL &amp; INTELLECTUAL PROPERTY</span>' +
      '<h2 style="font-size:1.65rem;font-weight:800;margin-bottom:12px;">Terms and Conditions</h2>' +
      '<p style="line-height:1.65;margin-bottom:14px;">All architectural drawings, 3D visualizations, walkthrough animations, studio designs, and physical miniature model photographs displayed on this website are the intellectual property of <strong>Ataur Rahman Akash</strong> (<span class="gibed-font">An Enthusiast Architect</span>) and respective project stakeholders at <strong>HORIZON</strong>.</p>' +
      '<p style="line-height:1.65;margin-bottom:0;">Unauthorized reproduction, redistribution, or commercial use of these architectural plans or renders without prior written permission is strictly prohibited. Copyright &copy; 2026 Ataur Rahman Akash. All rights reserved.</p>'
    );
  };

  function initModals() {
    const modal = document.getElementById('portfolioModal');
    const closeBtn = document.getElementById('portfolioModalClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        window.closePortfolioModal();
      });
    }
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) window.closePortfolioModal();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
        window.closePortfolioModal();
      }
    });
  }

  window.addEventListener('popstate', restoreRouteFromLocation);
  window.addEventListener('hashchange', restoreRouteFromLocation);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadModularPartials);
  } else {
    loadModularPartials();
  }
})();
