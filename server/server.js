import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import multer from 'multer';
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

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

// 6. Portfolios CRUD
app.get('/api/portfolios', (req, res) => {
  try {
    const portfolios = PortfolioStore.getAll();
    res.json({ success: true, data: portfolios });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/portfolios', (req, res) => {
  try {
    const { name, description, items } = req.body;
    if (!name || !items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Portfolio name and items are required' });
    }

    const saved = PortfolioStore.save({ name, description, items });
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/portfolios/:id', (req, res) => {
  try {
    PortfolioStore.delete(req.params.id);
    res.json({ success: true, message: 'Portfolio deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

app.listen(PORT, () => {
  console.log(`🚀 Mutual Fund Overlap & Simulation Server running on http://localhost:${PORT}`);
});

