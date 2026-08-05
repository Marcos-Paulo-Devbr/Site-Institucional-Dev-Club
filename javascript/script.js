const lines = [
  { text: '$ iniciando_transformacao.js', cls: 'prompt' },
  { text: '> carregando perfil do aluno...' },
  { text: '> de: [qualquer profissão]' },
  { text: '> para: Desenvolvedor(a) Full Stack' },
  { text: '> status: ' },
];

const termBody = document.getElementById('termBody');
let li = 0;

function typeLine() {
  if (li >= lines.length) {
    const okLine = document.createElement('div');
    okLine.className = 'line';
    okLine.innerHTML = '<span class="ok">✓ pronto pra compilar. </span><span class="cursor"></span>';
    termBody.appendChild(okLine);
    return;
  }

  const item = lines[li];
  const div = document.createElement('div');
  div.className = 'line' + (item.cls ? ' ' + item.cls : '');
  termBody.appendChild(div);

  let i = 0;
  const speed = 22;

  function type() {
    if (i <= item.text.length) {
      div.textContent = item.text.slice(0, i);
      i++;
      setTimeout(type, speed);
    } else {
      li++;
      setTimeout(typeLine, 260);
    }
  }

  type();
}

typeLine();

const revealEls = document.querySelectorAll('.reveal');

// Vídeos de fundo (qualquer .bg-video dentro de .has-video-bg — inclui as
// seções já com vídeo real e os slots ainda em placeholder): só carregam e
// tocam quando entram no viewport (preload="none" no HTML). Pra quem prefere
// menos movimento ou está numa conexão ruim, nem isso — fica só no poster.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const netInfo = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const isSlowConnection = !!(netInfo && (netInfo.saveData || ['slow-2g', '2g', '3g'].includes(netInfo.effectiveType)));
const bgVideos = prefersReducedMotion || isSlowConnection
  ? []
  : document.querySelectorAll('.has-video-bg .bg-video');

// Cards de #formacao: mesmo branch "reveal" do observer (classList.add('in')
// + unobserve) — o stagger entre eles é só CSS (transition-delay por
// nth-child), e o respeito a prefers-reduced-motion também é só CSS
// (a media query zera opacity/transform/transition pra quem pediu).
const formacaoCards = document.querySelectorAll('#formacao .stack-card');

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.target.tagName === 'VIDEO') {
      if (e.isIntersecting) e.target.play().catch(() => {});
      else e.target.pause();
      return;
    }
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });

revealEls.forEach((el) => io.observe(el));
bgVideos.forEach((el) => io.observe(el));
formacaoCards.forEach((el) => io.observe(el));

// Carrossel da formação
function initializeCarousel(trackId, prevId, nextId, counterId) {
  const track = document.getElementById(trackId);
  const prev = document.getElementById(prevId);
  const next = document.getElementById(nextId);
  const counter = document.getElementById(counterId);

  if (!track || !prev || !next || !counter) return;

  const cards = Array.from(track.querySelectorAll('.stack-card'));
  const getStep = () => cards[0].getBoundingClientRect().width + 1;
  let wheelLocked = false;

  function updateCarousel() {
    const activeIndex = Math.round(track.scrollLeft / getStep());
    const maxScroll = track.scrollWidth - track.clientWidth;
    counter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= maxScroll - 1;
  }

  prev.addEventListener('click', () => track.scrollBy({ left: -getStep(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: getStep(), behavior: 'smooth' }));
  track.addEventListener('wheel', (event) => {
    // Rolagem vertical normal do mouse E gesto horizontal (trackpad, shift+wheel)
    // avançam o carrossel — usa o eixo dominante do gesto pra decidir a direção.
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    const isAtStart = track.scrollLeft <= 1;
    const isAtEnd = track.scrollLeft >= maxScroll - 1;
    const isMovingForward = delta > 0;

    // Só deixa a rolagem passar pra página quando não houver mais cards nessa direção —
    // assim o mouse não fica "preso" no carrossel sem conseguir continuar descendo a página.
    if ((isMovingForward && isAtEnd) || (!isMovingForward && isAtStart)) return;

    event.preventDefault();
    if (wheelLocked) return;
    wheelLocked = true;
    track.scrollBy({ left: isMovingForward ? getStep() : -getStep(), behavior: 'smooth' });
    window.setTimeout(() => { wheelLocked = false; }, 350);
  }, { passive: false });
  track.addEventListener('scroll', updateCarousel, { passive: true });
  window.addEventListener('resize', updateCarousel);
  updateCarousel();
}

initializeCarousel('stackTrack', 'stackPrev', 'stackNext', 'stackCounter');
initializeCarousel('projectsTrack', 'projectsPrev', 'projectsNext', 'projectsCounter');
initializeCarousel('companiesTrack', 'companiesPrev', 'companiesNext', 'companiesCounter');

// Navegação: mantém a camada elevada no item ativo (clique ou scroll) e
// alimenta o efeito do fundo.
const navLinks = document.querySelectorAll('.navlinks a');
let activeNavLink = null;

function emitNavPulse(link) {
  const rect = link.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent('nav-pulse', {
    detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }));
}

