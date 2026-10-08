import "./AuroraBackground.css";

const BLOBS = ["push", "pull", "leg", "cardio"];

// tone: "Push" | "Pull" | "Leg" | "Cardio" | "Other" | undefined
export default function AuroraBackground({ children, active = false, tone }) {
  const toneKey = tone ? String(tone).toLowerCase() : undefined;

  return (
    <div
      className={`aurora ${active ? "aurora--active" : ""}`}
      data-tone={toneKey}
    >
      {/* One fixed, screen-sized glow. It never scrolls, so it never needs measuring. */}
      <div className="aurora__glow" aria-hidden="true">
        {BLOBS.map((name) => (
          <span key={name} className={`aurora__blob aurora__blob--${name}`} />
        ))}
      </div>

      <div className="aurora__content">{children}</div>
    </div>
  );
}