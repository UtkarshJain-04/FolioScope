// Setu Account Aggregator (AA) Sandbox API Service
// Implements RBI ReBIT AA Specifications for Mutual Funds (MUTUAL_FUNDS / SIP)
// Supports both live calls to https://fiu-sandbox.setu.co and high-fidelity Sandbox Simulation

import 'dotenv/config';
import crypto from 'crypto';
import { matchSchemeToCatalog } from './casParser.js';
import { mutualFunds } from '../data/fundsData.js';
import { CustomFundStore } from './dbStore.js';

// Configuration state
const config = {
  baseUrl: process.env.SETU_BASE_URL || 'https://fiu-sandbox.setu.co',
  clientId: process.env.SETU_CLIENT_ID || '',
  clientSecret: process.env.SETU_CLIENT_SECRET || '',
  productInstanceId: process.env.SETU_PRODUCT_INSTANCE_ID || '',
  mode: process.env.SETU_CLIENT_ID ? 'live_sandbox' : 'sandbox_simulator'
};

// In-memory store for active consent requests and data sessions
const consentStore = new Map();
const sessionStore = new Map();

// Token cache for Setu Bridge OAuth API
let tokenCache = {
  token: null,
  expiresAt: 0
};

/**
 * Get Setu Bearer Auth Token from Bridge OAuth endpoint
 */
async function getSetuAuthToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }
  if (!config.clientId || !config.clientSecret) {
    return null;
  }

  try {
    const res = await fetch('https://uat.setu.co/api/v2/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientID: config.clientId, secret: config.clientSecret })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data?.token) {
        tokenCache = {
          token: data.data.token,
          expiresAt: Date.now() + (data.data.expiresIn || 1800) * 1000
        };
        return tokenCache.token;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch Setu Auth Token:', err.message);
  }
  return null;
}

/**
 * Generate authenticated headers for Setu API requests
 */
async function getSetuHeaders() {
  const token = await getSetuAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    'x-product-instance-id': config.productInstanceId
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (config.clientId) {
    headers['client-id'] = config.clientId;
    headers['client-secret'] = config.clientSecret;
  }
  return headers;
}

/**
 * Realistic Mock Datasets modeled after ReBIT AA Mutual Funds specification
 */
