import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import './loadEnv.js';
import multer from 'multer';
import mongoose from 'mongoose';
import passport from 'passport';
import { randomBytes } from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { mutualFunds } from './data/fundsData.js';
import {
  calculatePairwiseOverlap,
  calculateOverlapMatrix,
  aggregatePortfolioHoldings
} from './services/overlapCalculator.js';
import { simulateProspectivePurchase } from './services/simulationEngine.js';
import { PortfolioStore, CustomFundStore } from './services/dbStore.js';
import { parseCasText } from './services/casParser.js';
import { SetuService } from './services/setuService.js';
import { SavedPortfolio } from './models/SavedPortfolio.js';
import {
  authenticatedUser,
  configurePassport,
  createAuthRouter,
  createSessionMiddleware,
} from './services/auth.js';
import {
  generatePersonalizedAiRecommendation,
  chatWithFinancialAdvisor,
  rankFundsByOverlap,
  LEGAL_DISCLAIMER
} from './services/groqAiService.js';

const app = express();
const PORT = process.env.PORT || 5000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const configuredSessionSecret = process.env.SESSION_SECRET;
const hasSessionSecret = Boolean(configuredSessionSecret && configuredSessionSecret.length >= 32);
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

let authDatabaseReady = false;
let mongoClient = null;
if (mongoUri) {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    authDatabaseReady = true;
    mongoClient = mongoose.connection.getClient();
    console.log('[Auth] Connected to MongoDB.');
  } catch (error) {
    console.error('[Auth] MongoDB connection failed; authentication is disabled:', error.message);
  }
} else {
  console.warn('[Auth] MONGODB_URI (or MONGO_URI) is not set; authentication is disabled.');
}

if (!hasSessionSecret) {
  console.warn('[Auth] SESSION_SECRET must contain at least 32 characters; authentication is disabled.');
}
const googleEnabled = configurePassport();
if (!googleEnabled) {
  console.warn('[Auth] Google OAuth credentials are not configured.');
}

app.use(createSessionMiddleware({
  mongoClient,
  sessionSecret: hasSessionSecret ? configuredSessionSecret : randomBytes(32).toString('hex'),
}));
app.use(passport.initialize());
app.use(passport.session());
app.use('/api/auth', createAuthRouter({
  isDatabaseReady: () => authDatabaseReady && mongoose.connection.readyState === 1,
  hasSessionSecret,
  googleEnabled,
}));
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/setu/webhook' || req.path.startsWith('/auth/')) {
    return next();
  }
  return authenticatedUser(req, res, next);
});

// Helper to find a fund by ID (checks standard catalog and custom funds)
function getFundById(fundId) {
  const custom = CustomFundStore.getAll().find(f => f.id === fundId);
  if (custom) return custom;
  return mutualFunds.find(f => f.id === fundId);
}

