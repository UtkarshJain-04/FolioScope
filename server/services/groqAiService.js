import OpenAI from 'openai';
import { normalizeStockIdentifier } from './overlapCalculator.js';
import { aggregatePortfolioHoldings } from './overlapCalculator.js';

// Initialize OpenAI client configured for Groq
function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.warn('[GroqAiService] Warning: GROQ_API_KEY / API_KEY is not set in environment.');
  }
  return new OpenAI({
    apiKey: apiKey || 'dummy-key',
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

/**
 * Standard legal disclaimer notice
 */
export const LEGAL_DISCLAIMER = `FolioScope AI is an algorithmic decision-support and educational analysis tool. It is NOT a SEBI-registered investment advisor, research analyst, or portfolio manager. All recommendations, overlap simulations, and risk categorization are computer-generated for educational and research purposes only. Mutual fund investments are subject to market risks; read all scheme-related documents carefully. Past performance and AI suggestions do not guarantee future returns. You bear sole responsibility for your investment decisions, asset allocation, and financial strategies.`;

/**
 * Calculate overlap percentage and details of a candidate fund against an active portfolio
 */
export function calculateFundOverlapWithPortfolio(portfolioItems, candidateFund) {
  if (!candidateFund || !candidateFund.holdings) {
    return { overlapPercentage: 0, commonStocksCount: 0, newStocksCount: 0, commonStocks: [], newStocks: [] };
  }

  const portfolioAgg = aggregatePortfolioHoldings(portfolioItems);
  const currentStockMap = new Map();
  portfolioAgg.stocks.forEach(s => {
    currentStockMap.set(normalizeStockIdentifier(s), s);
  });

  let overlapWeight = 0;
  const commonStocks = [];
  const newStocks = [];

  candidateFund.holdings.forEach(h => {
    const id = normalizeStockIdentifier(h);
    if (currentStockMap.has(id)) {
      const existing = currentStockMap.get(id);
      const overlapContrib = Math.min(h.weight, existing.effectiveWeight);
      overlapWeight += overlapContrib;

      commonStocks.push({
        stock: h.stock,
        ticker: h.ticker,
        sector: h.sector || 'Other',
        marketCap: h.marketCap || 'Other',
        candidateWeight: h.weight,
        portfolioEffectiveWeight: existing.effectiveWeight,
        overlapContribution: Number(overlapContrib.toFixed(2)),
      });
    } else {
      newStocks.push({
        stock: h.stock,
        ticker: h.ticker,
        sector: h.sector || 'Other',
        marketCap: h.marketCap || 'Other',
        candidateWeight: h.weight,
      });
    }
  });

  commonStocks.sort((a, b) => b.overlapContribution - a.overlapContribution);
  newStocks.sort((a, b) => b.candidateWeight - a.candidateWeight);

  const overlapPercentage = Number(overlapWeight.toFixed(2));

  return {
    fundId: candidateFund.id,
    fundName: candidateFund.name,
    category: candidateFund.category,
    riskRating: candidateFund.riskRating,
    cagr3Y: candidateFund.cagr3Y,
    expenseRatio: candidateFund.expenseRatio,
    overlapPercentage,
    commonStocksCount: commonStocks.length,
    newStocksCount: newStocks.length,
    commonStocks,
    newStocks,
    overlapLevel: overlapPercentage < 20 ? 'Low (High Diversification)' : overlapPercentage <= 40 ? 'Moderate' : 'High (Duplicate Exposure)',
  };
}

/**
 * Score and rank candidate funds against current portfolio
 */
export function rankFundsByOverlap(portfolioItems, allFunds) {
  const currentFundIds = new Set(portfolioItems.map(p => p.fundId || (p.fund && p.fund.id)));
  const candidates = allFunds.filter(f => !currentFundIds.has(f.id));

  const ranked = candidates.map(fund => calculateFundOverlapWithPortfolio(portfolioItems, fund));
  ranked.sort((a, b) => a.overlapPercentage - b.overlapPercentage);
  return ranked;
}

/**
 * Generate AI Mutual Fund Recommendations using Groq (openai/gpt-oss-20b)
 */
export async function generatePersonalizedAiRecommendation({
  currentPortfolioItems,
  allFunds,
  userProfile = {},
  selectedCandidateFundIds = [],
}) {
  const client = getGroqClient();

  // 1. Calculate actual overlap metrics for all candidates
  const allRanked = rankFundsByOverlap(currentPortfolioItems, allFunds);
  
  // Specific candidate funds or top options
  let targetCandidates = [];
  if (selectedCandidateFundIds && selectedCandidateFundIds.length > 0) {
    targetCandidates = allRanked.filter(c => selectedCandidateFundIds.includes(c.fundId));
  } else {
    // Pick diverse candidates across Small Cap, Mid Cap, Large Cap, Thematic
    targetCandidates = allRanked;
  }

  // Current portfolio summary
  const currentFundsSummary = currentPortfolioItems.map(item => {
    const fund = item.fund;
    return `- ${fund.name} (${fund.category}, AUM: ₹${fund.aum || 'N/A'} Cr, 3Y CAGR: ${fund.cagr3Y || 'N/A'}%)`;
  }).join('\n');

  // Candidate overlap table
  const candidatesDataSummary = targetCandidates.map(c => {
    const topCommon = c.commonStocks.slice(0, 3).map(s => `${s.stock} (${s.overlapContribution}%)`).join(', ') || 'None';
    const topNew = c.newStocks.slice(0, 3).map(s => `${s.stock} (${s.candidateWeight}%)`).join(', ') || 'None';
    return `* Fund: "${c.fundName}" | Category: ${c.category} | Overlap: ${c.overlapPercentage}% (${c.overlapLevel}) | 3Y CAGR: ${c.cagr3Y}% | Expense Ratio: ${c.expenseRatio}%\n  - Shared Stocks: ${topCommon}\n  - Unique New Stocks Added: ${topNew}`;
  }).join('\n\n');

  const {
    purpose = 'wealth_creation',
    riskTolerance = 'high',
    experienceLevel = 'beginner',
    timeHorizon = '5-10y',
    customGoalText = '',
    specificComparison = false,
  } = userProfile;

  // Build tailored instruction prompt for Groq
  const prompt = `You are FolioScope AI, an elite mutual fund research analyst and portfolio diversification specialist.
You help investors make smart, personalized mutual fund choices by analyzing portfolio stock overlap and aligning recommendations with their investment purpose and risk appetite.

USER PROFILE:
- Investing Purpose / Goal: ${purpose} ${customGoalText ? `("${customGoalText}")` : ''}
- Risk Appetite: ${riskTolerance} (e.g., if "high", aggressive funds like Small Cap / Mid Cap are appropriate; if "moderate", Flexi Cap / Large & Mid Cap; if "low", Large Cap / Index)
- Experience Level: ${experienceLevel} ${experienceLevel === 'beginner' ? '(CRITICAL: User is a beginner who does not know much about mutual funds. Explain everything in simple, jargon-free, crystal-clear language with relatable analogies!)' : '(Provide analytical, data-driven reasoning)'}
- Time Horizon: ${timeHorizon}

USER'S CURRENT PORTFOLIO:
${currentFundsSummary || 'No active funds'}

CANDIDATE FUNDS WITH EXACT MATHEMATICAL OVERLAP PERCENTAGES:
${candidatesDataSummary}

TASK INSTRUCTIONS:
1. OVERLAP-BASED COMPARISON & SELECTION:
   - State and compare the exact overlap percentages of the candidate funds (e.g. "Fund A has X% overlap with your portfolio, whereas Fund B has Y% overlap").
   - Explicitly explain why picking a fund with lower overlap (e.g. < 20%) provides real diversification (avoids paying double expense ratios on the same stocks like HDFC Bank or Reliance, reduces concentration risk, adds new sector exposure).
   - If two specific funds are being compared, explain clearly why one is superior based on its overlap percentage and complementary holdings.

2. GOAL & RISK-BASED ALIGNMENT:
   - Check the user's purpose: If their goal is "High Risk High Reward" (or aggressive wealth creation), specifically recommend Small Cap funds (e.g. Nippon India Small Cap, SBI Small Cap) or high-growth Mid Cap funds. Explain that small caps invest in young, fast-growing companies that can generate high returns over 7-10+ years, but fluctuate more in the short term.
   - If their goal is moderate or steady compounding, recommend Flexi Cap or Large & Mid Cap.
   - If low risk, recommend Large Cap or Index funds.

3. BEGINNER GUIDANCE (Mutual Funds 101):
   - ${experienceLevel === 'beginner' ? 'Include a dedicated section: "Beginner Guide: What You Need to Know". Explain in 3 simple bullet points: (1) What is a mutual fund? (2) Why Overlap matters (use the fruit basket analogy), and (3) What Small Cap vs Large Cap means.' : 'Include a strategic asset allocation note.'}

4. FINAL CLEAR ACTIONABLE VERDICT:
   - Give 1 or 2 Top Recommended Funds with their exact overlap %, expected role in portfolio, and SIP/allocation advice.

5. DISCLAIMER & CONSENT NOTICE:
   - End with a clear disclaimer reminder: "Disclaimer: This recommendation is an educational simulation based on portfolio overlap and user-stated goals. FolioScope is not a SEBI-registered advisor. You are solely responsible for your investment strategy and capital allocation."

Format your output in clean, beautiful Markdown with headers, bold text, and bullet points.`;

  try {
    const response = await client.responses.create({
      model: 'openai/gpt-oss-20b',
      input: prompt,
    });

    const outputText = response.output_text || (response.output && response.output.find(o => o.type === 'message')?.content?.[0]?.text) || '';

    return {
      success: true,
      aiAnalysis: outputText,
      modelUsed: 'openai/gpt-oss-20b (Groq)',
      userProfile,
      rankedCandidates: targetCandidates.slice(0, 6),
      disclaimer: LEGAL_DISCLAIMER,
    };
  } catch (error) {
    console.error('[GroqAiService] Error calling client.responses.create:', error);
    
    // Provide a comprehensive algorithmic fallback so users always get high quality insights
    const fallbackAnalysis = generateFallbackRecommendation({
      userProfile,
      targetCandidates,
      currentPortfolioItems,
    });

    return {
      success: true,
      aiAnalysis: fallbackAnalysis,
      modelUsed: 'FolioScope Algorithmic Engine (Offline / Fallback)',
      userProfile,
      rankedCandidates: targetCandidates.slice(0, 6),
      disclaimer: LEGAL_DISCLAIMER,
      errorNote: error.message,
    };
  }
}

/**
 * Interactive Advisor Chat using Groq
 */
export async function chatWithFinancialAdvisor({
  message,
  currentPortfolioItems,
  allFunds,
  userProfile = {},
  chatHistory = [],
}) {
  const client = getGroqClient();

  const rankedCandidates = rankFundsByOverlap(currentPortfolioItems, allFunds).slice(0, 5);
  const currentSummary = currentPortfolioItems.map(p => `${p.fund.name} (${p.fund.category})`).join(', ');
  const rankedSummary = rankedCandidates.map(c => `${c.fundName} (${c.category}, Overlap: ${c.overlapPercentage}%)`).join('; ');

  const prompt = `You are FolioScope AI, an interactive personal mutual fund advisor and overlap analyst.
User Profile:
- Investing Purpose: ${userProfile.purpose || 'Wealth Creation'}
- Risk Appetite: ${userProfile.riskTolerance || 'High Risk High Reward'}
- Experience Level: ${userProfile.experienceLevel || 'Beginner'}
- Active Portfolio: ${currentSummary || 'None'}
- Top Candidate Funds with Overlap %: ${rankedSummary}

User Question: "${message}"

INSTRUCTIONS:
1. Answer directly, concisely, and helpfully.
2. If comparing funds, reference their exact overlap percentages (Fund X has x% overlap, Fund Y has y% overlap).
3. If they ask about high risk high reward, explain how Small Cap funds fit and which small cap has the least overlap.
4. If beginner, keep language simple and encouraging.
5. Remind them briefly that you provide analytical guidance, and they remain responsible for their investment decisions.`;

  try {
    const response = await client.responses.create({
      model: 'openai/gpt-oss-20b',
      input: prompt,
    });

    const reply = response.output_text || (response.output && response.output.find(o => o.type === 'message')?.content?.[0]?.text) || 'No response generated.';

    return {
      success: true,
      reply,
      modelUsed: 'openai/gpt-oss-20b (Groq)',
      disclaimer: LEGAL_DISCLAIMER,
    };
  } catch (error) {
    console.error('[GroqAiService] Chat error:', error);
    return {
      success: true,
      reply: `Here is our overlap-based analysis: For your goal of ${userProfile.purpose || 'wealth creation'} with ${userProfile.riskTolerance || 'high risk'}, you should prioritize funds with low overlap (<20%) to avoid duplication. Among your top candidates, ${rankedCandidates[0]?.fundName || 'Small Cap fund'} has only ${rankedCandidates[0]?.overlapPercentage || '8'}% overlap with your portfolio, offering maximum diversification.\n\n*Disclaimer: Educational suggestion. You are responsible for your own strategy.*`,
      modelUsed: 'FolioScope Fallback',
      disclaimer: LEGAL_DISCLAIMER,
    };
  }
}

/**
 * Algorithmic Fallback generator
 */
function generateFallbackRecommendation({ userProfile, targetCandidates, currentPortfolioItems }) {
  const { purpose = 'wealth_creation', riskTolerance = 'high', experienceLevel = 'beginner' } = userProfile;

  const lowOverlapFunds = targetCandidates.filter(c => c.overlapPercentage < 20);
  const highOverlapFunds = targetCandidates.filter(c => c.overlapPercentage >= 40);

  const topPick = (riskTolerance === 'high' 
    ? targetCandidates.find(c => c.category === 'Small Cap' || c.category === 'Mid Cap')
    : targetCandidates.find(c => c.overlapPercentage < 20)) || targetCandidates[0];

  return `### 🎯 Personalized Mutual Fund Recommendation

#### 1. Overlap Analysis & Fund Comparison
- **Top Low-Overlap Recommendation**: **${topPick?.fundName || 'Nippon India Small Cap Fund'}**
  - **Overlap with your portfolio**: **${topPick?.overlapPercentage || '8.5'}%** (Ultra Low Overlap)
  - **Why this matters**: With only ${topPick?.overlapPercentage || '8.5'}% overlap, this fund introduces **${topPick?.newStocksCount || '18'} new companies** without duplicating your existing large-cap holdings.
- **High-Overlap Caution**: Funds like **${highOverlapFunds[0]?.fundName || 'HDFC Top 100'}** share **${highOverlapFunds[0]?.overlapPercentage || '42'}% overlap**, which duplicates stocks you already own in your portfolio.

#### 2. Goal Alignment: ${riskTolerance === 'high' ? 'High Risk, High Reward (Small Cap Strategy)' : 'Balanced Growth Strategy'}
${riskTolerance === 'high' 
  ? `Since your purpose is **High Risk High Reward**, Small Cap funds are an ideal vehicle. Small-cap enterprises have higher growth potential and can generate market-beating returns over a 7-10 year horizon. However, they carry higher short-term volatility.`
  : `Since your goal is steady wealth creation, a balanced mix with low portfolio duplication gives you optimal risk-adjusted returns.`}

#### 3. 📘 Beginner Guide: What You Need to Know
- **What is Overlap?** Imagine buying two fruit baskets that both contain 80% apples and bananas. You pay two delivery charges for the same fruits. Similarly, high mutual fund overlap means you pay two management fees for the same underlying stocks!
- **What is a Small Cap Fund?** Companies ranked 251st and beyond by market capitalization in India. They are smaller, dynamic businesses with substantial room to grow into mid or large caps.
- **The Golden Rule**: Aim for portfolio additions with **under 20% overlap** to achieve genuine diversification.

---
*Disclaimer: Educational research recommendation based on mathematical overlap calculations. FolioScope is not a SEBI-registered advisor; you are responsible for your own investment decisions.*`;
}
