import "./AuroraBackground.css";

// tone: "Push" | "Pull" | "Leg" | "Cardio" | "Other" | undefined
export default function AuroraBackground({ children, active = false, tone }) {
  const toneKey = tone ? String(tone).toLowerCase() : undefined;

  return (
    <div
      className={`aurora ${active ? "aurora--active" : ""}`}
      data-tone={toneKey}
    >
      <div className="aurora__glow" aria-hidden="true">
        <span className="aurora__band aurora__band--a" />
        <span className="aurora__band aurora__band--b" />
      </div>
      <div className="aurora__content">{children}</div>
    </div>
  );
}