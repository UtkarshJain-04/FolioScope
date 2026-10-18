// Simulation Engine: Calculates Before vs After Portfolio Overlap & Concentration
import { normalizeStockIdentifier, calculatePairwiseOverlap, aggregatePortfolioHoldings } from './overlapCalculator.js';

export function simulateProspectivePurchase({ currentPortfolioItems, prospectiveFund, prospectiveAmount = 0, prospectiveWeight = 0 }) {
  if (!prospectiveFund) {
    throw new Error('Prospective fund is required for simulation');
  }

  // 1. Calculate BEFORE state
  const beforeAggregation = aggregatePortfolioHoldings(currentPortfolioItems);

  // 2. Prepare AFTER items
  const currentTotalAmount = currentPortfolioItems.reduce((sum, item) => sum + (item.investmentAmount || 0), 0);
  
  let newPortfolioItems = [];
  let effectiveProspectiveAmount = prospectiveAmount;

  if (currentTotalAmount > 0) {
    // If amounts are provided, ensure prospectiveAmount has a sensible value (default 25% of current portfolio if 0)
    if (effectiveProspectiveAmount <= 0) {
      effectiveProspectiveAmount = Math.round(currentTotalAmount * 0.25);
    }

    newPortfolioItems = [
      ...currentPortfolioItems.map(item => ({ ...item })),
      {
        fund: prospectiveFund,
        investmentAmount: effectiveProspectiveAmount,
        weight: 0
      }
    ];
  } else {
    // Weight-based simulation
    const currentCount = currentPortfolioItems.length;
    let newWeight = prospectiveWeight;
    if (!newWeight || newWeight <= 0) {
      newWeight = currentCount > 0 ? (1 / (currentCount + 1)) : 1;
    }
    const remainingWeightShare = 1 - newWeight;

    newPortfolioItems = [
      ...currentPortfolioItems.map(item => ({
        ...item,
        weight: (item.weight || (1 / currentCount)) * remainingWeightShare
      })),
      {
        fund: prospectiveFund,
        investmentAmount: 0,
        weight: newWeight
      }
    ];
  }

  // 3. Calculate AFTER state
  const afterAggregation = aggregatePortfolioHoldings(newPortfolioItems);

  // 4. Calculate Direct Overlap between Prospective Fund and Current Portfolio
  // Formula: Sum of min(holdingWeight_in_ProspectiveFund, aggregatedWeight_in_CurrentPortfolio)
  const currentStockMap = new Map();
  beforeAggregation.stocks.forEach(s => {
    currentStockMap.set(normalizeStockIdentifier(s), s);
  });

  let directOverlapWeight = 0;
  const overlappingStocks = [];
  const brandNewStocks = [];

  prospectiveFund.holdings.forEach(ph => {
    const id = normalizeStockIdentifier(ph);
    if (currentStockMap.has(id)) {
      const currentStock = currentStockMap.get(id);
      const overlapContrib = Math.min(ph.weight, currentStock.effectiveWeight);
      directOverlapWeight += overlapContrib;

      overlappingStocks.push({
        stock: ph.stock,
        ticker: ph.ticker,
        sector: ph.sector,
        marketCap: ph.marketCap,
        currentWeight: currentStock.effectiveWeight,
        prospectiveFundWeight: ph.weight,
        overlapContribution: Number(overlapContrib.toFixed(2))
      });
    } else {
      brandNewStocks.push({
        stock: ph.stock,
        ticker: ph.ticker,
        sector: ph.sector,
        marketCap: ph.marketCap,
        prospectiveFundWeight: ph.weight
      });
    }
  });

  directOverlapWeight = Number(directOverlapWeight.toFixed(2));
  overlappingStocks.sort((a, b) => b.overlapContribution - a.overlapContribution);
  brandNewStocks.sort((a, b) => b.prospectiveFundWeight - a.prospectiveFundWeight);

  // 5. Calculate Pairwise Overlap of Prospective Fund with each current fund
  const pairwiseWithCurrentFunds = currentPortfolioItems.map(item => {
    const pairwise = calculatePairwiseOverlap(item.fund, prospectiveFund);
    return {
      fundId: item.fund.id,
      fundName: item.fund.name,
      category: item.fund.category,
      overlapPercentage: pairwise.overlapPercentage,
      commonStocksCount: pairwise.commonStocksCount
    };
  }).sort((a, b) => b.overlapPercentage - a.overlapPercentage);

  // 6. Detailed Stock-by-Stock Shift (Before vs After)
  const afterStockMap = new Map();
  afterAggregation.stocks.forEach(s => {
    afterStockMap.set(normalizeStockIdentifier(s), s);
  });

  const detailedStockShifts = [];
  const allStockKeys = new Set([...currentStockMap.keys(), ...afterStockMap.keys()]);

  allStockKeys.forEach(key => {
    const beforeStock = currentStockMap.get(key);
    const afterStock = afterStockMap.get(key);

    const stockName = afterStock?.stock || beforeStock?.stock;
    const ticker = afterStock?.ticker || beforeStock?.ticker;
    const sector = afterStock?.sector || beforeStock?.sector;
    const marketCap = afterStock?.marketCap || beforeStock?.marketCap;

    const beforeWeight = beforeStock ? beforeStock.effectiveWeight : 0;
    const afterWeight = afterStock ? afterStock.effectiveWeight : 0;
    const weightDelta = Number((afterWeight - beforeWeight).toFixed(2));

    const isCommonInProspective = prospectiveFund.holdings.some(h => normalizeStockIdentifier(h) === key);
    const isBrandNew = !beforeStock && isCommonInProspective;

    let alertLevel = 'normal';
    if (afterWeight >= 10) {
      alertLevel = 'critical'; // > 10% in a single stock is high risk
    } else if (afterWeight >= 7) {
      alertLevel = 'warning';  // 7-10% is elevated
    }

    detailedStockShifts.push({
      key,
      stock: stockName,
      ticker,
      sector,
      marketCap,
      beforeWeight,
      afterWeight,
      weightDelta,
      isBrandNew,
      isCommonInProspective,
      fundCountAfter: afterStock?.fundCount || 0,
      alertLevel
    });
  });

  // Sort by afterWeight descending
  detailedStockShifts.sort((a, b) => b.afterWeight - a.afterWeight);

  // 7. Sector Shifts (Before vs After)
  const allSectors = new Set([
    ...Object.keys(beforeAggregation.sectorBreakdown),
    ...Object.keys(afterAggregation.sectorBreakdown)
  ]);

  const sectorShifts = Array.from(allSectors).map(sector => {
    const beforePct = beforeAggregation.sectorBreakdown[sector] || 0;
    const afterPct = afterAggregation.sectorBreakdown[sector] || 0;
    const delta = Number((afterPct - beforePct).toFixed(2));

    return {
      sector,
      beforePct,
      afterPct,
      delta
    };
  }).sort((a, b) => b.afterPct - a.afterPct);

  // 8. Diversification Score & Recommendation Algorithm
  // Factors:
  // - Direct overlap penalty (0 to 50 pts deducted based on overlap %)
  // - Concentration penalty (deduct if any stock > 8%)
  // - New stocks bonus (+10 to +25 pts for bringing in 8+ new stocks)
  // - Category variety bonus
  let diversificationScore = 100;

  // Direct overlap deduction (higher overlap = lower score)
  diversificationScore -= (directOverlapWeight * 0.9);

  // Over-concentration penalty
  const highRiskStocks = detailedStockShifts.filter(s => s.afterWeight >= 8);
  if (highRiskStocks.length > 0) {
    diversificationScore -= (highRiskStocks.length * 6);
  }

  // Bonus for adding new unique stocks
  if (brandNewStocks.length >= 10) {
    diversificationScore += 12;
  } else if (brandNewStocks.length >= 5) {
    diversificationScore += 6;
  }

  diversificationScore = Math.max(10, Math.min(98, Math.round(diversificationScore)));

  // Risk Rating & Diagnosis
  let riskLevel = 'Low Overlap';
  let badgeColor = 'emerald';
  let recommendationSummary = '';
  let keyInsights = [];

  if (directOverlapWeight <= 15) {
    riskLevel = 'Excellent Diversifier (Low Overlap)';
    badgeColor = 'emerald';
    recommendationSummary = `Adding ${prospectiveFund.name} provides superior diversification with only ${directOverlapWeight}% overlap with your existing portfolio.`;
    keyInsights.push(`Introduces ${brandNewStocks.length} new company stocks that you currently do not own.`);
    keyInsights.push(`Expands your portfolio from ${beforeAggregation.totalUniqueStocks} to ${afterAggregation.totalUniqueStocks} unique stocks.`);
  } else if (directOverlapWeight <= 32) {
    riskLevel = 'Moderate Overlap (Balanced Addition)';
    badgeColor = 'cyan';
    recommendationSummary = `Adding ${prospectiveFund.name} introduces moderate overlap (${directOverlapWeight}%). It complements your portfolio with reasonable redundancy in core market leaders.`;
    keyInsights.push(`Shares ${overlappingStocks.length} stocks with your current funds, mainly in ${overlappingStocks.slice(0, 3).map(s => s.stock).join(', ')}.`);
    keyInsights.push(`Still adds ${brandNewStocks.length} fresh stocks to expand your market coverage.`);
  } else if (directOverlapWeight <= 48) {
    riskLevel = 'Elevated Overlap (High Redundancy)';
    badgeColor = 'amber';
    recommendationSummary = `Caution: ${prospectiveFund.name} has a significant ${directOverlapWeight}% overlap with your current portfolio. You are duplicating substantial stock exposure.`;
    keyInsights.push(`Shares ${overlappingStocks.length} overlapping holdings. Your top overlapping exposure will be concentrated in ${overlappingStocks.slice(0, 3).map(s => s.stock).join(', ')}.`);
    keyInsights.push(`Consider if an alternative fund in an under-allocated sector or small-cap space would provide better alpha.`);
  } else {
    riskLevel = 'Excessive Duplication (Duplicate Exposure)';
    badgeColor = 'rose';
    recommendationSummary = `High Redundancy Alert! ${prospectiveFund.name} overlaps ${directOverlapWeight}% with your current portfolio. Buying this fund mostly duplicates what you already own without adding meaningful diversification.`;
    keyInsights.push(`Very high stock redundancy: ${overlappingStocks.length} common stocks out of ${prospectiveFund.holdings.length} total holdings.`);
    keyInsights.push(`You would be paying additional expense ratio management fees for virtually identical stock holdings.`);
  }

  // Top stock concentration warning
  if (highRiskStocks.length > 0) {
    keyInsights.push(`Concentration warning: Post-purchase, ${highRiskStocks[0].stock} will account for ${highRiskStocks[0].afterWeight}% of your entire portfolio.`);
  }

  return {
    prospectiveFund: {
      id: prospectiveFund.id,
      name: prospectiveFund.name,
      category: prospectiveFund.category,
      amc: prospectiveFund.amc,
      nav: prospectiveFund.nav,
      expenseRatio: prospectiveFund.expenseRatio,
      holdingsCount: prospectiveFund.holdings.length
    },
    investmentSummary: {
      currentTotalAmount,
      prospectiveAmount: effectiveProspectiveAmount,
      newTotalAmount: currentTotalAmount + effectiveProspectiveAmount,
      allocationSharePercent: currentTotalAmount + effectiveProspectiveAmount > 0
        ? Number(((effectiveProspectiveAmount / (currentTotalAmount + effectiveProspectiveAmount)) * 100).toFixed(1))
        : 100
    },
    metrics: {
      directOverlapPercentage: directOverlapWeight,
      beforeUniqueStocks: beforeAggregation.totalUniqueStocks,
      afterUniqueStocks: afterAggregation.totalUniqueStocks,
      netNewStocksCount: brandNewStocks.length,
      commonStocksCount: overlappingStocks.length,
      beforeTop10Concentration: beforeAggregation.top10Concentration,
      afterTop10Concentration: afterAggregation.top10Concentration,
      beforeOverlapWeight: beforeAggregation.portfolioOverlapWeight,
      afterOverlapWeight: afterAggregation.portfolioOverlapWeight,
      overlapWeightDelta: Number((afterAggregation.portfolioOverlapWeight - beforeAggregation.portfolioOverlapWeight).toFixed(2)),
      diversificationScore
    },
    diagnosis: {
      riskLevel,
      badgeColor,
      recommendationSummary,
      keyInsights,
      highRiskStocks
    },
    overlappingStocks,
    brandNewStocks,
    pairwiseWithCurrentFunds,
    detailedStockShifts,
    sectorShifts,
    beforeAggregation,
    afterAggregation
  };
}
