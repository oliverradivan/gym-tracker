import "./AuroraBackground.css";

export default function AuroraBackground({ children, active = false }) {
  return (
    <div className={`aurora ${active ? "aurora--active" : ""}`}>
      <div className="aurora__blob aurora__blob--push" />
      <div className="aurora__blob aurora__blob--pull" />
      <div className="aurora__blob aurora__blob--leg" />
      <div className="aurora__blob aurora__blob--cardio" />
      <div className="aurora__content">{children}</div>
    </div>
  );
}