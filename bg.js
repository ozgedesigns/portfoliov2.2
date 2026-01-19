<script>
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".fx").forEach((wrap) => {
    const c = wrap.querySelector(".fx-c");
    if (!c) return;

    const ctx = c.getContext("2d");
    const mask = document.createElement("canvas");
    const mctx = mask.getContext("2d");
    const noise = document.createElement("canvas");
    const nctx = noise.getContext("2d");

    let dpr = Math.max(1, window.devicePixelRatio || 1);
    let W = 0, H = 0;

    // ------------------- DIALS -------------------
    const DOT_COLOR = "#FF82FA";
    const DOT_GAP = 22;
    const DOT_R = 2.0;
    const BASE_DOTS_ALPHA = 0.08;
    const REVEAL_DOTS_ALPHA = 1;

    // Trail look
    const BLUR = 22;            // tighter edges (less “big circle”)
    const MAX_STAMPS = 120;     // long trail memory
    const STAMP_STEP = 5;       // dense stamps

    // Fast follow + fast grow
    const FOLLOW = 0.65;        // higher = follows mouse faster
    const GROW_GAIN = 0.55;     // how fast size increases with speed
    const GROW_CAP = 180;       // max added size

    // Shape: stretched along velocity (this is the main fix)
    const BASE_R = 14;          // base thickness of trail
    const STRETCH = 3.4;        // how long the ellipse gets with speed
    const STRETCH_CAP = 7.0;    // max stretch multiplier

    // Disappear slowly (separate from grow)
    const FADE_A = 0.975;       // slower fade (closer to 1)
    const SHRINK_R = 0.995;     // slow shrink

    // Uneven visibility
    const NOISE_SCALE = 220;
    const NOISE_STRENGTH = 0.55;
    // --------------------------------------------

    function rebuildNoise() {
      const nw = Math.max(160, Math.floor(W / NOISE_SCALE));
      const nh = Math.max(160, Math.floor(H / NOISE_SCALE));
      noise.width = nw;
      noise.height = nh;

      const img = nctx.createImageData(nw, nh);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(Math.random() * 256);
        img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v; img.data[i+3] = 255;
      }
      nctx.putImageData(img, 0, 0);
    }

    function resize() {
      const r = wrap.getBoundingClientRect();
      W = Math.floor(r.width * dpr);
      H = Math.floor(r.height * dpr);

      c.width = W; c.height = H;
      c.style.width = r.width + "px";
      c.style.height = r.height + "px";

      mask.width = W;
      mask.height = H;

      rebuildNoise();
    }
    resize();
    window.addEventListener("resize", resize);

    // pointer state (CSS px)
    let tx = wrap.clientWidth / 2, ty = wrap.clientHeight / 2;
    let x = tx, y = ty;

    // trail stamps: {x,y, r, ang, sx, a}
    const stamps = [];
    function addStamp(px, py, r, ang, sx, a=1){
      stamps.push({ x: px, y: py, r, ang, sx, a });
      if (stamps.length > MAX_STAMPS) stamps.shift();
    }

    let lastTx = tx, lastTy = ty;
    let lastClientX = 0, lastClientY = 0, lastT = performance.now();

    function move(e){
      const p = e.touches ? e.touches[0] : e;
      const rect = wrap.getBoundingClientRect();
      tx = p.clientX - rect.left;
      ty = p.clientY - rect.top;

      const now = performance.now();
      const dt = Math.max(16, now - lastT);
      const dxC = p.clientX - lastClientX;
      const dyC = p.clientY - lastClientY;

      const speed = Math.sqrt(dxC*dxC + dyC*dyC) / dt; // px/ms
      const len = Math.max(0.001, Math.sqrt(dxC*dxC + dyC*dyC));
      const dirx = dxC / len;
      const diry = dyC / len;

      const ang = Math.atan2(diry, dirx);

      // thickness grows with speed (fast), but capped
      const grow = Math.min(GROW_CAP, speed * 1000 * GROW_GAIN);
      const r = BASE_R + grow * 0.08; // keep thickness reasonable

      // stretch multiplier grows with speed
      const sx = Math.min(STRETCH_CAP, 1 + speed * 1000 * (STRETCH / 120));

      // stamp along the path
      const ddx = tx - lastTx;
      const ddy = ty - lastTy;
      const dist = Math.sqrt(ddx*ddx + ddy*ddy);
      const steps = Math.max(1, Math.floor(dist / STAMP_STEP));

      for (let i = 1; i <= steps; i++){
        const t = i / steps;

        // tail thinner + fainter, head stronger
        const tail = 1 - t;
        const rr = r * (0.35 + 0.65 * tail);
        const aa = 0.25 + 0.75 * tail;

        // a little sideways jitter to break perfection
        const jx = (Math.random()-0.5) * 4;
        const jy = (Math.random()-0.5) * 4;

        addStamp(
          lastTx + ddx * t + jx,
          lastTy + ddy * t + jy,
          rr,
          ang,
          sx * (0.7 + 0.3 * tail),
          aa
        );
      }

      lastTx = tx; lastTy = ty;
      lastClientX = p.clientX; lastClientY = p.clientY; lastT = now;
    }

    wrap.addEventListener("mousemove", move, { passive:true });
    wrap.addEventListener("touchmove", move, { passive:true });

    function drawDots(targetCtx, alpha){
      targetCtx.save();
      targetCtx.globalAlpha = alpha;
      targetCtx.fillStyle = DOT_COLOR;
      const gap = DOT_GAP * dpr;
      const rr = DOT_R * dpr;
      for (let yy = 0; yy < H; yy += gap){
        for (let xx = 0; xx < W; xx += gap){
          targetCtx.beginPath();
          targetCtx.arc(xx, yy, rr, 0, Math.PI*2);
          targetCtx.fill();
        }
      }
      targetCtx.restore();
    }

    function drawEllipseField(){
      mctx.setTransform(1,0,0,1,0,0);
      mctx.clearRect(0,0,W,H);

      mctx.save();
      mctx.filter = `blur(${BLUR * dpr}px)`;
      mctx.globalCompositeOperation = "source-over";
      mctx.fillStyle = "rgba(0,0,0,1)";

      // fast follow
      x += (tx - x) * FOLLOW;
      y += (ty - y) * FOLLOW;

      stamps.forEach(s => {
        s.a *= FADE_A;
        s.r *= SHRINK_R;

        // drift slightly toward head (keeps it alive)
        s.x += (x - s.x) * 0.01;
        s.y += (y - s.y) * 0.01;

        mctx.globalAlpha = s.a;

        // draw an ellipse aligned to movement
        mctx.save();
        mctx.translate(s.x * dpr, s.y * dpr);
        mctx.rotate(s.ang);

        // ellipse via scale
        mctx.scale(s.sx, 1);

        mctx.beginPath();
        mctx.arc(0, 0, s.r * dpr, 0, Math.PI * 2);
        mctx.fill();
        mctx.restore();
      });

      mctx.restore();

      // prune
      for (let i = stamps.length - 1; i >= 0; i--){
        if (stamps[i].a < 0.02 || stamps[i].r < 2) stamps.splice(i, 1);
      }

      // uneven visibility (noise inside mask)
      mctx.save();
      mctx.globalCompositeOperation = "source-in";
      mctx.globalAlpha = 1;
      mctx.drawImage(noise, 0, 0, W, H);
      mctx.restore();

      // bring back some solidity so it doesn't get too broken
      mctx.save();
      mctx.globalCompositeOperation = "source-atop";
      mctx.globalAlpha = (1 - NOISE_STRENGTH) * 0.9;
      mctx.fillStyle = "rgba(0,0,0,1)";
      mctx.fillRect(0,0,W,H);
      mctx.restore();
    }

    function raf(){
      drawEllipseField();

      // base faint dots
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,W,H);
      drawDots(ctx, BASE_DOTS_ALPHA);

      // bright dots only inside mask
      ctx.save();
      drawDots(ctx, REVEAL_DOTS_ALPHA);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mask, 0, 0);
      ctx.restore();

      requestAnimationFrame(raf);
    }
    raf();
  });
});
</script>
