import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SimulatorView from './components/SimulatorView';
import MatrixView from './components/MatrixView';
import ComparatorView from './components/ComparatorView';
import CatalogView from './components/CatalogView';
import AddCustomFundModal from './components/AddCustomFundModal';
import CasUploadModal from './components/CasUploadModal';
import SetuAccountAggregatorModal from './components/SetuAccountAggregatorModal';
import AIAdvisorView from './components/AIAdvisorView';

export default function App() {
  const [activeTab, setActiveTab] = useState('simulator');
  const [funds, setFunds] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  // Default initial portfolio
  const [currentPortfolio, setCurrentPortfolio] = useState([
    { fundId: 'ppfas-flexi-cap', investmentAmount: 50000, weight: 0.5 },
    { fundId: 'mirae-large-midcap', investmentAmount: 50000, weight: 0.5 }
  ]);

  // Prospective fund under evaluation
  const [prospectiveFundId, setProspectiveFundId] = useState('hdfc-top-100');
  const [simulationResult, setSimulationResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isCasModalOpen, setIsCasModalOpen] = useState(false);
  const [isSetuModalOpen, setIsSetuModalOpen] = useState(false);
  const [initialSetuConsentId, setInitialSetuConsentId] = useState('');

  // Auto-detect Setu AA return callback or popup message
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const consentId = params.get('setu_consent_id') || params.get('consent_id') || params.get('id');
    const isCallbackPath = ['/callback', '/success'].includes(window.location.pathname);
    
    if (consentId || isCallbackPath) {
      if (consentId) setInitialSetuConsentId(consentId);
      setIsSetuModalOpen(true);
      // Clean query params and reset path to root without full page reload
      window.history.replaceState({}, document.title, '/');
    }

    const handleMessage = (event) => {
      if (event.data?.type === 'SETU_CONSENT_APPROVED' && event.data?.consentId) {
        setInitialSetuConsentId(event.data.consentId);
        setIsSetuModalOpen(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Fetch initial funds catalog and saved portfolios
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [fundsRes, portfoliosRes] = await Promise.all([
        fetch('/api/funds'),
        fetch('/api/portfolios')
      ]);

      if (fundsRes.ok) {
        const fundsData = await fundsRes.json();
        if (fundsData.success) {
          setFunds(fundsData.data);
          setApiOnline(true);
        }
      }

      if (portfoliosRes.ok) {
        const portfoliosData = await portfoliosRes.json();
        if (portfoliosData.success) {
          setPortfolios(portfoliosData.data);
        }
      }
    } catch (err) {
      console.error('Initial data fetch error:', err);
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  };

  // Run simulation calculation
  const runSimulation = useCallback(async (targetProspectiveFundId, targetAmount) => {
    const fundToSimulate = targetProspectiveFundId || prospectiveFundId;
    if (!fundToSimulate || currentPortfolio.length === 0) return;

    setIsSimulating(true);
    try {
      const res = await fetch('/api/overlap/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPortfolio,
          prospectiveFundId: fundToSimulate,
          prospectiveAmount: targetAmount || 30000
        })
      });

      const data = await res.json();
      if (data.success) {
        setSimulationResult(data.data);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  }, [currentPortfolio, prospectiveFundId]);

  // Auto-run simulation when currentPortfolio or prospectiveFundId changes
  useEffect(() => {
    if (funds.length > 0 && prospectiveFundId && currentPortfolio.length > 0) {
      runSimulation(prospectiveFundId);
    }
  }, [currentPortfolio, prospectiveFundId, funds.length, runSimulation]);

  // Handle selecting a fund from Catalog / Matrix to simulate buying
  const handleSelectForSimulation = (fundId) => {
    setProspectiveFundId(fundId);
    setActiveTab('simulator');
    runSimulation(fundId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle adding a fund to current portfolio basket
  const handleAddToPortfolio = (fundId) => {
    if (currentPortfolio.some(p => p.fundId === fundId)) {
      alert('Fund is already in your current portfolio!');
      return;
    }
    const updated = [
      ...currentPortfolio,
      { fundId, investmentAmount: 50000, weight: 0.3 }
    ];
    setCurrentPortfolio(updated);
    setActiveTab('simulator');
  };

  // Handle loading a preset portfolio
  const handleLoadPreset = (presetId) => {
    const found = portfolios.find(p => p.id === presetId);
    if (found && found.items) {
      setCurrentPortfolio(found.items);
      setActiveTab('simulator');
    }
  };

  // Handle import from parsed CAS statement
  const handleImportFromCas = (importedItems) => {
    if (!importedItems || importedItems.length === 0) return;
    setCurrentPortfolio(importedItems);
    setActiveTab('simulator');
  };

  // Handle import from Setu Account Aggregator
  const handleImportFromSetu = (importedItems) => {
    if (!importedItems || importedItems.length === 0) return;
    setCurrentPortfolio(importedItems);
    setActiveTab('simulator');
  };

  // Handle new custom fund added
  const handleCustomFundAdded = (newFund) => {
    setFunds(prev => [newFund, ...prev]);
    alert(`Custom fund "${newFund.name}" successfully created and added to catalog!`);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiOnline={apiOnline}
        fundsCount={funds.length}
        onOpenCustomModal={() => setIsCustomModalOpen(true)}
        onOpenCasModal={() => setIsCasModalOpen(true)}
        onOpenSetuModal={() => setIsSetuModalOpen(true)}
        onLoadPreset={handleLoadPreset}
        portfolios={portfolios}
      />

      {/* Main View Area */}
      <main className="container" style={{ flex: 1, padding: '30px 20px 60px' }}>
        {loading ? (
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
              Initializing FolioScope AI & Mutual Fund Engines...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'simulator' && (
              <SimulatorView
                funds={funds}
                currentPortfolio={currentPortfolio}
                setCurrentPortfolio={setCurrentPortfolio}
                prospectiveFundId={prospectiveFundId}
                setProspectiveFundId={setProspectiveFundId}
                simulationResult={simulationResult}
                isSimulating={isSimulating}
                onRunSimulation={runSimulation}
                onOpenCasModal={() => setIsCasModalOpen(true)}
                onOpenCustomModal={() => setIsCustomModalOpen(true)}
                onOpenSetuModal={() => setIsSetuModalOpen(true)}
                onNavigateToAdvisor={() => setActiveTab('advisor')}
              />
            )}

            {activeTab === 'matrix' && (
              <MatrixView
                funds={funds}
                onSelectForSimulation={handleSelectForSimulation}
              />
            )}

            {activeTab === 'comparator' && (
              <ComparatorView
                funds={funds}
                onSelectForSimulation={handleSelectForSimulation}
              />
            )}

            {activeTab === 'advisor' && (
              <AIAdvisorView
                funds={funds}
                currentPortfolio={currentPortfolio}
                onSelectForSimulation={handleSelectForSimulation}
                onAddToPortfolio={handleAddToPortfolio}
              />
            )}

            {activeTab === 'catalog' && (
              <CatalogView
                funds={funds}
                onSelectForSimulation={handleSelectForSimulation}
                onAddToPortfolio={handleAddToPortfolio}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '2px solid var(--olive-dark)',
          background: 'rgba(9, 15, 5, 0.95)',
          padding: '24px 0',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}
      >
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <strong style={{ color: 'var(--lime-accent)' }}>FolioScope AI</strong> • Mutual Fund Overlap Calculator & Pre-Purchase Simulator
          </div>
          <div style={{ color: 'var(--silver-neutral)' }}>
            Data modeled after AMFI & Morningstar methodologies • Zero-Duplication Investment Intelligence
          </div>
        </div>
      </footer>

      {/* Custom Fund Modal */}
      <AddCustomFundModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onFundAdded={handleCustomFundAdded}
      />

      {/* CAS Statement Upload & Parser Modal */}
      <CasUploadModal
        isOpen={isCasModalOpen}
        onClose={() => setIsCasModalOpen(false)}
        onImportToPortfolio={handleImportFromCas}
      />

      {/* Setu Account Aggregator Direct Sign-in & Ingestion Modal */}
      <SetuAccountAggregatorModal
        isOpen={isSetuModalOpen}
        initialConsentId={initialSetuConsentId}
        onClose={() => {
          setIsSetuModalOpen(false);
          setInitialSetuConsentId('');
        }}
        onImportToPortfolio={handleImportFromSetu}
      />
    </div>
  );
}
