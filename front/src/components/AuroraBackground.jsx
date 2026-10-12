import { useEffect, useRef } from "react";
import "./AuroraBackground.css";
import { startAuroraField } from "./auroraField";

export default function AuroraBackground({ children, active = false, tone }) {
  const toneKey = tone ? String(tone).toLowerCase() : undefined;
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const paramsRef = useRef({ active, toneKey, dark: false });
  paramsRef.current.active = active;
  paramsRef.current.toneKey = toneKey;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return undefined;

    const readDark = () => document.documentElement.classList.contains("dark");
    paramsRef.current.dark = readDark();

    const stop = startAuroraField(canvas, root, () => paramsRef.current);

    const mo = new MutationObserver(() => {
      paramsRef.current.dark = readDark();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      mo.disconnect();
      stop();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`aurora ${active ? "aurora--active" : ""}`}
      data-tone={toneKey}
    >
      <canvas ref={canvasRef} className="aurora__canvas" aria-hidden="true" />
      <div className="aurora__glow" aria-hidden="true">
        <div className="aurora__blobs">
          <span className="aurora__blob aurora__blob--push" />
          <span className="aurora__blob aurora__blob--pull" />
          <span className="aurora__blob aurora__blob--leg" />
          <span className="aurora__blob aurora__blob--cardio" />
        </div>
      </div>
      <div className="aurora__content">{children}</div>
    </div>
  );
}
