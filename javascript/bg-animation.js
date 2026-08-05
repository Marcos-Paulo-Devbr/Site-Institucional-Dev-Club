(function(){
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Rastro do cursor só faz sentido com mouse/trackpad de verdade — em touch,
  // "mousemove" às vezes dispara sintético uma vez no toque e deixa um ponto
  // fantasma parado na tela.
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  const trailEnabled = !prefersReduced && hasFinePointer;

  // paleta puxada direto do :root do styles.css do DevClub
  const CYAN     = [94, 234, 212];   // --cyan
  const CYAN_DIM = [35, 41, 55];     // --line
  const AMBER    = [255, 182, 39];   // --amber

  // máscara 13x13 do emblema, extraída pixel a pixel da logo oficial.
  const MASK = [
    [1,1,1,0,1,0,1,1,1,0,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,0,1,1,1,1,1,1,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,1,0],
    [1,0,1,1,1,0,0,0,1,1,0,0,1],
    [1,0,1,0,0,1,0,1,0,0,1,0,1],
    [1,0,1,0,0,1,0,1,0,0,0,0,1],
    [0,0,1,0,0,1,0,1,0,0,0,0,1],
    [1,0,1,1,1,0,0,0,1,1,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,0,0,0,0,1,0,0,1,0,1,1,1],
    [0,1,0,0,1,0,0,1,0,0,1,0,1],
    [1,0,0,1,0,0,0,0,1,0,1,1,1],
  ];

  let W,H,DPR;
  let ambient = [];
  let comets = [];
  let logoPixels = [];
  let bursts = [];
  let navPulses = [];
  let streams = [];
  let scrollY = 0, targetScrollY = 0;
  let mouseX=-9999, mouseY=-9999;

  // Siglas reais dos módulos da formação (mesmos nomes de #formacao), na
  // ordem em que aparecem lá — surgem uma de cada vez conforme o mouse anda,
  // tipo "puxando" cada tecnologia do rastro.
  const TECH_TAGS = ['HTML','CSS','JS','React','Node','SQL','Git','API'];
  let techLabels = [];
  let lastLabelPos = null;
  let techIndex = 0;
  const LABEL_MIN_DIST = 110; // px percorridos entre uma sigla e a próxima
  const LABEL_MAX_AGE = 2600; // ms — crescimento e leitura bem mais lentos
  const LABEL_MAX_COUNT = 4; // poucos nós "imantados" por vez, tipo a referência
  let quemSomosTop = 0; // posição (em coords de documento) onde a fase 1 termina

  // ---- emblema remonta uma 2ª vez, agora no canto direito, ancorado em
  // #formacao — o alvo fica em coordenadas de documento (por isso não é
  // recalculado a cada frame) e vira tela subtraindo scrollY no draw().
  let formacaoTop = 0;
  let formacaoAnchorDoc = { x:0, y:0, size:0 };
  let formacaoLogoPixels = [];

  function updateFormacaoAnchor(){
    const el = document.getElementById('formacao');
    if(!el){ formacaoAnchorDoc = {x:0,y:0,size:0}; formacaoTop = H*4; return; }
    const rect = el.getBoundingClientRect();
    const docTop = rect.top + window.scrollY;
    const size = Math.min(200, W*0.16, H*0.24);
    const cx = W - size*0.75 - 24;
    const cy = docTop + Math.min(300, rect.height*0.22);
    formacaoAnchorDoc = { x: cx-size/2, y: cy-size/2, size };
    formacaoTop = docTop;
  }

  function buildFormacaoLogoPixels(){
    const anchor = formacaoAnchorDoc;
    const rows=MASK.length, cols=MASK[0].length, cell=anchor.size/cols;
    const cells=[]; for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) if(MASK[y][x]) cells.push({x,y});
    const order = cells.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [order[i],order[j]]=[order[j],order[i]]; }
    formacaoLogoPixels = cells.map((c,i)=>({
      targetDoc:{x:anchor.x+c.x*cell+cell/2, y:anchor.y+c.y*cell+cell/2},
      home:{x:Math.random()*W, y:Math.random()*H*2-H*0.5},
      ctrl:{x:(Math.random()-0.5)*220, y:(Math.random()-0.5)*220},
      delay: order.indexOf(i)/cells.length, size:cell*0.74,
      locked:false,
    }));
  }

  // ---- fase 1: emblema se monta aqui, ancorado dentro do hero ----
  // A âncora é cacheada: draw() a consulta a cada frame e medir o layout
  // (getBoundingClientRect) 60x por segundo custaria reflow à toa.
  let anchorRect = { x:0, y:0, size:0 };
  function logoAnchor(){ return anchorRect; }

  function updateAnchor(){
    const size = Math.min(220, W*0.18, H*0.28);
    let cx, cy;
    if(W > 900){
      // hero em 2 colunas: o .terminal ocupa a direita, então o emblema
      // centraliza na coluna esquerda do .hero-grid (medida no DOM).
      const col = document.querySelector('.hero-grid > div');
      const rect = col && col.getBoundingClientRect();
      cx = (rect && rect.width) ? rect.left + rect.width/2 : W*0.3;
      cy = H*0.36;
    } else if(W > 560){
      // ainda 2 colunas, mas apertadas: mantém à direita. H*0.28 é o teto,
      // mas nessa faixa o .terminal sobe mais rápido que a fração conforme
      // a largura encolhe, então mede o topo real e sobe mais se precisar
      // (com uma margem) pra nunca encostar nele.
      cx = W*0.74;
      const term = document.querySelector('.terminal');
      const termTop = term ? term.getBoundingClientRect().top : Infinity;
      cy = Math.min(H*0.28, termTop - 24 - size/2);
    } else {
      // coluna única: o terminal desce para baixo do texto e o topo sobra.
      cx = W*0.5; cy = H*0.22;
    }
    anchorRect = { x: cx - size/2, y: cy - size/2, size };
  }

  function findPhaseBoundary(){
    const el = document.getElementById('quem-somos');
    if(el){
      const rect = el.getBoundingClientRect();
      quemSomosTop = rect.top + window.scrollY;
    } else {
      quemSomosTop = H*1.6; // fallback se a seção não existir
    }
  }

  let lastW = -1;
  function resize(){
    const widthChanged = window.innerWidth !== lastW;
    DPR = Math.min(window.devicePixelRatio||1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    lastW = W;
    canvas.width = W*DPR; canvas.height = H*DPR;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    findPhaseBoundary();
    updateAnchor();
    updateFormacaoAnchor();
    // Só a largura reconstrói as partículas. No mobile a barra de endereço
    // some/aparece e dispara resize só de altura: reconstruir ali faria o
    // emblema se desmontar e remontar no meio da rolagem.
    if(widthChanged){
      buildAmbient();
      buildComets();
      buildLogoPixels();
      buildFormacaoLogoPixels();
      buildStreams();
    }
  }

  let resizeTimer = null;
  function onResize(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  }

  function buildAmbient(){
    const defs = [
      { speed:0.03, count:70, size:1.4, color:CYAN_DIM, alpha:0.45, orbit:6 },
      { speed:0.09, count:50, size:1.8, color:CYAN,      alpha:0.24, orbit:10 },
      { speed:0.16, count:14, size:2.0, color:AMBER,     alpha:0.32, orbit:14 },
    ];
    ambient = defs.map(layer => ({
      ...layer,
      dots: Array.from({length: layer.count}, () => ({
        x: Math.random()*W, y: Math.random()*H*3 - H,
        phase: Math.random()*Math.PI*2, vx:0, vy:0,
      })),
    }));
    const dots = ambient[1].dots;
    ambient[1].links = [];
    for(let i=0;i<dots.length;i++) for(let j=i+1;j<dots.length;j++){
      if(Math.hypot(dots[i].x-dots[j].x, dots[i].y-dots[j].y) < 140) ambient[1].links.push([i,j]);
    }
  }

  function buildComets(){ comets = Array.from({length:4}, spawnComet); }
  function spawnComet(){
    const fromLeft = Math.random()<0.5;
    return { x: fromLeft?-40:W+40, y:Math.random()*H,
      vx:(fromLeft?1:-1)*(60+Math.random()*60), vy:(Math.random()-0.5)*30,
      color: Math.random()<0.5?AMBER:CYAN, trail:[], life:0 };
  }

  function buildLogoPixels(){
    const anchor = logoAnchor();
    const rows=MASK.length, cols=MASK[0].length, cell=anchor.size/cols;
    const cells=[]; for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) if(MASK[y][x]) cells.push({x,y});
    const order = cells.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [order[i],order[j]]=[order[j],order[i]]; }
    logoPixels = cells.map((c,i)=>({
      target:{x:anchor.x+c.x*cell+cell/2, y:anchor.y+c.y*cell+cell/2},
      home:{x:Math.random()*W, y:Math.random()*H*2-H*0.5},
      ctrl:{x:(Math.random()-0.5)*260, y:(Math.random()-0.5)*260},
      delay: order.indexOf(i)/cells.length, size:cell*0.74,
      locked:false,
    }));
  }

  // ---- fase 2: fluxo de dados, roda pelo resto da página ----
  function buildStreams(){
    const count = Math.max(14, Math.round(W/90));
    streams = Array.from({length: count}, () => spawnStream(true));
  }
  function spawnStream(randomY){
    return {
      x: Math.random()*W,
      y: randomY ? Math.random()*H : -40,
      len: 40 + Math.random()*90,
      speed: 26 + Math.random()*46,
      color: Math.random()<0.25 ? AMBER : CYAN,
      alpha: 0.12 + Math.random()*0.22,
    };
  }

  function onScroll(){ targetScrollY = window.scrollY; }
  function onMouse(e){
    mouseX=e.clientX; mouseY=e.clientY;
    if(trailEnabled){
      if(!lastLabelPos || Math.hypot(mouseX-lastLabelPos.x, mouseY-lastLabelPos.y) > LABEL_MIN_DIST){
        // fica parada onde nasceu — o "ímã" é a linha até o cursor atual,
        // que vai esticando conforme o mouse se afasta.
        techLabels.push({text:TECH_TAGS[techIndex % TECH_TAGS.length], x:mouseX, y:mouseY, t:performance.now()});
        if(techLabels.length>LABEL_MAX_COUNT) techLabels.shift();
        techIndex++;
        lastLabelPos = {x:mouseX, y:mouseY};
      }
    }
  }
  function onLeave(){ mouseX=-9999; mouseY=-9999; techLabels.length=0; lastLabelPos=null; }
  function onNavPulse(e){
    if(prefersReduced) return;
    const {x,y} = e.detail;
    navPulses.push({x, y, age:0});
  }
  function easeOutBack(t){ const c1=1.4,c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); }
  function smooth(t){ return t<0?0:t>1?1:t*t*(3-2*t); }
  function smoothstep(edge0,edge1,x){
    const t = Math.max(0, Math.min(1, (x-edge0)/(edge1-edge0)));
    return t*t*(3-2*t);
  }

  let t = 0, lastTime = performance.now();
  let rafId = null;
  function draw(now){
    const dt = Math.min(0.05,(now-lastTime)/1000); lastTime = now; t += dt;
    // 0.08 foi calibrado a 60fps (dt≈1/60s); normalizado por dt pra não
    // convergir mais rápido em telas de taxa de atualização mais alta
    // (a 144Hz reagia ~2,4x mais rápido que o pretendido).
    scrollY += (targetScrollY - scrollY) * (1 - Math.pow(1 - 0.08, dt*60));

    // progresso da montagem: termina um pouco antes do topo de #quem-somos
    const assembleEnd = Math.max(200, quemSomosTop - H*0.1);
    const progress = Math.min(1, scrollY / assembleEnd);

    // mistura entre fase 1 (montagem) e fase 2 (fluxo), com uma faixa de
    // transição suave em volta do início de #quem-somos
    const phase2 = smoothstep(quemSomosTop - H*0.35, quemSomosTop + H*0.15, scrollY);
    const phase1 = 1 - phase2;

    // progresso da 2ª montagem do emblema, agora disparada pela chegada em
    // #formacao. Usa a posição real da âncora (não o topo da seção — ela é
    // ancorada mais abaixo, perto dos cards), senão a montagem terminava
    // depois que o alvo já tinha saído da tela por cima.
    const formacaoProgress = smoothstep(formacaoAnchorDoc.y - H*0.75, formacaoAnchorDoc.y - H*0.15, scrollY);

    ctx.clearRect(0,0,W,H);

    // Ondas disparadas pelos botões de navegação: continuam vivas no canvas,
    // criando a ligação entre o menu e a animação de fundo.
    navPulses = navPulses.filter(p => p.age < 1.5);
    navPulses.forEach(p => {
      p.age += dt;
      // nome próprio pra não sombrear o "progress" de montagem do emblema, acima.
      const pulseProgress = p.age / 1.5;
      const radius = 12 + pulseProgress * Math.max(W, H) * .42;
      ctx.strokeStyle = `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${(1-pulseProgress)*.18})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
    });

    const g1 = ctx.createRadialGradient(W*0.5,H*0.3,0, W*0.5,H*0.3, W*0.7);
    g1.addColorStop(0,`rgba(94,234,212,${0.06*phase1})`);
    g1.addColorStop(1,'rgba(11,14,20,0)');
    ctx.fillStyle = g1; ctx.fillRect(0,0,W,H);

    // ===== FASE 1: poeira ambiente + cometas + montagem do emblema =====
    if(phase1 > 0.01){
      ambient.forEach((layer) => {
        const offsetY = scrollY*layer.speed;
        if(layer.links && !prefersReduced){
          ctx.lineWidth = 1;
          layer.links.forEach(([i,j]) => {
            const a=layer.dots[i], b=layer.dots[j];
            const ay=((a.y-offsetY)%(H*3)+H*3)%(H*3)-H, by=((b.y-offsetY)%(H*3)+H*3)%(H*3)-H;
            if(ay<-50||ay>H+50||by<-50||by>H+50) return;
            const pulse=0.5+0.5*Math.sin(t*0.6+i*0.3);
            ctx.strokeStyle=`rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${0.05*pulse*phase1})`;
            ctx.beginPath(); ctx.moveTo(a.x,ay); ctx.lineTo(b.x,by); ctx.stroke();
          });
        }
        layer.dots.forEach(d => {
          if(!prefersReduced){
            const dx=d.x-mouseX, dy=(((d.y-offsetY)%(H*3)+H*3)%(H*3)-H)-mouseY;
            const dist=Math.hypot(dx,dy);
            if(dist<90){ const push=(1-dist/90)*1.6; d.vx+=(dx/(dist||1))*push; d.vy+=(dy/(dist||1))*push; }
          }
          d.vx*=0.9; d.vy*=0.9; d.x+=d.vx;
          let py=((d.y-offsetY)%(H*3)+H*3)%(H*3)-H; py+=d.vy;
          const ox=Math.sin(t*0.4+d.phase)*layer.orbit*0.3, oy=Math.cos(t*0.3+d.phase)*layer.orbit*0.3;
          const flicker = prefersReduced?0.7:0.55+0.45*Math.sin(t*0.7+d.phase);
          const [r,g,b]=layer.color;
          ctx.fillStyle=`rgba(${r},${g},${b},${layer.alpha*flicker*phase1})`;
          ctx.beginPath(); ctx.arc(d.x+ox,py+oy,layer.size,0,Math.PI*2); ctx.fill();
        });
      });

      if(!prefersReduced){
        comets.forEach(c => {
          c.life+=dt; c.x+=c.vx*dt; c.y+=c.vy*dt;
          c.trail.push({x:c.x,y:c.y}); if(c.trail.length>14) c.trail.shift();
          for(let i=0;i<c.trail.length;i++){
            const p=c.trail[i], a=(i/c.trail.length)*0.45, [r,g,b]=c.color;
            ctx.fillStyle=`rgba(${r},${g},${b},${a*phase1})`;
            ctx.beginPath(); ctx.arc(p.x,p.y,1.6*(i/c.trail.length),0,Math.PI*2); ctx.fill();
          }
          if(c.x<-60||c.x>W+60||c.life>30) Object.assign(c, spawnComet());
        });
      }

      logoPixels.forEach(p => {
        const raw=(progress-p.delay*0.55)/(1-p.delay*0.55);
        const local=smooth(raw);
        const eased = raw<=0?0:raw>=1?1:easeOutBack(Math.min(1,raw));
        const bx=p.home.x+(p.target.x-p.home.x)*eased;
        const byBase=p.home.y-scrollY*0.05;
        const by=byBase+(p.target.y-byBase)*eased;
        const arc=(1-local);
        const x=bx+p.ctrl.x*arc*Math.sin(local*Math.PI);
        const y=by+p.ctrl.y*arc*Math.sin(local*Math.PI);

        if(local>0.98 && !p.locked){ p.locked=true; bursts.push({x:p.target.x,y:p.target.y,age:0}); }
        if(local<0.98) p.locked=false;

        const dx=x-mouseX, dy=y-mouseY;
        const near=Math.max(0,1-Math.hypot(dx,dy)/120);
        const size=(p.size*(0.55+local*0.55)+near*3);
        const color = local<0.97 ? CYAN_DIM : CYAN;
        const [r,g,b]=color;
        const alpha=(0.4+local*0.55+near*0.25)*phase1;
        if(local>0.9){ ctx.shadowColor=`rgba(${r},${g},${b},${0.85*phase1})`; ctx.shadowBlur=8; }
        ctx.fillStyle=`rgba(${r},${g},${b},${Math.min(alpha,1)})`;
        ctx.fillRect(x-size/2,y-size/2,size,size);
        ctx.shadowBlur=0;
      });

      bursts = bursts.filter(bs=>bs.age<0.5);
      bursts.forEach(bs => {
        bs.age+=dt; const p=bs.age/0.5;
        ctx.strokeStyle=`rgba(${AMBER[0]},${AMBER[1]},${AMBER[2]},${(1-p)*0.55*phase1})`;
        ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(bs.x,bs.y,4+p*16,0,Math.PI*2); ctx.stroke();
      });
    }

    // ===== FASE 2: fluxo de dados contínuo, cobre o resto da página =====
    if(phase2 > 0.01){
      if(!prefersReduced){
        streams.forEach(s => {
          s.y += s.speed*dt;
          if(s.y - s.len > H){ Object.assign(s, spawnStream(false)); }
          const grad = ctx.createLinearGradient(s.x, s.y-s.len, s.x, s.y);
          const [r,g,b] = s.color;
          grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
          grad.addColorStop(1, `rgba(${r},${g},${b},${s.alpha*phase2})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(s.x, s.y-s.len); ctx.lineTo(s.x, s.y); ctx.stroke();
        });
      } else {
        ctx.fillStyle = `rgba(94,234,212,${0.03*phase2})`;
        ctx.fillRect(0,0,W,H);
      }

      // emblema remonta pela 2ª vez no canto direito, ancorado em #formacao —
      // mesma lógica de "voa da posição aleatória até o alvo" do hero, só que
      // o alvo acompanha o scroll (é a posição real da seção, não fixa na tela).
      if(formacaoProgress > 0.001){
        formacaoLogoPixels.forEach(p => {
          const raw=(formacaoProgress-p.delay*0.55)/(1-p.delay*0.55);
          const local=smooth(raw);
          const eased = raw<=0?0:raw>=1?1:easeOutBack(Math.min(1,raw));
          const targetX = p.targetDoc.x, targetY = p.targetDoc.y - scrollY;
          const bx=p.home.x+(targetX-p.home.x)*eased;
          const by=p.home.y+(targetY-p.home.y)*eased;
          const arc=(1-local);
          const x=bx+p.ctrl.x*arc*Math.sin(local*Math.PI);
          const y=by+p.ctrl.y*arc*Math.sin(local*Math.PI);
          if(y<-40||y>H+40) return;

          const dx=x-mouseX, dy=y-mouseY;
          const near=Math.max(0,1-Math.hypot(dx,dy)/120);
          const size=(p.size*(0.55+local*0.55)+near*3);
          const color = local<0.97 ? CYAN_DIM : CYAN;
          const [r,g,b]=color;
          const alpha=(0.4+local*0.55+near*0.25)*phase2;
          if(local>0.9){ ctx.shadowColor=`rgba(${r},${g},${b},${0.7*phase2})`; ctx.shadowBlur=7; }
          ctx.fillStyle=`rgba(${r},${g},${b},${Math.min(alpha,1)})`;
          ctx.fillRect(x-size/2,y-size/2,size,size);
          ctx.shadowBlur=0;
        });
      }
    }

    // ===== Cursor: só linhas fininhas de conexão, sem rastro/malha grosso =====
    if(trailEnabled && mouseX>-9999){
      const now = performance.now();

      // liga às partículas de fundo próximas do cursor, mesmo tom —
      // sensação de "escanear" a poeira, reforçando a leitura de circuito.
      const nearLayer = ambient[1];
      if(nearLayer){
        const offsetY = scrollY*nearLayer.speed;
        let links=0;
        for(const d of nearLayer.dots){
          if(links>=6) break;
          const py=((d.y-offsetY)%(H*3)+H*3)%(H*3)-H;
          const dx=d.x-mouseX, dy=py-mouseY, dist=Math.hypot(dx,dy);
          if(dist<140){
            links++;
            const alpha=(1-dist/140)*0.35;
            ctx.strokeStyle=`rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${alpha})`;
            ctx.lineWidth=1;
            ctx.beginPath(); ctx.moveTo(mouseX,mouseY); ctx.lineTo(d.x,py); ctx.stroke();
            ctx.fillStyle=`rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${alpha+0.3})`;
            ctx.beginPath(); ctx.arc(d.x,py,2,0,Math.PI*2); ctx.fill();
          }
        }
      }

      // nó do cursor: um pontinho simples marcando a posição
      ctx.shadowColor=`rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},0.9)`;
      ctx.shadowBlur=10;
      ctx.fillStyle=`rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},0.95)`;
      ctx.beginPath(); ctx.arc(mouseX,mouseY,2.6,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;

      // siglas das tecnologias: cada uma fica parada onde nasceu e vira uma
      // bolinha que cresce bem devagar, presa ao cursor por uma linha — tipo
      // um ímã puxando aquele ponto enquanto o mouse se afasta.
      techLabels = techLabels.filter(l => now-l.t < LABEL_MAX_AGE);
      techLabels.forEach(l => {
        const age = (now-l.t)/LABEL_MAX_AGE;
        let alpha;
        if(age<0.08) alpha = age/0.08;
        else if(age>0.78) alpha = Math.max(0, 1-(age-0.78)/0.22);
        else alpha = 1;

        const growP = Math.min(1, age/0.7);
        const eased = 1-Math.pow(1-growP,3);
        const targetR = 17;
        const r = 2 + eased*(targetR-2);

        const dist = Math.hypot(l.x-mouseX, l.y-mouseY);
        if(dist>4){
          const grad = ctx.createLinearGradient(mouseX,mouseY,l.x,l.y);
          grad.addColorStop(0, `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${alpha*0.45})`);
          grad.addColorStop(1, `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${alpha*0.12})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(mouseX,mouseY); ctx.lineTo(l.x,l.y); ctx.stroke();
        }

        ctx.shadowColor=`rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${alpha*0.7})`;
        ctx.shadowBlur=10;
        ctx.fillStyle=`rgba(11,14,20,${alpha*0.75})`;
        ctx.beginPath(); ctx.arc(l.x,l.y,r,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.strokeStyle=`rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${alpha*0.8})`;
        ctx.lineWidth=1.3;
        ctx.beginPath(); ctx.arc(l.x,l.y,r,0,Math.PI*2); ctx.stroke();

        if(r>10){
          const textAlpha = Math.min(1,(r-10)/6)*alpha;
          const fontSize = l.text.length<=3 ? 10 : l.text.length<=4 ? 9 : 7.5;
          ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle=`rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${textAlpha})`;
          ctx.fillText(l.text, l.x, l.y+0.5);
        }
      });
    }

    rafId = requestAnimationFrame(draw);
  }

  // Com a aba em segundo plano não tem por que gastar CPU/GPU redesenhando
  // o canvas — cancela o loop e só reagenda quando ela volta a ficar visível.
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){
      cancelAnimationFrame(rafId);
      rafId = null;
    } else if(rafId === null){
      rafId = requestAnimationFrame(draw);
    }
  });

  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('mousemove', onMouse);
  window.addEventListener('mouseleave', onLeave);
  window.addEventListener('nav-pulse', onNavPulse);

  // no load o layout já assentou: remede a coluna do hero. A página ainda
  // está no topo (progress ~0), então reposicionar os alvos aqui é invisível.
  window.addEventListener('load', () => {
    resize();          // canvas e âncora com as medidas finais do layout
    buildLogoPixels(); // alvos na coluna do hero já medida
    buildFormacaoLogoPixels(); // idem, agora ancorado em #formacao
  });
  resize();
  rafId = requestAnimationFrame(draw);
})();
