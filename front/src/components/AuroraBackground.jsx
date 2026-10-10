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
        <span className="aurora__blob aurora__blob--push" />
        <span className="aurora__blob aurora__blob--pull" />
        <span className="aurora__blob aurora__blob--leg" />
        <span className="aurora__blob aurora__blob--cardio" />
      </div>
      <div className="aurora__content">{children}</div>
    </div>
  );
}