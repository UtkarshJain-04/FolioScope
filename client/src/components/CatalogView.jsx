import React, { useState } from 'react';
import { BookOpen, Search, Sparkles, Plus, TrendingUp, ShieldCheck } from 'lucide-react';

export default function CatalogView({
  funds,
  onSelectForSimulation,
  onAddToPortfolio
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = [
    'All',
    'Large Cap',
    'Flexi Cap',
    'Mid Cap',
    'Small Cap',
    'Thematic - Technology',
    'Index Fund',
    'International - US Large Cap'
  ];

  const filteredFunds = funds.filter(f => {
    const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      f.name.toLowerCase().includes(q) ||
      f.amc.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      f.topHoldings?.some(h => h.stock.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="badge badge-lime">
            <BookOpen size={13} /> MUTUAL FUND CATALOG
          </span>
        </div>
        <h1 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>
          Explore Mutual Funds & Holdings
        </h1>
        <p style={{ color: 'var(--silver-neutral)', fontSize: '0.88rem' }}>
          Browse authentic portfolios of India's and the world's leading equity schemes. Click to simulate how adding any scheme shifts your portfolio overlap.
        </p>
      </div>

      {/* Search and Category Filters */}
      <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ position: 'relative', maxWidth: '450px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-control"
            placeholder="Search by fund name, AMC, or stock holding..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '38px' }}
          />
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCategory(cat)}
              style={{ fontSize: '0.78rem', borderRadius: 'var(--radius-full)' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Mutual Funds */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {filteredFunds.map(fund => (
          <div
            key={fund.id}
            className="glass-panel"
            style={{
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'transform 0.2s, border-color 0.2s'
            }}
          >
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>
                  {fund.category}
                </span>
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--emerald-success)', fontWeight: 700 }}>
                  3Y: +{fund.cagr3Y}%
                </span>
              </div>

              <h3 style={{ fontSize: '1.15rem', marginBottom: '4px', lineHeight: 1.3 }}>
                {fund.name}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                {fund.amc}
              </p>

              {/* Fund Stats Mini-grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>AUM</div>
                  <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    ₹{fund.aum?.toLocaleString()} Cr
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>NAV</div>
                  <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    ₹{fund.nav}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Expense</div>
                  <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    {fund.expenseRatio}%
                  </div>
                </div>
              </div>

              {/* Top 4 Holdings snippet */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Top Holdings
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {fund.topHoldings?.slice(0, 4).map((h, i) => (
                    <span
                      key={i}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {h.stock} <span className="mono" style={{ color: 'var(--cyan-primary)' }}>{h.weight}%</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', paddingTop: '14px', borderTop: '1px solid var(--border-glass)' }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
                onClick={() => onSelectForSimulation(fund.id)}
              >
                <Sparkles size={14} />
                <span>Simulate Buying</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onAddToPortfolio(fund.id)}
                title="Add to Current Portfolio Basket"
              >
                <Plus size={14} />
                <span>Add to Portfolio</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
