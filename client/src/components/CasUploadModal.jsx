import React, { useState } from 'react';
import {
  X,
  Upload,
  FileText,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Layers,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';

export default function CasUploadModal({
  isOpen,
  onClose,
  onImportToPortfolio
}) {
  const [activeTab, setActiveTab] = useState('upload'); // upload, paste, demo
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [selectedSchemes, setSelectedSchemes] = useState({});

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg('');
    }
  };

  const handleParse = async () => {
    setErrorMsg('');
    setIsParsing(true);

    try {
      let res;
      if (activeTab === 'upload') {
        if (!file) {
          setErrorMsg('Please select a CAS file to upload.');
          setIsParsing(false);
          return;
        }

        const formData = new FormData();
        formData.append('casFile', file);
        if (password) formData.append('password', password);

        res = await fetch('/api/portfolio/upload-cas', {
          method: 'POST',
          body: formData
        });
      } else if (activeTab === 'paste') {
        if (!pastedText.trim()) {
          setErrorMsg('Please paste your CAS statement text.');
          setIsParsing(false);
          return;
        }

        res = await fetch('/api/portfolio/upload-cas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ casText: pastedText })
        });
      } else if (activeTab === 'demo') {
        res = await fetch('/api/portfolio/sample-cas');
      }

      const data = await res.json();
      if (data.success) {
        const parsed = data.data || data.parsed;
        setParsedData(parsed);

        // Pre-select all schemes
        const initialSelected = {};
        parsed.schemes.forEach((s, idx) => {
          initialSelected[s.id || idx] = true;
        });
        setSelectedSchemes(initialSelected);
      } else {
        setErrorMsg(data.message || 'Failed to parse CAS statement');
      }
    } catch (err) {
      console.error('Error uploading CAS:', err);
      setErrorMsg('Failed to process statement. Please check file format or password.');
    } finally {
      setIsParsing(false);
    }
  };

  // Toggle scheme selection
  const handleToggleScheme = (schemeId) => {
    setSelectedSchemes(prev => ({
      ...prev,
      [schemeId]: !prev[schemeId]
    }));
  };

  // Handle final import
  const handleConfirmImport = () => {
    if (!parsedData || !parsedData.schemes) return;

    const schemesToImport = parsedData.schemes.filter((s, idx) => selectedSchemes[s.id || idx]);
    if (schemesToImport.length === 0) {
      alert('Please select at least one fund to import!');
      return;
    }

    const portfolioItems = schemesToImport.map(s => ({
      fundId: s.fundId,
      investmentAmount: s.investmentAmount || s.currentValuation || 50000,
      weight: 0
    }));

    onImportToPortfolio(portfolioItems);
    onClose();
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
          maxWidth: '820px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#0e1608',
          borderColor: 'var(--lime-accent)',
          boxShadow: 'var(--shadow-tactile-lime)',
          padding: '24px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-lime">CAS PARSER [CAMS / KFINTECH]</span>
            </div>
            <h2 style={{ fontSize: '1rem', color: 'var(--lime-accent)', marginBottom: '4px' }}>
              Import Consolidated Account Statement (CAS)
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--silver-neutral)' }}>
              Upload your mutual fund CAS statement (PDF/CSV/Text). We will parse all held schemes, folios, and valuations to populate your portfolio.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px' }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Not yet parsed: Show Upload / Input Forms */}
        {!parsedData ? (
          <div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              <button
                className={`btn btn-sm ${activeTab === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setActiveTab('upload'); setErrorMsg(''); }}
              >
                <Upload size={14} /> Upload CAS File (PDF / CSV)
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'paste' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setActiveTab('paste'); setErrorMsg(''); }}
              >
                <FileText size={14} /> Paste Statement Text
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'demo' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setActiveTab('demo'); setErrorMsg(''); }}
              >
                <Sparkles size={14} /> Load Demo CAMS Statement
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid var(--rose-danger)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.8rem',
                  color: '#fb7185'
                }}
              >
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Tab 1: File Upload */}
            {activeTab === 'upload' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    border: '2px dashed var(--olive-dark)',
                    borderRadius: 'var(--radius-md)',
                    padding: '28px 20px',
                    textAlign: 'center',
                    background: 'rgba(22, 33, 11, 0.4)',
                    cursor: 'pointer'
                  }}
                  onClick={() => document.getElementById('cas-file-input')?.click()}
                >
                  <Upload size={32} color="var(--lime-accent)" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {file ? file.name : 'Click or Drag & Drop your CAS Statement here'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--silver-neutral)' }}>
                    Supports CAMS, KFintech, CDSL & NSDL PDFs or CSV / Excel exports
                  </div>
                  <input
                    id="cas-file-input"
                    type="file"
                    accept=".pdf,.csv,.txt,.json,.xlsx"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Password field for protected PDF */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--silver-neutral)', marginBottom: '6px' }}>
                    <Lock size={13} color="var(--lime-accent)" />
                    CAS PDF Password (Optional - usually your PAN in UPPERCASE or Date of Birth DDMMYYYY):
                  </label>
                  <input
                    type="password"
                    className="input-control"
                    placeholder="e.g. ABCDE1234F"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Paste Statement Text */}
            {activeTab === 'paste' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)' }}>
                  Paste the text content of your CAMS or KFintech CAS statement:
                </label>
                <textarea
                  className="input-control mono"
                  rows={8}
                  placeholder={`Paste statement text here, e.g.:\nParag Parikh Flexi Cap Fund - Direct Plan - Growth\nFolio: 10458921 / 0\nValuation: INR 75,344\n\nMirae Asset Large & Midcap Fund\nValuation: INR 62,000`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  style={{ fontSize: '0.78rem', resize: 'vertical' }}
                />
              </div>
            )}

            {/* Tab 3: Demo CAMS Statement */}
            {activeTab === 'demo' && (
              <div
                style={{
                  background: 'rgba(49, 69, 17, 0.3)',
                  border: '1px solid var(--olive-dark)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  fontSize: '0.82rem',
                  color: 'var(--silver-neutral)'
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--lime-accent)', marginBottom: '6px' }}>
                  Ready-to-Test Sample CAMS Statement
                </div>
                <p style={{ marginBottom: '10px' }}>
                  Click below to instantly parse a pre-loaded authentic CAMS statement with 4 real mutual fund holdings:
                </p>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  <li>Parag Parikh Flexi Cap Fund (₹75,344)</li>
                  <li>Mirae Asset Large & Midcap Fund (₹62,000)</li>
                  <li>UTI Nifty 50 Index Fund (₹40,000)</li>
                  <li>Nippon India Small Cap Fund (₹35,000)</li>
                </ul>
              </div>
            )}

            {/* Action Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleParse}
                disabled={isParsing}
              >
                {isParsing ? (
                  <span>Parsing Statement...</span>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>{activeTab === 'demo' ? 'Load & Parse Demo Statement' : 'Parse CAS Statement'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* =========================================================
             PARSED RESULTS REVIEW & IMPORT STEP
             ========================================================= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Investor Summary Banner */}
            <div
              style={{
                background: 'rgba(49, 69, 17, 0.35)',
                border: '1px solid var(--olive-dark)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--silver-neutral)' }}>Investor Name</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {parsedData.investor?.name || 'Valued Investor'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--silver-neutral)' }}>Total Current Valuation</div>
                <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--lime-accent)' }}>
                  ₹{parsedData.summary?.totalValuation?.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--silver-neutral)' }}>Total Cost / Gain</div>
                <div className="mono" style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ₹{parsedData.summary?.totalCost?.toLocaleString()}{' '}
                  <span style={{ color: 'var(--lime-accent)', fontSize: '0.78rem' }}>
                    (+{parsedData.summary?.gainPercentage}%)
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--silver-neutral)' }}>Schemes Detected</div>
                <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {parsedData.schemes?.length} Mutual Funds
                </div>
              </div>
            </div>

            {/* Scheme List Review Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--lime-accent)', textTransform: 'uppercase' }}>
                  Select Schemes to Import to Portfolio:
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--silver-neutral)' }}>
                  Checked schemes will populate your active basket
                </span>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {parsedData.schemes.map((scheme, idx) => {
                  const schemeKey = scheme.id || idx;
                  const isChecked = selectedSchemes[schemeKey] !== false;

                  return (
                    <div
                      key={schemeKey}
                      onClick={() => handleToggleScheme(schemeKey)}
                      style={{
                        background: isChecked ? 'rgba(49, 69, 17, 0.45)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isChecked ? 'var(--lime-accent)' : 'var(--olive-dark)'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleScheme(schemeKey)}
                          style={{ accentColor: 'var(--lime-accent)', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {scheme.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--silver-neutral)' }}>
                            {scheme.amc} • Folio: <span className="mono">{scheme.folio}</span> • {scheme.holdingsCount} holdings
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div className="mono" style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--lime-accent)' }}>
                          ₹{Number(scheme.investmentAmount || scheme.currentValuation).toLocaleString()}
                        </div>
                        <span className="badge badge-lime" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                          ✓ {scheme.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--olive-dark)', paddingTop: '16px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setParsedData(null)}
              >
                ← Back to Upload
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirmImport}
                >
                  <CheckCircle2 size={16} />
                  <span>Import All Funds to Current Portfolio</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
