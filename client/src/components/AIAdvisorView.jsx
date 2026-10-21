import React, { useState, useEffect, useId } from 'react';
import {
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  BookOpen,
  MessageSquare,
  Sliders,
  DollarSign,
  PieChart,
  Layers,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Scale
} from 'lucide-react';

export default function AIAdvisorView({
  funds = [],
  currentPortfolio = [],
  onSelectForSimulation,
  onAddToPortfolio
}) {
  // Tab within AI Advisor
  const [advisorSubTab, setAdvisorSubTab] = useState('recommendations'); // 'recommendations' | 'comparator' | 'guide' | 'chat'

  // Consent & Disclaimer State
  const [consentAccepted, setConsentAccepted] = useState(() => {
    return localStorage.getItem('folioscope_ai_consent') === 'true';
  });
  const [isDisclaimerModalOpen, setIsDisclaimerModalOpen] = useState(false);
  const [tempConsentCheck, setTempConsentCheck] = useState(false);

  // User Personalization Profile
  const [purpose, setPurpose] = useState('high_risk_high_reward');
  const [riskTolerance, setRiskTolerance] = useState('high');
  const [experienceLevel, setExperienceLevel] = useState('beginner');
  const [timeHorizon, setTimeHorizon] = useState('5-10y');
  const [customGoalText, setCustomGoalText] = useState('');

  // Overlap Rankings Data
  const [rankings, setRankings] = useState([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);

  // AI Recommendation Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);

  // Head-to-Head Compare State
  const [compareFundA, setCompareFundA] = useState('');
  const [compareFundB, setCompareFundB] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonAiResult, setComparisonAiResult] = useState(null);

  // Interactive Groq Chat State
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: "👋 Hi! I'm FolioScope AI, your personalized mutual fund overlap analyst. Tell me your financial goals or ask me which funds best complement your portfolio with minimal stock duplication!"
    }
  ]);
  const [inputChat, setInputChat] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Accordion state for beginner guide
  const [openGuideIndex, setOpenGuideIndex] = useState(0);

  // Unique IDs for accessibility
  const compareFundASelectId = useId();
  const compareFundBSelectId = useId();

  // Load overlap rankings when current portfolio changes
  useEffect(() => {
    fetchOverlapRankings();
  }, [currentPortfolio]);

  const fetchOverlapRankings = async () => {
    if (!currentPortfolio || currentPortfolio.length === 0) return;
    setIsLoadingRankings(true);
    try {
      const res = await fetch('/api/ai/overlap-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPortfolio })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRankings(data.data);
        // Default select top candidate for comparator
        if (data.data.length >= 2) {
          setCompareFundA(data.data[0].fundId);
          setCompareFundB(data.data[data.data.length - 1].fundId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch overlap rankings:', err);
    } finally {
      setIsLoadingRankings(false);
    }
  };

  // Handle saving consent
  const handleAcceptConsent = () => {
    localStorage.setItem('folioscope_ai_consent', 'true');
    setConsentAccepted(true);
    setIsDisclaimerModalOpen(false);
  };

  // Generate Personalized AI Recommendation
  const handleGenerateRecommendation = async (specificCandidateIds = null) => {
    if (!consentAccepted) {
      setIsDisclaimerModalOpen(true);
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPortfolio,
          userProfile: {
            purpose,
            riskTolerance,
            experienceLevel,
            timeHorizon,
            customGoalText
          },
          selectedCandidateFundIds: specificCandidateIds || (selectedCandidateIds.length > 0 ? selectedCandidateIds : null)
        })
      });

      const data = await res.json();
      if (data.success) {
        setAiReport(data.data);
      }
    } catch (err) {
      console.error('Error generating AI recommendation:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Head-to-Head Compare with AI
  const handleRunAiComparison = async () => {
    if (!compareFundA || !compareFundB) return;
    if (!consentAccepted) {
      setIsDisclaimerModalOpen(true);
      return;
    }

    setIsComparing(true);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPortfolio,
          userProfile: {
            purpose,
            riskTolerance,
            experienceLevel,
            timeHorizon,
            specificComparison: true
          },
          selectedCandidateFundIds: [compareFundA, compareFundB]
        })
      });

      const data = await res.json();
      if (data.success) {
        setComparisonAiResult(data.data);
      }
    } catch (err) {
      console.error('Error running AI comparison:', err);
    } finally {
      setIsComparing(false);
    }
  };

  // Handle Chat submit
  const handleSendChat = async (e) => {
    e?.preventDefault();
    if (!inputChat.trim() || isChatLoading) return;

    if (!consentAccepted) {
      setIsDisclaimerModalOpen(true);
      return;
    }

    const userText = inputChat.trim();
    setInputChat('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          currentPortfolio,
          userProfile: { purpose, riskTolerance, experienceLevel, timeHorizon },
          chatHistory: chatMessages.slice(-6)
        })
      });

      const data = await res.json();
      if (data.success && data.data?.reply) {
        setChatMessages(prev => [...prev, { sender: 'ai', text: data.data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { sender: 'ai', text: "I'm having trouble analyzing right now. Please try again." }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, { sender: 'ai', text: "Connection error. Please try again shortly." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Quick prompt chip clicked
  const handleQuickPrompt = (promptText) => {
    setInputChat(promptText);
    setAdvisorSubTab('chat');
  };

  // Helper to toggle candidate selection
  const toggleCandidateSelect = (fundId) => {
    setSelectedCandidateIds(prev =>
      prev.includes(fundId) ? prev.filter(id => id !== fundId) : [...prev, fundId]
    );
  };

  // Color helper for overlap badge
  const getOverlapBadgeStyle = (pct) => {
    if (pct < 15) {
      return {
        bg: 'rgba(205, 255, 35, 0.15)',
        color: 'var(--lime-accent)',
        border: '1px solid var(--lime-accent)',
        label: 'Ultra Low Overlap (High Diversifier)'
      };
    }
    if (pct <= 35) {
      return {
        bg: 'rgba(245, 158, 11, 0.15)',
        color: '#fbbf24',
        border: '1px solid #f59e0b',
        label: 'Moderate Overlap'
      };
    }
    return {
      bg: 'rgba(244, 63, 94, 0.15)',
      color: '#fda4af',
      border: '1px solid #f43f5e',
      label: 'High Overlap (Redundant)'
    };
  };

  // Purpose options
  const purposeOptions = [
    {
      id: 'high_risk_high_reward',
      title: 'High Risk, High Reward',
      subtitle: 'Small Cap & High-Beta Compounders',
      icon: '🚀',
      recommendedCategory: 'Small Cap / Mid Cap'
    },
    {
      id: 'wealth_creation',
      title: 'Steady Long-Term Wealth',
      subtitle: 'Flexi Cap & Large & Mid Cap',
      icon: '🌱',
      recommendedCategory: 'Flexi Cap / Multi Cap'
    },
    {
      id: 'capital_preservation',
      title: 'Capital Preservation / Low Risk',
      subtitle: 'Large Cap Bluechip & Index 50',
      icon: '🛡️',
      recommendedCategory: 'Large Cap / Index'
    },
    {
      id: 'thematic_tech',
      title: 'Thematic & Global Tech',
      subtitle: 'Technology, US Equity, Innovation',
      icon: '⚡',
      recommendedCategory: 'Thematic / International'
    },
    {
      id: 'custom_goal',
      title: 'Custom Investment Purpose',
      subtitle: 'Specify your own retirement, home, or SIP goal',
      icon: '✍️',
      recommendedCategory: 'Personalized'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner / Disclaimer Status Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderLeft: '4px solid var(--lime-accent)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-glass-bright)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--lime-accent)'
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0 }}>
                AI PERSONAL ADVISOR
              </h1>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(205, 255, 35, 0.15)',
                  color: 'var(--lime-accent)',
                  fontWeight: 700,
                  border: '1px solid var(--lime-accent)'
                }}
              >
                GROQ GPT-OSS-20B
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Personalized mutual fund recommendations powered by portfolio stock overlap math & investor purpose.
            </p>
          </div>
        </div>

        {/* Consent Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {consentAccepted ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'rgba(205, 255, 35, 0.08)',
                border: '1px solid rgba(205, 255, 35, 0.3)',
                fontSize: '0.75rem',
                color: 'var(--lime-accent)'
              }}
            >
              <CheckCircle2 size={14} />
              <span>Consent Verified (Educational Mode)</span>
              <button
                onClick={() => setIsDisclaimerModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--silver-neutral)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  marginLeft: '4px',
                  fontSize: '0.72rem'
                }}
              >
                View Terms
              </button>
            </div>
          ) : (
            <button
              className="btn btn-warning btn-sm"
              onClick={() => setIsDisclaimerModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700
              }}
            >
              <ShieldAlert size={14} />
              <span>Review Disclaimer & Accept Consent</span>
            </button>
          )}
        </div>
      </div>

      {/* Mandatory Consent Alert if not accepted */}
      {!consentAccepted && (
        <div
          style={{
            padding: '18px 22px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '2px solid var(--amber-warning)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}
        >
          <Scale size={24} style={{ color: 'var(--amber-warning)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--amber-warning)', marginBottom: '4px' }}>
              SEBI Regulatory Disclaimer & Investor Consent Required
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
              FolioScope AI is an algorithmic decision-support & mathematical overlap simulation tool. We are <strong>not a SEBI-registered investment advisor</strong>. Recommendations are educational suggestions. Mutual fund investments are subject to market risks. You are solely responsible for your investment decisions and asset allocation strategy.
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsDisclaimerModalOpen(true)}
              style={{ fontWeight: 800 }}
            >
              Accept Terms & Unlock AI Recommendations
            </button>
          </div>
        </div>
      )}

      {/* Sub Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid var(--olive-dark)',
          paddingBottom: '4px',
          overflowX: 'auto'
        }}
      >
        <button
          className={`nav-tab-btn ${advisorSubTab === 'recommendations' ? 'active' : ''}`}
          onClick={() => setAdvisorSubTab('recommendations')}
          style={{ padding: '8px 16px', fontSize: '0.82rem' }}
        >
          <Sparkles size={15} />
          <span>Personalized Recommendations & Overlap</span>
        </button>

        <button
          className={`nav-tab-btn ${advisorSubTab === 'comparator' ? 'active' : ''}`}
          onClick={() => setAdvisorSubTab('comparator')}
          style={{ padding: '8px 16px', fontSize: '0.82rem' }}
        >
          <Scale size={15} />
          <span>AI Overlap Head-to-Head (Fund X vs Y)</span>
        </button>

        <button
          className={`nav-tab-btn ${advisorSubTab === 'guide' ? 'active' : ''}`}
          onClick={() => setAdvisorSubTab('guide')}
          style={{ padding: '8px 16px', fontSize: '0.82rem' }}
        >
          <BookOpen size={15} />
          <span>Beginner's Guide (Mutual Funds 101)</span>
        </button>

        <button
          className={`nav-tab-btn ${advisorSubTab === 'chat' ? 'active' : ''}`}
          onClick={() => setAdvisorSubTab('chat')}
          style={{ padding: '8px 16px', fontSize: '0.82rem' }}
        >
          <MessageSquare size={15} />
          <span>Ask FolioScope AI (Groq Chat)</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PERSONALIZED RECOMMENDATIONS & OVERLAP MATCHER     */}
      {/* ========================================================= */}
      {advisorSubTab === 'recommendations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* STEP 1: Investor Profiling Card */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    background: 'var(--lime-accent)',
                    color: 'var(--bg-dark)',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.75rem'
                  }}
                >
                  1
                </span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Your Investment Purpose & Risk Appetite
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--silver-neutral)' }}>
                Active Portfolio: <strong>{currentPortfolio.length} Funds</strong>
              </span>
            </div>

            {/* Purpose Selector Grid */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '8px', display: 'block' }}>
                SELECT YOUR CURRENT INVESTING PURPOSE:
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px'
                }}
              >
                {purposeOptions.map(p => {
                  const isSelected = purpose === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setPurpose(p.id);
                        if (p.id === 'high_risk_high_reward') setRiskTolerance('high');
                        if (p.id === 'capital_preservation') setRiskTolerance('low');
                        if (p.id === 'wealth_creation') setRiskTolerance('moderate');
                      }}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'rgba(205, 255, 35, 0.12)' : 'var(--bg-card-solid)',
                        border: isSelected ? '2px solid var(--lime-accent)' : '1px solid var(--border-glass)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? 'var(--shadow-tactile-lime)' : 'none'
                      }}
                    >
                      <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>{p.icon}</div>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: isSelected ? 'var(--lime-accent)' : 'var(--text-primary)', marginBottom: '4px' }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--silver-neutral)', lineHeight: 1.3 }}>
                        {p.subtitle}
                      </div>
                      <div
                        style={{
                          marginTop: '8px',
                          fontSize: '0.68rem',
                          color: isSelected ? 'var(--lime-accent)' : 'var(--text-muted)',
                          fontWeight: 700
                        }}
                      >
                        Target: {p.recommendedCategory}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom goal text if selected */}
            {purpose === 'custom_goal' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  TELL US ABOUT YOUR SPECIFIC GOAL:
                </label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g., I am 26, want to invest ₹15,000 monthly SIP for a home down-payment in 7 years..."
                  value={customGoalText}
                  onChange={(e) => setCustomGoalText(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem', padding: '10px 14px' }}
                />
              </div>
            )}

            {/* Risk, Experience & Time Horizon Tri-Selector */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-glass)'
              }}
            >
              {/* Risk Appetite */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  RISK APPETITE:
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'high', label: 'High (Small Cap)', color: '#f43f5e' },
                    { id: 'moderate', label: 'Moderate', color: '#f59e0b' },
                    { id: 'low', label: 'Low (Index/Large)', color: '#10b981' }
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => setRiskTolerance(r.id)}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: riskTolerance === r.id ? '2px solid var(--lime-accent)' : '1px solid var(--border-glass)',
                        background: riskTolerance === r.id ? 'rgba(205, 255, 35, 0.15)' : 'var(--bg-card-solid)',
                        color: riskTolerance === r.id ? 'var(--lime-accent)' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience Level */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  EXPERIENCE LEVEL:
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'beginner', label: '🐣 Beginner (Explain Simply)' },
                    { id: 'experienced', label: '📊 Intermediate / Pro' }
                  ].map(exp => (
                    <button
                      key={exp.id}
                      onClick={() => setExperienceLevel(exp.id)}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: experienceLevel === exp.id ? '2px solid var(--lime-accent)' : '1px solid var(--border-glass)',
                        background: experienceLevel === exp.id ? 'rgba(205, 255, 35, 0.15)' : 'var(--bg-card-solid)',
                        color: experienceLevel === exp.id ? 'var(--lime-accent)' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {exp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Horizon */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  TIME HORIZON:
                </label>
                <select
                  className="input-control"
                  value={timeHorizon}
                  onChange={(e) => setTimeHorizon(e.target.value)}
                  style={{ width: '100%', fontSize: '0.78rem', padding: '8px 10px' }}
                >
                  <option value="<3y">Short-Term (&lt; 3 Years - Conservative)</option>
                  <option value="3-5y">Medium-Term (3 to 5 Years)</option>
                  <option value="5-10y">Long-Term (5 to 10 Years - Ideal for Equity)</option>
                  <option value="10y+">Very Long-Term (10+ Years - Max Compounding)</option>
                </select>
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => handleGenerateRecommendation()}
                disabled={isGenerating}
                style={{
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  padding: '12px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--lime-accent)',
                  color: 'var(--bg-dark)',
                  boxShadow: '0 0 16px var(--lime-glow)'
                }}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Analyzing Overlap with Groq AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Generate AI Recommendation ✨</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* STEP 2: Candidate Funds Ranked by Overlap Cards */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    background: 'var(--lime-accent)',
                    color: 'var(--bg-dark)',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.75rem'
                  }}
                >
                  2
                </span>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Mutual Funds Ranked by Overlap with Your Portfolio
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--silver-neutral)', marginTop: '2px' }}>
                    Lower overlap = Genuine diversification & zero duplicate expense fees.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={fetchOverlapRankings}
                  disabled={isLoadingRankings}
                  style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <RefreshCw size={12} className={isLoadingRankings ? 'animate-spin' : ''} />
                  <span>Refresh Math</span>
                </button>
              </div>
            </div>

            {isLoadingRankings ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: 'var(--lime-accent)' }} />
                <p style={{ fontSize: '0.85rem' }}>Calculating exact holding overlaps across all mutual funds...</p>
              </div>
            ) : rankings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                <p>No candidate funds available or current portfolio is empty.</p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '16px'
                }}
              >
                {rankings.map(candidate => {
                  const badge = getOverlapBadgeStyle(candidate.overlapPercentage);
                  const isSmallCap = candidate.category === 'Small Cap';
                  const matchesGoal = (purpose === 'high_risk_high_reward' && isSmallCap) ||
                                      (purpose === 'wealth_creation' && (candidate.category.includes('Cap') || candidate.category.includes('Flexi'))) ||
                                      (purpose === 'capital_preservation' && (candidate.category.includes('Large') || candidate.category.includes('Index')));

                  return (
                    <div
                      key={candidate.fundId}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card-solid)',
                        border: matchesGoal ? '2px solid var(--lime-accent)' : '1px solid var(--border-glass)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        position: 'relative'
                      }}
                    >
                      {/* Top Row: Name, Category, Goal Match badge */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                              {candidate.fundName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--silver-neutral)', marginTop: '2px' }}>
                              {candidate.category} • Risk: {candidate.riskRating || 'High'}
                            </div>
                          </div>
                          {matchesGoal && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: 'var(--lime-accent)',
                                color: 'var(--bg-dark)',
                                fontWeight: 900
                              }}
                            >
                              ★ Top Goal Match
                            </span>
                          )}
                        </div>

                        {/* Overlap Metric Card */}
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            background: badge.bg,
                            border: badge.border,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: badge.color, fontWeight: 700 }}>
                              Exact Overlap with Portfolio
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: badge.color, fontFamily: 'var(--font-mono)' }}>
                              {candidate.overlapPercentage}%
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            <div><strong>+{candidate.newStocksCount}</strong> new stocks</div>
                            <div><strong>{candidate.commonStocksCount}</strong> common</div>
                          </div>
                        </div>

                        {/* Metrics Bar */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px',
                            marginTop: '10px',
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <div style={{ background: 'var(--bg-subtle)', padding: '6px 8px', borderRadius: '4px' }}>
                            3Y CAGR: <strong style={{ color: 'var(--lime-accent)' }}>{candidate.cagr3Y ? `${candidate.cagr3Y}%` : 'N/A'}</strong>
                          </div>
                          <div style={{ background: 'var(--bg-subtle)', padding: '6px 8px', borderRadius: '4px' }}>
                            Expense Ratio: <strong style={{ color: 'var(--text-primary)' }}>{candidate.expenseRatio ? `${candidate.expenseRatio}%` : 'N/A'}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          borderTop: '1px solid var(--border-glass)',
                          paddingTop: '12px'
                        }}
                      >
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            if (onSelectForSimulation) {
                              onSelectForSimulation(candidate.fundId);
                            }
                          }}
                          style={{ flex: 1, fontSize: '0.72rem', fontWeight: 700 }}
                          title="Simulate impact on portfolio in Pre-Purchase Simulator"
                        >
                          <Sliders size={12} />
                          <span>Simulate Purchase</span>
                        </button>

                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            if (onAddToPortfolio) {
                              onAddToPortfolio(candidate.fundId);
                            }
                          }}
                          style={{ flex: 1, fontSize: '0.72rem', fontWeight: 700 }}
                          title="Add this fund directly to current portfolio"
                        >
                          <PlusCircle size={12} />
                          <span>Add to Portfolio</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* STEP 3: Groq AI Recommendation Output Report */}
          {aiReport && (
            <div
              className="card"
              style={{
                padding: '28px',
                border: '2px solid var(--lime-accent)',
                boxShadow: '0 0 24px var(--lime-glow)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={22} style={{ color: 'var(--lime-accent)' }} />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                    Personalized Groq AI Recommendation Report
                  </h3>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--silver-neutral)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Engine:</span>
                  <span style={{ color: 'var(--lime-accent)', fontWeight: 700 }}>{aiReport.modelUsed}</span>
                </div>
              </div>

              {/* Formatted Markdown Content */}
              <div
                style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.7,
                  color: 'var(--text-primary)',
                  background: 'rgba(9, 15, 5, 0.65)',
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-glass)',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-body)'
                }}
              >
                {aiReport.aiAnalysis}
              </div>

              {/* Disclaimer footer */}
              <div
                style={{
                  marginTop: '20px',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '0.72rem',
                  color: 'var(--silver-neutral)',
                  lineHeight: 1.4
                }}
              >
                <strong style={{ color: 'var(--amber-warning)' }}>Regulatory Disclaimer: </strong>
                {aiReport.disclaimer || 'FolioScope is an educational simulator and not a SEBI-registered advisor.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: AI HEAD-TO-HEAD OVERLAP COMPARATOR (Fund X vs Y)   */}
      {/* ========================================================= */}
      {advisorSubTab === 'comparator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Scale size={20} style={{ color: 'var(--lime-accent)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Compare Two Mutual Funds by Overlap (Fund A vs Fund B)
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Select two prospective mutual funds. FolioScope AI will analyze how much each overlaps with your current portfolio and guide you on which one to choose according to your risk and investment goals.
            </p>

            {/* Selectors */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: '16px',
                alignItems: 'center',
                marginBottom: '20px'
              }}
            >
              <div>
                <label htmlFor={compareFundASelectId} style={{ fontSize: '0.75rem', color: 'var(--lime-accent)', fontWeight: 800, marginBottom: '6px', display: 'block' }}>
                  CANDIDATE FUND A:
                </label>
                <select
                  id={compareFundASelectId}
                  className="input-control"
                  value={compareFundA}
                  onChange={(e) => setCompareFundA(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
                >
                  <option value="" disabled>Select Fund A...</option>
                  {rankings.map(f => (
                    <option key={f.fundId} value={f.fundId}>
                      {f.fundName} ({f.overlapPercentage}% overlap - {f.category})
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--olive-dark)',
                  color: 'var(--lime-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '0.75rem',
                  marginTop: '20px'
                }}
              >
                VS
              </div>

              <div>
                <label htmlFor={compareFundBSelectId} style={{ fontSize: '0.75rem', color: 'var(--amber-warning)', fontWeight: 800, marginBottom: '6px', display: 'block' }}>
                  CANDIDATE FUND B:
                </label>
                <select
                  id={compareFundBSelectId}
                  className="input-control"
                  value={compareFundB}
                  onChange={(e) => setCompareFundB(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
                >
                  <option value="" disabled>Select Fund B...</option>
                  {rankings.map(f => (
                    <option key={f.fundId} value={f.fundId}>
                      {f.fundName} ({f.overlapPercentage}% overlap - {f.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Metrics Comparison Cards if both selected */}
            {compareFundA && compareFundB && (
              (() => {
                const fa = rankings.find(r => r.fundId === compareFundA);
                const fb = rankings.find(r => r.fundId === compareFundB);
                if (!fa || !fb) return null;

                return (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '16px',
                      marginBottom: '20px'
                    }}
                  >
                    {/* Fund A Card */}
                    <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', border: '1px solid var(--lime-accent)' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--lime-accent)' }}>{fa.fundName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--silver-neutral)', marginBottom: '8px' }}>{fa.category}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span>Overlap with Portfolio:</span>
                        <strong style={{ color: 'var(--lime-accent)', fontSize: '0.9rem' }}>{fa.overlapPercentage}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '4px' }}>
                        <span>New Stocks Introduced:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>+{fa.newStocksCount}</strong>
                      </div>
                    </div>

                    {/* Fund B Card */}
                    <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', border: '1px solid var(--amber-warning)' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--amber-warning)' }}>{fb.fundName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--silver-neutral)', marginBottom: '8px' }}>{fb.category}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span>Overlap with Portfolio:</span>
                        <strong style={{ color: 'var(--amber-warning)', fontSize: '0.9rem' }}>{fb.overlapPercentage}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '4px' }}>
                        <span>New Stocks Introduced:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>+{fb.newStocksCount}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Run Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={handleRunAiComparison}
                disabled={isComparing || !compareFundA || !compareFundB || compareFundA === compareFundB}
                style={{
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  padding: '12px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isComparing ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Groq AI Comparing Overlaps...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Ask Groq AI to Compare & Pick Winner</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Comparison Result */}
          {comparisonAiResult && (
            <div className="card" style={{ padding: '24px', border: '2px solid var(--lime-accent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Sparkles size={20} style={{ color: 'var(--lime-accent)' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  AI Overlap Verdict: Which Fund to Choose?
                </h4>
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.7,
                  color: 'var(--text-primary)',
                  background: 'rgba(9, 15, 5, 0.65)',
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {comparisonAiResult.aiAnalysis}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: BEGINNER'S GUIDE & MUTUAL FUND 101                 */}
      {/* ========================================================= */}
      {advisorSubTab === 'guide' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <BookOpen size={20} style={{ color: 'var(--lime-accent)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Mutual Funds 101: A Plain-English Guide for Beginners
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Never invested in mutual funds before? Here are simple, zero-jargon explanations so you can invest with 100% confidence.
            </p>
          </div>

          {/* Guide Accordions */}
          {[
            {
              title: '1. What is a Mutual Fund? (The Shared Shopping Cart Analogy)',
              content: `Instead of trying to research and buy 50 individual company shares (which requires lakhs of rupees and deep financial knowledge), a mutual fund pools money from thousands of investors like you.\n\nA professional fund manager uses this shared pool to buy a diversified basket of top companies (like HDFC Bank, Infosys, Tata Motors, and Reliance). When these companies grow and make profits, your investment grows too! You can start with as little as ₹500/month through a Systematic Investment Plan (SIP).`
            },
            {
              title: '2. What is Portfolio Overlap? (Why High Overlap Silently Hurts You)',
              content: `Imagine going to two grocery stores and buying two pre-packaged fruit baskets, but both baskets are 80% apples and bananas. You paid delivery fees twice for the exact same fruits!\n\nThat is exactly what Mutual Fund Overlap is. If Fund A and Fund B both hold 70% of the same stocks (like large private banks and IT giants), you are not diversified at all. You are taking duplicate risk and paying two fund management expense ratios for the exact same companies. FolioScope AI helps you find funds with < 20% overlap so every rupee buys brand new opportunities.`
            },
            {
              title: '3. Market Cap Explained: Large Cap vs Mid Cap vs Small Cap',
              content: `Market capitalization is simply how big a company is:\n\n• Large Cap (The Elephants, Top 100): Massive giants like Reliance, TCS, HDFC Bank. Stable, highly resilient, steady compounding, lower volatility.\n• Mid Cap (The Gazelles, Ranks 101-250): Fast-growing companies with proven business models. Moderate-to-high risk with strong multi-year compounding.\n• Small Cap (The Cheetahs, Ranks 251+): High Risk, High Reward! Smaller, emerging businesses with immense room to grow into tomorrow's market leaders. During bull markets they can deliver explosive returns, but can drop sharply during market downturns. Perfect for 7-10+ year goals if you have high risk tolerance.`
            },
            {
              title: '4. What is NAV and Expense Ratio?',
              content: `• NAV (Net Asset Value): The per-unit price of the mutual fund. Unlike stock prices, a higher NAV does NOT mean a fund is expensive. It simply reflects past accumulated growth.\n• Expense Ratio: The annual percentage fee charged by the fund house to manage your money (typically 0.4% to 1.5%). Lower expense ratios leave more compounding wealth in your pocket over time.`
            },
            {
              title: '5. The Ideal 3-Fund Low-Overlap Portfolio Formula',
              content: `For most investors, owning 3 to 4 well-chosen funds is ideal:\n1. Core Stability: 1 Flexi Cap or Nifty 50 Index Fund (50% allocation)\n2. High-Growth Engine: 1 Small Cap or Mid Cap Fund (<15% overlap with Core, 30% allocation)\n3. Diversifier: 1 Thematic Tech or US International ETF (<10% overlap, 20% allocation)\n\nThis simple formula ensures zero duplication, maximum sector breadth, and powerful risk-adjusted returns!`
            }
          ].map((item, idx) => {
            const isOpen = openGuideIndex === idx;
            return (
              <div
                key={idx}
                className="card"
                style={{
                  padding: '18px 20px',
                  cursor: 'pointer',
                  border: isOpen ? '1px solid var(--lime-accent)' : '1px solid var(--border-glass)'
                }}
                onClick={() => setOpenGuideIndex(isOpen ? -1 : idx)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: isOpen ? 'var(--lime-accent)' : 'var(--text-primary)', margin: 0 }}>
                    {item.title}
                  </h4>
                  {isOpen ? <ChevronUp size={18} style={{ color: 'var(--lime-accent)' }} /> : <ChevronDown size={18} />}
                </div>

                {isOpen && (
                  <div
                    style={{
                      marginTop: '14px',
                      fontSize: '0.82rem',
                      lineHeight: 1.7,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'pre-wrap',
                      borderTop: '1px solid var(--border-glass)',
                      paddingTop: '12px'
                    }}
                  >
                    {item.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: ASK FOLIOSCOPE AI (GROQ CHAT)                      */}
      {/* ========================================================= */}
      {advisorSubTab === 'chat' && (
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '600px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: 'var(--lime-accent)' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Ask FolioScope AI
              </h3>
              <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-subtle)', color: 'var(--lime-accent)' }}>
                openai/gpt-oss-20b
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--silver-neutral)' }}>
              Portfolio-Aware AI
            </span>
          </div>

          {/* Quick Starter Chips */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '10px' }}>
            {[
              "Why should I pick Small Cap for high risk?",
              "Which fund has lowest overlap with my portfolio?",
              "Explain mutual fund overlap in simple terms",
              "Is having 40% overlap bad?"
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(chip)}
                style={{
                  fontSize: '0.7rem',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: 'var(--bg-card-solid)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--silver-neutral)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(9, 15, 5, 0.8)',
              border: '1px solid var(--border-glass)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '14px'
            }}
          >
            {chatMessages.map((msg, index) => {
              const isAi = msg.sender === 'ai';
              return (
                <div
                  key={index}
                  style={{
                    alignSelf: isAi ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: isAi ? 'var(--bg-card-solid)' : 'var(--olive-dark)',
                    border: isAi ? '1px solid var(--border-glass-bright)' : '1px solid var(--lime-accent)',
                    color: isAi ? 'var(--text-primary)' : '#ffffff',
                    fontSize: '0.82rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {isAi && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--lime-accent)', fontWeight: 800, marginBottom: '4px' }}>
                      FOLIOSCOPE AI
                    </div>
                  )}
                  {msg.text}
                </div>
              );
            })}
            {isChatLoading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card-solid)',
                  border: '1px solid var(--border-glass-bright)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--lime-accent)' }} />
                <span>Thinking on Groq...</span>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="input-control"
              placeholder="Ask anything about mutual funds, risk, or overlap..."
              value={inputChat}
              onChange={(e) => setInputChat(e.target.value)}
              disabled={isChatLoading}
              style={{ flex: 1, fontSize: '0.82rem', padding: '10px 14px' }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isChatLoading || !inputChat.trim()}
              style={{ fontWeight: 800, padding: '10px 18px', fontSize: '0.82rem' }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* SEBI LEGAL DISCLAIMER & CONSENT MODAL                     */}
      {/* ========================================================= */}
      {isDisclaimerModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDisclaimerModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px', padding: '28px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Scale size={24} style={{ color: 'var(--amber-warning)' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                SEBI Regulatory Disclaimer & Investor Consent
              </h3>
            </div>

            <div
              style={{
                fontSize: '0.82rem',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                background: 'rgba(9, 15, 5, 0.7)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                marginBottom: '20px',
                maxHeight: '320px',
                overflowY: 'auto'
              }}
            >
              <p style={{ marginBottom: '10px' }}>
                <strong style={{ color: 'var(--amber-warning)' }}>1. Educational Decision-Support Tool:</strong><br />
                FolioScope AI is an algorithmic mutual fund overlap simulation and portfolio research software. FolioScope is <strong>NOT a SEBI-registered Investment Advisor (RIA)</strong>, Research Analyst, or Portfolio Manager.
              </p>

              <p style={{ marginBottom: '10px' }}>
                <strong style={{ color: 'var(--amber-warning)' }}>2. No Financial Advice or Guarantee:</strong><br />
                All recommendations, risk classifications, overlap scores, and what-if simulations are mathematically generated based on public fund holdings and user inputs. Past performance is no guarantee of future returns. Mutual fund investments are subject to market risks. Please read all scheme-related offer documents (KIM/SID) carefully before investing.
              </p>

              <p style={{ marginBottom: '10px' }}>
                <strong style={{ color: 'var(--amber-warning)' }}>3. Sole Responsibility:</strong><br />
                You explicitly acknowledge that you alone are responsible for your financial decisions, investment strategy, asset allocation, and capital deployment. FolioScope AI accepts no liability for any financial loss or adverse investment outcomes.
              </p>
            </div>

            {/* Checkbox for Consent */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                marginBottom: '20px',
                fontSize: '0.8rem',
                color: 'var(--text-primary)'
              }}
            >
              <input
                type="checkbox"
                checked={tempConsentCheck || consentAccepted}
                onChange={(e) => setTempConsentCheck(e.target.checked)}
                style={{ marginTop: '3px', accentColor: 'var(--lime-accent)' }}
              />
              <span>
                <strong>I understand and agree:</strong> Recommendations are educational algorithmic suggestions based on portfolio overlap and stated goals. I am solely responsible for my investment strategy and capital decisions.
              </span>
            </label>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setIsDisclaimerModalOpen(false)}
                style={{ fontSize: '0.8rem' }}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAcceptConsent}
                disabled={!tempConsentCheck && !consentAccepted}
                style={{ fontWeight: 800, fontSize: '0.82rem' }}
              >
                Accept Terms & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
