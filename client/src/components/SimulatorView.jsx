import React, { useState, useId } from 'react';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  PieChart,
  Plus,
  Trash2,
  Search,
  Sliders,
  DollarSign,
  Info,
  ChevronDown,
  Layers,
  ArrowUpRight,
  Upload
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SimulatorView({
  funds,
  currentPortfolio,
  setCurrentPortfolio,
  prospectiveFundId,
  setProspectiveFundId,
  simulationResult,
  isSimulating,
  onRunSimulation,
  onOpenCasModal,
  onOpenCustomModal
}) {
  const [stockFilter, setStockFilter] = useState('all'); // all, overlapping, new, alerts
  const [stockSearch, setStockSearch] = useState('');
  const [prospectiveAmount, setProspectiveAmount] = useState(30000);
  const [selectedFundToAdd, setSelectedFundToAdd] = useState('');
  const prospectiveFundSelectId = useId();

  // Helper to get fund by ID
  const getFund = (id) => funds.find(f => f.id === id);

  // Add fund to current portfolio
  const handleAddFund = () => {
    if (!selectedFundToAdd) return;
    if (currentPortfolio.some(p => p.fundId === selectedFundToAdd)) {
      alert('Fund is already in your current portfolio!');
      return;
    }
    const updated = [
      ...currentPortfolio,
      { fundId: selectedFundToAdd, investmentAmount: 50000, weight: 0.5 }
    ];
    setCurrentPortfolio(updated);
    setSelectedFundToAdd('');
  };

  // Remove fund from current portfolio
  const handleRemoveFund = (id) => {
    if (currentPortfolio.length <= 1) {
      alert('Keep at least one fund in your portfolio to simulate overlap!');
      return;
    }
    const updated = currentPortfolio.filter(p => p.fundId !== id);
    setCurrentPortfolio(updated);
  };

  // Update fund amount
  const handleUpdateAmount = (id, amount) => {
    const updated = currentPortfolio.map(p =>
      p.fundId === id ? { ...p, investmentAmount: Math.max(0, Number(amount)) } : p
    );
    setCurrentPortfolio(updated);
  };

  // Trigger celebration confetti for safe diversification
  const handleCelebrateIfLow = () => {
    if (simulationResult && simulationResult.metrics.directOverlapPercentage <= 20) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch {
        // ignore if canvas blocked
      }
    }
  };

  // Filter stocks in shift table
  const filteredStocks = simulationResult?.detailedStockShifts?.filter(s => {
    if (stockSearch) {
      const q = stockSearch.toLowerCase();
      const matchName = s.stock.toLowerCase().includes(q);
      const matchTicker = s.ticker?.toLowerCase().includes(q);
      const matchSector = s.sector?.toLowerCase().includes(q);
      if (!matchName && !matchTicker && !matchSector) return false;
    }

    if (stockFilter === 'overlapping') {
      return s.isCommonInProspective && s.beforeWeight > 0;
    }
    if (stockFilter === 'new') {
      return s.isBrandNew;
    }
    if (stockFilter === 'alerts') {
      return s.alertLevel === 'warning' || s.alertLevel === 'critical';
    }
    return true;
  }) || [];

  const totalCurrentValue = currentPortfolio.reduce((sum, p) => sum + (Number(p.investmentAmount) || 0), 0);

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Banner / Headline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-lime">
              <Sparkles size={13} /> PRE-PURCHASE SIMULATION ENGINE
            </span>
          </div>
          <h1 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>
            Mutual Fund Overlap & Pre-Buy Simulator
          </h1>
          <p style={{ color: 'var(--silver-neutral)', fontSize: '0.88rem', maxWidth: '780px' }}>
            Simulate the exact mathematical impact of buying a prospective mutual fund. Preview how your stock duplication,
            sector drift, and portfolio concentration will change <em>before</em> you commit your capital.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              onRunSimulation(prospectiveFundId, prospectiveAmount);
              handleCelebrateIfLow();
            }}
            id="btn-recalculate-simulation"
            disabled={isSimulating}
          >
            <Sparkles size={16} />
            <span>{isSimulating ? 'Simulating...' : 'Recalculate Simulation'}</span>
          </button>
        </div>
      </div>

      {/* Two Column Setup: Left = Current Portfolio, Right = Prospective Fund Simulation Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Card 1: Current Portfolio */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} color="var(--lime-accent)" />
                Current Portfolio ({currentPortfolio.length} Funds)
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)', marginTop: '4px' }}>
                Total Capital: <strong className="mono" style={{ color: 'var(--lime-accent)' }}>₹{totalCurrentValue.toLocaleString()}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={onOpenCasModal}
                title="Upload CAS PDF/CSV to auto-import all your mutual funds"
                style={{ fontSize: '0.72rem', padding: '5px 10px' }}
              >
                <Upload size={13} />
                <span>Upload CAS</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenCustomModal}
                title="Create a custom fund or stock basket"
                style={{ fontSize: '0.72rem', padding: '5px 8px' }}
              >
                <Plus size={13} />
                <span>Manual</span>
              </button>
            </div>
          </div>

          {/* List of Current Funds */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {currentPortfolio.map(item => {
              const fund = getFund(item.fundId);
              if (!fund) return null;
              const sharePercent = totalCurrentValue > 0
                ? ((Number(item.investmentAmount) / totalCurrentValue) * 100).toFixed(1)
                : (100 / currentPortfolio.length).toFixed(1);

              return (
                <div
                  key={item.fundId}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fund.name}
                      </span>
                      <span className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                        {fund.category}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {fund.amc} • {fund.holdingsCount || fund.holdings?.length} holdings • Share: <span className="mono" style={{ color: 'var(--cyan-primary)' }}>{sharePercent}%</span>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative', width: '110px' }}>
                      <span style={{ position: 'absolute', left: '8px', top: '7px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹</span>
                      <input
                        type="number"
                        className="input-control mono"
                        style={{ paddingLeft: '20px', paddingRight: '6px', paddingTop: '6px', paddingBottom: '6px', fontSize: '0.8rem' }}
                        value={item.investmentAmount || ''}
                        onChange={(e) => handleUpdateAmount(item.fundId, e.target.value)}
                        placeholder="Amount"
                      />
                    </div>

                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRemoveFund(item.fundId)}
                      title="Remove from portfolio"
                      style={{ padding: '6px 8px' }}
                      aria-label="Remove Fund"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Fund to Current Portfolio Input */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="input-control"
              value={selectedFundToAdd}
              onChange={(e) => setSelectedFundToAdd(e.target.value)}
              style={{ flex: 1, fontSize: '0.85rem' }}
              aria-label="Select Fund to Add"
            >
              <option value="">+ Add another fund to current portfolio...</option>
              {funds
                .filter(f => !currentPortfolio.some(p => p.fundId === f.id))
                .map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.category})
                  </option>
                ))}
            </select>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleAddFund}
              disabled={!selectedFundToAdd}
            >
              <Plus size={15} /> Add
            </button>
          </div>
        </div>

        {/* Card 2: Prospective Fund Simulation Controls */}
        <div
          className="glass-panel"
          style={{
            padding: '22px',
            borderColor: 'var(--border-active)',
            boxShadow: 'var(--shadow-glow)',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(6, 182, 212, 0.05))'
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-lime">PROSPECTIVE CANDIDATE</span>
            </div>
            <h2 style={{ fontSize: '0.88rem', color: '#ffffff', marginBottom: '4px' }}>
              Select Prospective Fund to Buy
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--silver-neutral)' }}>
              Choose the fund you are considering investing in and adjust the proposed allocation.
            </p>
          </div>

          {/* Prospective Fund Selector */}
          <div style={{ marginBottom: '18px' }}>
            <label
              htmlFor={prospectiveFundSelectId}
              style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}
            >
              Mutual Fund to Purchase:
            </label>
            <select
              id={prospectiveFundSelectId}
              className="input-control"
              style={{ fontSize: '0.9rem', padding: '10px 14px', background: 'rgba(7, 11, 20, 0.8)', borderColor: 'rgba(6, 182, 212, 0.4)' }}
              value={prospectiveFundId}
              onChange={(e) => {
                setProspectiveFundId(e.target.value);
                onRunSimulation(e.target.value, prospectiveAmount);
              }}
            >
              {funds.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.category} ({f.amc})
                </option>
              ))}
            </select>
          </div>

          {/* Prospective Fund Quick Stats Card */}
          {(() => {
            const prospective = getFund(prospectiveFundId);
            if (!prospective) return null;
            return (
              <div
                style={{
                  background: 'rgba(6, 182, 212, 0.06)',
                  border: '1px solid rgba(6, 182, 212, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  marginBottom: '18px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  textAlign: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>3Y CAGR</div>
                  <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--emerald-success)' }}>
                    +{prospective.cagr3Y}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Expense Ratio</div>
                  <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {prospective.expenseRatio}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Holdings Count</div>
                  <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--cyan-primary)' }}>
                    {prospective.holdingsCount || prospective.holdings?.length}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Proposed Investment Amount & Allocation */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Proposed Investment Amount:
              </label>
              <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cyan-primary)' }}>
                ₹{Number(prospectiveAmount).toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {[15000, 30000, 50000, 100000].map(amt => (
                <button
                  key={amt}
                  className="btn btn-secondary btn-sm"
                  style={{
                    flex: 1,
                    fontSize: '0.75rem',
                    padding: '4px 6px',
                    borderColor: prospectiveAmount === amt ? 'var(--cyan-primary)' : 'var(--border-glass)',
                    color: prospectiveAmount === amt ? 'var(--cyan-primary)' : 'var(--text-secondary)'
                  }}
                  onClick={() => {
                    setProspectiveAmount(amt);
                    onRunSimulation(prospectiveFundId, amt);
                  }}
                >
                  ₹{(amt / 1000)}k
                </button>
              ))}
            </div>

            <input
              type="range"
              min="5000"
              max="200000"
              step="5000"
              value={prospectiveAmount}
              onChange={(e) => {
                const amt = Number(e.target.value);
                setProspectiveAmount(amt);
                onRunSimulation(prospectiveFundId, amt);
              }}
              style={{ width: '100%', accentColor: 'var(--cyan-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Prospective Allocation Share */}
          {simulationResult && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Simulated Weight in Portfolio:</span>
              <strong className="mono" style={{ color: 'var(--text-primary)' }}>
                {simulationResult.investmentSummary.allocationSharePercent}%
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================
          SIMULATION OUTCOME DASHBOARD
         ========================================================= */}
      {simulationResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Hero Diagnosis Card */}
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              background: `linear-gradient(135deg, rgba(15, 23, 42, 0.95), ${
                simulationResult.diagnosis.badgeColor === 'emerald'
                  ? 'rgba(16, 185, 129, 0.08)'
                  : simulationResult.diagnosis.badgeColor === 'cyan'
                  ? 'rgba(6, 182, 212, 0.08)'
                  : simulationResult.diagnosis.badgeColor === 'amber'
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'rgba(244, 63, 94, 0.08)'
              })`,
              borderLeft: `4px solid ${
                simulationResult.diagnosis.badgeColor === 'emerald'
                  ? 'var(--emerald-success)'
                  : simulationResult.diagnosis.badgeColor === 'cyan'
                  ? 'var(--cyan-primary)'
                  : simulationResult.diagnosis.badgeColor === 'amber'
                  ? 'var(--amber-warning)'
                  : 'var(--rose-danger)'
              }`
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'center' }}>
              {/* Left: Score & Risk Level */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span className={`badge badge-${simulationResult.diagnosis.badgeColor}`} style={{ fontSize: '0.75rem' }}>
                    {simulationResult.diagnosis.badgeColor === 'emerald' && <CheckCircle2 size={13} />}
                    {simulationResult.diagnosis.badgeColor === 'amber' && <AlertTriangle size={13} />}
                    {simulationResult.diagnosis.badgeColor === 'rose' && <ShieldAlert size={13} />}
                    {simulationResult.diagnosis.riskLevel}
                  </span>
                </div>
                <h2 style={{ fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '8px', color: '#ffffff' }}>
                  {simulationResult.diagnosis.recommendationSummary}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
                  {simulationResult.diagnosis.keyInsights.map((insight, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--cyan-primary)', marginTop: '2px' }}>•</span>
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Circular / Radial Diversification Health Gauge */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div
                  style={{
                    position: 'relative',
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    background: `conic-gradient(${
                      simulationResult.metrics.diversificationScore >= 70
                        ? '#10b981'
                        : simulationResult.metrics.diversificationScore >= 45
                        ? '#06b6d4'
                        : simulationResult.metrics.diversificationScore >= 30
                        ? '#f59e0b'
                        : '#f43f5e'
                    } ${simulationResult.metrics.diversificationScore * 3.6}deg, rgba(255, 255, 255, 0.06) 0deg)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 25px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  <div
                    style={{
                      width: '122px',
                      height: '122px',
                      borderRadius: '50%',
                      background: '#0d1527',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Diversification
                    </span>
                    <span className="mono" style={{ fontSize: '1.9rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                      {simulationResult.metrics.diversificationScore}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                      out of 100
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Core Before-vs-After Comparison Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* Card 1: Direct Overlap % */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Direct Overlap with Current Portfolio
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span className="mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--cyan-primary)' }}>
                  {simulationResult.metrics.directOverlapPercentage}%
                </span>
                <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>
                  Weighted
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Sum of min(holding weights) between prospective fund and existing portfolio basket.
              </p>
            </div>

            {/* Card 2: Unique Stocks Count */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Unique Stocks Owned
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="mono" style={{ fontSize: '1.4rem', color: 'var(--text-muted)' }}>
                  {simulationResult.metrics.beforeUniqueStocks}
                </span>
                <ArrowRight size={16} color="var(--cyan-primary)" />
                <span className="mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--emerald-success)' }}>
                  {simulationResult.metrics.afterUniqueStocks}
                </span>
              </div>
              <div style={{ marginTop: '6px' }}>
                <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                  +{simulationResult.metrics.netNewStocksCount} New Equities Added
                </span>
              </div>
            </div>

            {/* Card 3: Duplicated Stocks Count */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Common / Overlapping Stocks
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span className="mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--amber-warning)' }}>
                  {simulationResult.metrics.commonStocksCount}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  companies duplicated
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Stocks you already hold in your current portfolio that this fund also buys.
              </p>
            </div>

            {/* Card 4: Top 10 Stock Concentration */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Top 10 Stock Concentration
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="mono" style={{ fontSize: '1.4rem', color: 'var(--text-muted)' }}>
                  {simulationResult.metrics.beforeTop10Concentration}%
                </span>
                <ArrowRight size={16} color="var(--cyan-primary)" />
                <span className="mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {simulationResult.metrics.afterTop10Concentration}%
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Combined weight of your top 10 largest equity positions after prospective purchase.
              </p>
            </div>
          </div>

          {/* Pairwise Overlap with each current fund in portfolio */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.8rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart size={16} color="var(--lime-accent)" />
              Pairwise Overlap Breakdown with Your Current Funds
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
              {simulationResult.pairwiseWithCurrentFunds.map(p => (
                <div
                  key={p.fundId}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.fundName}
                    </span>
                    <span
                      className={`badge ${p.overlapPercentage > 40 ? 'badge-rose' : p.overlapPercentage > 20 ? 'badge-amber' : 'badge-emerald'}`}
                      style={{ fontSize: '0.7rem' }}
                    >
                      {p.overlapPercentage}% Overlap
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.category}</span>
                    <span>{p.commonStocksCount} common stocks</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sector Drift Comparison */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '0.8rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} color="var(--lime-accent)" />
              Sector Allocation Drift (Before vs After Purchase)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              {simulationResult.sectorShifts.slice(0, 8).map(sec => {
                const isIncreased = sec.delta > 0;
                return (
                  <div
                    key={sec.sector}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{sec.sector}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {sec.beforePct}% → <strong style={{ color: 'var(--text-primary)' }}>{sec.afterPct}%</strong>
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: isIncreased ? 'var(--cyan-primary)' : 'var(--text-muted)'
                          }}
                        >
                          {isIncreased ? `+${sec.delta}%` : `${sec.delta}%`}
                        </span>
                      </div>
                    </div>

                    {/* Progress bars comparison */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, sec.afterPct * 2)}%`,
                            background: isIncreased ? 'linear-gradient(90deg, #06b6d4, #3b82f6)' : '#64748b',
                            borderRadius: '3px',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Stock-by-Stock Shift Inspector */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={16} color="var(--lime-accent)" />
                  Stock Concentration Shifts & Duplication Details
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--silver-neutral)', marginTop: '4px' }}>
                  Detailed comparison showing how each individual company's portfolio weight shifts after buying {simulationResult.prospectiveFund.name}.
                </p>
              </div>

              {/* Filters and Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '200px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Search stock..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
                  />
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className={`btn btn-sm ${stockFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setStockFilter('all')}
                  >
                    All ({simulationResult.detailedStockShifts.length})
                  </button>
                  <button
                    className={`btn btn-sm ${stockFilter === 'overlapping' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setStockFilter('overlapping')}
                  >
                    Overlapping ({simulationResult.overlappingStocks.length})
                  </button>
                  <button
                    className={`btn btn-sm ${stockFilter === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setStockFilter('new')}
                  >
                    New Additions ({simulationResult.brandNewStocks.length})
                  </button>
                  <button
                    className={`btn btn-sm ${stockFilter === 'alerts' ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setStockFilter('alerts')}
                  >
                    Concentration Alerts
                  </button>
                </div>
              </div>
            </div>

            {/* Stocks Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px' }}>Company / Stock</th>
                    <th style={{ padding: '10px 12px' }}>Sector</th>
                    <th style={{ padding: '10px 12px' }}>Market Cap</th>
                    <th style={{ padding: '10px 12px' }}>Current Weight</th>
                    <th style={{ padding: '10px 12px' }}>Prospective Fund</th>
                    <th style={{ padding: '10px 12px' }}>Simulated Weight</th>
                    <th style={{ padding: '10px 12px' }}>Net Shift</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map((stock) => {
                    const isIncreased = stock.weightDelta > 0;
                    return (
                      <tr
                        key={stock.key}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                          background: stock.alertLevel === 'critical'
                            ? 'rgba(244, 63, 94, 0.05)'
                            : stock.alertLevel === 'warning'
                            ? 'rgba(245, 158, 11, 0.05)'
                            : 'transparent'
                        }}
                      >
                        {/* Company */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {stock.stock}
                          </div>
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
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {stock.marketCap}
                          </span>
                        </td>

                        {/* Current Weight */}
                        <td style={{ padding: '10px 12px' }} className="mono">
                          {stock.beforeWeight > 0 ? `${stock.beforeWeight}%` : '—'}
                        </td>

                        {/* Prospective Fund Holding Weight */}
                        <td style={{ padding: '10px 12px' }} className="mono" style={{ color: stock.isCommonInProspective ? 'var(--cyan-primary)' : 'var(--text-muted)' }}>
                          {stock.isCommonInProspective ? '✓ Held' : '—'}
                        </td>

                        {/* Simulated Weight */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              className="mono"
                              style={{
                                fontWeight: 700,
                                color: stock.afterWeight >= 8 ? 'var(--amber-warning)' : 'var(--text-primary)'
                              }}
                            >
                              {stock.afterWeight}%
                            </span>
                            <div style={{ width: '45px', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, stock.afterWeight * 7)}%`,
                                  height: '100%',
                                  background: stock.afterWeight >= 8 ? 'var(--amber-warning)' : 'var(--cyan-primary)'
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Net Shift */}
                        <td style={{ padding: '10px 12px' }} className="mono">
                          <span
                            style={{
                              fontWeight: 600,
                              color: isIncreased ? 'var(--emerald-success)' : 'var(--text-muted)'
                            }}
                          >
                            {isIncreased ? `+${stock.weightDelta}%` : `${stock.weightDelta}%`}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: '10px 12px' }}>
                          {stock.alertLevel === 'critical' ? (
                            <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>
                              <ShieldAlert size={11} /> Over-Concentration (&gt;10%)
                            </span>
                          ) : stock.alertLevel === 'warning' ? (
                            <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>
                              <AlertTriangle size={11} /> Elevated (&gt;7%)
                            </span>
                          ) : stock.isBrandNew ? (
                            <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>
                              <Plus size={11} /> Brand New Stock
                            </span>
                          ) : stock.isCommonInProspective ? (
                            <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                              Overlapped
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Existing
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
