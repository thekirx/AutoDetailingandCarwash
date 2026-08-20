import './PpfInstallSequence.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* On iOS the URL bar collapsing mid-scroll fires a resize, which would
   otherwise refresh every trigger and recalculate the pin while the finger
   is still moving. That recalculation is the single worst source of mobile
   stutter here. */
ScrollTrigger.config({ ignoreMobileResize: true });

/* Frame sequence -------------------------------------------------------- */
const FRAME_COUNT = 181;
const DESKTOP_DIR = "/ppf-frames/desktop";
const MOBILE_DIR = "/ppf-frames/mobile";
const MOBILE_QUERY = "(max-width: 767px)";

/* Every Nth frame is fetched first. Once these are in we have a coarse but
   complete pass of the whole clip, so the pin can be created immediately
   and the rest fills in underneath. */
const PRIMER_STRIDE = 15;

const framePath = (dir, i) =>
  `${dir}/ppf_${String(i + 1).padStart(3, "0")}.webp`;

export default function PpfInstallSequence({ onProgress }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const framesRef = useRef([]);
  const drawnRef = useRef(-1);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const boxRef = useRef({ w: 0, h: 0, dpr: 0 });
  const onProgressRef = useRef(onProgress);

  const [inView, setInView] = useState(false);
  const [primed, setPrimed] = useState(false);
  const [loadPct, setLoadPct] = useState(0);

  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  /* Nearest decoded frame, so a partially loaded sequence degrades to a
     coarser animation instead of freezing on a stale image. */
  const nearestLoaded = useCallback((index) => {
    const frames = framesRef.current;
    if (frames[index]) return index;
    for (let step = 1; step < FRAME_COUNT; step += 1) {
      if (frames[index - step]) return index - step;
      if (frames[index + step]) return index + step;
    }
    return -1;
  }, []);

  /* ---- draw ------------------------------------------------------------ */
  const paint = useCallback((index) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const slot = nearestLoaded(index);
    if (slot < 0) return;
    const frame = framesRef.current[slot];

    if (!ctxRef.current) ctxRef.current = canvas.getContext("2d", { alpha: false });
    const ctx = ctxRef.current;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const box = boxRef.current;

    // Resizing the backing store clears it and is expensive — only touch it
    // when the box actually changed.
    if (box.w !== w || box.h !== h || box.dpr !== dpr) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      boxRef.current = { w, h, dpr };
    }

    const fw = frame.width;
    const fh = frame.height;
    const scale = Math.max(w / fw, h / fh); // cover
    const dw = fw * scale;
    const dh = fh * scale;
    ctx.drawImage(frame, (w - dw) / 2, (h - dh) / 2, dw, dh);
    drawnRef.current = index;
  }, [nearestLoaded]);

  /* One draw per animation frame, and only when the index actually moved.
     Without this the scrub fires far more often than the display refreshes. */
  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const idx = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.round(progressRef.current * (FRAME_COUNT - 1)))
      );
      if (idx === drawnRef.current) return;
      paint(idx);
      // Notify at frame granularity rather than on every scroll event —
      // this drives caption state in the parent, and re-rendering it
      // hundreds of times per scroll is wasted work.
      onProgressRef.current?.(progressRef.current);
    });
  }, [paint]);

  /* ---- start fetching only once the section is worth paying for --------- */
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    /* The sequence is ~9 MB on desktop and ~5.5 MB on mobile. Fetching it on
       mount bills every visitor for it, including the ones who bounce from the
       hero. The margin is tuned to clear the hero and no more: the section
       sits roughly three quarters of a viewport below the fold, so anyone who
       starts scrolling still gets the ceramic section's worth of lead time
       before the pin engages — and an un-primed sequence is a poster, not a
       hole. */
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setInView(true);
      },
      { rootMargin: '80% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ---- decode frames to ImageBitmap ------------------------------------ */
  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const dir = isMobile ? MOBILE_DIR : DESKTOP_DIR;
    const frames = new Array(FRAME_COUNT);
    framesRef.current = frames;
    let done = 0;

    // Decoding to ImageBitmap moves the expensive work off the paint path —
    // drawImage then has nothing left to decode mid-scroll, which is where
    // the stutter came from.
    const load = async (i) => {
      if (frames[i]) return;
      try {
        const res = await fetch(framePath(dir, i), { cache: "force-cache" });
        const blob = await res.blob();
        frames[i] = await createImageBitmap(blob);
      } catch {
        const img = new Image();
        img.decoding = "async";
        img.src = framePath(dir, i);
        try { await img.decode(); } catch { /* leave slot empty */ }
        frames[i] = img;
      }
      if (cancelled) return;
      done += 1;
      setLoadPct(Math.round((done / FRAME_COUNT) * 100));
    };

    const drain = async (queue, concurrency) => {
      const workers = Array.from({ length: concurrency }, async () => {
        while (queue.length && !cancelled) await load(queue.shift());
      });
      await Promise.all(workers);
    };

    (async () => {
      // First and last frames first so the poster is correct immediately.
      await Promise.all([load(0), load(FRAME_COUNT - 1)]);
      if (cancelled) return;
      paint(0);

      // A sparse pass over the whole clip. As soon as this is in, every
      // scroll position has a frame within PRIMER_STRIDE, so the pin can be
      // built and the section stops changing the page height later on.
      const primer = [];
      for (let i = PRIMER_STRIDE; i < FRAME_COUNT - 1; i += PRIMER_STRIDE) primer.push(i);
      await drain(primer, 6);
      if (cancelled) return;
      setPrimed(true);

      const rest = Array.from({ length: FRAME_COUNT }, (_, i) => i).filter((i) => !frames[i]);
      await drain(rest, 6);
    })();

    return () => {
      cancelled = true;
      frames.forEach((f) => f?.close?.());
      framesRef.current = [];
    };
  }, [paint, inView]);

  /* ---- scroll wiring --------------------------------------------------- */
  useLayoutEffect(() => {
    if (!primed) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;

    const ctx = gsap.context(() => {
      if (reduced) {
        progressRef.current = 1;
        paint(FRAME_COUNT - 1);
        onProgressRef.current?.(1);
        return;
      }

      const trigger = ScrollTrigger.create({
        trigger: rootRef.current.closest("[data-ppf-stage]") || rootRef.current,
        start: "top top",
        end: isMobile ? "+=260%" : "+=340%",
        pin: rootRef.current.closest("[data-ppf-pin]") || stageRef.current,
        pinSpacing: true,
        anticipatePin: 1,
        // Fractional scrub eases the playhead toward the scroll position
        // instead of snapping to it — this is what reads as "smooth".
        scrub: isMobile ? 0.45 : 0.75,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          progressRef.current = self.progress;
          scheduleDraw();
        },
      });
      return () => trigger.kill();
    }, rootRef);

    // Repaint on resize, but debounced and only when the box really changed —
    // a raw resize listener repaints on every intermediate pixel.
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const box = boxRef.current;
        if (box.w === canvas.clientWidth && box.h === canvas.clientHeight) return;
        paint(drawnRef.current < 0 ? 0 : drawnRef.current);
      }, 150);
    };
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      ctx.revert();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [primed, paint, scheduleDraw]);

  return (
    <div ref={rootRef} className="ppf-sequence">
      <div ref={stageRef} className="ppf-stage">
        <canvas
          ref={canvasRef}
          className="ppf-canvas"
          role="img"
          aria-label="Paint protection film being applied to a pickup truck at Hakum Auto Care"
        />
        {/* Frame 0 is already painted underneath, so an un-primed sequence looks
            like a poster rather than a broken section. A percentage read-out
            here only advertises the wait — a hairline bar is enough, and it
            goes as soon as the sparse pass makes the whole clip scrubbable. */}
        {!primed && (
          <div className="ppf-loading" role="status" aria-live="polite">
            <span className="ppf-loading-bar">
              <span className="ppf-loading-fill" style={{ width: `${loadPct}%` }} />
            </span>
            <span className="sr-only">Preparing the install sequence — {loadPct}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
