(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasScrollTrigger = typeof ScrollTrigger !== 'undefined';
  if (hasScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  var hero = document.querySelector('.hero');
  if (!hero) return;

  // Fundo cinematográfico atrás do herói — um elemento novo, não mexe em
  // nada que já existia na página (zero risco de conflitar com o .reveal
  // e as outras animações já prontas em cada exemplo).
  var backdrop = document.createElement('div');
  backdrop.className = 'hero-cinema-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  hero.insertBefore(backdrop, hero.firstChild);

  if (!prefersReducedMotion && hasScrollTrigger) {
    gsap.to(backdrop, {
      yPercent: 16,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
    });
  }

  if (prefersReducedMotion) return;

  // Tilt/entrada cinematográfica só no mockup de imagem única (.preview-img).
  // A loja virtual usa .preview, que já tem seu próprio .reveal — mexer nela
  // aqui brigaria com a transição CSS que já existe lá.
  var mockup = hero.querySelector('.preview-img');
  if (!mockup) return;

  // Toca assim que a página carrega — sem scrollTrigger. Com scrollTrigger
  // start:'top 90%', em heróis mais altos (título + texto grandes empurrando
  // a imagem pra baixo) o mockup só entrava depois que o usuário já tinha
  // rolado, dando a impressão de atraso no primeiro carregamento.
  gsap.fromTo(mockup,
    { autoAlpha: 0, y: 40, rotateX: 8, scale: .97, transformPerspective: 1000, transformOrigin: 'center top' },
    { autoAlpha: 1, y: 0, rotateX: 0, scale: 1, duration: .9, ease: 'power3.out', delay: .15 }
  );

  if (hasScrollTrigger) {
    gsap.to(mockup, {
      rotateX: -5,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
    });
  }
})();
