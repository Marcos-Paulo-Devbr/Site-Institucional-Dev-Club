(function () {
  'use strict';
  // A linha inteira de cada aluno "sai" da caixa do vídeo de fundo, na ordem
  // de leitura — como se a transformação fosse sendo contada enquanto
  // aparece: identidade antiga -> seta -> foto (com flash de brilho) -> nome
  // -> depoimento. Dispara uma vez ao entrar na tela (o vídeo fica em loop,
  // não dá pra travar num timestamp exato dele).
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var list = document.querySelector('#alunos .transform-list');
  if (!list) return;
  gsap.registerPlugin(ScrollTrigger);

  var rows = Array.from(list.querySelectorAll('.transform-row'));
  if (!rows.length) return;

  ScrollTrigger.create({
    trigger: list,
    start: 'top 85%',
    once: true,
    onEnter: function () {
      var tl = gsap.timeline();
      rows.forEach(function (row, i) {
        var before = row.querySelector('.t-before');
        var arrow = row.querySelector('.t-arrow');
        var avatar = row.querySelector('.student-avatar');
        var name = row.querySelector('.student-name');
        var quote = row.querySelector('.t-quote');
        var at = i * 0.34;

        if (before) {
          tl.fromTo(before,
            { opacity: 0, x: -16, filter: 'blur(4px)' },
            { opacity: 1, x: 0, filter: 'blur(0px)', duration: .4, ease: 'power2.out' },
            at
          );
        }
        if (arrow) {
          tl.fromTo(arrow,
            { opacity: 0, scale: .3 },
            { opacity: 1, scale: 1, duration: .35, ease: 'back.out(3)' },
            at + .16
          );
        }
        if (avatar) {
          // Flutua pra fora da caixa: sai de mais alto, sem quicar — um
          // desvio lateral leve no meio do trajeto dá a sensação de peso
          // zero, em vez de cair/saltar direto no lugar.
          var floatTl = gsap.timeline();
          floatTl
            .fromTo(avatar,
              { scale: .3, opacity: 0, y: -78, x: -6, rotate: -5, filter: 'blur(8px)' },
              { opacity: 1, filter: 'blur(0px)', duration: .35, ease: 'sine.out' },
              0
            )
            .to(avatar, { y: -30, x: 6, rotate: 3, scale: .82, duration: .55, ease: 'sine.inOut' }, 0)
            .to(avatar, { y: 0, x: 0, rotate: 0, scale: 1, duration: .55, ease: 'sine.out' }, .5);
          tl.add(floatTl, at + .26)
            .fromTo(avatar,
              { boxShadow: '0 0 46px 14px rgba(94,234,212,.85)' },
              { boxShadow: '0 0 0 3px rgba(94,234,212,.1)', duration: 1.1, ease: 'power2.out' },
              at + .26
            )
            // flutuação contínua e sutil depois de acomodar, pra reforçar a
            // sensação de leveza mesmo parado
            .to(avatar, {
              y: -5, duration: 1.8, ease: 'sine.inOut', repeat: -1, yoyo: true
            }, at + 1.1);
        }
        if (name) {
          tl.fromTo(name,
            { opacity: 0, x: 12, filter: 'blur(4px)' },
            { opacity: 1, x: 0, filter: 'blur(0px)', duration: .4, ease: 'power2.out' },
            at + .5
          );
        }
        if (quote) {
          tl.fromTo(quote,
            { opacity: 0, y: 14, filter: 'blur(5px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: .55, ease: 'power2.out' },
            at + .66
          );
        }
      });
    }
  });
})();