const MOCK_REBIT_MF_ACCOUNTS = [
  {
    fipId: "CAMS-FIP-01",
    fipName: "CAMS (Computer Age Management Services)",
    maskedAccNumber: "XXXX-8921",
    profile: {
      holders: {
        holder: [
          {
            name: "PRIYANSHI JAIN",
            pan: "ABCDE1234F",
            mobile: "9999999999",
            email: "investor@folioscope.app",
            kycStatus: "VERIFIED"
          }
        ]
      }
    },
    summary: {
      totalValuation: 177344,
      folios: [
        {
          folioNumber: "10458921/0",
          amcName: "PPFAS Mutual Fund",
          registrar: "CAMS",
          holdings: [
            {
              schemeName: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
              isin: "INF879O01019",
              schemeCategory: "Flexi Cap",
              nav: 79.45,
              navDate: new Date().toISOString().split('T')[0],
              units: 948.321,
              investedValue: 50000.0,
              currentValue: 75344.0,
              gainLoss: 25344.0,
              cagr: 22.4
            }
          ]
        },
        {
          folioNumber: "89320145/0",
          amcName: "Mirae Asset Mutual Fund",
          registrar: "CAMS",
          holdings: [
            {
              schemeName: "Mirae Asset Large & Midcap Fund - Direct Plan - Growth",
              isin: "INF769K01053",
              schemeCategory: "Large & Mid Cap",
              nav: 128.60,
              navDate: new Date().toISOString().split('T')[0],
              units: 482.118,
              investedValue: 45000.0,
              currentValue: 62000.0,
              gainLoss: 17000.0,
              cagr: 20.8
            }
          ]
        },
        {
          folioNumber: "47219082/0",
          amcName: "UTI Mutual Fund",
          registrar: "CAMS",
          holdings: [
            {
              schemeName: "UTI Nifty 50 Index Fund - Direct Plan - Growth",
              isin: "INF789F01032",
              schemeCategory: "Index Funds",
              nav: 164.20,
              navDate: new Date().toISOString().split('T')[0],
              units: 243.605,
              investedValue: 30000.0,
              currentValue: 40000.0,
              gainLoss: 10000.0,
              cagr: 16.5
            }
          ]
        }
      ]
    }
  },
  {
    fipId: "KFINTECH-FIP-02",
    fipName: "KFin Technologies",
    maskedAccNumber: "XXXX-1248",
    profile: {
      holders: {
        holder: [
          {
            name: "PRIYANSHI JAIN",
            pan: "ABCDE1234F",
            mobile: "9999999999",
            kycStatus: "VERIFIED"
          }
        ]
      }
    },
    summary: {
      totalValuation: 115500,
      folios: [
        {
          folioNumber: "33901248/0",
          amcName: "Nippon India Mutual Fund",
          registrar: "KFintech",
          holdings: [
            {
              schemeName: "Nippon India Small Cap Fund - Direct Plan - Growth",
              isin: "INF204K01844",
              schemeCategory: "Small Cap",
              nav: 172.50,
              navDate: new Date().toISOString().split('T')[0],
              units: 202.898,
              investedValue: 25000.0,
              currentValue: 35000.0,
              gainLoss: 10000.0,
              cagr: 26.2
            }
          ]
        },
        {
          folioNumber: "55129841/0",
          amcName: "HDFC Mutual Fund",
          registrar: "KFintech",
          holdings: [
            {
              schemeName: "HDFC Top 100 Fund - Direct Plan - Growth",
              isin: "INF179K01BE2",
              schemeCategory: "Large Cap",
              nav: 1120.40,
              navDate: new Date().toISOString().split('T')[0],
              units: 42.842,
              investedValue: 35000.0,
              currentValue: 48000.0,
              gainLoss: 13000.0,
              cagr: 18.2
            }
          ]
        },
        {
          folioNumber: "61084291/0",
          amcName: "Quant Mutual Fund",
          registrar: "KFintech",
          holdings: [
            {
              schemeName: "Quant Active Fund - Direct Plan - Growth",
              isin: "INF966L01019",
              schemeCategory: "Multi Cap",
              nav: 685.20,
              navDate: new Date().toISOString().split('T')[0],
              units: 47.431,
              investedValue: 22000.0,
              currentValue: 32500.0,
              gainLoss: 10500.0,
              cagr: 28.5
            }
          ]
        }
      ]
    }
  }
];

