const lines = [
  { text: '$ iniciando_transformacao.js', cls: 'prompt' },
  { text: '> carregando perfil do aluno...' },
  { text: '> de: [qualquer profissão]' },
  { text: '> para: Desenvolvedor(a) Full Stack' },
  { text: '> tempo estimado: ~4 meses' },
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
