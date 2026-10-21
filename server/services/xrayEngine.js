// Portfolio X-Ray Diagnostic Engine
// Provides holistic look-through stock analysis, sector & market-cap exposure,
// expense ratio benchmarking, and duplicate fee waste calculations for current portfolio.

import { mutualFunds } from '../data/fundsData.js';
import {
  aggregatePortfolioHoldings,
  calculatePairwiseOverlap,
  normalizeStockIdentifier
} from './overlapCalculator.js';
import {
  calculateDiversificationScore,
  getOverlapSeverityTier
} from './simulationEngine.js';

/**
 * Classify whether a mutual fund is passive / index / ETF
 */
export function isPassiveFund(fund) {
  if (!fund) return false;
  const cat = (fund.category || '').toLowerCase();
  const name = (fund.name || '').toLowerCase();
  const bm = (fund.benchmark || '').toLowerCase();

  return (
    cat.includes('index') ||
    cat.includes('etf') ||
    cat.includes('passive') ||
    name.includes('index') ||
    name.includes('etf') ||
    name.includes('nifty 50') ||
    name.includes('s&p 500') ||
    bm.includes('index')
  );
}

/**
 * Compute category average TER strictly from the bundled catalog (fundsData.js).
 * If a category has fewer than 3 catalog funds, returns null.
 */
const catalogCategoryMap = {};
mutualFunds.forEach(f => {
  const cat = f.category || 'Other';
  if (!catalogCategoryMap[cat]) catalogCategoryMap[cat] = [];
  if (typeof f.expenseRatio === 'number') {
    catalogCategoryMap[cat].push(f.expenseRatio);
  }
});

export function getCategoryAvgTER(category) {
  const ters = catalogCategoryMap[category] || [];
  if (ters.length < 3) {
    return null;
  }
  const sum = ters.reduce((acc, v) => acc + v, 0);
  return Number((sum / ters.length).toFixed(2));
}

/**
 * Generate comprehensive Portfolio X-Ray diagnostics for a user's current portfolio
 * portfolioItems: [{ fund: FundObject, investmentAmount: number, weight: number }]
 */
