(function() {
  const canvas = document.querySelector('.fx-c');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  
  const DOT_COLOR = [255, 130, 250];
  const DOT_RADIUS = 1;
  const DOT_SPACING = 24;
  const SMOOTHING = 0.06;
  const GLOW_RADIUS = 120;
  
  let width, height;
  let canvasRect;
  let dots = [];
  let trail = [];
  let mouse = { x: 0, y: 0 };
  let clientMouse = { x: 0, y: 0 };
  let smoothMouse = { x: 0, y: 0 };
  let velocity = 0;
  let isHovering = false;
  let demoPlayed = false;
  let demoActive = false;
  let demoProgress = 0;
  
  function resize() {
    const rect = parent.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvasRect = rect;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    dots = [];
    const cols = Math.ceil(width / DOT_SPACING) + 1;
    const rows = Math.ceil(height / DOT_SPACING) + 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        dots.push({
          x: col * DOT_SPACING,
          y: row * DOT_SPACING
        });
      }
    }
  }
  
  function getDemoPosition(t) {
    const padding = 0.15;
    const left = width * padding;
    const right = width * (1 - padding);
    const top = height * 0.2;
    const bottom = height * 0.8;
    
    if (t < 0.33) {
      const segT = t / 0.33;
      const eased = segT < 0.5 ? 2 * segT * segT : 1 - Math.pow(-2 * segT + 2, 2) / 2;
      return { x: left + (right - left) * eased, y: top };
    } else if (t < 0.66) {
      const segT = (t - 0.33) / 0.33;
      return { x: right - (right - left) * segT, y: top + (bottom - top) * segT };
    } else {
      const segT = (t - 0.66) / 0.34;
      const eased = segT < 0.5 ? 2 * segT * segT : 1 - Math.pow(-2 * segT + 2, 2) / 2;
      return { x: left + (right - left) * eased, y: bottom };
    }
  }
  
  function startDemo() {
    if (demoPlayed || demoActive) return;
    demoActive = true;
    demoProgress = 0;
    trail = [];
    velocity = 5;
    const startPos = getDemoPosition(0);
    smoothMouse.x = startPos.x;
    smoothMouse.y = startPos.y;
    mouse.x = startPos.x;
    mouse.y = startPos.y;
  }
  
  let demoFading = false;

  function updateDemo() {
    if (!demoActive) return;
    demoProgress += 0.015;
    if (demoProgress >= 1) {
      demoActive = false;
      demoPlayed = true;
      demoFading = true;
      return;
    }
    const pos = getDemoPosition(demoProgress);
    mouse.x = pos.x;
    mouse.y = pos.y;
  }
  
  function updateMousePosition() {
    canvasRect = parent.getBoundingClientRect();
    mouse.x = clientMouse.x - canvasRect.left;
    mouse.y = clientMouse.y - canvasRect.top;
    isHovering = mouse.x >= 0 && mouse.x <= width && mouse.y >= 0 && mouse.y <= height;
  }
  
  function getOpacity(dotX, dotY) {
    let maxOp = 0;
    
    // Static glow around cursor
    if (isHovering || demoActive) {
      const dx = dotX - smoothMouse.x;
      const dy = dotY - smoothMouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < GLOW_RADIUS) {
        const glowOp = Math.pow(1 - dist / GLOW_RADIUS, 2) * 0.5;
        maxOp = Math.max(maxOp, glowOp);
      }
    }
    
    // Trail effect
    if (trail.length >= 2) {
      const headWidth = 30 + velocity * 8;
      const tailWidth = 2;
      
      for (let i = 0; i < trail.length - 1; i++) {
        const p1 = trail[i];
        const p2 = trail[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;
        
        let t = ((dotX - p1.x) * dx + (dotY - p1.y) * dy) / (len * len);
        t = Math.max(0, Math.min(1, t));
        
        const nearX = p1.x + t * dx;
        const nearY = p1.y + t * dy;
        const dist = Math.sqrt((dotX - nearX) ** 2 + (dotY - nearY) ** 2);
        const progress = (i + t) / trail.length;
        const taper = Math.pow(1 - progress, 0.8);
        const trailWidth = tailWidth + (headWidth - tailWidth) * taper;
        
        if (dist < trailWidth) {
          const normalizedDist = dist / trailWidth;
          const solidCore = 0.2;
          let edgeFade = normalizedDist < solidCore ? 1 : Math.pow(1 - (normalizedDist - solidCore) / (1 - solidCore), 3);
          const trailFade = Math.pow(1 - progress, 0.6);
          maxOp = Math.max(maxOp, edgeFade * trailFade * Math.min(1, velocity / 4));
        }
      }
    }
    
    return maxOp;
  }
  
  function update() {
    if (demoActive) updateDemo();
    
    smoothMouse.x += (mouse.x - smoothMouse.x) * SMOOTHING;
    smoothMouse.y += (mouse.y - smoothMouse.y) * SMOOTHING;
    
    let vx = 0, vy = 0;
    if (trail.length > 0) {
      vx = smoothMouse.x - trail[0].x;
      vy = smoothMouse.y - trail[0].y;
    }
    const newVel = Math.sqrt(vx * vx + vy * vy);
    velocity += (newVel - velocity) * (newVel > velocity ? 0.3 : 0.15);
    
    if (isHovering || demoActive) {
      const dist = trail.length > 0 ? Math.sqrt((smoothMouse.x - trail[0].x) ** 2 + (smoothMouse.y - trail[0].y) ** 2) : 999;
      if (dist > 1) trail.unshift({ x: smoothMouse.x, y: smoothMouse.y });
    }
    
    const maxLen = 15 + velocity * 3;
    while (trail.length > maxLen) trail.pop();
    if (velocity < 2 && trail.length > 2) trail.pop();
    
    // Gradual fade after demo
    if (demoFading && trail.length > 0) {
      trail.pop();
      if (trail.length === 0) demoFading = false;
    }
  }
  
  function draw() {
    ctx.clearRect(0, 0, width, height);
    update();
    
    for (const dot of dots) {
      const op = getOpacity(dot.x, dot.y);
      if (op > 0.01) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${DOT_COLOR[0]},${DOT_COLOR[1]},${DOT_COLOR[2]},${op})`;
        ctx.fill();
      }
    }
    
    requestAnimationFrame(draw);
  }
  
  document.addEventListener('mousemove', (e) => {
    clientMouse.x = e.clientX;
    clientMouse.y = e.clientY;
    
    if (demoActive) return;
    
    const wasHovering = isHovering;
    updateMousePosition();
    
    if (isHovering && !wasHovering) {
      smoothMouse.x = mouse.x;
      smoothMouse.y = mouse.y;
      trail = [];
    }
    if (!isHovering && wasHovering) {
      velocity = 0;
      trail = [];
    }
  });
  
  window.addEventListener('scroll', () => {
    if (demoActive) return;
    updateMousePosition();
  });
  
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.create({
    trigger: '#works',
    start: 'top center',
    once: true,
    onEnter: startDemo
  });
  
  window.addEventListener('resize', resize);
  resize();
  draw();
})();
