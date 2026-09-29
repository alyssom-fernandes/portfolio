/* =====================================================================
   Alyssom Fernandes — Portfólio
   Comportamento da "planilha": idioma, tema, barra de fórmulas, célula
   sob o cursor, abas, demo antes/depois e pequenos detalhes.
   ===================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const ROW = 32;          // altura de linha (igual a --row no CSS)
  const HEADER_ROWS = 2;   // a barra fixa do topo ocupa 2 linhas
  const COLS = 'ABCDEFGHIJKL';
  const EMAIL = 'alyssom1919@gmail.com';

  doc.classList.add('js');

  /* ------------------------------------------------------------------
     Idioma
     ------------------------------------------------------------------ */
  const I18N = window.I18N;
  const LANGS = ['pt', 'en', 'es'];
  const HTML_LANG = { pt: 'pt-BR', en: 'en', es: 'es' };
  let lang = detectLang();

  function detectLang() {
    const fromUrl = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
    if (LANGS.includes(fromUrl)) return fromUrl;
    try {
      const saved = localStorage.getItem('lang');
      if (LANGS.includes(saved)) return saved;
    } catch (e) { /* armazenamento indisponível */ }
    const prefs = (navigator.languages || [navigator.language || 'pt']).map(l => l.slice(0, 2).toLowerCase());
    return prefs.find(l => LANGS.includes(l)) || 'en';
  }

  function t(key) {
    const dict = I18N[lang] || I18N.pt;
    if (key in dict) return dict[key];
    if (key in I18N.pt) return I18N.pt[key];
    return key;
  }

  function applyLang(next, persist) {
    lang = next;
    doc.lang = HTML_LANG[lang];

    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    $$('[data-i18n-attr]').forEach(el => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });

    document.title = t('meta.title');
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('meta.desc'));

    $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $$('.cv-link').forEach(a => { a.href = `cv/Alyssom-Fernandes-CV-${lang.toUpperCase()}.pdf`; });

    if (persist) {
      try { localStorage.setItem('lang', lang); } catch (e) { /* ignora */ }
      const url = new URL(location.href);
      url.searchParams.set('lang', lang);
      history.replaceState(null, '', url);
    }

    updateDurations();
    buildPrintSkills();
    if (currentSection) showFormula(currentSection, true);
    doc.classList.remove('i18n-pending');
  }

  $$('[data-lang]').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.lang !== lang) applyLang(btn.dataset.lang, true);
  }));

  /* ------------------------------------------------------------------
     Tema claro / escuro
     ------------------------------------------------------------------ */
  const themeBtn = $('#themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = doc.dataset.theme === 'dark' ? 'light' : 'dark';
      doc.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* ignora */ }
    });
  }

  /* ------------------------------------------------------------------
     Moldura: colunas A–L, números de linha e célula sob o cursor
     ------------------------------------------------------------------ */
  const colHeads = $$('.colhead__cols span');
  const colGuides = $$('.sheet-bg span');
  const gutter = $('#rowGutter');
  const nameBox = $('#nameBox');
  const statusBar = $('.statusbar');
  let colRects = [];
  let activeCol = -1;
  let activeRow = -1;
  let sectionCell = 'A1';

  function measureCols() {
    colRects = colHeads.map(el => el.getBoundingClientRect());
  }

  function colAt(x) {
    for (let i = 0; i < colRects.length; i++) {
      if (x >= colRects[i].left && x < colRects[i].right) return i;
    }
    return -1;
  }

  const rowAt = pageY => Math.floor(pageY / ROW) - HEADER_ROWS + 1;
  const cellAt = (x, pageY) => {
    const c = colAt(x);
    const r = rowAt(pageY);
    return c < 0 || r < 1 ? null : COLS[c] + r;
  };

  function buildGutter() {
    if (!gutter || getComputedStyle(gutter).display === 'none') return;
    const count = Math.ceil(document.body.offsetHeight / ROW) + 1;
    if (gutter.childElementCount === count) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      const label = i - HEADER_ROWS + 1;
      if (label >= 1) span.textContent = label;
      frag.appendChild(span);
    }
    gutter.replaceChildren(frag);
    activeRow = -1;
  }

  function setActiveCol(i) {
    if (i === activeCol) return;
    if (activeCol >= 0) {
      colHeads[activeCol].classList.remove('is-active');
      if (colGuides[activeCol]) colGuides[activeCol].classList.remove('is-active');
    }
    if (i >= 0) {
      colHeads[i].classList.add('is-active');
      if (colGuides[i]) colGuides[i].classList.add('is-active');
    }
    activeCol = i;
  }

  function setActiveRow(r) {
    if (r === activeRow || !gutter) return;
    const prev = gutter.children[activeRow + HEADER_ROWS - 1];
    if (prev) prev.classList.remove('is-active');
    const next = gutter.children[r + HEADER_ROWS - 1];
    if (next) next.classList.add('is-active');
    activeRow = r;
  }

  let pointer = null;
  let crossRaf = 0;

  function updateCrosshair() {
    crossRaf = 0;
    if (!pointer) {
      setActiveCol(-1);
      setActiveRow(-1);
      nameBox.textContent = sectionCell;
      return;
    }
    const top = parseFloat(getComputedStyle(doc).getPropertyValue('--header-h')) || 64;
    const bottom = window.innerHeight - (statusBar ? statusBar.offsetHeight : 0);
    const inside = pointer.y > top && pointer.y < bottom;
    const c = inside ? colAt(pointer.x) : -1;
    const r = inside ? rowAt(pointer.y + window.scrollY) : -1;
    setActiveCol(c);
    setActiveRow(r);
    const cell = inside ? cellAt(pointer.x, pointer.y + window.scrollY) : null;
    nameBox.textContent = cell || sectionCell;
  }

  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    pointer = { x: e.clientX, y: e.clientY };
    if (!crossRaf) crossRaf = requestAnimationFrame(updateCrosshair);
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', () => {
    pointer = null;
    if (!crossRaf) crossRaf = requestAnimationFrame(updateCrosshair);
  });

  /* Endereços reais de célula: o intervalo ocupado pelo nome no hero
     (ex.: "A3:H8") e as referências "A24" nos títulos e métricas. */
  function nearestCol(x) {
    let i = colAt(x);
    if (i < 0) i = x < colRects[0].left ? 0 : colRects.length - 1;
    return COLS[i];
  }

  function updateCellRefs() {
    if (!colRects.length) return;
    const y = window.scrollY;
    const box = $('.hero__name .sel');
    const label = $('#nameRange');
    if (box && label) {
      const r = box.getBoundingClientRect();
      const from = nearestCol(r.left + 2) + Math.max(1, rowAt(r.top + y + 2));
      const to = nearestCol(r.right - 2) + Math.max(1, rowAt(r.bottom + y - 2));
      label.textContent = `${from}:${to}`;
    }
    $$('[data-cellref]').forEach(el => {
      const host = el.closest('.metric, .kicker, .hero__top') || el;
      const r = host.getBoundingClientRect();
      el.textContent = nearestCol(r.left + 2) + Math.max(1, rowAt(r.top + y + 2));
    });
  }

  /* ------------------------------------------------------------------
     Barra de fórmulas
     ------------------------------------------------------------------ */
  const formulaEl = $('#formula');
  const resultEl = $('#formulaResult');
  let typing = 0;
  let shownKey = '';

  function typeFormula(text, result) {
    clearInterval(typing);
    resultEl.textContent = '';
    let i = 0;
    const step = Math.max(1, Math.ceil(text.length / 20));
    formulaEl.textContent = '';
    typing = setInterval(() => {
      i += step;
      formulaEl.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(typing);
        resultEl.textContent = result;
      }
    }, 16);
  }

  function showFormula(el, force) {
    const key = el.dataset.f;
    if (!key || (key === shownKey && !force)) return;
    shownKey = key;
    typeFormula(t(key), el.dataset.r ? t(el.dataset.r) : '');
  }

  // Métricas e outros elementos com fórmula própria
  $$('[data-f]:not(section)').forEach(el => {
    const enter = () => showFormula(el);
    const leave = () => { if (currentSection) showFormula(currentSection); };
    el.addEventListener('mouseenter', enter);
    el.addEventListener('focus', enter);
    el.addEventListener('mouseleave', leave);
    el.addEventListener('blur', leave);
  });

  /* ------------------------------------------------------------------
     Abas (scrollspy) e "zoom" = progresso de leitura
     ------------------------------------------------------------------ */
  const sections = $$('main > section[id]');
  const tabsList = $('#tabs');
  const tabLinks = $$('#tabs a');
  const zoomThumb = $('#zoomThumb');
  const zoomPct = $('#zoomPct');
  let currentSection = null;

  function revealTab(link) {
    if (!tabsList) return;
    const left = link.offsetLeft;
    const right = left + link.offsetWidth;
    if (left < tabsList.scrollLeft) tabsList.scrollLeft = left - 8;
    else if (right > tabsList.scrollLeft + tabsList.clientWidth) tabsList.scrollLeft = right - tabsList.clientWidth + 8;
  }

  function spy() {
    const line = window.innerHeight * 0.38;
    const atBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 4;
    let current = sections[0];
    if (atBottom) current = sections[sections.length - 1];
    else sections.forEach(s => { if (s.getBoundingClientRect().top <= line) current = s; });

    if (current !== currentSection) {
      currentSection = current;
      tabLinks.forEach(a => {
        const on = a.getAttribute('href') === `#${current.id}`;
        if (on) { a.setAttribute('aria-current', 'true'); revealTab(a); }
        else a.removeAttribute('aria-current');
      });
      const top = current.getBoundingClientRect().top + window.scrollY;
      sectionCell = `A${Math.max(1, rowAt(top + 2))}`;
      if (!pointer) nameBox.textContent = sectionCell;
      showFormula(current);
    }

    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    if (zoomThumb) zoomThumb.style.left = `${pct * 100}%`;
    if (zoomPct) zoomPct.textContent = `${Math.round(pct * 100)}%`;
  }

  let scrollRaf = 0;
  window.addEventListener('scroll', () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      spy();
      if (pointer) updateCrosshair();
    });
  }, { passive: true });

  /* ------------------------------------------------------------------
     Revelação ao rolar + contadores das métricas
     ------------------------------------------------------------------ */
  function countUp(el) {
    const to = parseFloat(el.dataset.to);
    if (Number.isNaN(to)) return;
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const start = performance.now();
    const dur = 1100;
    const tick = now => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(to * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const revealEls = $$('.reveal');
  const counters = $$('[data-to]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(el => io.observe(el));

    const cio = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        cio.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(el => cio.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-in'));
  }

  /* ------------------------------------------------------------------
     Demo do hero: planilha caótica -> dashboard
     ------------------------------------------------------------------ */
  const demo = $('#demo');
  if (demo) {
    const toggles = $$('[data-demo]', demo);
    // Cada célula recebe coordenadas (linha, coluna) para a dissolução diagonal.
    const items = [];
    $$('.xl-fx > *', demo).forEach((el, i) => items.push({ el, r: 0, c: i * 3 }));
    $$('.xl .c', demo).forEach((el, i) => items.push({ el, r: 1 + Math.floor(i / 7), c: i % 7 }));
    $$('.xl-tabs > *', demo).forEach((el, i) => items.push({ el, r: 14, c: i }));
    $$('.chart__g', demo).forEach((g, i) => g.querySelectorAll('i').forEach(bar => bar.style.setProperty('--i', i)));
    const maxK = Math.max(...items.map(it => it.r + it.c));
    let touched = false;

    const setState = (state, animate = true) => {
      const toAfter = state === 'after';
      items.forEach(({ el, r, c }) => {
        const k = toAfter ? r + c : maxK - (r + c);
        el.style.setProperty('--d', `${animate ? k * 24 : 0}ms`);
      });
      demo.dataset.state = state;
      toggles.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.demo === state)));
    };

    toggles.forEach(btn => btn.addEventListener('click', () => {
      touched = true;
      setState(btn.dataset.demo);
    }));

    setState('before', false);

    if ('IntersectionObserver' in window) {
      const dio = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return;
        dio.disconnect();
        setTimeout(() => { if (!touched) setState('after'); }, 1600);
      }, { threshold: 0.55 });
      dio.observe(demo);
    }
  }

  /* ------------------------------------------------------------------
     Tabelas dinâmicas: totais calculados + destaque de coluna
     ------------------------------------------------------------------ */
  $$('.pivot').forEach(table => {
    // Célula marcada é só um ponto visual; leitores de tela ouvem "usado".
    $$('td.on', table).forEach(td => {
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.dataset.i18n = 's.yes';
      td.appendChild(sr);
    });
    const rows = $$('tbody tr', table);
    const totals = rows.map(r => $$('td.on', r).length);
    const max = Math.max(1, ...totals);
    rows.forEach((row, i) => {
      const cell = $('td.tot', row);
      if (!cell) return;
      const bar = document.createElement('span');
      bar.className = 'bar';
      bar.style.setProperty('--w', (totals[i] / max).toFixed(3));
      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = totals[i];
      cell.replaceChildren(bar, n);
    });

    let lastCol = -1;
    const clear = () => {
      if (lastCol < 0) return;
      table.querySelectorAll('tr').forEach(tr => { if (tr.cells[lastCol]) tr.cells[lastCol].classList.remove('is-col'); });
      lastCol = -1;
    };
    table.addEventListener('mouseover', e => {
      const cell = e.target.closest('td, th');
      if (!cell || !table.contains(cell)) return;
      const idx = cell.cellIndex;
      if (idx === lastCol) return;
      clear();
      if (idx === 0) return;
      table.querySelectorAll('tr').forEach(tr => { if (tr.cells[idx]) tr.cells[idx].classList.add('is-col'); });
      lastCol = idx;
    });
    table.addEventListener('mouseleave', clear);
  });

  /* ------------------------------------------------------------------
     Durações de cada experiência (calculadas, como um =DATADIF)
     ------------------------------------------------------------------ */
  function formatDuration(total) {
    const years = Math.floor(total / 12);
    const months = total % 12;
    const parts = [];
    if (years) parts.push(`${years} ${t(years === 1 ? 'ui.year' : 'ui.years')}`);
    if (months) parts.push(`${months} ${t(months === 1 ? 'ui.month' : 'ui.months')}`);
    return parts.join(` ${t('ui.and')} `) || `1 ${t('ui.month')}`;
  }

  function updateDurations() {
    const now = new Date();
    $$('[data-since]').forEach(el => {
      const [y, m] = el.dataset.since.split('-').map(Number);
      const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) + 1;
      el.textContent = formatDuration(Math.max(1, months));
    });
    $$('[data-months]').forEach(el => { el.textContent = formatDuration(Number(el.dataset.months)); });
  }

  /* ------------------------------------------------------------------
     Currículo impresso: resumo de habilidades a partir das tabelas
     ------------------------------------------------------------------ */
  function buildPrintSkills() {
    const box = $('#printSkills');
    if (!box) return;
    const names = sel => $$(sel).map(el => el.textContent.trim()).filter(Boolean);
    const line = (label, items) => {
      const p = document.createElement('p');
      const b = document.createElement('b');
      b.textContent = `${label} `;
      p.append(b, items.join(' · '));
      return p;
    };
    box.replaceChildren(
      line(t('s.printTech'), [...names('#pivotTech tbody th'), ...names('.also .chips li')]),
      line(t('s.printDomain'), names('#pivotDomain tbody th'))
    );
  }

  /* ------------------------------------------------------------------
     Pequenos detalhes: copiar e-mail, aba "+", toast, console
     ------------------------------------------------------------------ */
  const toastEl = $('#toast');
  let toastTimer = 0;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2800);
  }

  const copyBtn = $('#copyEmail');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(EMAIL);
        toast(t('ui.copied'));
      } catch (e) {
        window.location.href = `mailto:${EMAIL}`;
      }
    });
  }

  const addTab = $('#tabAdd');
  if (addTab) {
    addTab.addEventListener('click', () => {
      toast(t('ui.newTabToast'));
      const target = $('#contato');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  }

  /* ------------------------------------------------------------------
     Inicialização
     ------------------------------------------------------------------ */
  applyLang(lang, false);
  measureCols();
  buildGutter();
  spy();

  const afterFonts = () => {
    measureCols();
    buildGutter();
    updateCellRefs();
    requestAnimationFrame(() => doc.classList.add('is-ready'));
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(afterFonts);
  else window.addEventListener('load', afterFonts);
  // Segurança: se as fontes demorarem, mostra o nome mesmo assim.
  setTimeout(() => doc.classList.add('is-ready'), 1200);

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { measureCols(); buildGutter(); updateCellRefs(); spy(); }, 120);
  });

  if ('ResizeObserver' in window) {
    let roTimer = 0;
    new ResizeObserver(() => {
      clearTimeout(roTimer);
      roTimer = setTimeout(() => { buildGutter(); updateCellRefs(); }, 150);
    }).observe(document.body);
  }

  window.addEventListener('beforeprint', buildPrintSkills);

  console.log(
    '%c=OLÁ("dev")%c\nCurioso com o código? Tudo feito à mão, sem framework.\n→ github.com/alyssom-fernandes',
    'font: 600 14px monospace; color: #14B25F;',
    'font: 12px monospace; color: inherit;'
  );
})();
