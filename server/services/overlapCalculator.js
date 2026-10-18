// Service for Mutual Fund Overlap Mathematics & Portfolio Aggregation

/**
 * Standardize stock names/tickers to match accurately across funds
 */
export function normalizeStockIdentifier(stock) {
  if (stock.ticker) return stock.ticker.toUpperCase().trim();
  return stock.stock.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Calculate pairwise overlap between two mutual funds
 * Industry standard formula: Sum of min(weightA_i, weightB_i) for all shared stocks
 */
export function calculatePairwiseOverlap(fundA, fundB) {
  if (!fundA || !fundB) return null;

  const holdingsMapA = new Map();
  fundA.holdings.forEach(h => {
    const id = normalizeStockIdentifier(h);
    holdingsMapA.set(id, h);
  });

  const commonStocks = [];
  const uniqueToA = [];
  const uniqueToB = [];

  let overlapWeight = 0;
  let totalWeightAInCommon = 0;
  let totalWeightBInCommon = 0;

  // Track checked stocks in B
  const seenInB = new Set();

  fundB.holdings.forEach(hb => {
    const id = normalizeStockIdentifier(hb);
    seenInB.add(id);

    if (holdingsMapA.has(id)) {
      const ha = holdingsMapA.get(id);
      const minWeight = Math.min(ha.weight, hb.weight);
      overlapWeight += minWeight;
      totalWeightAInCommon += ha.weight;
      totalWeightBInCommon += hb.weight;

      commonStocks.push({
        stock: ha.stock,
        ticker: ha.ticker || hb.ticker,
        sector: ha.sector || hb.sector,
        marketCap: ha.marketCap || hb.marketCap,
        weightInA: ha.weight,
        weightInB: hb.weight,
        minOverlapWeight: Number(minWeight.toFixed(2)),
        weightDifference: Number(Math.abs(ha.weight - hb.weight).toFixed(2))
      });
    } else {
      uniqueToB.push({
        stock: hb.stock,
        ticker: hb.ticker,
        sector: hb.sector,
        marketCap: hb.marketCap,
        weight: hb.weight
      });
    }
  });

  fundA.holdings.forEach(ha => {
    const id = normalizeStockIdentifier(ha);
    if (!seenInB.has(id)) {
      uniqueToA.push({
        stock: ha.stock,
        ticker: ha.ticker,
        sector: ha.sector,
        marketCap: ha.marketCap,
        weight: ha.weight
      });
    }
  });

  // Sort common stocks by overlap weight descending
  commonStocks.sort((a, b) => b.minOverlapWeight - a.minOverlapWeight);
  uniqueToA.sort((a, b) => b.weight - a.weight);
  uniqueToB.sort((a, b) => b.weight - a.weight);

  const totalUniqueStocksCount = commonStocks.length + uniqueToA.length + uniqueToB.length;
  const commonStocksCount = commonStocks.length;

  return {
    fundA: { id: fundA.id, name: fundA.name, category: fundA.category },
    fundB: { id: fundB.id, name: fundB.name, category: fundB.category },
    overlapPercentage: Number(overlapWeight.toFixed(2)),
    commonStocksCount,
    totalUniqueStocksCount,
    commonStocksRatio: totalUniqueStocksCount > 0 ? Number(((commonStocksCount / totalUniqueStocksCount) * 100).toFixed(1)) : 0,
    weightOfCommonInFundA: Number(totalWeightAInCommon.toFixed(2)),
    weightOfCommonInFundB: Number(totalWeightBInCommon.toFixed(2)),
    commonStocks,
    uniqueToA,
    uniqueToB
  };
}

/**
 * Calculate full N x N pairwise overlap matrix for an array of funds
 */
export function calculateOverlapMatrix(funds) {
  const n = funds.length;
  const matrix = [];

  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push({
          fundAId: funds[i].id,
          fundBId: funds[j].id,
          overlapPercentage: 100,
          commonStocksCount: funds[i].holdings.length
        });
      } else {
        const result = calculatePairwiseOverlap(funds[i], funds[j]);
        row.push({
          fundAId: funds[i].id,
          fundBId: funds[j].id,
          overlapPercentage: result.overlapPercentage,
          commonStocksCount: result.commonStocksCount
        });
      }
    }
    matrix.push(row);
  }

  return {
    funds: funds.map(f => ({ id: f.id, name: f.name, category: f.category, amc: f.amc })),
    matrix
  };
}

