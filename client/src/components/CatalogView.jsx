import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Search,
  Sparkles,
  Plus,
  TrendingUp,
  ShieldCheck,
  ExternalLink,
  ArrowLeft,
  Calendar,
  Layers,
  Database,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  searchMfapiSchemes,
  getMfapiSchemeDetails,
  parseDateDdMmYyyy
} from '../services/mfapiService';

// Popular initial suggestions for quick 1-click exploration
const POPULAR_QUERIES = [
  'Parag Parikh',
  'HDFC Top 100',
  'Quant Small Cap',
  'Mirae Asset',
  'Nippon India',
  'SBI Bluechip',
  'ICICI Prudential'
];

export default function CatalogView({
  funds = [],
  onSelectForSimulation,
  onAddToPortfolio
}) {
  // Active catalog mode: 'mfapi' (Live AMFI & Charts) or 'static' (Bundled Demo Holdings)
  const [catalogMode, setCatalogMode] = useState('mfapi');

  // MFapi Live Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [liveResults, setLiveResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // MFapi Selected Scheme Detail View States
  const [selectedSchemeCode, setSelectedSchemeCode] = useState(null);
  const [schemeDetails, setSchemeDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [retrievedAt, setRetrievedAt] = useState(null);
  const [timeRange, setTimeRange] = useState('MAX'); // '1M' | '6M' | '1Y' | '3Y' | '5Y' | 'MAX'

  // Bundled demo catalog filters
  const [bundledSearchTerm, setBundledSearchTerm] = useState('');
  const [bundledCategory, setBundledCategory] = useState('All');

  const bundledCategories = [
    'All',
    'Large Cap',
    'Flexi Cap',
    'Mid Cap',
    'Small Cap',
    'Thematic - Technology',
    'Index Fund',
    'International - US Large Cap'
  ];

  // Execute live search
  const handleLiveSearch = useCallback(async (queryToSearch) => {
    const q = (queryToSearch !== undefined ? queryToSearch : searchQuery).trim();
    if (!q) {
      setLiveResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchMfapiSchemes(q);
      setLiveResults(results);
      if (results.length === 0) {
        setSearchError(`No mutual fund schemes found matching "${q}". Try another AMC or scheme keyword.`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Could not fetch scheme list from MFapi.in. Please check your connection and try again.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Initial search on mount
  useEffect(() => {
    handleLiveSearch('');
  }, [handleLiveSearch]);

  // Load scheme details and historical NAV data
  const handleViewNavHistory = async (schemeCode) => {
    setSelectedSchemeCode(schemeCode);
    setIsLoadingDetails(true);
    setDetailsError(null);

    try {
      const details = await getMfapiSchemeDetails(schemeCode);
      setSchemeDetails(details);
      const now = new Date();
      setRetrievedAt(now.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      }));
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } catch (err) {
      console.error('Details error:', err);
      setDetailsError('Failed to retrieve NAV history from MFapi.in. Please try again.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Close details view and return to directory
  const handleBackToSearch = () => {
    setSelectedSchemeCode(null);
    setSchemeDetails(null);
    setDetailsError(null);
  };

  // Process & filter historical NAV data for Recharts
  const { chartData, stats } = useMemo(() => {
    if (!schemeDetails?.data || schemeDetails.data.length === 0) {
      return { chartData: [], stats: null };
    }

    // MFapi returns newest-to-oldest, reverse for left-to-right chronological chart
    const chronological = [...schemeDetails.data]
      .reverse()
      .map(item => ({
        date: item.date,
        nav: parseFloat(item.nav),
        timestamp: parseDateDdMmYyyy(item.date)
      }))
      .filter(item => !isNaN(item.nav) && item.nav > 0);

    if (chronological.length === 0) {
      return { chartData: [], stats: null };
    }

    const latestItem = chronological[chronological.length - 1];
    const latestTimestamp = latestItem.timestamp;

    // Filter by selected time range
    let filtered = chronological;
    const DAY_MS = 24 * 60 * 60 * 1000;

    if (timeRange === '1M') {
      const cutoff = latestTimestamp - 30 * DAY_MS;
      filtered = chronological.filter(d => d.timestamp >= cutoff);
    } else if (timeRange === '6M') {
      const cutoff = latestTimestamp - 182 * DAY_MS;
      filtered = chronological.filter(d => d.timestamp >= cutoff);
    } else if (timeRange === '1Y') {
      const cutoff = latestTimestamp - 365 * DAY_MS;
      filtered = chronological.filter(d => d.timestamp >= cutoff);
    } else if (timeRange === '3Y') {
      const cutoff = latestTimestamp - 3 * 365 * DAY_MS;
      filtered = chronological.filter(d => d.timestamp >= cutoff);
    } else if (timeRange === '5Y') {
      const cutoff = latestTimestamp - 5 * 365 * DAY_MS;
      filtered = chronological.filter(d => d.timestamp >= cutoff);
    }

    // Downsample large series for smooth 60fps Recharts rendering
    let sampled = filtered;
    const maxPoints = 280;
    if (filtered.length > maxPoints) {
      const step = Math.ceil(filtered.length / maxPoints);
      sampled = [];
      for (let i = 0; i < filtered.length; i += step) {
        sampled.push(filtered[i]);
      }
      if (sampled[sampled.length - 1] !== filtered[filtered.length - 1]) {
        sampled.push(filtered[filtered.length - 1]);
      }
    }

    // Compute key statistics
    const navs = filtered.map(d => d.nav);
    const minNav = Math.min(...navs);
    const maxNav = Math.max(...navs);
    const firstNav = filtered[0]?.nav || latestItem.nav;
    const lastNav = latestItem.nav;
    const periodReturn = firstNav > 0 ? (((lastNav - firstNav) / firstNav) * 100).toFixed(2) : '0.00';

    return {
      chartData: sampled,
      stats: {
        latestNav: lastNav.toFixed(2),
        latestDate: latestItem.date,
        totalPoints: schemeDetails.data.length,
        minNav: minNav.toFixed(2),
        maxNav: maxNav.toFixed(2),
        periodReturn,
        isPositive: parseFloat(periodReturn) >= 0
      }
    };
  }, [schemeDetails, timeRange]);

  // Custom Glassmorphic Tooltip for Recharts
  const CustomNavTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div
          style={{
            background: 'rgba(9, 15, 5, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--lime-accent)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ fontSize: '0.74rem', color: 'var(--silver-neutral)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Calendar size={12} style={{ color: 'var(--lime-accent)' }} />
            <span>{dataPoint.date}</span>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--lime-accent)', fontFamily: 'var(--font-mono)' }}>
            ₹{Number(dataPoint.nav).toFixed(2)}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Historical Published NAV
          </div>
        </div>
      );
    }
    return null;
  };

  // Filter bundled demo funds
  const filteredBundledFunds = funds.filter(f => {
    const matchesCategory = bundledCategory === 'All' || f.category === bundledCategory;
    const q = bundledSearchTerm.toLowerCase();
    const matchesSearch =
      !bundledSearchTerm ||
      f.name.toLowerCase().includes(q) ||
      f.amc.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      f.topHoldings?.some(h => h.stock.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & Mode Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {/* Left Market Snapshot Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(18, 28, 9, 0.75)',
            border: '1px solid var(--border-glass)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: 'var(--lime-accent)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--lime-accent)', boxShadow: '0 0 8px var(--lime-accent)' }} />
            MARKET SNAPSHOT
          </span>
          <span style={{ color: 'var(--border-glass)' }}>|</span>
          <span style={{ color: 'var(--silver-neutral)', fontSize: '0.73rem' }}>
            Backend online · live NAV search separate
          </span>
        </div>

        {/* Right Compliance / Safety Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(49, 69, 17, 0.25)',
            border: '1px solid var(--border-glass)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.73rem',
            color: 'var(--silver-neutral)'
          }}
        >
          <ShieldCheck size={14} style={{ color: 'var(--lime-accent)' }} />
          <span>No trading or transactions take place in FolioScope</span>
        </div>
      </div>

      {/* Main Title Hero Section */}
      <div
        className="glass-panel"
        style={{
          padding: '24px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
              LIVE DATA · EXTERNAL SOURCE
            </div>
            <h1 style={{ fontSize: '1.15rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Search the live mutual-fund directory
            </h1>
            <p style={{ color: 'var(--silver-neutral)', fontSize: '0.86rem', maxWidth: '780px', lineHeight: 1.5 }}>
              Search current scheme records and load published NAV history from MFapi.in. This is separate from the bundled demo catalog.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(205, 255, 35, 0.12)',
                color: 'var(--lime-accent)',
                border: '1px solid rgba(205, 255, 35, 0.35)',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--lime-accent)' }} />
              MFapi.in
            </span>

            {/* Catalog Mode Selector */}
            <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-glass)' }}>
              <button
                className={`btn btn-sm ${catalogMode === 'mfapi' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.72rem', borderRadius: 'var(--radius-full)', padding: '4px 12px', border: 'none' }}
                onClick={() => setCatalogMode('mfapi')}
              >
                Live MFapi Directory
              </button>
              <button
                className={`btn btn-sm ${catalogMode === 'static' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.72rem', borderRadius: 'var(--radius-full)', padding: '4px 12px', border: 'none' }}
                onClick={() => setCatalogMode('static')}
              >
                Demo Holdings Catalog ({funds.length})
              </button>
            </div>
          </div>
        </div>

        {/* Search Input Control (Only in MFapi mode) */}
        {catalogMode === 'mfapi' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                <Search
                  size={18}
                  style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  className="input-control"
                  placeholder="Search scheme name (e.g. Parag Parikh, HDFC, SBI, Small Cap)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLiveSearch();
                  }}
                  style={{
                    paddingLeft: '42px',
                    height: '44px',
                    background: 'rgba(9, 15, 5, 0.85)',
                    fontSize: '0.92rem'
                  }}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={() => handleLiveSearch()}
                disabled={isSearching}
                style={{
                  height: '44px',
                  padding: '0 24px',
                  fontWeight: 800,
                  fontSize: '0.86rem'
                }}
              >
                {isSearching ? (
                  <>
                    <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Searching...</span>
                  </>
                ) : (
                  <span>Search live schemes</span>
                )}
              </button>
            </div>

            {/* Quick Query Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Popular:</span>
              {POPULAR_QUERIES.map(q => (
                <button
                  key={q}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: 'var(--radius-full)' }}
                  onClick={() => {
                    setSearchQuery(q);
                    handleLiveSearch(q);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          LIVE MFAPI MODE
          ========================================================================= */}
      {catalogMode === 'mfapi' && (
        <>
          {/* Detail View when a scheme is chosen */}
          {selectedSchemeCode && (
            <div
              className="glass-panel animate-fade"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                border: '1px solid var(--border-glass-bright)',
                background: 'rgba(18, 28, 9, 0.95)'
              }}
            >
              {isLoadingDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '14px' }}>
                  <RefreshCw size={32} style={{ color: 'var(--lime-accent)', animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: 'var(--silver-neutral)', fontSize: '0.88rem' }}>
                    Loading NAV history points from MFapi.in...
                  </p>
                </div>
              ) : detailsError ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--rose-danger)' }}>
                  <AlertCircle size={28} style={{ marginBottom: '8px' }} />
                  <p>{detailsError}</p>
                  <button className="btn btn-secondary btn-sm" onClick={handleBackToSearch} style={{ marginTop: '12px' }}>
                    <ArrowLeft size={14} /> Back to schemes
                  </button>
                </div>
              ) : schemeDetails ? (
                <>
                  {/* Top Bar of Record */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                        LIVE NAV RECORD
                      </div>
                      <h2 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {schemeDetails.meta?.scheme_name}
                      </h2>
                      <div style={{ fontSize: '0.82rem', color: 'var(--silver-neutral)' }}>
                        {schemeDetails.meta?.fund_house} · {schemeDetails.meta?.scheme_category}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {retrievedAt && (
                        <div
                          style={{
                            background: 'rgba(205, 255, 35, 0.12)',
                            color: 'var(--lime-accent)',
                            border: '1px solid rgba(205, 255, 35, 0.3)',
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}
                        >
                          Retrieved {retrievedAt}
                        </div>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleBackToSearch}
                        style={{ fontSize: '0.75rem' }}
                      >
                        <ArrowLeft size={14} /> Back to Search
                      </button>
                    </div>
                  </div>

                  {/* 3 Metric Cards matching Screenshot 2 */}
                  {stats && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '14px'
                      }}
                    >
                      {/* 1. Latest NAV */}
                      <div
                        style={{
                          background: 'rgba(9, 15, 5, 0.8)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: 'var(--radius-md)',
                          padding: '16px 18px'
                        }}
                      >
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                          LATEST NAV
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          ₹{Math.round(stats.latestNav)}
                          <span style={{ fontSize: '0.9rem', color: 'var(--silver-neutral)', fontWeight: 500, marginLeft: '4px' }}>
                            ({stats.latestNav})
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--silver-neutral)', marginTop: '4px' }}>
                          As of {stats.latestDate}
                        </div>
                      </div>

                      {/* 2. History Points */}
                      <div
                        style={{
                          background: 'rgba(9, 15, 5, 0.8)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: 'var(--radius-md)',
                          padding: '16px 18px'
                        }}
                      >
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                          HISTORY POINTS
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {stats.totalPoints}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--silver-neutral)', marginTop: '4px' }}>
                          Historical published NAV observations
                        </div>
                      </div>

                      {/* 3. Data Source */}
                      <div
                        style={{
                          background: 'rgba(9, 15, 5, 0.8)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: 'var(--radius-md)',
                          padding: '16px 18px'
                        }}
                      >
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                          DATA SOURCE
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          MFapi.in
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--silver-neutral)', marginTop: '4px' }}>
                          AMFI NAV data
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Range Selector & Chart Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--silver-neutral)' }}>
                        Published NAV Performance Curve
                      </span>
                      {stats && (
                        <span
                          className={`badge ${stats.isPositive ? 'badge-emerald' : 'badge-rose'}`}
                          style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}
                        >
                          {stats.isPositive ? '+' : ''}{stats.periodReturn}%
                        </span>
                      )}
                    </div>

                    {/* Time Range Pills */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['1M', '6M', '1Y', '3Y', '5Y', 'MAX'].map(r => (
                        <button
                          key={r}
                          className={`btn btn-sm ${timeRange === r ? 'btn-primary' : 'btn-secondary'}`}
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-full)'
                          }}
                          onClick={() => setTimeRange(r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recharts Area Chart */}
                  <div
                    style={{
                      width: '100%',
                      height: 380,
                      background: 'rgba(9, 15, 5, 0.7)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px 12px 10px 0',
                      border: '1px solid var(--border-glass)'
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 25, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="mfapiGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#cdff23" stopOpacity={0.42} />
                            <stop offset="95%" stopColor="#cdff23" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.04)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="#4b5563"
                          tickLine={false}
                          tick={{ fontSize: 10, fill: '#889a74' }}
                          minTickGap={45}
                        />
                        <YAxis
                          stroke="#4b5563"
                          tickLine={false}
                          tick={{ fontSize: 10, fill: '#889a74' }}
                          domain={['auto', 'auto']}
                          tickFormatter={(val) => `${Math.round(val)}`}
                        />
                        <Tooltip content={<CustomNavTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="nav"
                          stroke="#cdff23"
                          strokeWidth={2.4}
                          fillOpacity={1}
                          fill="url(#mfapiGlow)"
                          dot={false}
                          activeDot={{ r: 5, fill: '#cdff23', stroke: '#090f05', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Range stats and action footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--silver-neutral)' }}>
                      <span>Range Low: <strong className="mono" style={{ color: 'var(--text-primary)' }}>₹{stats?.minNav}</strong></span>
                      <span>Range High: <strong className="mono" style={{ color: 'var(--text-primary)' }}>₹{stats?.maxNav}</strong></span>
                      <span>Scheme Code: <strong className="mono" style={{ color: 'var(--lime-accent)' }}>{schemeDetails.meta?.scheme_code}</strong></span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleBackToSearch}
                      >
                        <ArrowLeft size={14} /> Back to Directory
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* Scheme Search Results List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--silver-neutral)', fontWeight: 600 }}>
                {isSearching
                  ? 'Searching MFapi.in directory...'
                  : searchQuery.trim()
                    ? `${liveResults.length} Schemes Found for "${searchQuery}"`
                    : 'Search Live Mutual Fund Schemes'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Direct AMFI Live Published Records
              </span>
            </div>

            {searchError && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--rose-danger)',
                  fontSize: '0.84rem'
                }}
              >
                {searchError}
              </div>
            )}

            {/* Empty Search Prompt if no query searched yet */}
            {liveResults.length === 0 && !isSearching && !searchError && (
              <div
                className="glass-panel"
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  border: '1px dashed var(--border-glass)'
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(205, 255, 35, 0.1)',
                    border: '1px solid rgba(205, 255, 35, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--lime-accent)'
                  }}
                >
                  <Search size={20} />
                </div>
                <h3 style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  Search Any Indian Mutual Fund Scheme
                </h3>
                <p style={{ color: 'var(--silver-neutral)', fontSize: '0.82rem', maxWidth: '480px' }}>
                  Type a scheme keyword above (e.g. "Parag Parikh", "HDFC", "Small Cap", "Index") or click one of the popular search buttons to load real-time AMFI data and interactive NAV curves.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
                  {POPULAR_QUERIES.slice(0, 4).map(q => (
                    <button
                      key={q}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.74rem' }}
                      onClick={() => {
                        setSearchQuery(q);
                        handleLiveSearch(q);
                      }}
                    >
                      <Sparkles size={12} style={{ color: 'var(--lime-accent)' }} />
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* List of Schemes matching Screenshot 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {liveResults.map((scheme) => {
                const isSelected = selectedSchemeCode === scheme.schemeCode;
                return (
                  <div
                    key={scheme.schemeCode}
                    className="glass-panel"
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px',
                      borderColor: isSelected ? 'var(--lime-accent)' : 'var(--border-glass)',
                      background: isSelected ? 'rgba(205, 255, 35, 0.08)' : 'var(--bg-card)',
                      transition: 'border-color 0.15s, transform 0.15s'
                    }}
                  >
                    {/* Left: Scheme Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.98rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          marginBottom: '4px',
                          lineHeight: 1.35
                        }}
                      >
                        {scheme.schemeName}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        Scheme code: <span className="mono" style={{ color: 'var(--silver-neutral)' }}>{scheme.schemeCode}</span> · MFapi.in / AMFI NAV data
                      </div>
                    </div>

                    {/* Right: View NAV history Action Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewNavHistory(scheme.schemeCode)}
                        style={{
                          fontSize: '0.8rem',
                          padding: '8px 14px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderColor: isSelected ? 'var(--lime-accent)' : undefined
                        }}
                      >
                        <span>View NAV history</span>
                        <ExternalLink size={13} style={{ color: 'var(--lime-accent)' }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          BUNDLED DEMO HOLDINGS CATALOG MODE (with Overlap Simulation)
          ========================================================================= */}
      {catalogMode === 'static' && (
        <>
          {/* Search and Category Filters */}
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ position: 'relative', maxWidth: '450px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-control"
                placeholder="Search by fund name, AMC, or stock holding..."
                value={bundledSearchTerm}
                onChange={(e) => setBundledSearchTerm(e.target.value)}
                style={{ paddingLeft: '38px' }}
              />
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {bundledCategories.map(cat => (
                <button
                  key={cat}
                  className={`btn btn-sm ${bundledCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setBundledCategory(cat)}
                  style={{ fontSize: '0.78rem', borderRadius: 'var(--radius-full)' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Mutual Funds */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {filteredBundledFunds.map(fund => (
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

                  <h3 style={{ fontSize: '0.82rem', marginBottom: '4px', lineHeight: 1.5 }}>
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
        </>
      )}
    </div>
  );
}