export function generatePortfolioXRay(portfolioItems) {
  if (!portfolioItems || !Array.isArray(portfolioItems) || portfolioItems.length === 0) {
    throw new Error('Portfolio items array is required');
  }

  // Determine if user provided rupee amounts
  const hasRupeeAmounts = portfolioItems.some(i => (Number(i.investmentAmount) || 0) > 0);
  const totalAmount = portfolioItems.reduce((acc, i) => acc + (Number(i.investmentAmount) || 0), 0);

  // 1. Core Portfolio Aggregation (Look-through stocks, sectors, market cap)
  const aggregated = aggregatePortfolioHoldings(portfolioItems);

  // Calculate normalized fund weights across portfolio
  const normalizedFundWeights = portfolioItems.map(item => {
    if (hasRupeeAmounts && totalAmount > 0) {
      return (Number(item.investmentAmount) || 0) / totalAmount;
    }
    return item.weight || (1 / portfolioItems.length);
  });

  // 2. Diversification Health Score (reusing exact logic from simulationEngine.js)
  // portfolioOverlapWeight = combined effective weight of stocks appearing in >1 fund
  const highRiskStocks = aggregated.stocks.filter(s => s.effectiveWeight >= 8);
  let bonusPoints = 0;
  if (aggregated.totalUniqueStocks >= 40) {
    bonusPoints = 12;
  } else if (aggregated.totalUniqueStocks >= 25) {
    bonusPoints = 6;
  }

  const diversificationScore = calculateDiversificationScore({
    overlapWeight: aggregated.portfolioOverlapWeight,
    highRiskStocksCount: highRiskStocks.length,
    bonusPoints
  });

  // 3. Intra-Portfolio Pairwise Overlap Matrix (All pairs among current funds)
  const fundPairsOverlap = [];
  const n = portfolioItems.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const fundA = portfolioItems[i].fund;
      const fundB = portfolioItems[j].fund;
      const pairwise = calculatePairwiseOverlap(fundA, fundB);
      const severity = getOverlapSeverityTier(pairwise.overlapPercentage);

      fundPairsOverlap.push({
        fundA: { id: fundA.id, name: fundA.name, category: fundA.category },
        fundB: { id: fundB.id, name: fundB.name, category: fundB.category },
        overlapPercentage: pairwise.overlapPercentage,
        commonStocksCount: pairwise.commonStocksCount,
        severityTier: severity.severityTier,
        description: severity.description,
        badgeColor: severity.badgeColor
      });
    }
  }

  // Sort pairs by overlap percentage descending (highest overlap first)
  fundPairsOverlap.sort((a, b) => b.overlapPercentage - a.overlapPercentage);

  const highestPairwiseOverlap = fundPairsOverlap.length > 0 ? fundPairsOverlap[0].overlapPercentage : 0;
  const portfolioSeverity = getOverlapSeverityTier(highestPairwiseOverlap);

  // Health diagnosis summary
  let healthSummary = '';
  if (aggregated.fundsCount === 1) {
    healthSummary = 'Single fund portfolio. Consider adding complementary funds to spread concentration risk.';
  } else if (diversificationScore >= 75) {
    healthSummary = 'Strong portfolio diversification with minimal overlapping holdings and well-distributed sector exposure.';
  } else if (diversificationScore >= 50) {
    healthSummary = 'Moderate portfolio overlap. Core market leaders are shared across funds, but overall spread remains balanced.';
  } else {
    healthSummary = 'Elevated concentration alert: Substantial duplication across multiple funds creates redundant fees without extra diversification.';
  }

  // 4. Look-Through Top 10 Stocks
  const lookThroughTop10 = aggregated.stocks.slice(0, 10).map((stock, idx) => ({
    rank: idx + 1,
    stock: stock.stock,
    ticker: stock.ticker,
    sector: stock.sector,
    marketCap: stock.marketCap,
    effectiveWeight: stock.effectiveWeight,
    effectiveAmount: hasRupeeAmounts ? stock.effectiveAmount : null,
    fundCount: stock.fundCount,
    heldInFunds: stock.heldInFunds
  }));

  // 5. Expense Ratio Analysis & Category Benchmarking
  let weightedTERSum = 0;
  let totalAnnualFeeRupees = 0;

  const fundsExpenseAnalysis = portfolioItems.map((item, idx) => {
    const fund = item.fund;
    const weight = normalizedFundWeights[idx];
    const ter = typeof fund.expenseRatio === 'number' ? fund.expenseRatio : 0.5;
    const sharePercent = Number((weight * 100).toFixed(1));

    weightedTERSum += weight * ter;

    const amount = hasRupeeAmounts ? (Number(item.investmentAmount) || 0) : null;
    const annualFeeRupees = hasRupeeAmounts ? Number((amount * (ter / 100)).toFixed(2)) : null;

    if (hasRupeeAmounts) {
      totalAnnualFeeRupees += annualFeeRupees;
    }

    const categoryAvgTER = getCategoryAvgTER(fund.category);
    const isPassive = isPassiveFund(fund);

    // Outlier rules:
    // 1. isAboveCategoryAvg: only if category has >= 3 catalog funds and fund's TER is > (catAvg + 0.15)
    const isAboveCategoryAvg = categoryAvgTER !== null ? (ter > (categoryAvgTER + 0.15)) : false;
    // 2. isHighActiveFee: active fund with TER > 1.5%
    const isHighActiveFee = !isPassive && ter > 1.50;

    let flag = 'Fair / Healthy';
    if (isHighActiveFee) {
      flag = 'High Active Fee (>1.5%)';
    } else if (isAboveCategoryAvg) {
      flag = 'Above Category Avg';
    } else if (isPassive) {
      flag = 'Low-Cost Passive';
    }

    const terDelta = categoryAvgTER !== null ? Number((ter - categoryAvgTER).toFixed(2)) : null;

    return {
      fundId: fund.id,
      name: fund.name,
      category: fund.category,
      sharePercent,
      amount,
      ter,
      categoryAvgTER,
      terDelta,
      annualFeeRupees,
      isPassive,
      isAboveCategoryAvg,
      isHighActiveFee,
      flag
    };
  });

  const weightedTER = Number(weightedTERSum.toFixed(4));
  totalAnnualFeeRupees = hasRupeeAmounts ? Number(totalAnnualFeeRupees.toFixed(2)) : null;

  // 6. Duplicate Fee Waste Metric (ESTIMATE)
  // For each fund:
  // redundancyShare = sum of min stock weights between that fund and rest of portfolio (weighted by investment amounts)
  // waste = fund value * TER * redundancyShare
  let totalWasteRupees = 0;

  const duplicateWasteFunds = portfolioItems.map((targetItem, targetIdx) => {
    const targetFund = targetItem.fund;
    const targetAmount = hasRupeeAmounts ? (Number(targetItem.investmentAmount) || 0) : null;
    const targetTER = typeof targetFund.expenseRatio === 'number' ? targetFund.expenseRatio : 0.5;

    if (portfolioItems.length <= 1) {
      return {
        fundId: targetFund.id,
        name: targetFund.name,
        ter: targetTER,
        amount: targetAmount,
        redundancyPercent: 0,
        redundancyShare: 0,
        annualFeeRupees: hasRupeeAmounts ? Number((targetAmount * (targetTER / 100)).toFixed(2)) : null,
        wasteRupees: hasRupeeAmounts ? 0 : null
      };
    }

    // Rest of the portfolio
    const restItems = portfolioItems.filter((_, idx) => idx !== targetIdx);
    const restWeights = normalizedFundWeights.filter((_, idx) => idx !== targetIdx);
    const sumRestWeight = restWeights.reduce((s, w) => s + w, 0);

    // Aggregate stock weights in the rest of the portfolio
    const restStockMap = new Map();
    restItems.forEach((item, rIdx) => {
      const restFund = item.fund;
      const normalizedWeightInRest = sumRestWeight > 0 ? (restWeights[rIdx] / sumRestWeight) : (1 / restItems.length);

      restFund.holdings.forEach(h => {
        const id = normalizeStockIdentifier(h);
        const weightedHoldingInRest = h.weight * normalizedWeightInRest;
        restStockMap.set(id, (restStockMap.get(id) || 0) + weightedHoldingInRest);
      });
    });

    // Sum min stock weights between targetFund and rest
    let sumMinWeights = 0;
    targetFund.holdings.forEach(h => {
      const id = normalizeStockIdentifier(h);
      const weightInRest = restStockMap.get(id) || 0;
      const minOverlap = Math.min(h.weight, weightInRest);
      sumMinWeights += minOverlap;
    });

    const redundancyShare = sumMinWeights / 100; // as decimal fraction
    const redundancyPercent = Number(sumMinWeights.toFixed(2));

    let annualFeeRupees = null;
    let wasteRupees = null;

    if (hasRupeeAmounts) {
      annualFeeRupees = Number((targetAmount * (targetTER / 100)).toFixed(2));
      wasteRupees = Number((annualFeeRupees * redundancyShare).toFixed(2));
      totalWasteRupees += wasteRupees;
    }

    return {
      fundId: targetFund.id,
      name: targetFund.name,
      ter: targetTER,
      amount: targetAmount,
      redundancyPercent,
      redundancyShare: Number(redundancyShare.toFixed(4)),
      annualFeeRupees,
      wasteRupees
    };
  });

  totalWasteRupees = hasRupeeAmounts ? Number(totalWasteRupees.toFixed(2)) : null;

  let wastePercentageOfFees = 0;
  if (hasRupeeAmounts && totalAnnualFeeRupees && totalAnnualFeeRupees > 0) {
    wastePercentageOfFees = Number(((totalWasteRupees / totalAnnualFeeRupees) * 100).toFixed(1));
  } else if (!hasRupeeAmounts && weightedTER > 0) {
    const weightedWasteShare = portfolioItems.reduce((acc, item, idx) => {
      const ter = typeof item.fund.expenseRatio === 'number' ? item.fund.expenseRatio : 0.5;
      return acc + (normalizedFundWeights[idx] * duplicateWasteFunds[idx].redundancyShare * ter);
    }, 0);
    wastePercentageOfFees = Number(((weightedWasteShare / weightedTER) * 100).toFixed(1));
  }

  return {
    summary: {
      hasRupeeAmounts,
      totalValuation: hasRupeeAmounts ? totalAmount : null,
      fundsCount: portfolioItems.length,
      totalUniqueStocks: aggregated.totalUniqueStocks,
      overlappingStocksCount: aggregated.overlappingStocksCount,
      portfolioOverlapWeight: aggregated.portfolioOverlapWeight,
      top10Concentration: aggregated.top10Concentration
    },
    healthScore: {
      score: diversificationScore,
      severityTier: portfolioSeverity.severityTier,
      badgeColor: portfolioSeverity.badgeColor,
      summary: healthSummary
    },
    lookThroughStocks: lookThroughTop10,
    sectorBreakdown: aggregated.sectorBreakdown,
    marketCapBreakdown: aggregated.marketCapBreakdown,
    fundPairsOverlap,
    expenseAnalysis: {
      weightedTER,
      totalAnnualFeeRupees,
      funds: fundsExpenseAnalysis
    },
    duplicateWasteAnalysis: {
      totalWasteRupees,
      wastePercentageOfFees,
      isEstimate: true,
      disclaimer: 'ESTIMATE: Calculated based on disclosed top holdings in the mutual fund catalog.',
      funds: duplicateWasteFunds
    },
    legalDisclaimer: 'FolioScope is an algorithmic educational decision-support tool. It is not a SEBI-registered investment advisor. All metrics and duplication calculations are computer-generated estimates for research purposes.'
  };
}

