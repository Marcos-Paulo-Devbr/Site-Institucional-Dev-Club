(function(){
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // paleta puxada direto do :root do styles.css do DevClub
  const CYAN     = [94, 234, 212];   // --cyan
  const CYAN_DIM = [35, 41, 55];     // --line
  const AMBER    = [255, 182, 39];   // --amber

  // máscara 13x13 do emblema, extraída pixel a pixel da logo enviada.
  const MASK = [
    '1110101110101',
    '1010000000001',
    '1110111111101',
    '0000000000000',
    '1011100011001',
    '1010010100101',
    '1010010100001',
    '0010010100001',
    '1011100011101',
    '0000000000000',
    '1000010010111',
    '0100100100101',
    '1001000010111',
  ].map(row => row.split('').map(Number));

  let W,H,DPR;
  let ambient = [];
  let comets = [];
  let logoPixels = [];
  let bursts = [];
  let navPulses = [];
  let streams = [];
  let scrollY = 0, targetScrollY = 0;
  let mouseX=-9999, mouseY=-9999;
  let quemSomosTop = 0; // posição (em coords de documento) onde a fase 1 termina

  // ---- fase 1: emblema se monta aqui, ancorado dentro do hero ----
  function logoAnchor(){
    const size = Math.min(220, W*0.18, H*0.28);
    return { x: W*0.74 - size/2, y: H*0.36 - size/2, size };
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

  function resize(){
    DPR = Math.min(window.devicePixelRatio||1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W*DPR; canvas.height = H*DPR;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    findPhaseBoundary();
    buildAmbient();
    buildComets();
    buildLogoPixels();
    buildStreams();
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
      wobblePhase:Math.random()*Math.PI*2, locked:false,
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
  function onMouse(e){ mouseX=e.clientX; mouseY=e.clientY; }
  function onLeave(){ mouseX=-9999; mouseY=-9999; }
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
  function draw(now){
    const dt = Math.min(0.05,(now-lastTime)/1000); lastTime = now; t += dt;
    scrollY += (targetScrollY - scrollY) * 0.08;

    // progresso da montagem: termina um pouco antes do topo de #quem-somos
    const assembleEnd = Math.max(200, quemSomosTop - H*0.1);
    const progress = Math.min(1, scrollY / assembleEnd);

    // mistura entre fase 1 (montagem) e fase 2 (fluxo), com uma faixa de
    // transição suave em volta do início de #quem-somos
    const phase2 = smoothstep(quemSomosTop - H*0.35, quemSomosTop + H*0.15, scrollY);
    const phase1 = 1 - phase2;

    ctx.clearRect(0,0,W,H);

    // Ondas disparadas pelos botões de navegação: continuam vivas no canvas,
    // criando a ligação entre o menu e a animação de fundo.
    navPulses = navPulses.filter(p => p.age < 1.5);
    navPulses.forEach(p => {
      p.age += dt;
      const progress = p.age / 1.5;
      const radius = 12 + progress * Math.max(W, H) * .42;
      ctx.strokeStyle = `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${(1-progress)*.18})`;
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

      const anchor = logoAnchor();
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

      // emblema permanece como marca-d'água discreta na fase 2
      const anchor = logoAnchor();
      const rows=MASK.length, cols=MASK[0].length, cell=anchor.size/cols;
      ctx.fillStyle = `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${0.10*phase2})`;
      for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) if(MASK[y][x]){
        ctx.fillRect(anchor.x+x*cell+1, anchor.y+y*cell+1, cell-2, cell-2);
      }
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('mousemove', onMouse);
  window.addEventListener('mouseleave', onLeave);
  window.addEventListener('nav-pulse', onNavPulse);

  window.addEventListener('load', findPhaseBoundary);
  resize();
  requestAnimationFrame(draw);
})();
