(function() {
  const canvas = document.querySelector('.fx-c');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  
  const DOT_COLOR = [255, 130, 250];
  const DOT_RADIUS = 2;
  const DOT_SPACING = 22;
  const SMOOTHING = 0.08;
  
  let width, height;
  let canvasRect;
  let dots = [];
  let trail = [];
  let mouse = { x: 0, y: 0 };
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
  
  // Z-shape path
  function getDemoPosition(t) {
    const padding = 0.15;
    const left = width * padding;
    const right = width * (1 - padding);
    const top = height * 0.2;
    const bottom = height * 0.8;
    
    // Z shape: top-left → top-right → bottom-left → bottom-right
    if (t < 0.33) {
      // Top horizontal: left to right
      const segT = t / 0.33;
      const eased = segT < 0.5 ? 2 * segT * segT : 1 - Math.pow(-2 * segT + 2, 2) / 2;
      return {
        x: left + (right - left) * eased,
        y: top
      };
    } else if (t < 0.66) {
      // Diagonal: top-right to bottom-left
      const segT = (t - 0.33) / 0.33;
      const eased = segT;
      return {
        x: right - (right - left) * eased,
        y: top + (bottom - top) * eased
      };
    } else {
      // Bottom horizontal: left to right
      const segT = (t - 0.66) / 0.34;
      const eased = segT < 0.5 ? 2 * segT * segT : 1 - Math.pow(-2 * segT + 2, 2) / 2;
      return {
        x: left + (right - left) * eased,
        y: bottom
      };
    }
  }
  
  function startDemo() {
    if (demoPlayed || demoActive) return;
    
    demoActive = true;
    demoProgress = 0;
    trail = [];
    
    const startPos = getDemoPosition(0);
    smoothMouse.x = startPos.x;
    smoothMouse.y = startPos.y;
    mouse.x = startPos.x;
    mouse.y = startPos.y;
  }
  
  function updateDemo() {
    if (!demoActive) return;
    
    demoProgress += 0.012;
    
    if (demoProgress >= 1) {
      demoActive = false;
      demoPlayed = true;
      velocity = 0;
      return;
    }
    
    const pos = getDemoPosition(demoProgress);
    mouse.x = pos.x;
    mouse.y = pos.y;
    
    isHovering = true;
  }
  
  function getOpacity(dotX, dotY) {
    if (trail.length < 2) return 0;
    
    let maxOp = 0;
    
    const headWidth = 35 + velocity * 12;
    const tailWidth = 3 + velocity * 1;
    
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
      
      // Steeper taper for quicker size reduction
      const taper = Math.pow(1 - progress, 0.4);
      const trailWidth = tailWidth + (headWidth - tailWidth) * taper;
      
      if (dist < trailWidth) {
        const normalizedDist = dist / trailWidth;
        const solidCore = 0.3;
        
        let edgeFade;
        if (normalizedDist < solidCore) {
          edgeFade = 1;
        } else {
          const edgeProgress = (normalizedDist - solidCore) / (1 - solidCore);
          edgeFade = Math.pow(1 - edgeProgress, 2.5);
        }
        
        // Faster trail fade
        const trailFade = Math.pow(1 - progress, 0.6);
        
        maxOp = Math.max(maxOp, edgeFade * trailFade);
      }
    }
    
    const velFade = Math.min(1, velocity / 5);
    return maxOp * velFade;
  }
  
  function update() {
    if (demoActive) {
      updateDemo();
    }
    
    smoothMouse.x += (mouse.x - smoothMouse.x) * SMOOTHING;
    smoothMouse.y += (mouse.y - smoothMouse.y) * SMOOTHING;
    
    let vx = 0, vy = 0;
    if (trail.length > 0) {
      vx = smoothMouse.x - trail[0].x;
      vy = smoothMouse.y - trail[0].y;
    }
    const newVel = Math.sqrt(vx * vx + vy * vy);
    
    if (newVel > velocity) {
      velocity += (newVel - velocity) * 0.25;
    } else {
      velocity += (newVel - velocity) * 0.08;
    }
    
    if (isHovering || demoActive) {
      const dist = trail.length > 0 
        ? Math.sqrt((smoothMouse.x - trail[0].x) ** 2 + (smoothMouse.y - trail[0].y) ** 2)
        : 999;
      
      if (dist > 1) {
        trail.unshift({ x: smoothMouse.x, y: smoothMouse.y });
      }
    }
    
    // Shorter max trail length
    const maxLen = 12 + velocity * 3;
    while (trail.length > maxLen) trail.pop();
    
    // Faster trail shrink when slow
    if (velocity < 1.5 && trail.length > 2) {
      trail.pop();
      if (velocity < 0.5 && trail.length > 2) {
        trail.pop();
      }
    }
    
    if (demoActive) {
      isHovering = false;
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
    if (demoActive) return;
    
    canvasRect = parent.getBoundingClientRect();
    
    mouse.x = e.clientX - canvasRect.left;
    mouse.y = e.clientY - canvasRect.top;
    
    const wasHovering = isHovering;
    isHovering = mouse.x >= 0 && mouse.x <= width && mouse.y >= 0 && mouse.y <= height;
    
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
  
  // Check on scroll if canvas top has passed viewport center
  function checkDemoTrigger() {
    if (demoPlayed || demoActive) return;
    
    const rect = canvas.getBoundingClientRect();
    const viewportCenter = window.innerHeight / 2;
    
    // Trigger when canvas top passes the viewport center
    if (rect.top <= viewportCenter) {
      setTimeout(startDemo, 300);
    }
  }
  
  window.addEventListener('scroll', () => {
    canvasRect = parent.getBoundingClientRect();
    checkDemoTrigger();
  });
  
  window.addEventListener('resize', resize);
  
  resize();
  draw();
  
  // Check on load in case already scrolled
  checkDemoTrigger();
})();
