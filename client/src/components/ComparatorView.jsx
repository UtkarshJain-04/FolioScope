import React, { useState, useEffect } from 'react';
import { GitCompare, ArrowRightLeft, Sparkles, PieChart, Layers } from 'lucide-react';

export default function ComparatorView({
  funds,
  onSelectForSimulation
}) {
  const [fundAId, setFundAId] = useState(funds[0]?.id || 'ppfas-flexi-cap');
  const [fundBId, setFundBId] = useState(funds[1]?.id || 'mirae-large-midcap');
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('common'); // common, uniqueA, uniqueB

  useEffect(() => {
    if (fundAId && fundBId) {
      fetchComparison();
    }
  }, [fundAId, fundBId]);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/overlap/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundAId, fundBId })
      });
      const data = await res.json();
      if (data.success) {
        setComparisonData(data.data);
      }
    } catch (err) {
      console.error('Error fetching pairwise overlap:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwapFunds = () => {
    const temp = fundAId;
    setFundAId(fundBId);
    setFundBId(temp);
  };

  const fundA = funds.find(f => f.id === fundAId);
  const fundB = funds.find(f => f.id === fundBId);

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="badge badge-lime">
            <GitCompare size={13} /> DIRECT PAIRWISE COMPARATOR
          </span>
        </div>
        <h1 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>
          2-Fund Overlap & Venn Comparator
        </h1>
        <p style={{ color: 'var(--silver-neutral)', fontSize: '0.88rem' }}>
          Compare any two mutual funds side-by-side to inspect common holdings, portfolio overlap %, and distinct holdings.
        </p>
      </div>

      {/* Fund Selectors Card */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
          {/* Fund A */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Select First Fund (Fund A):
            </label>
            <select
              className="input-control"
              value={fundAId}
              onChange={(e) => setFundAId(e.target.value)}
              style={{ fontSize: '0.9rem' }}
            >
              {funds.map(f => (
                <option key={f.id} value={f.id} disabled={f.id === fundBId}>
                  {f.name} ({f.category})
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div style={{ marginTop: '22px' }}>
            <button
              className="btn btn-secondary"
              onClick={handleSwapFunds}
              title="Swap Funds"
              style={{ borderRadius: '50%', width: '42px', height: '42px', padding: 0 }}
            >
              <ArrowRightLeft size={16} />
            </button>
          </div>

          {/* Fund B */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Select Second Fund (Fund B):
            </label>
            <select
              className="input-control"
              value={fundBId}
              onChange={(e) => setFundBId(e.target.value)}
              style={{ fontSize: '0.9rem' }}
            >
              {funds.map(f => (
                <option key={f.id} value={f.id} disabled={f.id === fundAId}>
                  {f.name} ({f.category})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Comparison Results */}
      {comparisonData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Visual Venn / Intersection Diagram */}
          <div className="glass-panel" style={{ padding: '26px' }}>
            <h2 style={{ fontSize: '0.88rem', marginBottom: '24px', textAlign: 'center', color: 'var(--lime-accent)' }}>
              Portfolio Overlap Intersection Diagram
            </h2>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '14px', position: 'relative' }}>
              {/* Circle A: Unique to A */}
              <div
                style={{
                  width: '200px',
                  height: '200px',
                  borderRadius: '50%',
                  background: 'rgba(49, 69, 17, 0.35)',
                  border: '2px solid var(--olive-dark)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '16px'
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--silver-neutral)', marginBottom: '4px' }}>
                  {fundA?.name}
                </div>
                <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>
                  {comparisonData.uniqueToA.length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Unique Stocks
                </div>
              </div>

              {/* Center Overlap Intersection */}
              <div
                style={{
                  width: '220px',
                  height: '220px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(49, 69, 17, 0.8), rgba(205, 255, 35, 0.25))',
                  border: '2px solid var(--lime-accent)',
                  boxShadow: '0 0 25px rgba(205, 255, 35, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '16px',
                  zIndex: 2
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--lime-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Mutual Overlap
                </div>
                <div className="mono" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  {comparisonData.overlapPercentage}%
                </div>
                <div className="badge badge-lime" style={{ fontSize: '0.68rem', marginTop: '6px' }}>
                  {comparisonData.commonStocksCount} Common Stocks
                </div>
              </div>

              {/* Circle B: Unique to B */}
              <div
                style={{
                  width: '200px',
                  height: '200px',
                  borderRadius: '50%',
                  background: 'rgba(49, 69, 17, 0.35)',
                  border: '2px solid var(--olive-dark)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '16px'
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--silver-neutral)', marginBottom: '4px' }}>
                  {fundB?.name}
                </div>
                <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>
                  {comparisonData.uniqueToB.length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Unique Stocks
                </div>
              </div>
            </div>

            {/* Quick Summary Pill Bar */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '24px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Weight of common stocks in {fundA?.name}: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{comparisonData.weightOfCommonInFundA}%</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Weight of common stocks in {fundB?.name}: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{comparisonData.weightOfCommonInFundB}%</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Total Unique Companies: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{comparisonData.totalUniqueStocksCount}</strong>
              </div>
            </div>
          </div>

          {/* Holdings Explorer: Common vs Unique Tabs */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`btn btn-sm ${activeTab === 'common' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('common')}
                >
                  Common Overlapping Stocks ({comparisonData.commonStocks.length})
                </button>
                <button
                  className={`btn btn-sm ${activeTab === 'uniqueA' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('uniqueA')}
                >
                  Only in {fundA?.name.slice(0, 16)}... ({comparisonData.uniqueToA.length})
                </button>
                <button
                  className={`btn btn-sm ${activeTab === 'uniqueB' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('uniqueB')}
                >
                  Only in {fundB?.name.slice(0, 16)}... ({comparisonData.uniqueToB.length})
                </button>
              </div>

              {/* Test in Simulator CTA */}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onSelectForSimulation(fundBId)}
              >
                <Sparkles size={14} />
                <span>Simulate Buying {fundB?.name.slice(0, 15)}...</span>
              </button>
            </div>

            {/* Content Table */}
            {activeTab === 'common' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px' }}>Stock / Company</th>
                      <th style={{ padding: '10px 12px' }}>Sector</th>
                      <th style={{ padding: '10px 12px' }}>Weight in {fundA?.name.slice(0, 14)}...</th>
                      <th style={{ padding: '10px 12px' }}>Weight in {fundB?.name.slice(0, 14)}...</th>
                      <th style={{ padding: '10px 12px' }}>Min Overlap Weight</th>
                      <th style={{ padding: '10px 12px' }}>Weight Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.commonStocks.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.stock}</span>
                          {s.ticker && (
                            <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--cyan-primary)', marginLeft: '6px' }}>
                              ({s.ticker})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{s.sector}</td>
                        <td style={{ padding: '10px 12px' }} className="mono">{s.weightInA}%</td>
                        <td style={{ padding: '10px 12px' }} className="mono">{s.weightInB}%</td>
                        <td style={{ padding: '10px 12px' }} className="mono" style={{ color: 'var(--cyan-primary)', fontWeight: 700 }}>
                          {s.minOverlapWeight}%
                        </td>
                        <td style={{ padding: '10px 12px' }} className="mono" style={{ color: 'var(--text-muted)' }}>
                          ±{s.weightDifference}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'uniqueA' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px' }}>Stock / Company</th>
                      <th style={{ padding: '10px 12px' }}>Sector</th>
                      <th style={{ padding: '10px 12px' }}>Market Cap</th>
                      <th style={{ padding: '10px 12px' }}>Holding Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.uniqueToA.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.stock}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{s.sector}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{s.marketCap}</td>
                        <td style={{ padding: '10px 12px' }} className="mono" style={{ color: 'var(--cyan-primary)' }}>
                          {s.weight}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'uniqueB' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px' }}>Stock / Company</th>
                      <th style={{ padding: '10px 12px' }}>Sector</th>
                      <th style={{ padding: '10px 12px' }}>Market Cap</th>
                      <th style={{ padding: '10px 12px' }}>Holding Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.uniqueToB.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.stock}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{s.sector}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{s.marketCap}</td>
                        <td style={{ padding: '10px 12px' }} className="mono" style={{ color: 'var(--violet-accent)' }}>
                          {s.weight}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
