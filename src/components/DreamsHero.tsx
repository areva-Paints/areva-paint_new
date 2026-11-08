import React from 'react';

/** Shared live hero for the embedded homepage and React Studio. */
export function DreamsHero() {
  return (
    <section className="dreams-hero" aria-labelledby="dreams-hero-title">
      <img className="dreams-hero-art" src="/assets/images/areva-dreams-hero.webp" alt="A cream sofa, colourful cushions and flowing paint ribbons in a vibrant living space" width="2098" height="750" fetchPriority="high" />
      <div className="dreams-hero-copy">
        <p className="dreams-hero-eyebrow">AREVA PAINTS</p>
        <h1 id="dreams-hero-title">Paint<br />Your<br /><span>Dreams</span></h1>
        <span className="dreams-hero-rule" aria-hidden="true" />
        <p className="dreams-hero-intro">Colours that feel personal, finishes that behave intelligently, and paint solutions engineered for every space.</p>
        <div className="dreams-hero-actions">
          <a className="dreams-hero-primary" href="#products">Explore products <span aria-hidden="true">→</span></a>
          <a className="dreams-hero-secondary" href="#visualizer"><span className="dreams-hero-play" aria-hidden="true"><svg viewBox="0 0 12 12" width="10" height="10"><path d="M3 1.5 10 6 3 10.5Z" fill="currentColor" /></svg></span> Try a colour</a>
        </div>
      </div>
      <div className="dreams-hero-brand">
        <img src="/assets/images/areva-brand-white.webp" alt="Areva Paints" width="500" height="381" />
        <p><span aria-hidden="true">•</span> paint your dreams <span aria-hidden="true">•</span></p>
      </div>
    </section>
  );
}