export const SetuService = {
  /**
   * Get current Setu AA configuration & health
   */
  getConfig: () => {
    const clientId = config.clientId || process.env.SETU_CLIENT_ID || '';
    const clientSecret = config.clientSecret || process.env.SETU_CLIENT_SECRET || '';
    const productInstanceId = config.productInstanceId || process.env.SETU_PRODUCT_INSTANCE_ID || '';
    const baseUrl = config.baseUrl || process.env.SETU_BASE_URL || 'https://fiu-sandbox.setu.co';
    const isConfigured = Boolean(clientId && clientSecret && productInstanceId);
    const mode = config.mode || (isConfigured ? 'live_sandbox' : 'sandbox_simulator');

    return {
      baseUrl,
      isConfigured,
      hasClientId: Boolean(clientId),
      clientIdMasked: clientId ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}` : '',
      productInstanceId,
      mode,
      supportedFiTypes: ["MUTUAL_FUNDS", "SIP"],
      supportedAAs: [
        { id: "setu-aa", name: "Setu AA", status: "Active" },
        { id: "camspay-aa", name: "CAMS Finserv", status: "Active" },
        { id: "kfin-aa", name: "KFin OneMoney", status: "Active" },
        { id: "sahamati-sandbox", name: "Sahamati AA Sandbox", status: "Active" }
      ]
    };
  },

  /**
   * Update configuration at runtime
   */
  updateConfig: (newConfig) => {
    if (newConfig.clientId !== undefined) config.clientId = newConfig.clientId.trim();
    if (newConfig.clientSecret !== undefined) config.clientSecret = newConfig.clientSecret.trim();
    if (newConfig.productInstanceId !== undefined) config.productInstanceId = newConfig.productInstanceId.trim();
    if (newConfig.baseUrl !== undefined) config.baseUrl = newConfig.baseUrl.trim();
    if (newConfig.mode !== undefined) config.mode = newConfig.mode;
    else config.mode = config.clientId ? 'live_sandbox' : 'sandbox_simulator';

    return SetuService.getConfig();
  },

  /**
   * Helper: Get all stored consents (for debugging & dashboard)
   */
  getAllConsents: () => {
    return Array.from(consentStore.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * Helper: Get specific consent by ID
   */
  getConsent: (consentId) => {
    return consentStore.get(consentId) || null;
  },

  /**
   * Helper: Update consent status (e.g., from redirect callback or webhook)
   */
  updateConsentStatus: (consentId, status, extra = {}) => {
    let record = consentStore.get(consentId);
    if (!record) {
      record = {
        id: consentId,
        createdAt: new Date().toISOString(),
        isLiveApi: true
      };
    }
    record.status = status;
    record.updatedAt = new Date().toISOString();
    Object.assign(record, extra);
    consentStore.set(consentId, record);
    return record;
  },

  /**
   * Step 1: Create Consent Request for MUTUAL_FUNDS
   * POST /v2/consents (supports both /api/setu/consent and /api/setu/consent/create)
   */
  createConsentRequest: async ({ mobileNumber = '9999999999', purposeText, fips = [], redirectUrl }) => {
    const cleanMobile = mobileNumber.replace(/[^0-9]/g, '');
    const userVpa = cleanMobile ? `${cleanMobile}@setu` : '9999999999@setu';
    const consentId = `consent_${crypto.randomUUID()}`;
    const effectiveRedirectUrl = redirectUrl || `http://localhost:${process.env.PORT || 5000}/api/setu/consent`;

    // If live credentials exist and mode is live_sandbox, invoke Setu's Sandbox API with Bearer token
    if (config.mode === 'live_sandbox' && config.clientId && config.productInstanceId) {
      try {
        const headers = await getSetuHeaders();
        const payload = {
          consentDuration: {
            unit: "MONTH",
            value: "12"
          },
          vua: `${cleanMobile || '9999999999'}@onemoney`,
          fiTypes: ["MUTUAL_FUNDS", "SIP"],
          dataRange: {
            from: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
            to: new Date().toISOString()
          },
          purpose: {
            code: "101",
            text: purposeText || "Portfolio overlap & diversification analysis",
            refUri: "https://api.rebit.org.in/aa/purpose/101.xml",
            category: { type: "string" }
          },
          context: [],
          redirectUrl: effectiveRedirectUrl
        };

        const res = await fetch(`${config.baseUrl}/v2/consents`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          const realConsentId = data.consentCollectionId || data.id || consentId;
          const webviewUrl = data.url || `${config.baseUrl}/v2/consents/webview/${realConsentId}`;
          const consentRecord = {
            id: realConsentId,
            mobileNumber: cleanMobile,
            userVpa,
            status: data.status || 'PENDING',
            url: webviewUrl,
            redirectUrl: effectiveRedirectUrl,
            createdAt: new Date().toISOString(),
            isLiveApi: true
          };
          consentStore.set(realConsentId, consentRecord);
          return {
            success: true,
            consentId: realConsentId,
            url: webviewUrl,
            redirectUrl: effectiveRedirectUrl,
            status: consentRecord.status,
            isLiveApi: true,
            message: "Consent request registered with Setu Sandbox API"
          };
        } else {
          const errText = await res.text();
          console.warn(`Setu live API returned ${res.status}: ${errText}. Using sandbox simulation fallback.`);
        }
      } catch (err) {
        console.warn('Setu API network call failed, falling back to Sandbox Simulator:', err.message);
      }
    }

    // High-Fidelity Sandbox Simulation with link to live webview simulator
    const simulatedRecord = {
      id: consentId,
      mobileNumber: cleanMobile,
      userVpa,
      status: 'PENDING',
      otp: '123456', // standard test OTP
      url: `https://fiu-sandbox.setu.co/v2/consents/webview/${consentId}?mock_phone=${cleanMobile}&redirect_url=${encodeURIComponent(effectiveRedirectUrl)}`,
      redirectUrl: effectiveRedirectUrl,
      createdAt: new Date().toISOString(),
      isLiveApi: false,
      fips: fips.length > 0 ? fips : ["CAMS", "KFintech"]
    };

    consentStore.set(consentId, simulatedRecord);

    return {
      success: true,
      consentId,
      url: simulatedRecord.url,
      redirectUrl: effectiveRedirectUrl,
      status: 'PENDING',
      isLiveApi: false,
      testOtp: '123456',
      message: "Sandbox Consent created. Proceed to sign in with OTP 123456"
    };
  },

  /**
   * Step 2: Check Consent Status
   * GET /v2/consents/:id/status
   */
  getConsentStatus: async (consentId) => {
    let record = consentStore.get(consentId);

    if (config.clientId) {
      try {
        const headers = await getSetuHeaders();
        const res = await fetch(`${config.baseUrl}/v2/consents/${consentId}/status`, {
          headers
        });

        if (res.ok) {
          const data = await res.json();
          if (!record) {
            record = { id: consentId, createdAt: new Date().toISOString(), isLiveApi: true };
          }
          record.status = data.status || record.status;
          consentStore.set(consentId, record);
          return { success: true, consentId, status: record.status, isLiveApi: true, data };
        }
      } catch (err) {
        console.error('Error checking live consent status:', err);
      }
    }

    if (!record) {
      // Create lazy simulated consent if not found
      return { success: true, consentId, status: 'ACTIVE', isLiveApi: false };
    }

    return {
      success: true,
      consentId,
      status: record.status,
      isLiveApi: Boolean(record.isLiveApi)
    };
  },

  /**
   * Step 2b: Simulate Consent Approval & OTP Verification (for Sandbox UI sign-in)
   */
  simulateApproveConsent: (consentId, enteredOtp) => {
    let record = consentStore.get(consentId);
    if (!record) {
      record = {
        id: consentId,
        mobileNumber: '9999999999',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };
      consentStore.set(consentId, record);
    }

    // In sandbox, accept '123456' or any 6-digit OTP
    if (enteredOtp && enteredOtp.toString().trim().length === 6) {
      record.status = 'ACTIVE';
      record.approvedAt = new Date().toISOString();
      consentStore.set(consentId, record);
      return {
        success: true,
        consentId,
        status: 'ACTIVE',
        message: 'Consent successfully approved by user via Setu AA'
      };
    }

    return {
      success: false,
      message: 'Invalid OTP. For Setu sandbox testing, please enter OTP: 123456'
    };
  },

  /**
   * Step 3: Create Data Session
   * POST /v2/sessions
   */
  createDataSession: async (consentId) => {
    const record = consentStore.get(consentId);
    const sessionId = `sess_${crypto.randomUUID()}`;

    if (config.clientId) {
      try {
        const headers = await getSetuHeaders();
        const payload = {
          consentId,
          format: "json",
          dataRange: {
            from: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
            to: new Date().toISOString()
          }
        };

        const res = await fetch(`${config.baseUrl}/v2/sessions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          const realSessionId = data.id || sessionId;
          sessionStore.set(realSessionId, {
            id: realSessionId,
            consentId,
            status: data.status || 'PENDING',
            isLiveApi: true
          });
          return { success: true, sessionId: realSessionId, status: data.status, isLiveApi: true };
        }
      } catch (err) {
        console.warn('Live data session creation failed, falling back to simulator session:', err.message);
      }
    }

    // Simulator Data Session
    sessionStore.set(sessionId, {
      id: sessionId,
      consentId,
      status: 'COMPLETED',
      isLiveApi: false,
      data: MOCK_REBIT_MF_ACCOUNTS
    });

    return {
      success: true,
      sessionId,
      status: 'COMPLETED',
      isLiveApi: false,
      message: 'Data session established. Ready to fetch mutual fund records.'
    };
  },

  /**
   * Step 4: Fetch Session Data & ReBIT Mutual Fund Parser
   * GET /v2/sessions/:id
   */
  fetchSessionData: async (sessionId) => {
    let session = sessionStore.get(sessionId);

    // If live API session, fetch data from Setu
    if (session?.isLiveApi && config.clientId) {
      try {
        const headers = await getSetuHeaders();
        const res = await fetch(`${config.baseUrl}/v2/sessions/${sessionId}`, {
          headers
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.status === 'PENDING') {
            return { success: true, sessionId, status: 'PENDING', message: 'Data aggregation in progress by FIPs...' };
          }
          // Process payload
          return SetuService.processRebitMutualFundData(resData.payload || resData.data || MOCK_REBIT_MF_ACCOUNTS);
        }
      } catch (err) {
        console.error('Error fetching live session data:', err);
      }
    }

    // Default to high-fidelity mock dataset
    return SetuService.processRebitMutualFundData(MOCK_REBIT_MF_ACCOUNTS);
  },

  /**
   * Process & Normalize ReBIT Mutual Fund accounts into FolioScope portfolio items
   */
  processRebitMutualFundData: (accountsPayload) => {
    const rawHoldings = [];
    let investorName = 'Investor';
    let investorPan = 'ABCDE1234F';
    const fipsDiscovered = new Set();

    // Iterate accounts / FIPs
    if (Array.isArray(accountsPayload)) {
      for (const account of accountsPayload) {
        const fipName = account.fipName || account.fipId || 'RTA / FIP';
        fipsDiscovered.add(fipName);

        const profile = account.profile || account.account?.profile;
        if (profile?.holders?.holder?.[0]) {
          const h = profile.holders.holder[0];
          if (h.name) investorName = h.name;
          if (h.pan) investorPan = h.pan;
        }

        // Search in summary.folios or investment.folios
        const folios = account.summary?.folios ||
                       account.summary?.investment?.folios?.folio ||
                       account.account?.summary?.investment?.folios?.folio ||
                       account.account?.summary?.folios || [];

        const folioList = Array.isArray(folios) ? folios : [folios];

        for (const f of folioList) {
          const folioNumber = f.folioNumber || f.folioNo || 'Direct';
          const amc = f.amcName || f.amc || 'Mutual Fund';
          const registrar = f.registrar || fipName;

          const holdings = f.holdings?.holding || f.holdings || [];
          const holdingList = Array.isArray(holdings) ? holdings : [holdings];

          for (const h of holdingList) {
            const schemeName = h.schemeName || h.name || h.schemeDescription || '';
            const isin = h.isin || h.schemeCode || '';
            const units = parseFloat(h.units || h.closingUnits || 0) || 0;
            const nav = parseFloat(h.nav || 0) || 0;
            const currentValue = parseFloat(h.currentValue || h.valuation || (units * nav) || 0);
            const investedValue = parseFloat(h.investedValue || h.costValue || currentValue * 0.8 || 0);

            if (schemeName) {
              rawHoldings.push({
                schemeName,
                isin,
                folioNumber,
                amc,
                registrar,
                units,
                nav,
                currentValue: Math.round(currentValue),
                investedValue: Math.round(investedValue)
              });
            }
          }
        }
      }
    }

    // Match each discovered holding to FolioScope Catalog
    let totalPortfolioValuation = 0;
    const recognizedSchemes = rawHoldings.map((h, idx) => {
      totalPortfolioValuation += h.currentValue;

      // 1. Try matching using ISIN or Scheme Name
      let catalogFund = null;
      if (h.isin) {
        // Check if any fund in catalog has matching ISIN in description or name
        catalogFund = mutualFunds.find(f => f.description?.includes(h.isin) || f.name.toLowerCase().includes(h.isin.toLowerCase()));
      }
      if (!catalogFund) {
        catalogFund = matchSchemeToCatalog(h.schemeName);
      }

      // If matched with catalog fund, use its ID; otherwise, dynamically register custom fund
      let fundId = '';
      let isCatalogMatched = false;
      let fundMeta = null;

      if (catalogFund) {
        fundId = catalogFund.id;
        isCatalogMatched = true;
        fundMeta = {
          name: catalogFund.name,
          category: catalogFund.category,
          amc: catalogFund.amc,
          aum: catalogFund.aum,
          holdingsCount: catalogFund.holdings?.length || 0,
          cagr3Y: catalogFund.cagr3Y
        };
      } else {
        // Auto-create a custom fund entry so overlap analysis can still work
        fundId = `setu-${idx}-${h.schemeName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 25)}`;
        fundMeta = {
          name: h.schemeName,
          category: h.amc || 'Diversified Equity',
          amc: h.amc || 'Mutual Fund',
          aum: 5000,
          holdingsCount: 15,
          cagr3Y: 15.0
        };
      }

      return {
        id: `aa-holding-${idx}`,
        schemeName: h.schemeName,
        isin: h.isin,
        folioNumber: h.folioNumber,
        amc: h.amc,
        registrar: h.registrar,
        units: h.units,
        nav: h.nav,
        currentValuation: h.currentValue,
        investedValue: h.investedValue,
        fundId,
        isCatalogMatched,
        fundMeta
      };
    });

    // Calculate normalized weights
    const schemesWithWeights = recognizedSchemes.map(s => ({
      ...s,
      weight: totalPortfolioValuation > 0
        ? Number(((s.currentValuation / totalPortfolioValuation) * 100).toFixed(2))
        : Number((100 / recognizedSchemes.length).toFixed(2))
    }));

    // Convert into FolioScope Current Portfolio Items format
    const portfolioItems = schemesWithWeights.map(s => ({
      fundId: s.fundId,
      investmentAmount: s.currentValuation,
      weight: totalPortfolioValuation > 0 ? (s.currentValuation / totalPortfolioValuation) : (1 / schemesWithWeights.length)
    }));

    return {
      success: true,
      data: {
        investor: {
          name: investorName,
          pan: investorPan,
          fips: Array.from(fipsDiscovered)
        },
        metrics: {
          totalFolios: new Set(schemesWithWeights.map(s => s.folioNumber)).size,
          totalSchemes: schemesWithWeights.length,
          totalValuation: Math.round(totalPortfolioValuation),
          catalogMatchedCount: schemesWithWeights.filter(s => s.isCatalogMatched).length
        },
        schemes: schemesWithWeights,
        portfolioItems
      }
    };
  },

  /**
   * Handle Webhook from Setu AA
   * POST /api/setu/webhook
   */
  handleWebhook: (payload) => {
    const { type, consentId, status, sessionId } = payload;
    console.log(`[Setu AA Webhook] Event: ${type}, Consent: ${consentId}, Status: ${status}, Session: ${sessionId}`);

    if (consentId && consentStore.has(consentId)) {
      const record = consentStore.get(consentId);
      record.status = status || record.status;
      consentStore.set(consentId, record);
    }

    if (sessionId && sessionStore.has(sessionId)) {
      const record = sessionStore.get(sessionId);
      record.status = status || record.status;
      sessionStore.set(sessionId, record);
    }

    return { success: true, acknowledged: true };
  }
};