// O brilho do botão e a onda no fundo continuam surgindo enquanto ele estiver
// selecionado — mas só enquanto houver de fato um link ativo e a aba estiver
// visível. Antes rodava pra sempre desde o load, mesmo sem nenhum link ativo
// e com a aba em segundo plano.
let navPulseInterval = null;
function startNavPulseLoop() {
  if (navPulseInterval || !activeNavLink || document.hidden) return;
  navPulseInterval = setInterval(() => { if (activeNavLink) emitNavPulse(activeNavLink); }, 1700);
}
function stopNavPulseLoop() {
  clearInterval(navPulseInterval);
  navPulseInterval = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopNavPulseLoop();
  else startNavPulseLoop();
});

function setActiveLink(link) {
  if (!link || link === activeNavLink) return;
  navLinks.forEach((item) => item.classList.remove('is-active'));
  link.classList.add('is-active');
  activeNavLink = link;
  emitNavPulse(link);
  startNavPulseLoop();
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => setActiveLink(link));
});

// Menu mobile: abaixo de 820px .navlinks vira um drawer (ver styles.css)
// controlado por este botão, já que fica sem navegação nenhuma nessa largura.
const navToggle = document.getElementById('navToggle');
const navlinksEl = document.getElementById('navlinks');
if (navToggle && navlinksEl) {
  const closeMenu = () => {
    navlinksEl.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  };
  const openMenu = () => {
    navlinksEl.classList.add('open');
    navToggle.setAttribute('aria-expanded', 'true');
  };
  navToggle.addEventListener('click', () => {
    navlinksEl.classList.contains('open') ? closeMenu() : openMenu();
  });
  navlinksEl.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
  document.addEventListener('click', (e) => {
    if (!navlinksEl.classList.contains('open')) return;
    if (navlinksEl.contains(e.target) || navToggle.contains(e.target)) return;
    closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 820) closeMenu(); });
}

// Scrollspy: destaca o link correspondente à seção visível, não só no clique.
const sectionLinks = Array.from(navLinks)
  .map((link) => {
    const id = link.getAttribute('href');
    const section = id && id.startsWith('#') ? document.querySelector(id) : null;
    return section ? { link, section } : null;
  })
  .filter(Boolean);

if (sectionLinks.length) {
  const scrollSpy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const match = sectionLinks.find((s) => s.section === entry.target);
      if (match) setActiveLink(match.link);
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

  sectionLinks.forEach(({ section }) => scrollSpy.observe(section));
}

// Animação de contagem dos números nas estatísticas
function animateCounter(element, target, duration = 2000) {
  const suffix = element.querySelector('.u') ? element.querySelector('.u').textContent : '';

  const render = (value) => {
    element.textContent = Math.floor(value).toLocaleString('pt-BR');
    if (suffix) {
      const suffixSpan = document.createElement('span');
      suffixSpan.className = 'u';
      suffixSpan.textContent = suffix;
      element.appendChild(suffixSpan);
    }
  };

  // Baseado em tempo decorrido, não em contagem de frames — um incremento
  // fixo por frame assumia 60fps e terminava bem mais rápido em telas de
  // taxa de atualização mais alta.
  const start = performance.now();
  const animate = (now) => {
    const elapsed = now - start;
    if (elapsed < duration) {
      render((elapsed / duration) * target);
      requestAnimationFrame(animate);
    } else {
      render(target);
      element.classList.add('count-active');
    }
  };
  requestAnimationFrame(animate);
}

// Observador para iniciar a contagem quando os números entram em view
const statNumbers = document.querySelectorAll('.stat-num');
const countObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting && !entry.target.classList.contains('count-active')) {
      const text = entry.target.textContent.replace(/\D/g, '');
      const numericValue = parseInt(text) || 0;
      
      if (numericValue > 0) {
        animateCounter(entry.target, numericValue, 2500);
      }
      countObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

statNumbers.forEach((el) => countObserver.observe(el));

// FAQ accordion — max-height precisa ser o valor real do conteúdo
// (scrollHeight), senão respostas longas ficam cortadas num teto fixo.
document.querySelectorAll('.faq-item').forEach((item) => {
  const btn = item.querySelector('.faq-q');
  const answer = item.querySelector('.faq-a');
  btn.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach((el) => {
      el.classList.remove('open');
      el.querySelector('.faq-a').style.maxHeight = '';
    });
    if (!isOpen) {
      item.classList.add('open');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  });
});

// Formulário de contato (demo — sem back-end conectado ainda)
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const emailInput = contactForm.querySelector('input[type="email"]');

  if (emailInput) {
    emailInput.addEventListener('invalid', () => {
      const message = emailInput.validity.valueMissing
        ? 'Informe seu e-mail.'
        : 'Digite um endereço de e-mail válido, como nome@exemplo.com.';
      emailInput.setCustomValidity(message);
    });

    emailInput.addEventListener('input', () => {
      emailInput.setCustomValidity('');
    });
  }

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('contactNote').textContent = 'Mensagem pronta pra envio — conecte este formulário a um back-end ou serviço de e-mail.';
    contactForm.reset();
  });
}

// Newsletter (demo)
const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    newsletterForm.reset();
  });
}
