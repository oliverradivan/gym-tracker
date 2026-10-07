import React from 'react';
import './AuroraBackground.css';

export default function AuroraBackground({ children }) {
  return (
    <div className="swirl-container">
      <div className="swirl-background">
        <div className="swirl-layer layer-1" />
        <div className="swirl-layer layer-2" />
        <div className="swirl-layer layer-3" />
        <div className="swirl-overlay" />
      </div>
      
      {/* Optional foreground content */}
      {children && <div className="swirl-content">{children}</div>}
    </div>
  );
}