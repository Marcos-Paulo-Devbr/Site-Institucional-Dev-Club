(function () {
  'use strict';

  // Sequência cinematográfica do herói: 6 clipes (caixa de ferramentas abrindo,
  // um módulo por "ferramenta", caixa fechando) renderizados quadro a quadro
  // num canvas, com a rolagem controlando o progresso via GSAP ScrollTrigger.
  // Só ativa em telas grandes, sem prefers-reduced-motion e sem conexão lenta —
  // fora disso o CSS já mostra a fase 0 (herói real) parada, sem pin nem canvas.
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' || typeof Lenis === 'undefined') return;

  var heroEl = document.getElementById('heroCinematic');
  var canvas = document.getElementById('heroCanvas');
  if (!heroEl || !canvas) return;

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isWideEnough = window.matchMedia('(min-width: 821px)').matches;
  var netInfo = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var isSlowConnection = !!(netInfo && (netInfo.saveData || ['slow-2g', '2g', '3g'].includes(netInfo.effectiveType)));

  if (prefersReducedMotion || !isWideEnough || isSlowConnection) return;

  gsap.registerPlugin(ScrollTrigger);

  // Lenis fica escopado a este mesmo cenário (desktop + movimento permitido):
  // seu propósito aqui é suavizar a rolagem que controla o scrub do canvas.
  var lenis = new Lenis({ duration: 1.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);
  document.documentElement.style.scrollBehavior = 'auto';

  var BASE = 'arquivos/hero-sequence/';
  // 12fps / 1280px (mesma largura do _web.mp4 de origem — evita esticar uma
  // imagem menor e borrar) — subiu de 8fps/960px porque em telas grandes
  // ficava visivelmente borrado e com passos perceptíveis entre quadros.
  var CLIPS = [
    { key: 'hero-open', frames: 97, phase: 0 },
    { key: 'modulo-html-css', frames: 97, phase: 1 },
    { key: 'modulo-javascript', frames: 97, phase: 2 },
    { key: 'modulo-react', frames: 97, phase: 3 },
    { key: 'modulo-nodejs', frames: 97, phase: 4 },
    { key: 'case-final', frames: 97, phase: 5 }
  ];
  var TOTAL_FRAMES = CLIPS.reduce(function (a, c) { return a + c.frames; }, 0);

  CLIPS.forEach(function (clip) {
    clip.images = new Array(clip.frames);
    clip.loadedCount = 0;
    clip.loading = false;
  });

  function frameSrc(clip, i) {
    var n = String(i + 1).padStart(3, '0');
    return BASE + clip.key + '/f' + n + '.jpg';
  }

  function loadClip(clipIndex, onDone) {
    var clip = CLIPS[clipIndex];
    if (!clip || clip.loadedCount === clip.frames) { if (onDone) onDone(); return; }
    if (clip.loading) return;
    clip.loading = true;
    var remaining = clip.frames;
    for (var i = 0; i < clip.frames; i++) {
      (function (i) {
        var img = new Image();
        img.onload = function () {
          clip.loadedCount++;
          remaining--;
          // Se essa imagem é justamente o quadro que a rolagem pede agora
          // (usuário parou de rolar num quadro que ainda não tinha chegado),
          // redesenha na hora em vez de esperar o próximo tick de scroll.
          if (scrollTriggerInstance) {
            var live = resolveFrame(scrollTriggerInstance.progress);
            if (live.clipIndex === clipIndex && live.frameIndex === i) drawFrame(clipIndex, i);
          }
          if (remaining === 0) { clip.loading = false; if (onDone) onDone(); }
        };
        img.onerror = function () {
          clip.loadedCount++;
          remaining--;
          if (remaining === 0) { clip.loading = false; if (onDone) onDone(); }
        };
        img.src = frameSrc(clip, i);
        clip.images[i] = img;
      })(i);
    }
  }

  var ctx = canvas.getContext('2d');
  // Mesmo teto usado em bg-animation.js: em telas HiDPI (DPR 2-3) os quadros
  // de 1280px já esticam bastante — deixar o cap em 2 ampliava ainda mais
  // essa esticada e piorava o borrado.
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  var lastDrawn = { clipIndex: 0, frameIndex: 0 };

  function drawFrame(clipIndex, frameIndex) {
    var clip = CLIPS[clipIndex];
    var img = clip.images[frameIndex];
    if (!img || !img.complete || !img.naturalWidth) {
      var fb = CLIPS[lastDrawn.clipIndex].images[lastDrawn.frameIndex];
      if (fb && fb.complete && fb.naturalWidth) { img = fb; } else { return; }
    } else {
      lastDrawn = { clipIndex: clipIndex, frameIndex: frameIndex };
    }
    var cw = canvas.width, ch = canvas.height;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var scale = Math.max(cw / iw, ch / ih);
    var dw = iw * scale, dh = ih * scale;
    var dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function resolveFrame(progress) {
    var globalIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.floor(progress * TOTAL_FRAMES)));
    var idx = globalIndex;
    for (var c = 0; c < CLIPS.length; c++) {
      if (idx < CLIPS[c].frames) return { clipIndex: c, frameIndex: idx };
      idx -= CLIPS[c].frames;
    }
    var last = CLIPS.length - 1;
    return { clipIndex: last, frameIndex: CLIPS[last].frames - 1 };
  }

  var phaseEls = Array.prototype.slice.call(heroEl.querySelectorAll('.hero-phase'));
  var activePhase = 0;

  function setActivePhase(phase) {
    if (phase === activePhase) return;
    activePhase = phase;
    phaseEls.forEach(function (el) {
      var p = parseInt(el.getAttribute('data-phase'), 10);
      el.classList.toggle('is-active', p === phase);
    });
  }

  var scrollHint = document.getElementById('heroScrollHint');

  function onProgress(progress) {
    var f = resolveFrame(progress);
    // Carrega o clipe atual sob demanda (no-op se já carregado/carregando) —
    // cobre saltos grandes de rolagem que pulariam o pré-carregamento sequencial.
    loadClip(f.clipIndex);
    drawFrame(f.clipIndex, f.frameIndex);
    setActivePhase(CLIPS[f.clipIndex].phase);
    if (scrollHint) scrollHint.style.opacity = progress > 0.02 ? '0' : '1';
    var clip = CLIPS[f.clipIndex];
    if (f.frameIndex > clip.frames * 0.5 && f.clipIndex + 1 < CLIPS.length) {
      loadClip(f.clipIndex + 1);
    }
  }

  var scrollTriggerInstance = null;

  function activate() {
    heroEl.classList.add('is-sequenced');
    ScrollTrigger.refresh();
    resizeCanvas();
    drawFrame(0, 0);

    scrollTriggerInstance = ScrollTrigger.create({
      trigger: heroEl,
      start: 'top top',
      end: 'bottom bottom',
      pin: heroEl.querySelector('.hero-cinematic-pin'),
      pinSpacing: false,
      scrub: 0.2,
      onUpdate: function (self) { onProgress(self.progress); },
      onRefresh: function (self) { onProgress(self.progress); }
    });

    window.addEventListener('resize', function () {
      resizeCanvas();
      if (scrollTriggerInstance) onProgress(scrollTriggerInstance.progress);
    });

    loadClip(1);
  }

  var activated = false;
  function activateOnce() {
    if (activated) return;
    activated = true;
    activate();
  }

  loadClip(0, activateOnce);
  // Se a rede travar no meio do carregamento do primeiro clipe, ativa mesmo
  // assim depois de um tempo — melhor um quadro estático do que nunca rolar.
  setTimeout(activateOnce, 4000);
})();
