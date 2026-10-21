import React from 'react';
import { Layers, Activity, Sparkles, Grid, GitCompare, BookOpen, PlusCircle, Upload } from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  apiOnline,
  fundsCount,
  onOpenCustomModal,
  onOpenCasModal,
  onOpenSetuModal,
  onLoadPreset,
  portfolios = []
}) {
  return (
    <header className="app-header">
      <div className="container header-content">
        {/* Brand */}
        <div className="brand-wrapper">
          <div className="brand-logo-icon">
            <Layers size={22} />
          </div>
          <div>
            <div className="brand-title">
              FolioScope <span className="brand-tag"></span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Mutual Fund Overlap Calculator & Pre-Purchase Simulator
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
            id="tab-simulator"
          >
            <Sparkles size={16} />
            <span>Pre-Purchase Simulator</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
            id="tab-matrix"
          >
            <Grid size={16} />
            <span>Overlap Matrix</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'comparator' ? 'active' : ''}`}
            onClick={() => setActiveTab('comparator')}
            id="tab-comparator"
          >
            <GitCompare size={16} />
            <span>2-Fund Venn</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'advisor' ? 'active' : ''}`}
            onClick={() => setActiveTab('advisor')}
            id="tab-advisor"
          >
            <Sparkles size={16} style={{ color: 'var(--lime-accent)' }} />
            <span>AI Advisor</span>
            <span
              style={{
                fontSize: '0.62rem',
                background: 'var(--lime-accent)',
                color: 'var(--bg-dark)',
                padding: '1px 5px',
                borderRadius: '8px',
                fontWeight: 900,
                marginLeft: '4px'
              }}
            >
              AI
            </span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
            id="tab-catalog"
          >
            <BookOpen size={16} />
            <span>Fund Catalog ({fundsCount})</span>
          </button>
        </nav>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Preset Portfolios Quick Selector */}
          {portfolios.length > 0 && (
            <select
              className="input-control"
              style={{ width: 'auto', fontSize: '0.78rem', padding: '6px 10px', height: '36px' }}
              onChange={(e) => {
                if (e.target.value) onLoadPreset(e.target.value);
              }}
              defaultValue=""
              aria-label="Preset Portfolios"
            >
              <option value="" disabled>Load Preset Portfolio...</option>
              {portfolios.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          {/* Setu Account Aggregator Direct Sign-in */}
          <button
            className="btn btn-primary btn-sm"
            onClick={onOpenSetuModal}
            title="Directly Sign-in and Fetch Mutual Funds via Setu Account Aggregator"
            style={{
              fontWeight: 800,
              background: 'var(--lime-accent)',
              color: 'var(--bg-dark)',
              boxShadow: '0 0 14px rgba(205, 255, 35, 0.4), 2px 2px 0px var(--olive-dark)',
              border: '1px solid var(--lime-accent)'
            }}
          >
            <Sparkles size={14} />
            <span>Connect Setu AA</span>
          </button>

          {/* Upload CAS Statement */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={onOpenCasModal}
            title="Upload CAS (CAMS/KFintech) Statement"
            style={{ fontWeight: 700 }}
          >
            <Upload size={14} />
            <span>Upload CAS</span>
          </button>

          {/* Add Custom Fund */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={onOpenCustomModal}
            title="Create Custom Mutual Fund"
          >
            <PlusCircle size={14} />

          </button>

          {/* API Status Indicator */}
          <div
            className={`badge ${apiOnline ? 'badge-emerald' : 'badge-rose'}`}
            style={{ fontSize: '0.7rem', padding: '5px 9px' }}
            title={apiOnline ? 'Backend Connected' : 'Connecting to Server...'}
          >
            <Activity size={12} />

          </div>
        </div>
      </div>
    </header>
  );
}
