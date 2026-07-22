const lines = [
  { text: '$ iniciando_transformacao.js', cls: 'prompt' },
  { text: '> carregando perfil do aluno...' },
  { text: '> de: [qualquer profissão]' },
  { text: '> para: Desenvolvedor(a) Full Stack' },
  { text: '> status: ', inline: true },
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
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });

revealEls.forEach((el) => io.observe(el));

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
    const wheelAmount = event.deltaY || event.deltaX;
    if (!wheelAmount) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    const isAtStart = track.scrollLeft <= 1;
    const isAtEnd = track.scrollLeft >= maxScroll - 1;
    const isMovingForward = wheelAmount > 0;

    // Mantém a rolagem normal da página apenas quando não houver mais cards nessa direção.
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

// Navegação: mantém a camada elevada no último item clicado e alimenta o efeito do fundo.
const navLinks = document.querySelectorAll('.navlinks a');
let activeNavLink = null;
function emitNavPulse(link) {
  const rect = link.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent('nav-pulse', {
    detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }));
}
navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.forEach((item) => item.classList.remove('is-active'));
    link.classList.add('is-active');
    activeNavLink = link;
    emitNavPulse(link);
  });
});
// O brilho do botão e a onda no fundo continuam surgindo enquanto ele estiver selecionado.
setInterval(() => { if (activeNavLink) emitNavPulse(activeNavLink); }, 1700);

// FAQ accordion
document.querySelectorAll('.faq-item').forEach((item) => {
  const btn = item.querySelector('.faq-q');
  btn.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach((el) => el.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

// Formulário de contato (demo — sem back-end conectado ainda)
const contactForm = document.getElementById('contactForm');
if (contactForm) {
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
