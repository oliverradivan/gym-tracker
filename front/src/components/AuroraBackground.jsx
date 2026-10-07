import "./AuroraBackground.css";

export default function AuroraBackground({ children, active = false }) {
  return (
    <div className={`aurora ${active ? "aurora--active" : ""}`}>
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