import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  PieChart,
  TrendingUp,
  DollarSign,
  Percent,
  Upload,
  ArrowRight,
  Info,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

export default function XRayView({
  currentPortfolio = [],
  onOpenCasModal,
  onOpenSetuModal,
  onNavigateToSimulator,
  onNavigateToAdvisor
}) {
  const [xrayData, setXrayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch X-Ray analysis when current portfolio changes
  useEffect(() => {
    if (!currentPortfolio || currentPortfolio.length === 0) {
      setXrayData(null);
      return;
    }
    fetchXRayData();
  }, [currentPortfolio]);

  const fetchXRayData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/portfolio/xray', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: currentPortfolio })
      });
      const data = await res.json();
      if (data.success) {
        setXrayData(data.data);
      } else {
        setErrorMsg(data.message || 'Failed to calculate portfolio X-Ray');
      }
    } catch (err) {
      console.error('X-Ray fetch error:', err);
      setErrorMsg('Network error while analyzing portfolio X-Ray');
    } finally {
      setLoading(false);
    }
  };

  // Helper for formatting INR currency
  const formatINR = (val) => {
    if (val === null || val === undefined) return '—';
    return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  // 1. EMPTY STATE
  if (!currentPortfolio || currentPortfolio.length === 0) {
    return (
      <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center', maxWidth: '680px', margin: '40px auto' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(205, 255, 35, 0.1)',
              border: '1px solid var(--lime-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              color: 'var(--lime-accent)'
            }}
          >
            <Activity size={32} />
          </div>
          <h2 style={{ fontSize: '1.25rem', color: '#ffffff', marginBottom: '8px' }}>
            No Mutual Funds in Current Portfolio
          </h2>
          <p style={{ color: 'var(--silver-neutral)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '24px' }}>
            Import your holdings to generate a complete Portfolio X-Ray showing true look-through company weights,
            sector exposures, expense ratio benchmarking, and estimated duplicate fee waste.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {onOpenSetuModal && (
              <button
                className="btn btn-primary"
                onClick={onOpenSetuModal}
                style={{ fontWeight: 800 }}
              >
                <Sparkles size={16} />
                <span>Connect via Setu AA</span>
              </button>
            )}
            {onOpenCasModal && (
              <button className="btn btn-secondary" onClick={onOpenCasModal}>
                <Upload size={16} />
                <span>Upload CAS Statement</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. LOADING STATE
  if (loading && !xrayData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div
          style={{
            width: '45px',
            height: '45px',
            border: '3px solid var(--border-glass)',
            borderTopColor: 'var(--lime-accent)',
            borderRadius: '50%',
            animation: 'pulseSubtle 1s infinite'
          }}
        />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Generating Comprehensive Portfolio X-Ray & Duplicate Fee Audit...
        </p>
      </div>
    );
  }

  // 3. ERROR STATE
  if (errorMsg && !xrayData) {
    return (
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', borderColor: 'var(--rose-danger)' }}>
        <AlertTriangle size={32} color="var(--rose-danger)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ color: 'var(--rose-danger)', marginBottom: '8px' }}>Could not generate Portfolio X-Ray</h3>
        <p style={{ color: 'var(--silver-neutral)', fontSize: '0.85rem', marginBottom: '16px' }}>{errorMsg}</p>
        <button className="btn btn-secondary btn-sm" onClick={fetchXRayData}>
          Try Again
        </button>
      </div>
    );
  }

  if (!xrayData) return null;

  const {
    summary,
    healthScore,
    lookThroughStocks,
    sectorBreakdown,
    marketCapBreakdown,
    fundPairsOverlap,
    expenseAnalysis,
    duplicateWasteAnalysis,
    legalDisclaimer
  } = xrayData;

  const hasAmounts = summary.hasRupeeAmounts;

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {/* Top Banner / Headline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-lime">
              <Activity size={13} /> PORTFOLIO X-RAY DIAGNOSTICS
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--cyan-primary)',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              * Look-through weights & overlap based on disclosed top holdings
            </span>
          </div>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
            Current Portfolio X-Ray & Fee Audit
          </h1>
          <p style={{ color: 'var(--silver-neutral)', fontSize: '0.88rem', maxWidth: '820px', lineHeight: 1.5 }}>
            Look through all {summary.fundsCount} mutual funds in your active portfolio to uncover your true underlying company exposures,
            market capitalization spread, and estimated fee drag caused by duplicated stock holdings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {onNavigateToSimulator && (
            <button
              className="btn btn-secondary"
              onClick={() => onNavigateToSimulator()}
              title="Test adding a new fund in Pre-Purchase Simulator"
            >
              <Sparkles size={15} />
              <span>Pre-Purchase Simulator</span>
            </button>
          )}
          {onNavigateToAdvisor && (
            <button
              className="btn btn-primary"
              onClick={onNavigateToAdvisor}
              title="Get personalized AI recommendations based on portfolio overlap"
              style={{ fontWeight: 800 }}
            >
              <Sparkles size={15} />
              <span>AI Advisor</span>
            </button>
          )}
        </div>
      </div>

      {/* Hero Health Diagnosis Card */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          background: `linear-gradient(135deg, rgba(15, 23, 42, 0.95), ${
            healthScore.badgeColor === 'emerald'
              ? 'rgba(16, 185, 129, 0.08)'
              : healthScore.badgeColor === 'cyan'
              ? 'rgba(6, 182, 212, 0.08)'
              : healthScore.badgeColor === 'amber'
              ? 'rgba(245, 158, 11, 0.08)'
              : 'rgba(244, 63, 94, 0.08)'
          })`,
          borderLeft: `4px solid ${
            healthScore.badgeColor === 'emerald'
              ? 'var(--emerald-success)'
              : healthScore.badgeColor === 'cyan'
              ? 'var(--cyan-primary)'
              : healthScore.badgeColor === 'amber'
              ? 'var(--amber-warning)'
              : 'var(--rose-danger)'
          }`
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'center' }}>
          {/* Diagnosis Text */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className={`badge badge-${healthScore.badgeColor}`} style={{ fontSize: '0.75rem' }}>
                {healthScore.badgeColor === 'emerald' && <CheckCircle2 size={13} />}
                {healthScore.badgeColor === 'cyan' && <ShieldCheck size={13} />}
                {healthScore.badgeColor === 'amber' && <AlertTriangle size={13} />}
                {healthScore.badgeColor === 'rose' && <ShieldAlert size={13} />}
                {healthScore.severityTier}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)' }}>
                {summary.fundsCount} Mutual Funds • {summary.totalUniqueStocks} Unique Companies
              </span>
            </div>
            <h2 style={{ fontSize: '1rem', lineHeight: 1.5, marginBottom: '8px', color: '#ffffff' }}>
              {healthScore.summary}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <div>
                • <strong>{summary.overlappingStocksCount} companies</strong> are held in multiple funds simultaneously, accounting for{' '}
                <strong style={{ color: 'var(--amber-warning)' }}>{summary.portfolioOverlapWeight}%</strong> of your total portfolio weight.
              </div>
              <div>
                • Your top 10 holdings represent <strong style={{ color: 'var(--text-primary)' }}>{summary.top10Concentration}%</strong> of your entire portfolio.
              </div>
            </div>
          </div>

          {/* Radial Health Gauge */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '145px',
                height: '145px',
                borderRadius: '50%',
                background: `conic-gradient(${
                  healthScore.score >= 70
                    ? '#10b981'
                    : healthScore.score >= 45
                    ? '#06b6d4'
                    : healthScore.score >= 30
                    ? '#f59e0b'
                    : '#f43f5e'
                } ${healthScore.score * 3.6}deg, rgba(255, 255, 255, 0.06) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 25px rgba(0, 0, 0, 0.4)'
              }}
            >
              <div
                style={{
                  width: '118px',
                  height: '118px',
                  borderRadius: '50%',
                  background: '#0d1527',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Diversification
                </span>
                <span className="mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  {healthScore.score}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  out of 100
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core Executive Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
        {/* Card 1: Value-Weighted Expense Ratio */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Portfolio-Weighted TER
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--cyan-primary)' }}>
              {expenseAnalysis.weightedTER}%
            </span>
            <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
              Value-Weighted
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Average annual management fee weighted by your fund allocations.
          </p>
        </div>

        {/* Card 2: Total Annual Fee in Rupees */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Total Annual Management Fee
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: hasAmounts ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {hasAmounts ? formatINR(expenseAnalysis.totalAnnualFeeRupees) : '—'}
            </span>
            {hasAmounts ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>/ year</span>
            ) : (
              <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>Amounts not set</span>
            )}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            {hasAmounts
              ? `Estimated annual fee paid to AMCs on ₹${summary.totalValuation?.toLocaleString()} total capital.`
              : 'Add rupee amounts to funds to calculate total annual fee in ₹.'}
          </p>
        </div>

        {/* Card 3: Estimated Duplicate Fee Waste */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            borderColor: duplicateWasteAnalysis.wastePercentageOfFees > 15 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-glass)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Duplicate Fee Waste</span>
            <span className="badge badge-amber" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
              ESTIMATE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--amber-warning)' }}>
              {hasAmounts ? formatINR(duplicateWasteAnalysis.totalWasteRupees) : `${duplicateWasteAnalysis.wastePercentageOfFees}%`}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              ({duplicateWasteAnalysis.wastePercentageOfFees}% of fees)
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Annual management fees paid on identical stocks duplicated across your active funds.
          </p>
        </div>

        {/* Card 4: Top 10 Stock Concentration */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Top 10 Stock Concentration
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {summary.top10Concentration}%
            </span>
            <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
              Top 10 Look-Through
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Combined share of your 10 largest company positions across all mutual funds.
          </p>
        </div>
      </div>

      {/* Look-Through Top 10 Stocks Table */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
              <Layers size={17} color="var(--lime-accent)" />
              Top 10 Look-Through Underlying Stocks
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)', marginTop: '2px' }}>
              Aggregated stock weights across all your mutual funds. Badges highlight companies duplicated in multiple funds.
            </p>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Showing 10 of {summary.totalUniqueStocks} unique companies
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px', width: '40px' }}>#</th>
                <th style={{ padding: '10px 12px' }}>Company / Stock</th>
                <th style={{ padding: '10px 12px' }}>Sector</th>
                <th style={{ padding: '10px 12px' }}>Market Cap</th>
                <th style={{ padding: '10px 12px' }}>Effective Weight</th>
                {hasAmounts && <th style={{ padding: '10px 12px' }}>Effective Value</th>}
                <th style={{ padding: '10px 12px' }}>Held In Funds</th>
              </tr>
            </thead>
            <tbody>
              {lookThroughStocks.map((stock) => {
                const isOverlapping = stock.fundCount > 1;
                return (
                  <tr
                    key={stock.stock}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                      background: stock.effectiveWeight >= 8 ? 'rgba(245, 158, 11, 0.04)' : 'transparent'
                    }}
                  >
                    {/* Rank */}
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }} className="mono">
                      {stock.rank}
                    </td>

                    {/* Stock Name */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stock.stock}</div>
                      {stock.ticker && (
                        <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--cyan-primary)' }}>
                          {stock.ticker}
                        </span>
                      )}
                    </td>

                    {/* Sector */}
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {stock.sector}
                    </td>

                    {/* Market Cap */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {stock.marketCap}
                      </span>
                    </td>

                    {/* Effective Weight */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          className="mono"
                          style={{
                            fontWeight: 700,
                            color: stock.effectiveWeight >= 8 ? 'var(--amber-warning)' : 'var(--text-primary)'
                          }}
                        >
                          {stock.effectiveWeight}%
                        </span>
                        <div style={{ width: '45px', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, stock.effectiveWeight * 7)}%`,
                              height: '100%',
                              background: stock.effectiveWeight >= 8 ? 'var(--amber-warning)' : 'var(--cyan-primary)'
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Effective Value (if amounts) */}
                    {hasAmounts && (
                      <td style={{ padding: '10px 12px' }} className="mono">
                        {formatINR(stock.effectiveAmount)}
                      </td>
                    )}

                    {/* Held in Funds Badge */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          className={`badge ${isOverlapping ? 'badge-amber' : 'badge-secondary'}`}
                          style={{ fontSize: '0.68rem', padding: '2px 7px' }}
                          title={stock.heldInFunds?.map(f => `${f.fundName} (${f.fundWeight}%)`).join(', ')}
                        >
                          Held in {stock.fundCount} {stock.fundCount === 1 ? 'fund' : 'funds'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ({stock.heldInFunds?.map(f => f.fundName.split(' ')[0]).join(', ')})
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-Column Section: Market Cap Distribution & Sector Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Left Column: Market Cap Distribution */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
            <PieChart size={16} color="var(--lime-accent)" />
            Market Capitalization Distribution
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)', marginBottom: '16px' }}>
            Underlying look-through allocation across market capitalization tiers.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'Large Cap', value: marketCapBreakdown['Large Cap'] || 0, color: 'var(--cyan-primary)', desc: 'Top 100 established market leaders' },
              { label: 'Mid Cap', value: marketCapBreakdown['Mid Cap'] || 0, color: '#3b82f6', desc: '101st-250th high-growth compounders' },
              { label: 'Small Cap', value: marketCapBreakdown['Small Cap'] || 0, color: 'var(--lime-accent)', desc: '251st+ dynamic emerging companies' },
              { label: 'Other / Debt / Cash', value: marketCapBreakdown['Other'] || 0, color: '#64748b', desc: 'International or unclassified assets' }
            ].map(tier => (
              <div key={tier.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{tier.label}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>{tier.desc}</span>
                  </div>
                  <span className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: tier.color }}>
                    {tier.value}%
                  </span>
                </div>
                <div style={{ height: '7px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, tier.value)}%`,
                      background: tier.color,
                      borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Top Sectors Breakdown */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
            <TrendingUp size={16} color="var(--lime-accent)" />
            Top Sector Exposures
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)', marginBottom: '16px' }}>
            Aggregated industry sector allocation across all portfolio holdings.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(sectorBreakdown)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([sector, pct]) => (
                <div key={sector}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>{sector}</span>
                    <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cyan-primary)' }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, pct * 2.2)}%`,
                        background: 'linear-gradient(90deg, #06b6d4, #10b981)',
                        borderRadius: '3px',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Expense Ratio Benchmarking Table */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
              <Percent size={17} color="var(--lime-accent)" />
              Expense Ratio (TER) Benchmarking
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)', marginTop: '2px' }}>
              Per-fund Total Expense Ratio compared against catalog category benchmarks. Active funds &gt;1.5% or &gt;0.15% above category average are flagged.
            </p>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--silver-neutral)' }}>
            Portfolio-Weighted TER:{' '}
            <strong className="mono" style={{ color: 'var(--lime-accent)' }}>{expenseAnalysis.weightedTER}%</strong>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px' }}>Mutual Fund</th>
                <th style={{ padding: '10px 12px' }}>Category</th>
                <th style={{ padding: '10px 12px' }}>Share</th>
                {hasAmounts && <th style={{ padding: '10px 12px' }}>Amount</th>}
                <th style={{ padding: '10px 12px' }}>Fund TER</th>
                <th style={{ padding: '10px 12px' }}>Category Avg</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                {hasAmounts && <th style={{ padding: '10px 12px' }}>Annual Fee</th>}
              </tr>
            </thead>
            <tbody>
              {expenseAnalysis.funds.map((f) => (
                <tr key={f.fundId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {f.name}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                    {f.category}
                  </td>
                  <td style={{ padding: '10px 12px' }} className="mono">
                    {f.sharePercent}%
                  </td>
                  {hasAmounts && (
                    <td style={{ padding: '10px 12px' }} className="mono">
                      {formatINR(f.amount)}
                    </td>
                  )}
                  <td style={{ padding: '10px 12px' }} className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {f.ter}%
                  </td>
                  <td style={{ padding: '10px 12px' }} className="mono" style={{ color: 'var(--text-secondary)' }}>
                    {f.categoryAvgTER !== null ? `${f.categoryAvgTER}%` : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>— (&lt;3 funds)</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {f.isHighActiveFee ? (
                      <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>
                        High Active Fee (&gt;1.5%)
                      </span>
                    ) : f.isAboveCategoryAvg ? (
                      <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>
                        Above Category Avg (+{f.terDelta}%)
                      </span>
                    ) : f.isPassive ? (
                      <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>
                        Low-Cost Passive
                      </span>
                    ) : (
                      <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                        Fair / Healthy
                      </span>
                    )}
                  </td>
                  {hasAmounts && (
                    <td style={{ padding: '10px 12px' }} className="mono" style={{ color: 'var(--text-primary)' }}>
                      {formatINR(f.annualFeeRupees)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Duplicate Fee Waste Audit Table */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '0.92rem', color: '#ffffff' }}>
                Duplicate Fee Waste Audit (Per-Fund Breakdown)
              </h3>
              <span className="badge badge-amber" style={{ fontSize: '0.62rem' }}>
                ESTIMATE
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)', marginTop: '2px' }}>
              Redundancy Share measures the % of stocks in this fund that are already held elsewhere in your portfolio.
              Fee waste estimates how much annual management fee is spent paying for duplicated holdings.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--silver-neutral)' }}>Estimated Total Waste: </span>
            <strong className="mono" style={{ color: 'var(--amber-warning)', fontSize: '0.95rem' }}>
              {hasAmounts ? formatINR(duplicateWasteAnalysis.totalWasteRupees) : `${duplicateWasteAnalysis.wastePercentageOfFees}% of fees`}
            </strong>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px' }}>Mutual Fund</th>
                <th style={{ padding: '10px 12px' }}>Fund TER</th>
                {hasAmounts && <th style={{ padding: '10px 12px' }}>Fund Amount</th>}
                <th style={{ padding: '10px 12px' }}>Redundancy Share</th>
                {hasAmounts && <th style={{ padding: '10px 12px' }}>Total Annual Fee</th>}
                {hasAmounts && <th style={{ padding: '10px 12px' }}>Estimated Waste (₹)</th>}
              </tr>
            </thead>
            <tbody>
              {duplicateWasteAnalysis.funds.map((f) => (
                <tr key={f.fundId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {f.name}
                  </td>
                  <td style={{ padding: '10px 12px' }} className="mono">
                    {f.ter}%
                  </td>
                  {hasAmounts && (
                    <td style={{ padding: '10px 12px' }} className="mono">
                      {formatINR(f.amount)}
                    </td>
                  )}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        className="mono"
                        style={{
                          fontWeight: 700,
                          color: f.redundancyPercent > 20 ? 'var(--amber-warning)' : 'var(--text-primary)'
                        }}
                      >
                        {f.redundancyPercent}%
                      </span>
                      <div style={{ width: '40px', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, f.redundancyPercent * 2)}%`,
                            height: '100%',
                            background: f.redundancyPercent > 20 ? 'var(--amber-warning)' : 'var(--cyan-primary)'
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  {hasAmounts && (
                    <td style={{ padding: '10px 12px' }} className="mono" style={{ color: 'var(--text-secondary)' }}>
                      {formatINR(f.annualFeeRupees)}
                    </td>
                  )}
                  {hasAmounts && (
                    <td style={{ padding: '10px 12px' }} className="mono" style={{ fontWeight: 700, color: 'var(--amber-warning)' }}>
                      {formatINR(f.wasteRupees)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Intra-Portfolio Overlap Pair Breakdown */}
      {fundPairsOverlap && fundPairsOverlap.length > 0 && (
        <div className="glass-panel" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '0.92rem', marginBottom: '6px', color: '#ffffff' }}>
            Intra-Portfolio Pairwise Overlap Breakdown
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)', marginBottom: '16px' }}>
            Direct holding overlap between every pair of mutual funds currently in your portfolio, categorized by the 4 standard severity tiers.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {fundPairsOverlap.map((pair, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', maxWidth: '70%' }}>
                    {pair.fundA.name} <br />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>vs</span> {pair.fundB.name}
                  </div>
                  <span className={`badge badge-${pair.badgeColor}`} style={{ fontSize: '0.7rem' }}>
                    {pair.overlapPercentage}% Overlap
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--silver-neutral)' }}>
                  <span>{pair.severityTier}</span>
                  <span>{pair.commonStocksCount} common stocks</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regulatory & Non-Advice Legal Disclaimer */}
      <div
        style={{
          background: 'rgba(22, 33, 11, 0.4)',
          border: '1px solid var(--olive-dark)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          fontSize: '0.74rem',
          color: 'var(--silver-neutral)',
          lineHeight: 1.5
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--lime-accent)', marginBottom: '4px' }}>
          Non-Advisory Compliance & Educational Notice
        </div>
        {legalDisclaimer}
      </div>
    </div>
  );
}

