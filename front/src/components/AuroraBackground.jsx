import { useEffect, useRef, useState } from "react";
import "./AuroraBackground.css";

const BLOBS = ["push", "pull", "leg", "cardio"];

// tone: "Push" | "Pull" | "Leg" | "Cardio" | "Other" | undefined
export default function AuroraBackground({ children, active = false, tone }) {
  const toneKey = tone ? String(tone).toLowerCase() : undefined;

  const rootRef = useRef(null);
  const [tileHeight, setTileHeight] = useState(800);
  const [tileCount, setTileCount] = useState(1);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const measure = () => {
      // One tile = one screen tall (never tiny)
      const tile = Math.max(window.innerHeight, 600);
      setTileHeight(tile);
      setTileCount(Math.max(1, Math.ceil(el.clientHeight / tile)));
    };

    measure();

    // Re-measure whenever the page grows or shrinks
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`aurora ${active ? "aurora--active" : ""}`}
      data-tone={toneKey}
    >
      {Array.from({ length: tileCount }, (_, i) => (
        <div
          key={i}
          className="aurora__glow"
          aria-hidden="true"
          style={{
            top: i * tileHeight,
            height: tileHeight,
            // each tile starts at a slightly different point in the animation
            "--shift": `${-i * 3.7}s`,
          }}
        >
          {BLOBS.map((name) => (
            <span key={name} className={`aurora__blob aurora__blob--${name}`} />
          ))}
        </div>
      ))}

      <div className="aurora__content">{children}</div>
    </div>
  );
}