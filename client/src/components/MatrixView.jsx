import React, { useState, useEffect } from 'react';
import { Grid, Sparkles, Check, Info, X } from 'lucide-react';

export default function MatrixView({ funds, onSelectForSimulation }) {
  // Default selected funds (5 diverse funds)
  const [selectedFundIds, setSelectedFundIds] = useState([
    'ppfas-flexi-cap',
    'mirae-large-midcap',
    'hdfc-top-100',
    'uti-nifty-50-index',
    'nippon-small-cap'
  ]);
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCellPair, setSelectedCellPair] = useState(null);
  const [pairDetails, setPairDetails] = useState(null);

  useEffect(() => {
    if (selectedFundIds.length >= 2) {
      fetchMatrix();
    }
  }, [selectedFundIds]);

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/overlap/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundIds: selectedFundIds })
      });
      const data = await res.json();
      if (data.success) {
        setMatrixData(data.data);
      }
    } catch (err) {
      console.error('Error fetching matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFund = (id) => {
    if (selectedFundIds.includes(id)) {
      if (selectedFundIds.length <= 2) {
        alert('Please keep at least 2 funds selected to view the matrix.');
        return;
      }
      setSelectedFundIds(selectedFundIds.filter(fId => fId !== id));
    } else {
      if (selectedFundIds.length >= 8) {
        alert('You can select up to 8 funds simultaneously for optimal matrix readability.');
        return;
      }
      setSelectedFundIds([...selectedFundIds, id]);
    }
  };

  const handleCellClick = async (fundAId, fundBId) => {
    if (fundAId === fundBId) return;
    try {
      const res = await fetch('/api/overlap/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundAId, fundBId })
      });
      const data = await res.json();
      if (data.success) {
        setPairDetails(data.data);
        setSelectedCellPair({ fundAId, fundBId });
      }
    } catch (err) {
      console.error('Error fetching cell pair:', err);
    }
  };

  // Helper for heatmap cell color
  const getCellBg = (val, isSelf) => {
    if (isSelf) return 'rgba(255, 255, 255, 0.05)';
    if (val < 15) return 'rgba(205, 255, 35, 0.22)'; // Lime
    if (val < 30) return 'rgba(49, 69, 17, 0.65)';   // Olive
    if (val < 45) return 'rgba(245, 158, 11, 0.25)'; // Amber
    return 'rgba(244, 63, 94, 0.35)';                 // Rose
  };

  const getCellTextColor = (val, isSelf) => {
    if (isSelf) return 'var(--text-muted)';
    if (val < 15) return '#cdff23';
    if (val < 30) return '#c3c3c3';
    if (val < 45) return '#fbbf24';
    return '#fb7185';
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="badge badge-lime">
            <Grid size={13} /> MULTI-FUND HEATMAP MATRIX
          </span>
        </div>
        <h1 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>
          Mutual Fund Overlap Matrix
        </h1>
        <p style={{ color: 'var(--silver-neutral)', fontSize: '0.88rem' }}>
          Evaluate cross-portfolio stock duplication across 2 to 8 funds simultaneously. Click on any heatmap cell to inspect common stocks.
        </p>
      </div>

      {/* Fund Selector Pills */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Select Funds for Matrix ({selectedFundIds.length}/8):
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {funds.map(f => {
            const isSelected = selectedFundIds.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggleFund(f.id)}
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                {isSelected && <Check size={13} />}
                <span>{f.name}</span>
                <span style={{ opacity: 0.75, fontSize: '0.7rem' }}>({f.category})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Heatmap Matrix Table */}
      {matrixData && (
        <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '1.15rem' }}>Cross-Fund Pairwise Overlap Heatmap</h2>

            {/* Heatmap Color Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)' }}>Overlap Legend:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.4)' }} />
                <span>&lt; 15% (Low)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(6, 182, 212, 0.4)' }} />
                <span>15 - 30% (Moderate)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.4)' }} />
                <span>30 - 45% (High)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(244, 63, 94, 0.5)' }} />
                <span>&gt; 45% (Excessive)</span>
              </div>
            </div>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '600px' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Funds
                </th>
                {matrixData.funds.map((f, idx) => (
                  <th
                    key={f.id}
                    style={{
                      padding: '12px 8px',
                      textAlign: 'center',
                      borderBottom: '1px solid var(--border-glass)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      maxWidth: '120px'
                    }}
                    title={f.name}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name.split(' ')[0]} {f.name.split(' ')[1] || ''}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixData.matrix.map((row, rowIdx) => {
                const rowFund = matrixData.funds[rowIdx];
                return (
                  <tr key={rowFund.id}>
                    {/* Row header */}
                    <td
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {rowFund.name}
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                        ({rowFund.category})
                      </span>
                    </td>

                    {/* Matrix Cells */}
                    {row.map((cell, colIdx) => {
                      const isSelf = rowIdx === colIdx;
                      const colFund = matrixData.funds[colIdx];
                      return (
                        <td
                          key={cell.fundBId}
                          onClick={() => !isSelf && handleCellClick(rowFund.id, colFund.id)}
                          style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            background: getCellBg(cell.overlapPercentage, isSelf),
                            cursor: isSelf ? 'default' : 'pointer',
                            transition: 'transform 0.15s, background-color 0.15s'
                          }}
                          title={isSelf ? 'Same fund' : `Click to view common stocks between ${rowFund.name} and ${colFund.name}`}
                        >
                          <div
                            className="mono"
                            style={{
                              fontSize: isSelf ? '0.75rem' : '0.9rem',
                              fontWeight: 700,
                              color: getCellTextColor(cell.overlapPercentage, isSelf)
                            }}
                          >
                            {cell.overlapPercentage}%
                          </div>
                          {!isSelf && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {cell.commonStocksCount} common
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Cell Modal / Drawer */}
      {pairDetails && selectedCellPair && (
        <div
          className="glass-panel animate-fade"
          style={{
            padding: '22px',
            borderColor: 'var(--cyan-primary)',
            background: 'rgba(15, 23, 42, 0.95)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <span className="badge badge-cyan" style={{ marginBottom: '6px' }}>Pairwise Inspection</span>
              <h3 style={{ fontSize: '1.2rem' }}>
                {pairDetails.fundA.name} <span style={{ color: 'var(--cyan-primary)' }}>vs</span> {pairDetails.fundB.name}
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onSelectForSimulation(pairDetails.fundB.id)}
              >
                <Sparkles size={14} />
                <span>Simulate Buying {pairDetails.fundB.name.slice(0, 15)}...</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setPairDetails(null);
                  setSelectedCellPair(null);
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Overlap Percentage: <strong className="mono" style={{ color: 'var(--cyan-primary)' }}>{pairDetails.overlapPercentage}%</strong>
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Common Stocks: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{pairDetails.commonStocksCount}</strong>
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total Unique Companies: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{pairDetails.totalUniqueStocksCount}</strong>
            </span>
          </div>

          {/* List of common stocks */}
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px' }}>Stock</th>
                  <th style={{ padding: '8px' }}>Sector</th>
                  <th style={{ padding: '8px' }}>Weight in {pairDetails.fundA.name.slice(0, 12)}...</th>
                  <th style={{ padding: '8px' }}>Weight in {pairDetails.fundB.name.slice(0, 12)}...</th>
                  <th style={{ padding: '8px' }}>Min Overlap</th>
                </tr>
              </thead>
              <tbody>
                {pairDetails.commonStocks.map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{s.stock}</td>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{s.sector}</td>
                    <td style={{ padding: '8px' }} className="mono">{s.weightInA}%</td>
                    <td style={{ padding: '8px' }} className="mono">{s.weightInB}%</td>
                    <td style={{ padding: '8px', color: 'var(--cyan-primary)', fontWeight: 700 }} className="mono">
                      {s.minOverlapWeight}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
