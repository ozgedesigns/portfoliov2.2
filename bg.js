
(function() {
  const canvas = document.querySelector('.fx-c');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  
  const DOT_COLOR = [255, 130, 250];
  const DOT_RADIUS = 2;
  const DOT_SPACING = 22;
  const SMOOTHING = 0.08;
  
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  let width, height;
  let canvasRect;
  let dots = [];
  let trail = [];
  let mouse = { x: 0, y: 0 };
  let smoothMouse = { x: 0, y: 0 };
  let velocity = 0;
  let isHovering = false;
  let demoActive = false;
  let demoProgress = 0;
  let hasPlayedOnce = false;
  let repeatInterval = null;
  
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
    let x, y;
    
    if (t < 0.33) {
      const segmentT = t / 0.33;
      x = width * 0.25 + (width * 0.5) * segmentT;
      y = height * 0.35;
    } else if (t < 0.66) {
      const segmentT = (t - 0.33) / 0.33;
      x = width * 0.75 - (width * 0.5) * segmentT;
      y = height * 0.35 + (height * 0.3) * segmentT;
    } else {
      const segmentT = (t - 0.66) / 0.34;
      x = width * 0.25 + (width * 0.5) * segmentT;
      y = height * 0.65;
    }
    
    return { x, y };
  }
  
  function startDemo() {
    if (demoActive) return;
    
    demoActive = true;
    demoProgress = 0;
    trail = [];
    velocity = 8;
    
    const startPos = getDemoPosition(0);
    smoothMouse.x = startPos.x;
    smoothMouse.y = startPos.y;
    mouse.x = startPos.x;
    mouse.y = startPos.y;
  }
  
  function getOpacity(dotX, dotY) {
    if (trail.length < 2) return 0;
    
    let maxOp = 0;
    const headWidth = 40 + velocity * 15;
    const tailWidth = 5 + velocity * 2;
    
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
      const taper = Math.pow(1 - progress, 0.2);
      const trailWidth = tailWidth + (headWidth - tailWidth) * taper;
      
      if (dist < trailWidth) {
        const normalizedDist = dist / trailWidth;
        const solidCore = 0.4;
        
        let edgeFade;
        if (normalizedDist < solidCore) {
          edgeFade = 1;
        } else {
          const edgeProgress = (normalizedDist - solidCore) / (1 - solidCore);
          edgeFade = Math.pow(1 - edgeProgress, 2);
        }
        
        const trailFade = Math.pow(1 - progress, 0.4);
        maxOp = Math.max(maxOp, edgeFade * trailFade);
      }
    }
    
    const velFade = Math.min(1, velocity / 5);
    return maxOp * velFade;
  }
  
  function update() {
    if (demoActive) {
      demoProgress += 0.006;
      
      if (demoProgress >= 1) {
        demoActive = false;
      } else {
        const pos = getDemoPosition(demoProgress);
        mouse.x = pos.x;
        mouse.y = pos.y;
      }
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
      velocity += (newVel - velocity) * 0.2;
    } else {
      velocity += (newVel - velocity) * 0.04;
    }
    
    if (isHovering || demoActive) {
      const dist = trail.length > 0 
        ? Math.sqrt((smoothMouse.x - trail[0].x) ** 2 + (smoothMouse.y - trail[0].y) ** 2)
        : 999;
      
      if (dist > 1) {
        trail.unshift({ x: smoothMouse.x, y: smoothMouse.y });
      }
    }
    
    const maxLen = 20 + velocity * 5;
    while (trail.length > maxLen) trail.pop();
    
    if (!demoActive && velocity < 1 && trail.length > 0) {
      trail.pop();
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
  
  if (!isTouchDevice) {
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
  }
  
  // Observe the section, not the canvas parent
  const section = document.querySelector('.sec.is-works') || parent;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // First time entering view - play demo once
        if (!hasPlayedOnce) {
          hasPlayedOnce = true;
          setTimeout(startDemo, 400);
        }
        
        // For touch devices - repeat every 6 seconds while in view
        if (isTouchDevice && !repeatInterval) {
          repeatInterval = setInterval(() => {
            if (!demoActive) startDemo();
          }, 6000);
        }
      } else {
        // Out of view - clear repeat interval
        if (repeatInterval) {
          clearInterval(repeatInterval);
          repeatInterval = null;
        }
      }
    });
  }, { 
    threshold: 0.15,
    rootMargin: '0px'
  });
  
  observer.observe(section);
  
  window.addEventListener('resize', resize);
  
  resize();
  draw();
})();
