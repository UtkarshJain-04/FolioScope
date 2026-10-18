import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2, Sparkles } from 'lucide-react';

export default function AddCustomFundModal({ isOpen, onClose, onFundAdded }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Flexi Cap');
  const [amc, setAmc] = useState('My Custom Basket');
  const [expenseRatio, setExpenseRatio] = useState('0.50');
  const [holdings, setHoldings] = useState([
    { stock: 'Reliance Industries Ltd', ticker: 'RELIANCE', sector: 'Energy / Oil & Gas', marketCap: 'Large Cap', weight: 15 },
    { stock: 'HDFC Bank Ltd', ticker: 'HDFCBANK', sector: 'Financial Services', marketCap: 'Large Cap', weight: 15 },
    { stock: 'Tata Consultancy Services', ticker: 'TCS', sector: 'Technology', marketCap: 'Large Cap', weight: 12 },
    { stock: 'Infosys Ltd', ticker: 'INFY', sector: 'Technology', marketCap: 'Large Cap', weight: 10 },
    { stock: 'Larsen & Toubro Ltd', ticker: 'LT', sector: 'Capital Goods', marketCap: 'Large Cap', weight: 8 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalWeight = holdings.reduce((sum, h) => sum + (Number(h.weight) || 0), 0);

  const handleAddRow = () => {
    setHoldings([
      ...holdings,
      { stock: '', ticker: '', sector: 'Financial Services', marketCap: 'Mid Cap', weight: 5 }
    ]);
  };

  const handleRemoveRow = (index) => {
    if (holdings.length <= 1) return;
    setHoldings(holdings.filter((_, i) => i !== index));
  };

  const handleUpdateRow = (index, field, value) => {
    const updated = [...holdings];
    updated[index][field] = field === 'weight' ? Number(value) : value;
    setHoldings(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a fund name');
      return;
    }
    const validHoldings = holdings.filter(h => h.stock.trim() && h.weight > 0);
    if (validHoldings.length === 0) {
      alert('Please add at least one stock with weight > 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/funds/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          amc,
          expenseRatio: Number(expenseRatio) || 0.5,
          holdings: validHoldings
        })
      });
      const data = await res.json();
      if (data.success) {
        onFundAdded(data.data);
        onClose();
      } else {
        alert(data.message || 'Failed to save custom fund');
      }
    } catch (err) {
      console.error('Error saving custom fund:', err);
      alert('Network error while saving custom fund');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 10, 3, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        className="glass-panel animate-fade"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#0e1608',
          borderColor: 'var(--lime-accent)',
          boxShadow: 'var(--shadow-tactile-lime)',
          padding: '24px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <span className="badge badge-lime" style={{ marginBottom: '6px' }}>MANUAL FUND CREATION</span>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--lime-accent)', marginTop: '4px' }}>
              Add Custom Mutual Fund / Portfolio
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)', marginTop: '4px' }}>
              Create a custom fund or custom equity portfolio to calculate overlap and simulate additions.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Metadata Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Fund / Portfolio Name *
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="e.g. My High Conviction PMS"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Category
              </label>
              <select
                className="input-control"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="Large Cap">Large Cap</option>
                <option value="Flexi Cap">Flexi Cap</option>
                <option value="Mid Cap">Mid Cap</option>
                <option value="Small Cap">Small Cap</option>
                <option value="Thematic - Technology">Thematic - Technology</option>
                <option value="Custom Portfolio">Custom Portfolio</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Provider / AMC
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="e.g. My Custom Portfolio"
                value={amc}
                onChange={(e) => setAmc(e.target.value)}
              />
            </div>
          </div>

          {/* Holdings Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Stock Holdings & Weights:</span>
              <span className="mono" style={{ fontSize: '0.8rem', color: totalWeight > 100 ? 'var(--rose-danger)' : 'var(--cyan-primary)' }}>
                Total Weight: <strong>{totalWeight}%</strong>
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {holdings.map((h, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Stock Name"
                    value={h.stock}
                    onChange={(e) => handleUpdateRow(idx, 'stock', e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                    required
                  />
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Ticker"
                    value={h.ticker}
                    onChange={(e) => handleUpdateRow(idx, 'ticker', e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                  />
                  <select
                    className="input-control"
                    value={h.sector}
                    onChange={(e) => handleUpdateRow(idx, 'sector', e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                  >
                    <option value="Financial Services">Financial Services</option>
                    <option value="Technology">Technology</option>
                    <option value="Consumer Staples">Consumer Staples</option>
                    <option value="Consumer Discretionary">Consumer Discretionary</option>
                    <option value="Energy / Oil & Gas">Energy / Oil & Gas</option>
                    <option value="Capital Goods">Capital Goods</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Automobile">Automobile</option>
                    <option value="Chemicals">Chemicals</option>
                    <option value="Utilities">Utilities</option>
                  </select>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      max="100"
                      className="input-control mono"
                      placeholder="Weight %"
                      value={h.weight}
                      onChange={(e) => handleUpdateRow(idx, 'weight', e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '8px 10px', paddingRight: '20px' }}
                      required
                    />
                    <span style={{ position: 'absolute', right: '8px', top: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>%</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemoveRow(idx)}
                    style={{ padding: '8px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddRow}
              style={{ marginTop: '10px' }}
            >
              <Plus size={14} /> Add Stock Row
            </button>
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save & Make Available'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
