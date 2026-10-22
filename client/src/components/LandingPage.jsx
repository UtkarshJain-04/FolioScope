import React from 'react';
import './LandingPage.css';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  FileUp,
  GitCompareArrows,
  Layers3,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';

const capabilities = [
  {
    icon: GitCompareArrows,
    number: '01',
    title: 'Measure portfolio overlap',
    description: 'See which stocks your funds share and where your portfolio is already concentrated.',
    tab: 'matrix',
    action: 'Open overlap matrix',
  },
  {
    icon: Target,
    number: '02',
    title: 'Check before you invest',
    description: 'Simulate a prospective fund and understand how it could change your holdings mix.',
    tab: 'simulator',
    action: 'Try the simulator',
  },
  {
    icon: Sparkles,
    number: '03',
    title: 'Explore personalized insights',
    description: 'Compare candidate funds against your goals, risk comfort, and existing portfolio.',
    tab: 'advisor',
    action: 'Meet your AI advisor',
  },
];

export default function LandingPage({ onNavigate, fundsCount, apiOnline }) {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow">
            <span className="landing-status-dot" />
            A clearer view of what you own
          </div>

          <h1 className="landing-title">
            Look beyond
            <br />
            the <span>fund name.</span>
          </h1>

          <p className="landing-lede">
            Two funds can look different and still own the same companies.
            See what is underneath your portfolio before you make your next move.
          </p>

          <div className="landing-hero-actions">
            <button className="landing-primary-button" onClick={() => onNavigate('simulator')}>
              Explore your portfolio
              <ArrowRight size={17} />
            </button>
            <button className="landing-text-button" onClick={() => onNavigate('matrix')}>
              See how overlap works
              <ArrowDown size={15} />
            </button>
          </div>

          <div className="landing-trust-row">
            <span><ShieldCheck size={15} /> Private to your account</span>
            <span><Activity size={15} /> {fundsCount || '—'} funds in the catalog</span>
          </div>
        </div>

        <div className="landing-visual" aria-label="Illustration of portfolio overlap analysis">
          <div className="landing-visual-topline">
            <span><span className="landing-live-dot" /> PORTFOLIO SCAN</span>
            <span>FOLIO / 001</span>
          </div>

          <div className="landing-visual-heading">
            <div>
              <span className="landing-visual-label">DIVERSIFICATION CHECK</span>
              <h2>Know what<br />you really own.</h2>
            </div>
            <div className="landing-orbit" aria-hidden="true">
              <div className="landing-orbit-ring landing-orbit-ring-one" />
              <div className="landing-orbit-ring landing-orbit-ring-two" />
              <div className="landing-orbit-core"><Layers3 size={19} /></div>
              <span className="landing-orbit-dot landing-orbit-dot-one" />
              <span className="landing-orbit-dot landing-orbit-dot-two" />
            </div>
          </div>

          <div className="landing-fund-stack">
            <div className="landing-fund-row">
              <span className="landing-fund-icon">P</span>
              <span className="landing-fund-name">Flexi Cap Fund</span>
              <span className="landing-fund-weight">50%</span>
              <span className="landing-fund-bar"><i style={{ width: '70%' }} /></span>
            </div>
            <div className="landing-fund-row">
              <span className="landing-fund-icon landing-fund-icon-alt">M</span>
              <span className="landing-fund-name">Large &amp; Mid Cap</span>
              <span className="landing-fund-weight">50%</span>
              <span className="landing-fund-bar"><i style={{ width: '55%' }} /></span>
            </div>
          </div>

          <div className="landing-overlap-callout">
            <div>
              <span className="landing-visual-label">SHARED HOLDINGS</span>
              <strong>Spot the overlap.</strong>
            </div>
            <div className="landing-overlap-symbol">
              <span />
              <span />
              <b>+</b>
            </div>
          </div>

          <div className="landing-visual-footer">
            <span><Check size={13} /> Stock-level analysis</span>
            <span>Illustrative preview</span>
          </div>
          <div className="landing-visual-grid" aria-hidden="true" />
        </div>

        <button className="landing-scroll-cue" onClick={() => document.getElementById('landing-tools')?.scrollIntoView({ behavior: 'smooth' })} aria-label="Scroll to explore tools">
          <ChevronRight size={16} />
        </button>
      </section>

      <section className="landing-proof-strip" aria-label="FolioScope features">
        <span>BUILT FOR THE WHOLE PORTFOLIO</span>
        <div><BarChart3 size={16} /> Clear, stock-level insights</div>
        <div><CircleHelp size={16} /> Understand before you invest</div>
        <div><ShieldCheck size={16} /> Educational decision support</div>
      </section>

      <section className="landing-tools" id="landing-tools">
        <div className="landing-section-heading">
          <div>
            <span className="landing-section-kicker">YOUR PORTFOLIO, IN FOCUS</span>
            <h2>Make your next move<br />with more context.</h2>
          </div>
          <p>One workspace to explore your holdings, compare funds, and understand what could change.</p>
        </div>

        <div className="landing-capability-grid">
          {capabilities.map(({ icon: Icon, number, title, description, tab, action }) => (
            <button className="landing-capability-card" key={number} onClick={() => onNavigate(tab)}>
              <div className="landing-capability-top">
                <span className="landing-capability-icon"><Icon size={19} /></span>
                <span className="landing-capability-number">{number}</span>
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="landing-capability-action">{action}<ArrowUpRight size={15} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="landing-import-banner">
        <div className="landing-import-icon"><FileUp size={21} /></div>
        <div>
          <span className="landing-section-kicker">START WITH WHAT YOU HAVE</span>
          <h2>Bring your portfolio into focus.</h2>
          <p>Upload a CAS statement or start with a sample portfolio. Your next insight is a few clicks away.</p>
        </div>
        <button className="landing-secondary-button" onClick={() => onNavigate('simulator')}>
          Get started <ArrowRight size={16} />
        </button>
      </section>

      <p className="landing-disclaimer">
        FolioScope is an educational portfolio analysis tool, not an investment advisor. Mutual fund investments are subject to market risks.
        {apiOnline ? ' Portfolio tools are connected.' : ''}
      </p>
    </div>
  );
}