// 1. Get all mutual funds
app.get('/api/funds', (req, res) => {
  try {
    const { search, category, amc } = req.query;
    const all = [...mutualFunds, ...CustomFundStore.getAll()];

    let filtered = all;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.amc.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.holdings.some(h => h.stock.toLowerCase().includes(q) || (h.ticker && h.ticker.toLowerCase().includes(q)))
      );
    }

    if (category && category !== 'All') {
      filtered = filtered.filter(f => f.category === category);
    }

    if (amc && amc !== 'All') {
      filtered = filtered.filter(f => f.amc === amc);
    }

    // Return light version for catalog list
    const summaryList = filtered.map(f => ({
      id: f.id,
      name: f.name,
      amc: f.amc,
      category: f.category,
      riskRating: f.riskRating,
      aum: f.aum,
      nav: f.nav,
      expenseRatio: f.expenseRatio,
      cagr3Y: f.cagr3Y,
      benchmark: f.benchmark,
      holdingsCount: f.holdings.length,
      topHoldings: f.holdings.slice(0, 5).map(h => ({ stock: h.stock, weight: h.weight })),
      isCustom: Boolean(f.isCustom)
    }));

    res.json({
      success: true,
      count: summaryList.length,
      data: summaryList
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Get single fund details with sector summary
app.get('/api/funds/:id', (req, res) => {
  try {
    const fund = getFundById(req.params.id);
    if (!fund) {
      return res.status(404).json({ success: false, message: 'Fund not found' });
    }

    // Calculate sector breakdown for this single fund
    const sectorBreakdown = {};
    fund.holdings.forEach(h => {
      const sec = h.sector || 'Other';
      sectorBreakdown[sec] = Number(((sectorBreakdown[sec] || 0) + h.weight).toFixed(2));
    });

    res.json({
      success: true,
      data: {
        ...fund,
        sectorBreakdown
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Pairwise or Matrix Overlap Calculation
app.post('/api/overlap/calculate', (req, res) => {
  try {
    const { fundAId, fundBId, fundIds } = req.body;

    // Pairwise calculation
    if (fundAId && fundBId) {
      const fundA = getFundById(fundAId);
      const fundB = getFundById(fundBId);

      if (!fundA || !fundB) {
        return res.status(404).json({ success: false, message: 'One or both funds not found' });
      }

      const result = calculatePairwiseOverlap(fundA, fundB);
      return res.json({ success: true, data: result });
    }

    // Matrix calculation
    if (fundIds && Array.isArray(fundIds)) {
      const funds = fundIds.map(id => getFundById(id)).filter(Boolean);
      if (funds.length < 2) {
        return res.status(400).json({ success: false, message: 'Provide at least two valid fund IDs' });
      }

      const result = calculateOverlapMatrix(funds);
      return res.json({ success: true, data: result });
    }

    return res.status(400).json({ success: false, message: 'Invalid parameters for overlap calculation' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Portfolio Aggregation (Current holdings combined)
app.post('/api/overlap/portfolio', (req, res) => {
  try {
    const { items } = req.body; // [{ fundId, investmentAmount, weight }]
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Portfolio items array is required' });
    }

    const portfolioItems = items.map(item => {
      const fund = getFundById(item.fundId);
      return fund ? { fund, investmentAmount: Number(item.investmentAmount) || 0, weight: Number(item.weight) || 0 } : null;
    }).filter(Boolean);

    if (portfolioItems.length === 0) {
      return res.status(404).json({ success: false, message: 'No valid funds found in portfolio' });
    }

    const aggregated = aggregatePortfolioHoldings(portfolioItems);
    res.json({ success: true, data: aggregated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. PRE-PURCHASE WHAT-IF SIMULATION ENGINE
app.post('/api/overlap/simulate', (req, res) => {
  try {
    const { currentPortfolio, prospectiveFundId, prospectiveAmount, prospectiveWeight } = req.body;

    if (!prospectiveFundId) {
      return res.status(400).json({ success: false, message: 'prospectiveFundId is required' });
    }

    const prospectiveFund = getFundById(prospectiveFundId);
    if (!prospectiveFund) {
      return res.status(404).json({ success: false, message: 'Prospective fund not found' });
    }

    if (!currentPortfolio || !Array.isArray(currentPortfolio) || currentPortfolio.length === 0) {
      return res.status(400).json({ success: false, message: 'Current portfolio items are required' });
    }

    const currentPortfolioItems = currentPortfolio.map(item => {
      const fund = getFundById(item.fundId);
      return fund ? { fund, investmentAmount: Number(item.investmentAmount) || 0, weight: Number(item.weight) || 0 } : null;
    }).filter(Boolean);

    if (currentPortfolioItems.length === 0) {
      return res.status(404).json({ success: false, message: 'No valid funds in current portfolio' });
    }

    const simulationResult = simulateProspectivePurchase({
      currentPortfolioItems,
      prospectiveFund,
      prospectiveAmount: Number(prospectiveAmount) || 0,
      prospectiveWeight: Number(prospectiveWeight) || 0
    });

    res.json({ success: true, data: simulationResult });
  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 5.1 AI PERSONALIZED ADVISOR & GROQ ENGINE
// ==========================================

// Get mathematical overlap rankings for candidate funds against current portfolio
app.post('/api/ai/overlap-rankings', (req, res) => {
  try {
    const { currentPortfolio } = req.body;
    if (!currentPortfolio || !Array.isArray(currentPortfolio) || currentPortfolio.length === 0) {
      return res.status(400).json({ success: false, message: 'Current portfolio items required' });
    }

    const currentPortfolioItems = currentPortfolio.map(item => {
      const fund = getFundById(item.fundId);
      return fund ? { fund, investmentAmount: Number(item.investmentAmount) || 0, weight: Number(item.weight) || 0 } : null;
    }).filter(Boolean);

    const allFunds = [...mutualFunds, ...CustomFundStore.getAll()];
    const rankings = rankFundsByOverlap(currentPortfolioItems, allFunds);

    res.json({ success: true, data: rankings });
  } catch (error) {
    console.error('AI overlap rankings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate comprehensive personalized AI recommendation with Groq
app.post('/api/ai/recommend', async (req, res) => {
  try {
    const { currentPortfolio, userProfile, selectedCandidateFundIds } = req.body;

    const currentPortfolioItems = (currentPortfolio || []).map(item => {
      const fund = getFundById(item.fundId);
      return fund ? { fund, investmentAmount: Number(item.investmentAmount) || 0, weight: Number(item.weight) || 0 } : null;
    }).filter(Boolean);

    const allFunds = [...mutualFunds, ...CustomFundStore.getAll()];

    const recommendation = await generatePersonalizedAiRecommendation({
      currentPortfolioItems,
      allFunds,
      userProfile: userProfile || {},
      selectedCandidateFundIds: selectedCandidateFundIds || [],
    });

    res.json({ success: true, data: recommendation });
  } catch (error) {
    console.error('AI recommendation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Interactive AI chat advisor powered by Groq
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, currentPortfolio, userProfile, chatHistory } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const currentPortfolioItems = (currentPortfolio || []).map(item => {
      const fund = getFundById(item.fundId);
      return fund ? { fund, investmentAmount: Number(item.investmentAmount) || 0, weight: Number(item.weight) || 0 } : null;
    }).filter(Boolean);

    const allFunds = [...mutualFunds, ...CustomFundStore.getAll()];

    const reply = await chatWithFinancialAdvisor({
      message,
      currentPortfolioItems,
      allFunds,
      userProfile: userProfile || {},
      chatHistory: chatHistory || [],
    });

    res.json({ success: true, data: reply });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Legal disclaimer notice and terms
app.get('/api/ai/disclaimer', (req, res) => {
  res.json({
    success: true,
    data: {
      disclaimer: LEGAL_DISCLAIMER,
      termsVersion: '1.0.0',
      complianceFramework: 'SEBI Educational & Decision Support Guidelines'
    }
  });
});

// 6. Portfolios CRUD
app.get('/api/portfolios', async (req, res) => {
  try {
    const presetPortfolios = PortfolioStore.getAll().filter(portfolio => portfolio.id.startsWith('preset-'));
    const savedPortfolios = await SavedPortfolio.find({ owner: req.user._id }).sort({ createdAt: -1 }).lean();
    const ownedPortfolios = savedPortfolios.map(portfolio => ({
      id: portfolio._id.toString(),
      name: portfolio.name,
      description: portfolio.description,
      items: portfolio.items,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    }));
    res.json({ success: true, data: [...presetPortfolios, ...ownedPortfolios] });
  } catch (error) {
    console.error('Failed to load user portfolios:', error);
    res.status(500).json({ success: false, message: 'Could not load portfolios.' });
  }
});

app.post('/api/portfolios', async (req, res) => {
  try {
    const { name, description, items } = req.body;
    if (!name || !items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Portfolio name and items are required' });
    }

    const saved = await SavedPortfolio.create({
      owner: req.user._id,
      name,
      description: description || '',
      items,
    });
    res.json({
      success: true,
      data: {
        id: saved._id.toString(),
        name: saved.name,
        description: saved.description,
        items: saved.items,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to save user portfolio:', error);
    res.status(500).json({ success: false, message: 'Could not save portfolio.' });
  }
});

app.delete('/api/portfolios/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Portfolio not found' });
    }
    const deleted = await SavedPortfolio.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Portfolio not found' });
    }
    res.json({ success: true, message: 'Portfolio deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user portfolio:', error);
    res.status(500).json({ success: false, message: 'Could not delete portfolio.' });
  }
});

// 7. Custom Fund Creation
app.post('/api/funds/custom', (req, res) => {
  try {
    const { name, amc, category, aum, expenseRatio, holdings } = req.body;

    if (!name || !holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return res.status(400).json({ success: false, message: 'Fund name and holdings list are required' });
    }

    const newFund = CustomFundStore.save({
      name,
      amc: amc || 'Custom Portfolio',
      category: category || 'Custom',
      riskRating: 'Custom',
      aum: Number(aum) || 1000,
      nav: 100.0,
      expenseRatio: Number(expenseRatio) || 0.5,
      cagr3Y: 15.0,
      benchmark: 'NIFTY 500 TRI',
      holdings: holdings.map(h => ({
        stock: h.stock,
        ticker: h.ticker || h.stock.slice(0, 8).toUpperCase().replace(/[^A-Z]/g, ''),
        sector: h.sector || 'Diversified',
        marketCap: h.marketCap || 'Mid Cap',
        weight: Number(h.weight)
      }))
    });

    res.json({ success: true, data: newFund });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. CAS (Consolidated Account Statement) Upload & Parser
app.post('/api/portfolio/upload-cas', upload.single('casFile'), async (req, res) => {
  try {
    let rawText = '';
    const password = req.body.password || '';

    if (req.file) {
      const mime = req.file.mimetype;
      const originalName = req.file.originalname.toLowerCase();

      if (mime === 'application/pdf' || originalName.endsWith('.pdf')) {
        // PDF parsing with optional password support
        const options = {};
        if (password) {
          options.password = password;
        }
        const pdfData = await pdf(req.file.buffer, options);
        rawText = pdfData.text;
      } else {
        // Text, CSV, JSON
        rawText = req.file.buffer.toString('utf-8');
      }
    } else if (req.body.casText) {
      // Direct text / JSON paste
      rawText = req.body.casText;
    } else {
      return res.status(400).json({ success: false, message: 'Please upload a CAS file (PDF/CSV/Text) or paste statement text' });
    }

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, message: 'Could not extract text from statement. If protected, please enter the correct CAS PDF password.' });
    }

    const parsedCas = parseCasText(rawText);

    res.json({
      success: true,
      data: parsedCas
    });
  } catch (error) {
    console.error('CAS Parsing Error:', error);
    res.status(500).json({
      success: false,
      message: error.message?.includes('password')
        ? 'Password protected PDF. Please provide your CAS PDF password (typically PAN in UPPERCASE or DOB).'
        : `CAS parsing failed: ${error.message}`
    });
  }
});

// 9. Sample CAS statements for instant demo testing
app.get('/api/portfolio/sample-cas', (req, res) => {
  const sampleCamsCasText = `
CONSOLIDATED ACCOUNT STATEMENT - CAMS
Statement for the period: 01-Apr-2024 to 30-Sep-2024
Investor Name: PRIYANSHI JAIN
PAN: ABCDE1234F

Folio No: 10458921 / 0
Parag Parikh Flexi Cap Fund - Direct Plan - Growth
ISIN: INF879O01019
Closing Unit Balance: 948.321
NAV on 30-Sep-2024: INR 79.45
Cost Value: INR 50,000.00
Valuation on 30-Sep-2024: INR 75,344.00

Folio No: 89320145 / 0
Mirae Asset Large & Midcap Fund - Direct Plan - Growth
ISIN: INF769K01053
Closing Unit Balance: 482.118
NAV on 30-Sep-2024: INR 128.60
Cost Value: INR 45,000.00
Valuation on 30-Sep-2024: INR 62,000.00

Folio No: 47219082 / 0
UTI Nifty 50 Index Fund - Direct Plan - Growth
ISIN: INF789F01032
Closing Unit Balance: 243.605
NAV on 30-Sep-2024: INR 164.20
Cost Value: INR 30,000.00
Valuation on 30-Sep-2024: INR 40,000.00

Folio No: 33901248 / 0
Nippon India Small Cap Fund - Direct Plan - Growth
ISIN: INF204K01844
Closing Unit Balance: 202.898
NAV on 30-Sep-2024: INR 172.50
Cost Value: INR 25,000.00
Valuation on 30-Sep-2024: INR 35,000.00
`;

  try {
    const parsed = parseCasText(sampleCamsCasText);
    res.json({ success: true, sampleText: sampleCamsCasText.trim(), parsed });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// SETU ACCOUNT AGGREGATOR (AA) SANDBOX API ROUTES
// ============================================================

// 10. Get Setu AA configuration & health status
app.get('/api/setu/config', (req, res) => {
  try {
    const cfg = SetuService.getConfig();
    res.json({ success: true, data: cfg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11. Update Setu AA credentials at runtime
app.post('/api/setu/config', (req, res) => {
  try {
    const updated = SetuService.updateConfig(req.body);
    res.json({ success: true, data: updated, message: 'Setu configuration updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// SETU ACCOUNT AGGREGATOR (AA) SANDBOX API ROUTES
// ============================================================

// 12a. Primary Setu AA Consent Endpoint (POST /api/setu/consent)
// Creates a new live or simulated consent request with dynamic redirect URL
app.post('/api/setu/consent', async (req, res) => {
  try {
    const { mobileNumber, purposeText, fips, redirectUrl } = req.body || {};
    const defaultRedirectUrl = `${req.protocol}://${req.get('host')}/api/setu/consent`;
    const result = await SetuService.createConsentRequest({
      mobileNumber: mobileNumber || '9999999999',
      purposeText: purposeText || 'Portfolio overlap & diversification analysis',
      fips: fips || ['CAMS', 'KFintech'],
      redirectUrl: redirectUrl || defaultRedirectUrl
    });
    res.json(result);
  } catch (error) {
    console.error('Error creating Setu consent at /api/setu/consent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Backward compatibility alias for /api/setu/consent/create
app.post('/api/setu/consent/create', async (req, res) => {
  try {
    const { mobileNumber, purposeText, fips, redirectUrl } = req.body || {};
    const defaultRedirectUrl = `${req.protocol}://${req.get('host')}/api/setu/consent`;
    const result = await SetuService.createConsentRequest({
      mobileNumber: mobileNumber || '9999999999',
      purposeText: purposeText || 'Portfolio overlap & diversification analysis',
      fips: fips || ['CAMS', 'KFintech'],
      redirectUrl: redirectUrl || defaultRedirectUrl
    });
    res.json(result);
  } catch (error) {
    console.error('Error creating Setu consent request:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 12b. Setu Consent Live Sandbox Route (GET /api/setu/consent)
// Handles:
// 1) Live Setu Webview Redirect Callback (query params: ?id=...&status=...)
// 2) Diagnostic & Connection Testing Console when viewed directly in browser
// 3) REST inspection when called via JSON API
app.get('/api/setu/consent', async (req, res) => {
  try {
    const consentId = req.query.id || req.query.consent_id || req.query.consentCollectionId || req.query.consentHandle;
    const rawStatus = req.query.status;
    const isSuccess = req.query.success === 'true' || rawStatus === 'GRANTED' || rawStatus === 'ACTIVE';
    const status = rawStatus || (isSuccess ? 'ACTIVE' : 'PENDING');
    const errorCode = req.query.error_code || req.query.errorCode || req.query.error;
    const errorMessage = req.query.error_message || req.query.errorMessage || '';
    const wantsJson = req.query.format === 'json' || (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/html'));
    const clientPort = process.env.CLIENT_PORT || '3000';
    const clientRedirectUrl = `http://localhost:${clientPort}?setu_consent_id=${encodeURIComponent(consentId || '')}&status=${encodeURIComponent(status)}`;

    // If callback with a consentId
    if (consentId) {
      // Update local store
      const updated = SetuService.updateConsentStatus(consentId, status, {
        rawCallbackQuery: req.query,
        errorCode,
        errorMessage,
        callbackReceivedAt: new Date().toISOString()
      });

      // Attempt live sync with Setu sandbox if credentials configured
      try {
        await SetuService.getConsentStatus(consentId);
      } catch (err) {
        console.warn('Setu live status sync error on callback:', err.message);
      }

      if (wantsJson) {
        return res.json({
          success: !errorCode && status !== 'REJECTED',
          consentId,
          status: updated.status,
          message: errorCode ? `Setu returned error: ${errorMessage || errorCode}` : 'Setu consent callback received and processed successfully',
          data: updated
        });
      }

      // Render High-Tech Animated Callback Landing Page
      const isApproved = status === 'ACTIVE' || status === 'GRANTED';
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Setu AA • Live Sandbox Consent ${isApproved ? 'Approved' : 'Status'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090f05;
      --card-bg: rgba(18, 28, 10, 0.95);
      --border: #314511;
      --lime: #cdff23;
      --lime-dim: rgba(205, 255, 35, 0.15);
      --emerald: #10b981;
      --text: #f0fdf4;
      --text-muted: #86efac;
      --silver: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(ellipse at 50% 20%, rgba(205, 255, 35, 0.08) 0%, transparent 60%),
        linear-gradient(to bottom, #090f05, #040802);
      color: var(--text);
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--lime);
      box-shadow: 0 0 50px rgba(205, 255, 35, 0.22), 6px 6px 0px #1c2a0f;
      border-radius: 14px;
      max-width: 580px;
      width: 100%;
      padding: 36px 32px;
      text-align: center;
      position: relative;
      overflow: hidden;
      backdrop-filter: blur(12px);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: var(--lime-dim);
      border: 1px solid var(--lime);
      color: var(--lime);
      margin-bottom: 20px;
    }
    .icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(205, 255, 35, 0.15);
      border: 2px solid var(--lime);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      box-shadow: 0 0 25px rgba(205, 255, 35, 0.35);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    h1 {
      font-size: 1.5rem;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    p.subtitle {
      color: var(--silver);
      font-size: 0.88rem;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .details {
      background: rgba(0, 0, 0, 0.45);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
      text-align: left;
      font-size: 0.82rem;
      margin-bottom: 24px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: var(--silver); font-size: 0.76rem; }
    .detail-val { color: var(--text); font-weight: 600; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px 20px;
      background: var(--lime);
      color: #000;
      font-weight: 700;
      font-size: 0.92rem;
      border-radius: 8px;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      box-shadow: 0 4px 14px rgba(205, 255, 35, 0.3);
    }
    .btn:hover {
      background: #b8e61e;
      transform: translateY(-1px);
    }
    .countdown {
      margin-top: 14px;
      font-size: 0.76rem;
      color: var(--silver);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">SETU ACCOUNT AGGREGATOR • LIVE SANDBOX</div>
    <div class="icon-wrap">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cdff23" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    </div>
    <h1>${isApproved ? 'Live Setu Consent Linked!' : 'Setu Consent Callback Processed'}</h1>
    <p class="subtitle">
      ${isApproved 
        ? 'Your mutual fund accounts (CAMS & KFintech) are authorized through the Setu Account Aggregator Sandbox.' 
        : 'The consent status has been recorded in the FolioScope server.'}
    </p>

    <div class="details">
      <div class="detail-row">
        <span class="detail-label">Consent ID</span>
        <span class="detail-val mono" style="color: var(--lime); font-size: 0.78rem;">${consentId}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-val" style="color: ${isApproved ? '#10b981' : '#f59e0b'}; font-weight: 700;">${status}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">FIPs Queried</span>
        <span class="detail-val">CAMS & KFintech Mutual Funds</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Connected Port</span>
        <span class="detail-val mono">:${process.env.PORT || 5000} (Backend)</span>
      </div>
    </div>

    <a href="${clientRedirectUrl}" id="returnBtn" class="btn">
      Return to FolioScope Portfolio
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
      </svg>
    </a>

    <div class="countdown" id="countdownMsg">
      Redirecting to portfolio in <span id="timer" class="mono" style="color: var(--lime); font-weight: 700;">3</span> seconds...
    </div>
  </div>

  <script>
    // Broadcast consent completion to parent window if opened as popup
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'SETU_CONSENT_APPROVED',
          consentId: '${consentId}',
          status: '${status}'
        }, '*');
      }
    } catch (e) {
      console.warn('Could not postMessage to opener:', e);
    }

    // Auto redirect countdown
    let secondsLeft = 3;
    const timerEl = document.getElementById('timer');
    const interval = setInterval(() => {
      secondsLeft--;
      if (timerEl) timerEl.textContent = secondsLeft;
      if (secondsLeft <= 0) {
        clearInterval(interval);
        window.location.href = '${clientRedirectUrl}';
      }
    }, 1000);
  </script>
</body>
</html>`);
    }

    // If NO consentId provided (Direct GET /api/setu/consent inspection)
    const config = SetuService.getConfig();
    const allConsents = SetuService.getAllConsents();
    const currentHost = req.get('host');
    const redirectUrl = `${req.protocol}://${currentHost}/api/setu/consent`;

    if (wantsJson) {
      return res.json({
        success: true,
        endpoint: '/api/setu/consent',
        message: 'Setu Account Aggregator Consent route is active and ready to link live sandbox',
        redirectUrl,
        config,
        activeConsents: allConsents,
        usage: {
          createConsent: 'POST /api/setu/consent',
          checkStatus: 'GET /api/setu/consent?id=<consent_id>',
          redirectCallback: 'GET /api/setu/consent?id=<consent_id>&status=<status>'
        }
      });
    }

    // Diagnostic & Interactive Connection Portal
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Setu Account Aggregator • Live Sandbox Hub</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #070c04;
      --card-bg: rgba(18, 28, 10, 0.95);
      --border: #314511;
      --lime: #cdff23;
      --lime-dim: rgba(205, 255, 35, 0.15);
      --emerald: #10b981;
      --text: #f0fdf4;
      --text-muted: #86efac;
      --silver: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      background-image: 
        radial-gradient(ellipse at 50% 10%, rgba(205, 255, 35, 0.1) 0%, transparent 50%),
        linear-gradient(to bottom, #070c04, #030602);
      color: var(--text);
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      min-height: 100vh;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .container { max-width: 760px; width: 100%; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--lime);
      box-shadow: 0 0 45px rgba(205, 255, 35, 0.2), 5px 5px 0px #1a270e;
      border-radius: 14px;
      padding: 32px;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: var(--lime-dim);
      border: 1px solid var(--lime);
      color: var(--lime);
    }
    .badge-emerald {
      background: rgba(16, 185, 129, 0.15);
      border-color: #10b981;
      color: #10b981;
    }
    h1 { font-size: 1.6rem; letter-spacing: -0.02em; margin: 12px 0 6px; }
    p.sub { color: var(--silver); font-size: 0.88rem; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .stat-box {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
    }
    .stat-label { font-size: 0.72rem; color: var(--silver); text-transform: uppercase; margin-bottom: 4px; }
    .stat-val { font-size: 0.95rem; font-weight: 700; color: var(--lime); }
    .snippet {
      background: #020401;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      font-size: 0.82rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.88rem;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
      border: 1px solid transparent;
    }
    .btn-lime { background: var(--lime); color: #000; }
    .btn-lime:hover { background: #b8e61e; }
    .btn-sec { background: rgba(255, 255, 255, 0.05); color: var(--text); border-color: var(--border); }
    .btn-sec:hover { background: rgba(255, 255, 255, 0.1); }
    .btn-group { display: flex; flex-wrap: wrap; gap: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span class="badge">SETU ACCOUNT AGGREGATOR</span>
        <span class="badge badge-emerald">ROUTE ACTIVE: HTTP 200</span>
      </div>

      <h1>Setu Sandbox Live Consent Route</h1>
      <p class="sub">
        This route (<span class="mono" style="color: var(--lime);">/api/setu/consent</span>) is ready to link live Setu Account Aggregator Sandbox requests, callbacks, and webview redirects.
      </p>

      <div class="grid">
        <div class="stat-box">
          <div class="stat-label">Mode</div>
          <div class="stat-val">${config.mode === 'live_sandbox' ? 'Live Sandbox Connected' : 'Sandbox Simulator'}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Product Instance ID</div>
          <div class="stat-val mono" style="font-size: 0.78rem;">${config.productInstanceId ? config.productInstanceId.slice(0, 14) + '...' : 'Not Set'}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Active Consents</div>
          <div class="stat-val">${allConsents.length} recorded</div>
        </div>
      </div>

      <div style="margin-bottom: 8px; font-size: 0.78rem; font-weight: 700; color: var(--silver);">
        REGISTERED REDIRECT URL FOR SETU BRIDGE / CONSOLE:
      </div>
      <div class="snippet mono">
        <span id="redirectUrlText" style="color: var(--lime);">${redirectUrl}</span>
        <button onclick="navigator.clipboard.writeText('${redirectUrl}'); alert('Copied to clipboard!');" class="btn btn-sec" style="padding: 4px 10px; font-size: 0.72rem;">
          Copy URL
        </button>
      </div>

      <div class="btn-group">
        <button id="testCreateBtn" class="btn btn-lime">
          <span>Test Create Live Consent</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </button>

        <a href="${redirectUrl}?id=test-consent-${Date.now().toString().slice(-4)}&status=ACTIVE&success=true" class="btn btn-sec">
          Simulate Webview Callback
        </a>

        <a href="http://localhost:${clientPort}" class="btn btn-sec">
          Open FolioScope App
        </a>
      </div>

      <div id="testResult" style="margin-top: 20px; display: none;"></div>
    </div>
  </div>

  <script>
    document.getElementById('testCreateBtn').addEventListener('click', async () => {
      const resultBox = document.getElementById('testResult');
      resultBox.style.display = 'block';
      resultBox.innerHTML = '<div style="color: var(--silver); font-size: 0.8rem;">Initiating consent with Setu Sandbox...</div>';

      try {
        const res = await fetch('/api/setu/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobileNumber: '9999999999',
            purposeText: 'Live Setu Sandbox Route Verification'
          })
        });
        const data = await res.json();
        if (data.success) {
          resultBox.innerHTML = \`
            <div style="background: rgba(0,0,0,0.5); border: 1px solid var(--lime); border-radius: 8px; padding: 16px;">
              <div style="color: var(--lime); font-weight: 700; font-size: 0.85rem; margin-bottom: 8px;">
                ✓ Consent Created: \${data.consentId}
              </div>
              <div style="margin-bottom: 12px; font-size: 0.78rem; color: var(--silver);">
                Webview URL: <a href="\${data.url}" target="_blank" style="color: var(--lime);">\${data.url}</a>
              </div>
              <a href="\${data.url}" target="_blank" class="btn btn-lime" style="padding: 8px 16px; font-size: 0.8rem;">
                Open Setu Webview in New Tab
              </a>
            </div>
          \`;
        } else {
          resultBox.innerHTML = '<div style="color: #ef4444; font-size: 0.8rem;">Error: ' + (data.message || 'Failed') + '</div>';
        }
      } catch (err) {
        resultBox.innerHTML = '<div style="color: #ef4444; font-size: 0.8rem;">Network error: ' + err.message + '</div>';
      }
    });
  </script>
</body>
</html>`);
  } catch (error) {
    console.error('Error handling /api/setu/consent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 13. Check Consent Status (Polling / Webhook status verification)
app.get('/api/setu/consent/:consentId/status', async (req, res) => {
  try {
    const result = await SetuService.getConsentStatus(req.params.consentId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 14. Sandbox OTP Verification & Consent Approval
app.post('/api/setu/consent/:consentId/simulate-approve', (req, res) => {
  try {
    const { otp } = req.body;
    const result = SetuService.simulateApproveConsent(req.params.consentId, otp);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 15. Create Data Session for Approved Consent
app.post('/api/setu/session/create', async (req, res) => {
  try {
    const { consentId } = req.body;
    if (!consentId) {
      return res.status(400).json({ success: false, message: 'consentId is required' });
    }
    const result = await SetuService.createDataSession(consentId);
    res.json(result);
  } catch (error) {
    console.error('Error creating Setu data session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 16. Fetch & Parse Financial Information (ReBIT Mutual Funds Schema)
app.get('/api/setu/session/:sessionId/data', async (req, res) => {
  try {
    const result = await SetuService.fetchSessionData(req.params.sessionId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching Setu session data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 17. Setu Webhook Handler
app.post('/api/setu/webhook', (req, res) => {
  try {
    const result = SetuService.handleWebhook(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    fundsCount: mutualFunds.length + CustomFundStore.getAll().length
  });
});

// Serve client static build if available
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'client', 'dist');

import fs from 'fs';
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`🚀 Mutual Fund Overlap & Simulation Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use by another running process.`);
    console.error(`👉 To free port ${PORT} on Windows PowerShell, run:`);
    console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});