/**
 * Aggregate a multi-fund portfolio into a single blended stock holding list
 * portfolioItems: [{ fund: FundObject, investmentAmount: number, weight: number }]
 */
export function aggregatePortfolioHoldings(portfolioItems) {
  if (!portfolioItems || portfolioItems.length === 0) {
    return {
      totalAmount: 0,
      stocks: [],
      sectorBreakdown: {},
      marketCapBreakdown: {},
      totalUniqueStocks: 0,
      overlappingStocksCount: 0,
      portfolioOverlapWeight: 0,
      top10Concentration: 0
    };
  }

  const totalAmount = portfolioItems.reduce((acc, item) => acc + (item.investmentAmount || 0), 0);
  const useAmounts = totalAmount > 0;

  // Calculate normalized weights for each fund
  const normalizedFunds = portfolioItems.map(item => {
    let weight = 0;
    if (useAmounts) {
      weight = (item.investmentAmount / totalAmount);
    } else {
      // If no amounts provided, assume equal weight or given weight
      weight = item.weight || (1 / portfolioItems.length);
    }
    return {
      fund: item.fund,
      amount: item.investmentAmount || 0,
      weight
    };
  });

  // Aggregate stock holdings
  const stockMap = new Map();
  const sectorMap = {};
  const marketCapMap = { 'Large Cap': 0, 'Mid Cap': 0, 'Small Cap': 0, 'Other': 0 };

  normalizedFunds.forEach(({ fund, weight, amount }) => {
    fund.holdings.forEach(holding => {
      const id = normalizeStockIdentifier(holding);
      const stockWeightedShare = holding.weight * weight; // effective portfolio weight %

      if (!stockMap.has(id)) {
        stockMap.set(id, {
          stock: holding.stock,
          ticker: holding.ticker,
          sector: holding.sector || 'Other',
          marketCap: holding.marketCap || 'Other',
          effectiveWeight: stockWeightedShare,
          effectiveAmount: useAmounts ? (amount * (holding.weight / 100)) : 0,
          heldInFunds: [{ fundId: fund.id, fundName: fund.name, fundWeight: holding.weight }]
        });
      } else {
        const existing = stockMap.get(id);
        existing.effectiveWeight += stockWeightedShare;
        if (useAmounts) {
          existing.effectiveAmount += (amount * (holding.weight / 100));
        }
        existing.heldInFunds.push({ fundId: fund.id, fundName: fund.name, fundWeight: holding.weight });
      }

      // Sectors
      const sec = holding.sector || 'Other';
      sectorMap[sec] = (sectorMap[sec] || 0) + stockWeightedShare;

      // Market cap
      const mc = holding.marketCap || 'Other';
      marketCapMap[mc] = (marketCapMap[mc] || 0) + stockWeightedShare;
    });
  });

  const stocks = Array.from(stockMap.values()).map(s => ({
    ...s,
    effectiveWeight: Number(s.effectiveWeight.toFixed(2)),
    effectiveAmount: Number(s.effectiveAmount.toFixed(2)),
    fundCount: s.heldInFunds.length
  }));

  stocks.sort((a, b) => b.effectiveWeight - a.effectiveWeight);

  // Overlapping stocks are those appearing in > 1 fund
  const overlappingStocks = stocks.filter(s => s.fundCount > 1);
  const portfolioOverlapWeight = overlappingStocks.reduce((sum, s) => sum + s.effectiveWeight, 0);

  // Top 10 concentration
  const top10Concentration = stocks.slice(0, 10).reduce((sum, s) => sum + s.effectiveWeight, 0);

  // Round sectors and market caps
  const cleanSectors = {};
  Object.keys(sectorMap).forEach(k => {
    cleanSectors[k] = Number(sectorMap[k].toFixed(2));
  });

  const cleanMarketCaps = {};
  Object.keys(marketCapMap).forEach(k => {
    cleanMarketCaps[k] = Number(marketCapMap[k].toFixed(2));
  });

  return {
    totalAmount,
    fundsCount: portfolioItems.length,
    stocks,
    sectorBreakdown: cleanSectors,
    marketCapBreakdown: cleanMarketCaps,
    totalUniqueStocks: stocks.length,
    overlappingStocksCount: overlappingStocks.length,
    portfolioOverlapWeight: Number(portfolioOverlapWeight.toFixed(2)),
    top10Concentration: Number(top10Concentration.toFixed(2))
  };
}
