import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Smartphone,
  KeyRound,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Sliders,
  Sparkles,
  Lock,
  Layers,
  Database,
  Building2,
  Check,
  TrendingUp,
  FileCheck
} from 'lucide-react';

export default function SetuAccountAggregatorModal({
  isOpen,
  initialConsentId,
  onClose,
  onImportToPortfolio
}) {
  // Wizard steps: 'signin' | 'otp' | 'fetching' | 'review' | 'settings'
  const [step, setStep] = useState('signin');
  const [mobileNumber, setMobileNumber] = useState('9999999999');
  const [otp, setOtp] = useState('123456');
  const [consentId, setConsentId] = useState('');
  const [consentUrl, setConsentUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected FIPs
  const [selectedFips, setSelectedFips] = useState(['CAMS', 'KFintech']);

  // Fetched data
  const [fetchedData, setFetchedData] = useState(null);
  const [selectedSchemes, setSelectedSchemes] = useState({});

  // Setu Config
  const [config, setConfig] = useState(null);
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [productInstanceIdInput, setProductInstanceIdInput] = useState('');
  const [isConfigSaving, setIsConfigSaving] = useState(false);

  // Fetch current Setu config on open
  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setErrorMsg('');
      setSuccessMsg('');

      if (initialConsentId) {
        setConsentId(initialConsentId);
        setStep('fetching');
        handleTriggerDataSession(initialConsentId);
      }
    }
  }, [isOpen, initialConsentId]);

  // Auto-poll for status changes if user is completing webview in another window
  useEffect(() => {
    let timer;
    if (isOpen && step === 'otp' && consentId) {
      timer = setInterval(async () => {
        try {
          const res = await fetch(`/api/setu/consent/${consentId}/status`);
          const data = await res.json();
          if (data.success && (data.status === 'ACTIVE' || data.status === 'GRANTED')) {
            clearInterval(timer);
            setStep('fetching');
            handleTriggerDataSession(consentId);
          }
        } catch (_) {}
      }, 2500);
    }
    return () => clearInterval(timer);
  }, [isOpen, step, consentId]);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/setu/config');
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setProductInstanceIdInput(data.data.productInstanceId || '');
      }
    } catch (err) {
      console.error('Error fetching Setu config:', err);
    }
  };

  if (!isOpen) return null;

  // Toggle FIP selection
  const toggleFip = (fip) => {
    if (selectedFips.includes(fip)) {
      if (selectedFips.length > 1) {
        setSelectedFips(selectedFips.filter(f => f !== fip));
      }
    } else {
      setSelectedFips([...selectedFips, fip]);
    }
  };

  // Step 1: Create Consent Request via /api/setu/consent
  const handleInitiateConsent = async () => {
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/setu/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobileNumber,
          purposeText: 'Wealth management and mutual fund portfolio overlap analysis',
          fips: selectedFips,
          redirectUrl: `${window.location.origin}/api/setu/consent`
        })
      });

      const data = await res.json();
      if (data.success) {
        setConsentId(data.consentId);
        setConsentUrl(data.url || '');
        setStep('otp');
        if (data.testOtp) {
          setOtp(data.testOtp);
        }
      } else {
        setErrorMsg(data.message || 'Failed to create Setu consent request');
      }
    } catch (err) {
      console.error('Consent error:', err);
      setErrorMsg('Failed to connect to Setu AA server. Please check backend status.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Approve Consent via OTP (or via Webview redirect)
  const handleVerifyOtpAndApprove = async () => {
    if (!otp || otp.length !== 6) {
      setErrorMsg('Please enter a valid 6-digit OTP (for Sandbox use: 123456)');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch(`/api/setu/consent/${consentId}/simulate-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp })
      });

      const data = await res.json();
      if (data.success) {
        // Now trigger Data Session
        setStep('fetching');
        await handleTriggerDataSession(consentId);
      } else {
        setErrorMsg(data.message || 'OTP verification failed');
        setLoading(false);
      }
    } catch (err) {
      console.error('OTP error:', err);
      setErrorMsg('Error verifying OTP with Setu Sandbox');
      setLoading(false);
    }
  };

  // Step 3: Trigger Data Session & Fetch ReBIT MF Records
  const handleTriggerDataSession = async (cId) => {
    try {
      const sessionRes = await fetch('/api/setu/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentId: cId })
      });

      const sessionData = await sessionRes.json();
      if (!sessionData.success) {
        setErrorMsg(sessionData.message || 'Failed to initiate data session');
        setStep('otp');
        setLoading(false);
        return;
      }

      setSessionId(sessionData.sessionId);

      // Brief delay to simulate live FIP encryption/decryption experience
      setTimeout(async () => {
        try {
          const dataRes = await fetch(`/api/setu/session/${sessionData.sessionId}/data`);
          const fullData = await dataRes.json();

          if (fullData.success && fullData.data) {
            setFetchedData(fullData.data);

            // Pre-select all schemes
            const initialSelected = {};
            (fullData.data.schemes || []).forEach(s => {
              initialSelected[s.id] = true;
            });
            setSelectedSchemes(initialSelected);
            setStep('review');
          } else {
            setErrorMsg(fullData.message || 'Could not fetch ReBIT portfolio payload');
            setStep('otp');
          }
        } catch (fetchErr) {
          setErrorMsg('Failed to parse financial data from Setu session: ' + fetchErr.message);
          setStep('otp');
        } finally {
          setLoading(false);
        }
      }, 1000);
    } catch (err) {
      console.error('Session error:', err);
      setErrorMsg('Data session failed: ' + err.message);
      setStep('otp');
      setLoading(false);
    }
  };

  // Step 4: Toggle individual scheme
  const toggleScheme = (schemeId) => {
    setSelectedSchemes(prev => ({
      ...prev,
      [schemeId]: !prev[schemeId]
    }));
  };

  // Select all / Deselect all
  const selectAll = (val) => {
    if (!fetchedData?.schemes) return;
    const updated = {};
    fetchedData.schemes.forEach(s => {
      updated[s.id] = val;
    });
    setSelectedSchemes(updated);
  };

  // Confirm import to portfolio
  const handleConfirmImport = () => {
    if (!fetchedData || !fetchedData.schemes) return;

    const chosen = fetchedData.schemes.filter(s => selectedSchemes[s.id]);
    if (chosen.length === 0) {
      alert('Please select at least one mutual fund scheme to import.');
      return;
    }

    const portfolioItems = chosen.map(s => ({
      fundId: s.fundId,
      investmentAmount: s.currentValuation || 50000,
      weight: 0
    }));

    onImportToPortfolio(portfolioItems);
    onClose();
  };

  // Save Settings
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsConfigSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/setu/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientIdInput,
          clientSecret: clientSecretInput,
          productInstanceId: productInstanceIdInput
        })
      });

      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setSuccessMsg('Setu AA API settings updated successfully!');
      } else {
        setErrorMsg(data.message || 'Failed to update Setu config');
      }
    } catch (err) {
      setErrorMsg('Failed to save config: ' + err.message);
    } finally {
      setIsConfigSaving(false);
    }
  };

  // Calculate selected total valuation
  const selectedSchemesList = fetchedData?.schemes?.filter(s => selectedSchemes[s.id]) || [];
  const selectedTotalValuation = selectedSchemesList.reduce((sum, s) => sum + (s.currentValuation || 0), 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 10, 3, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 110,
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
          maxWidth: '740px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(15, 24, 8, 0.96)',
          border: '1px solid var(--lime-accent)',
          boxShadow: '0 0 35px rgba(205, 255, 35, 0.25), 4px 4px 0px var(--olive-dark)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--olive-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(28, 42, 15, 0.6)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(205, 255, 35, 0.15)',
                border: '1px solid var(--lime-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--lime-accent)'
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '0.86rem', letterSpacing: '-0.01em', margin: 0 }}>
                  SETU ACCOUNT AGGREGATOR
                </h2>
                <span className="badge badge-lime" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>
                  SANDBOX API
                </span>
                {config?.isConfigured && (
                  <span className="badge badge-emerald" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>
                    LIVE SANDBOX
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--silver-neutral)', marginTop: '2px' }}>
                Direct sign-in & instant mutual fund portfolio ingestion via RBI AA Framework
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className={`btn btn-secondary btn-sm ${step === 'settings' ? 'active' : ''}`}
              onClick={() => setStep(step === 'settings' ? 'signin' : 'settings')}
              title="API Configuration"
              style={{ padding: '6px 10px' }}
            >
              <Sliders size={13} />
              <span>Config</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Step Indicator Tracker (when not on settings) */}
        {step !== 'settings' && (
          <div
            style={{
              padding: '12px 22px',
              background: 'rgba(9, 15, 5, 0.7)',
              borderBottom: '1px solid var(--olive-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              color: 'var(--silver-neutral)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: step === 'signin' ? 'var(--lime-accent)' : 'inherit', fontWeight: step === 'signin' ? 700 : 400 }}>
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: step === 'signin' ? 'var(--lime-accent)' : 'var(--olive-dark)', color: step === 'signin' ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>1</span>
              <span>1. Sign-in</span>
            </div>
            <ArrowRight size={12} color="var(--olive-dark)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: step === 'otp' ? 'var(--lime-accent)' : 'inherit', fontWeight: step === 'otp' ? 700 : 400 }}>
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: step === 'otp' ? 'var(--lime-accent)' : 'var(--olive-dark)', color: step === 'otp' ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>2</span>
              <span>2. OTP Consent</span>
            </div>
            <ArrowRight size={12} color="var(--olive-dark)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: step === 'fetching' ? 'var(--lime-accent)' : 'inherit', fontWeight: step === 'fetching' ? 700 : 400 }}>
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: step === 'fetching' ? 'var(--lime-accent)' : 'var(--olive-dark)', color: step === 'fetching' ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>3</span>
              <span>3. Data Fetch</span>
            </div>
            <ArrowRight size={12} color="var(--olive-dark)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: step === 'review' ? 'var(--lime-accent)' : 'inherit', fontWeight: step === 'review' ? 700 : 400 }}>
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: step === 'review' ? 'var(--lime-accent)' : 'var(--olive-dark)', color: step === 'review' ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>4</span>
              <span>4. Ingest Portfolio</span>
            </div>
          </div>
        )}

        {/* Modal Body Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>
          {/* Error / Success Notifications */}
          {errorMsg && (
            <div
              style={{
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                color: '#fb7185',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                background: 'rgba(205, 255, 35, 0.12)',
                border: '1px solid var(--lime-accent)',
                color: 'var(--lime-accent)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ============================================================
              STEP 1: PHONE SIGN-IN & FIP DISCOVERY
              ============================================================ */}
          {step === 'signin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Value Proposition Hero */}
              <div
                style={{
                  background: 'rgba(49, 69, 17, 0.3)',
                  border: '1px solid var(--olive-dark)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(205, 255, 35, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--lime-accent)',
                    flexShrink: 0
                  }}
                >
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.78rem', marginBottom: '4px', color: 'var(--lime-accent)' }}>
                    ZERO-EFFORT PORTFOLIO FETCH
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)', lineHeight: 1.4 }}>
                    No need to download, enter passwords, or upload CAS statements. Sign in securely via Setu Account Aggregator to automatically pull all mutual fund folios directly from CAMS and KFintech!
                  </p>
                </div>
              </div>

              {/* Mobile Number Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Enter Mobile Number Linked to Mutual Funds
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '11px',
                        fontSize: '0.85rem',
                        color: 'var(--lime-accent)',
                        fontWeight: 700
                      }}
                    >
                      +91
                    </span>
                    <input
                      type="tel"
                      className="input-control mono"
                      style={{ paddingLeft: '45px', fontSize: '0.95rem' }}
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="9999999999"
                      maxLength={10}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setMobileNumber('9999999999')}
                    title="Fill standard Setu Sandbox test number"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Setu Sandbox Demo No.
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Setu AA sandbox will fetch simulated CAMS & KFintech mutual fund folios.
                  </span>
                  <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--lime-accent)' }}>
                    VPA: {mobileNumber || '...' }@setu
                  </span>
                </div>
              </div>

              {/* FIP Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Financial Information Providers (FIPs) to Query:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {[
                    { id: 'CAMS', label: 'CAMS Finserv', count: '3 Folios', sub: 'PPFAS, Mirae, UTI' },
                    { id: 'KFintech', label: 'KFin Technologies', count: '3 Folios', sub: 'Nippon, HDFC, Quant' }
                  ].map(fip => (
                    <div
                      key={fip.id}
                      onClick={() => toggleFip(fip.id)}
                      style={{
                        padding: '12px',
                        background: selectedFips.includes(fip.id) ? 'rgba(205, 255, 35, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${selectedFips.includes(fip.id) ? 'var(--lime-accent)' : 'var(--olive-dark)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: selectedFips.includes(fip.id) ? 'var(--lime-accent)' : 'var(--text-primary)' }}>
                          {fip.label}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--silver-neutral)', marginTop: '2px' }}>
                          {fip.count} • {fip.sub}
                        </div>
                      </div>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          background: selectedFips.includes(fip.id) ? 'var(--lime-accent)' : 'transparent',
                          border: '1px solid var(--lime-accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#000'
                        }}
                      >
                        {selectedFips.includes(fip.id) && <Check size={14} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Consent Parameters Overview */}
              <div
                style={{
                  background: 'rgba(9, 15, 5, 0.6)',
                  border: '1px solid var(--olive-dark)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  fontSize: '0.74rem',
                  color: 'var(--silver-neutral)'
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--lime-accent)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={13} />
                  CONSENT PARAMETERS (REBIT AA COMPLIANT)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div><strong>FI Types:</strong> MUTUAL_FUNDS, SIP</div>
                  <div><strong>Mode:</strong> VIEW (Read-only)</div>
                  <div><strong>Fetch Type:</strong> ONETIME (Instant)</div>
                  <div><strong>Data Range:</strong> Past 12 Months</div>
                </div>
              </div>

              {/* Action Button */}
              <button
                className="btn btn-primary"
                onClick={handleInitiateConsent}
                disabled={loading || !mobileNumber}
                style={{ width: '100%', padding: '12px' }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Connecting to Setu AA Sandbox...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={16} />
                    <span>Proceed to Setu Sign-in & OTP</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ============================================================
              STEP 2: OTP VERIFICATION & CONSENT APPROVAL
              ============================================================ */}
          {step === 'otp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  background: 'rgba(49, 69, 17, 0.3)',
                  border: '1px solid var(--olive-dark)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Setu Consent Identifier</div>
                  <div className="mono" style={{ fontSize: '0.85rem', color: 'var(--lime-accent)', fontWeight: 700 }}>
                    {consentId}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--silver-neutral)', marginTop: '4px' }}>
                    User: +91 {mobileNumber} • Status: <span className="badge badge-amber" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>PENDING</span>
                  </div>
                </div>

                {consentUrl && (
                  <a
                    href={consentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem' }}
                  >
                    <span>Open Webview</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* OTP Input Card */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  textAlign: 'center'
                }}
              >
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: 'rgba(205, 255, 35, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    color: 'var(--lime-accent)'
                  }}
                >
                  <KeyRound size={22} />
                </div>
                <h3 style={{ fontSize: '0.82rem', marginBottom: '4px' }}>
                  ENTER VERIFICATION OTP
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--silver-neutral)', marginBottom: '16px' }}>
                  Setu AA has dispatched a simulated verification OTP to <strong>+91 {mobileNumber}</strong>
                </p>

                {/* 6 Digit Box */}
                <div style={{ maxWidth: '240px', margin: '0 auto 12px' }}>
                  <input
                    type="text"
                    className="input-control mono"
                    style={{
                      textAlign: 'center',
                      fontSize: '1.4rem',
                      letterSpacing: '10px',
                      padding: '10px'
                    }}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setOtp('123456')}
                    style={{ fontSize: '0.72rem' }}
                  >
                    <span>Auto-fill Sandbox OTP (123456)</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep('signin')}
                  style={{ flex: 1 }}
                >
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleVerifyOtpAndApprove}
                  disabled={loading || otp.length !== 6}
                  style={{ flex: 2 }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Verifying & Establishing Session...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Approve Consent & Fetch Folios</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================
              STEP 3: REAL-TIME DATA EXTRACTION IN PROGRESS
              ============================================================ */}
          {step === 'fetching' && (
            <div style={{ padding: '30px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  border: '3px solid var(--border-glass)',
                  borderTopColor: 'var(--lime-accent)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
              <div>
                <h3 style={{ fontSize: '0.88rem', marginBottom: '8px' }}>
                  AGGREGATING MUTUAL FUND FOLIOS VIA SETU AA
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--silver-neutral)', maxWidth: '480px', margin: '0 auto' }}>
                  Securely querying CAMS and KFintech registries, decrypting financial payloads, and matching schemes with FolioScope catalog...
                </p>
              </div>

              {/* Progress Milestones */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '460px',
                  background: 'rgba(9, 15, 5, 0.8)',
                  border: '1px solid var(--olive-dark)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  textAlign: 'left',
                  fontSize: '0.76rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--lime-accent)' }}>
                  <CheckCircle2 size={14} />
                  <span>Consent Status: ACTIVE on Setu AA</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--lime-accent)' }}>
                  <CheckCircle2 size={14} />
                  <span>Data Session: {sessionId || 'INITIALIZED'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--lime-accent)' }}>
                  <CheckCircle2 size={14} />
                  <span>Querying CAMS & KFintech FIP Registries...</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--silver-neutral)' }}>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Normalizing ReBIT Mutual Fund Schema...</span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              STEP 4: HOLDINGS REVIEW & DIRECT IMPORT
              ============================================================ */}
          {step === 'review' && fetchedData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Profile & KPI Summary */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '12px'
                }}
              >
                <div className="glass-panel" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>INVESTOR</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {fetchedData.investor.name}
                  </div>
                  <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--silver-neutral)' }}>
                    PAN: {fetchedData.investor.pan}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TOTAL VALUE FETCHED</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--lime-accent)', marginTop: '2px' }}>
                    ₹{fetchedData.metrics.totalValuation.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--silver-neutral)' }}>
                    {fetchedData.metrics.totalFolios} Folios Discovered
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CATALOG MATCHED</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--lime-accent)', marginTop: '2px' }}>
                    {fetchedData.metrics.catalogMatchedCount} / {fetchedData.metrics.totalSchemes}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--silver-neutral)' }}>
                    100% Ready for Overlap
                  </div>
                </div>
              </div>

              {/* Table Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Discovered Mutual Fund Holdings ({selectedSchemesList.length}/{fetchedData.schemes.length} selected):
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => selectAll(true)}
                    style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => selectAll(false)}
                    style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Schemes List */}
              <div
                style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  border: '1px solid var(--olive-dark)',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(9, 15, 5, 0.7)'
                }}
              >
                {fetchedData.schemes.map(s => {
                  const isChecked = Boolean(selectedSchemes[s.id]);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleScheme(s.id)}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--olive-dark)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        background: isChecked ? 'rgba(205, 255, 35, 0.04)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          background: isChecked ? 'var(--lime-accent)' : 'transparent',
                          border: '1px solid var(--lime-accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#000',
                          flexShrink: 0
                        }}
                      >
                        {isChecked && <Check size={13} />}
                      </div>

                      {/* Scheme Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.schemeName}
                          </span>
                          {s.isCatalogMatched && (
                            <span className="badge badge-lime" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                              Catalog Match
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Folio: <span className="mono">{s.folioNumber}</span> • {s.registrar} • {s.units.toFixed(2)} units @ NAV ₹{s.nav}
                        </div>
                      </div>

                      {/* Valuation */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="mono" style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--lime-accent)' }}>
                          ₹{s.currentValuation.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--silver-neutral)' }}>
                          Share: <span className="mono">{s.weight}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Import Actions */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep('signin')}
                  style={{ flex: 1 }}
                >
                  <RefreshCw size={14} />
                  <span>Fetch Again</span>
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirmImport}
                  disabled={selectedSchemesList.length === 0}
                  style={{ flex: 2, padding: '12px' }}
                >
                  <Sparkles size={16} />
                  <span>
                    Import {selectedSchemesList.length} Funds (₹{selectedTotalValuation.toLocaleString()}) to Portfolio
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================
              SETTINGS TAB: SETU AA API CREDENTIALS CONFIGURATION
              ============================================================ */}
          {step === 'settings' && (
            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: 'rgba(49, 69, 17, 0.3)',
                  border: '1px solid var(--olive-dark)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  fontSize: '0.76rem',
                  color: 'var(--silver-neutral)'
                }}
              >
                <strong style={{ color: 'var(--lime-accent)' }}>Setu Account Aggregator Credentials:</strong>
                <p style={{ marginTop: '4px', lineHeight: 1.4 }}>
                  FolioScope works right out of the box with built-in Setu AA Sandbox simulation. To connect to your live Setu Sandbox bridge account (`fiu-sandbox.setu.co`), enter your Client ID and Product Instance ID below from{' '}
                  <a href="https://bridge.setu.co" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--lime-accent)', textDecoration: 'underline' }}>
                    bridge.setu.co
                  </a>.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                  Setu Product Instance ID
                </label>
                <input
                  type="text"
                  className="input-control mono"
                  value={productInstanceIdInput}
                  onChange={(e) => setProductInstanceIdInput(e.target.value)}
                  placeholder="e.g. 5f3a5564-9abc-48f9-ae32-af4b22c781ce"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                  Setu Client ID
                </label>
                <input
                  type="text"
                  className="input-control mono"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder={config?.clientIdMasked || "e.g. client_id_..."}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                  Setu Client Secret
                </label>
                <input
                  type="password"
                  className="input-control mono"
                  value={clientSecretInput}
                  onChange={(e) => setClientSecretInput(e.target.value)}
                  placeholder="e.g. client_secret_..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStep('signin')}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isConfigSaving}
                  style={{ flex: 2 }}
                >
                  {isConfigSaving ? 'Saving...' : 'Save Configuration & Connect'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
