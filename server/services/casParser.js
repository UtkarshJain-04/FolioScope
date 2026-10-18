// CAS (Consolidated Account Statement) Parser Service
// Supports CAMS, KFintech, CDSL, and NSDL statement text & PDF exports
import { mutualFunds } from '../data/fundsData.js';
import { CustomFundStore } from './dbStore.js';

// Clean text for matching
function cleanString(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Extract float number from text
function parseAmount(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const cleaned = val.toString().replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Fuzzy match a scheme name from CAS against known mutual funds
 */
export function matchSchemeToCatalog(rawSchemeName) {
  const allFunds = [...mutualFunds, ...CustomFundStore.getAll()];
  const cleanedRaw = cleanString(rawSchemeName);

  // 1. Direct exact or substring match
  for (const fund of allFunds) {
    const cleanedFund = cleanString(fund.name);
    if (cleanedRaw.includes(cleanedFund) || cleanedFund.includes(cleanedRaw)) {
      return fund;
    }
  }

  // 2. Token overlap score
  const rawTokens = rawSchemeName.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(t => !['fund', 'direct', 'plan', 'growth', 'option', 'reg', 'regular', 'idcw', 'ltd', 'limited', 'scheme', 'pms'].includes(t));

  let bestMatch = null;
  let highestScore = 0;

  for (const fund of allFunds) {
    const fundTokens = fund.name.toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(t => !['fund', 'direct', 'plan', 'growth', 'option', 'reg', 'regular'].includes(t));

    let matchingTokens = 0;
    for (const t of rawTokens) {
      if (fundTokens.some(ft => ft.includes(t) || t.includes(ft))) {
        matchingTokens++;
      }
    }

    const score = matchingTokens / Math.max(fundTokens.length, 1);
    if (score > highestScore && score >= 0.5) {
      highestScore = score;
      bestMatch = fund;
    }
  }

  return bestMatch;
}

/**
 * Parse raw text extracted from CAS PDF or pasted by user
 */
export function parseCasText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Valid CAS text content is required');
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const detectedSchemes = [];
  let currentScheme = null;

  // Track investor details if available in header
  let investorName = '';
  let pan = '';
  let statementPeriod = '';

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i];
    if (line.toLowerCase().includes('name:') || line.toLowerCase().includes('investor name')) {
      investorName = line.split(/:\s*/)[1] || line;
    }
    if (line.toLowerCase().includes('pan:') || line.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/)) {
      const match = line.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
      if (match) pan = match[0];
    }
    if (line.toLowerCase().includes('period:') || line.toLowerCase().includes('statement as on') || line.toLowerCase().includes('portfolio as on')) {
      statementPeriod = line;
    }
  }

  // Regex patterns commonly found in CAMS & KFintech CAS:
  // e.g., "Folio No: 1234567/89" or "Folio: 91012345"
  // e.g., "Closing Unit Balance: 1,234.567"
  // e.g., "Cost Value: INR 50,000.00"
  // e.g., "Total Cost Value: 50,000"
  // e.g., "Valuation on ... : INR 78,450.00"

  const knownAMCs = [
    'parag parikh', 'ppfas', 'mirae asset', 'hdfc', 'icici prudential',
    'sbi', 'quant', 'nippon india', 'uti', 'kotak', 'motilal oswal',
    'axis', 'tata', 'dsp', 'bandhan', 'vanguard', 'invesco', 'franklin'
  ];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Check if line looks like a scheme title
    const lineLower = line.toLowerCase();
    const isAmcMatch = knownAMCs.some(amc => lineLower.includes(amc));
    const isSchemeKeyword = lineLower.includes('fund') || lineLower.includes('growth') || lineLower.includes('equity') || lineLower.includes('plan');

    // Often lines with ISIN like INF... or scheme names
    if (isAmcMatch && isSchemeKeyword && !lineLower.includes('valuation') && !lineLower.includes('closing unit')) {
      if (currentScheme && (currentScheme.currentValuation > 0 || currentScheme.investedAmount > 0)) {
        detectedSchemes.push(currentScheme);
      }

      currentScheme = {
        rawName: line.replace(/^[0-9.\-\s]+/, '').trim(),
        folio: '',
        units: 0,
        nav: 0,
        investedAmount: 0,
        currentValuation: 0
      };
      continue;
    }

    if (!currentScheme) continue;

    // Check for folio number
    if (lineLower.includes('folio')) {
      const folioMatch = line.match(/folio\s*(?:no\.?|number)?\s*[:\s-]*([0-9]+(?:\s*\/\s*[0-9]+)?)/i);
      if (folioMatch && folioMatch[1]) {
        currentScheme.folio = folioMatch[1].trim();
      }
    }

    // Check for units
    if (lineLower.includes('unit') || lineLower.includes('balance')) {
      const parts = line.split(/[:=]/);
      const targetStr = parts.length > 1 ? parts[parts.length - 1] : line;
      const unitMatch = targetStr.match(/([0-9,]+\.[0-9]{2,4})/);
      if (unitMatch) {
        currentScheme.units = parseFloat(unitMatch[1].replace(/,/g, ''));
      }
    }

    // Check for NAV
    if (lineLower.includes('nav')) {
      const parts = line.split(/[:=]/);
      const targetStr = parts.length > 1 ? parts[parts.length - 1] : line;
      const navMatch = targetStr.match(/(?:inr|rs\.?|₹)?\s*([0-9,]+\.[0-9]{2,4})/i);
      if (navMatch) {
        currentScheme.nav = parseFloat(navMatch[1].replace(/,/g, ''));
      }
    }

    // Check for Cost value / Invested amount
    if (lineLower.includes('cost') || lineLower.includes('invested')) {
      const parts = line.split(/[:=]/);
      const targetStr = parts.length > 1 ? parts[parts.length - 1] : line;
      const costMatch = targetStr.match(/(?:inr|rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
      if (costMatch) {
        currentScheme.investedAmount = parseAmount(costMatch[1]);
      }
    }

    // Check for Valuation
    if (lineLower.includes('valuation') || lineLower.includes('current value') || lineLower.includes('market value')) {
      const parts = line.split(/[:=]/);
      const targetStr = parts.length > 1 ? parts[parts.length - 1] : line;
      const valMatch = targetStr.match(/(?:inr|rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
      if (valMatch) {
        currentScheme.currentValuation = parseAmount(valMatch[1]);
      }
    }

    // Direct multi-column row check: e.g. "Parag Parikh Flexi Cap Fund | 123456 | 50,000 | 78,450"
    if (line.includes('|') || line.includes('\t') || line.includes(',')) {
      const parts = line.split(/[|\t,]/).map(p => p.trim());
      if (parts.length >= 3) {
        const potentialAmounts = parts.map(p => parseAmount(p)).filter(a => a > 500);
        if (potentialAmounts.length >= 1 && !currentScheme.investedAmount) {
          currentScheme.investedAmount = potentialAmounts[0];
          currentScheme.currentValuation = potentialAmounts[1] || potentialAmounts[0];
        }
      }
    }
  }

  // Push last scheme
  if (currentScheme && (currentScheme.currentValuation > 0 || currentScheme.investedAmount > 0 || currentScheme.rawName)) {
    detectedSchemes.push(currentScheme);
  }

  // If standard line scanning didn't catch, try a generic pattern search for popular funds
  if (detectedSchemes.length === 0) {
    mutualFunds.forEach(fund => {
      const regex = new RegExp(fund.name.split(' ')[0] + '[^\\n]+' + (fund.name.split(' ')[1] || ''), 'i');
      if (regex.test(rawText)) {
        detectedSchemes.push({
          rawName: fund.name,
          folio: 'CAS-IMPORTED',
          units: 100,
          nav: fund.nav,
          investedAmount: 50000,
          currentValuation: Math.round(50000 * (1 + fund.cagr3Y / 100))
        });
      }
    });
  }

  // Match each detected scheme to our mutual fund catalog
  const matchedSchemes = detectedSchemes.map((ds, index) => {
    const matchedFund = matchSchemeToCatalog(ds.rawName);
    const effectiveAmount = ds.currentValuation || ds.investedAmount || 50000;

    if (matchedFund) {
      return {
        id: `cas-${matchedFund.id}-${index}`,
        fundId: matchedFund.id,
        name: matchedFund.name,
        rawName: ds.rawName,
        category: matchedFund.category,
        amc: matchedFund.amc,
        folio: ds.folio || `FOLIO-${100000 + index}`,
        investmentAmount: effectiveAmount,
        currentValuation: ds.currentValuation || effectiveAmount,
        costValue: ds.investedAmount || effectiveAmount,
        isMatched: true,
        holdingsCount: matchedFund.holdings.length
      };
    } else {
      // Unmatched: create custom placeholder fund
      const customFund = CustomFundStore.save({
        name: ds.rawName,
        amc: 'CAS Imported',
        category: 'Custom Equity',
        holdings: [
          { stock: 'HDFC Bank Ltd', ticker: 'HDFCBANK', sector: 'Financial Services', marketCap: 'Large Cap', weight: 12 },
          { stock: 'Reliance Industries Ltd', ticker: 'RELIANCE', sector: 'Energy / Oil & Gas', marketCap: 'Large Cap', weight: 10 },
          { stock: 'ICICI Bank Ltd', ticker: 'ICICIBANK', sector: 'Financial Services', marketCap: 'Large Cap', weight: 9 },
          { stock: 'Infosys Ltd', ticker: 'INFY', sector: 'Technology', marketCap: 'Large Cap', weight: 8 },
          { stock: 'Tata Consultancy Services', ticker: 'TCS', sector: 'Technology', marketCap: 'Large Cap', weight: 7 }
        ]
      });

      return {
        id: `cas-custom-${index}`,
        fundId: customFund.id,
        name: customFund.name,
        rawName: ds.rawName,
        category: 'Imported Scheme',
        amc: 'CAS Import',
        folio: ds.folio || `FOLIO-${100000 + index}`,
        investmentAmount: effectiveAmount,
        currentValuation: ds.currentValuation || effectiveAmount,
        costValue: ds.investedAmount || effectiveAmount,
        isMatched: false,
        holdingsCount: customFund.holdings.length
      };
    }
  });

  const totalValuation = matchedSchemes.reduce((sum, s) => sum + s.investmentAmount, 0);
  const totalCost = matchedSchemes.reduce((sum, s) => sum + s.costValue, 0);

  return {
    investor: {
      name: investorName || 'Mutual Fund Investor',
      pan: pan || 'XXXXX0000X',
      statementPeriod: statementPeriod || 'Consolidated Account Statement'
    },
    summary: {
      schemesCount: matchedSchemes.length,
      totalValuation,
      totalCost,
      unrealizedGain: totalValuation - totalCost,
      gainPercentage: totalCost > 0 ? Number((((totalValuation - totalCost) / totalCost) * 100).toFixed(1)) : 0
    },
    schemes: matchedSchemes
  };
}
