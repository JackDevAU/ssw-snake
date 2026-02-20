import type { Phase } from '../game/types';

interface IntroOverlayProps {
  phase: Phase;
}

export const IntroOverlay = ({ phase }: IntroOverlayProps) => (
  <section className={`intro-overlay ${phase === 'intro-explode' ? 'explode' : ''}`}>
    <div className="logo-wrap" aria-label="SSW intro logo">
      <div className="logo-piece logo-top-left" />
      <div className="logo-piece logo-top-right" />
      <div className="logo-piece logo-bottom-left" />
      <div className="logo-piece logo-bottom-right" />
    </div>
    <p className="intro-copy">SSW Snake</p>
  </section>
);
