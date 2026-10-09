import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./AuroraBackground.css";

const BLOBS = ["push", "pull", "leg", "cardio"];

// Tune these pixel values to change cursor drift and the temporary scroll push.
const MOUSE_STRENGTH = 16;
const SCROLL_STRENGTH = 14;

// tone: "Push" | "Pull" | "Leg" | "Cardio" | "Other" | undefined
export default function AuroraBackground({ children, active = false, tone }) {
  const toneKey = tone ? String(tone).toLowerCase() : undefined;
  const rootRef = useRef(null);
  const glowRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const glow = glowRef.current;
    if (!root || !glow) return;

    const blobs = Array.from(glow.querySelectorAll(".aurora__blob"));
    const pointerMedia = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scrollTarget = root.closest(".swipe-deck-page") || window;
    const positions = blobs.map(() => ({ x: 0, y: 0 }));
    const depths = blobs.map(
      (blob) => Number.parseFloat(getComputedStyle(blob).getPropertyValue("--depth")) || 0,
    );
    let pointerX = 0;
    let pointerY = 0;
    let scrollKick = 0;
    let frame = 0;
    let previousTime = 0;
    let lastScrollPosition =
      scrollTarget === window ? window.scrollY : scrollTarget.scrollTop;
    let visible = !document.hidden;

    const canReact = () => visible && !motionMedia.matches;

    const schedule = () => {
      if (!frame && canReact()) frame = window.requestAnimationFrame(tick);
    };

    const tick = (time) => {
      frame = 0;
      const delta = Math.min(time - (previousTime || time), 64);
      previousTime = time;
      const easing = 1 - Math.exp(-delta / 190);
      scrollKick *= Math.exp(-delta / 260);
      let needsMoreFrames = Math.abs(scrollKick) > 0.05;

      blobs.forEach((blob, index) => {
        const depth = depths[index];
        const targetX = pointerX * MOUSE_STRENGTH * depth;
        const targetY = pointerY * MOUSE_STRENGTH * depth + scrollKick * depth;
        const position = positions[index];
        position.x += (targetX - position.x) * easing;
        position.y += (targetY - position.y) * easing;
        if (Math.abs(targetX - position.x) > 0.08 || Math.abs(targetY - position.y) > 0.08) {
          needsMoreFrames = true;
        } else {
          position.x = targetX;
          position.y = targetY;
        }
        blob.style.setProperty("--react-x", `${position.x.toFixed(2)}px`);
        blob.style.setProperty("--react-y", `${position.y.toFixed(2)}px`);
      });

      if (needsMoreFrames && canReact()) schedule();
      else previousTime = 0;
    };

    const onPointerMove = (event) => {
      if (!pointerMedia.matches || motionMedia.matches) return;
      pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    };

    const onScroll = () => {
      const position =
        scrollTarget === window ? window.scrollY : scrollTarget.scrollTop;
      const delta = position - lastScrollPosition;
      lastScrollPosition = position;
      scrollKick = Math.max(
        -SCROLL_STRENGTH,
        Math.min(SCROLL_STRENGTH, scrollKick + delta * 0.08),
      );
      schedule();
    };

    const onVisibilityChange = () => {
      visible = !document.hidden;
      if (!visible && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else {
        schedule();
      }
    };

    const onMediaChange = () => {
      if (motionMedia.matches && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        blobs.forEach((blob) => {
          blob.style.setProperty("--react-x", "0px");
          blob.style.setProperty("--react-y", "0px");
        });
        positions.forEach((position) => {
          position.x = 0;
          position.y = 0;
        });
        scrollKick = 0;
      } else {
        schedule();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionMedia.addEventListener("change", onMediaChange);
    pointerMedia.addEventListener("change", onMediaChange);
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      scrollTarget.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionMedia.removeEventListener("change", onMediaChange);
      pointerMedia.removeEventListener("change", onMediaChange);
    };
  }, []);

  return (
    <>
      <div
        ref={rootRef}
        className={`aurora ${active ? "aurora--active" : ""}`}
        data-tone={toneKey}
      >
        <div className="aurora__content">{children}</div>
      </div>
      {createPortal(
        <div className="aurora aurora__portal" data-tone={toneKey}>
          <div ref={glowRef} className="aurora__glow" aria-hidden="true">
            {BLOBS.map((name) => (
              <span key={name} className={`aurora__blob aurora__blob--${name}`} />
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
