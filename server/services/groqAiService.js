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
    const response = await client.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'user', content: prompt }],
    });

    const outputText = response.choices[0]?.message?.content;
    if (!outputText) {
      throw new Error('Groq returned an empty recommendation.');
    }

    return {
      success: true,
      aiAnalysis: outputText,
      modelUsed: 'openai/gpt-oss-20b (Groq)',
      userProfile,
      rankedCandidates: targetCandidates.slice(0, 6),
      disclaimer: LEGAL_DISCLAIMER,
    };
  } catch (error) {
    console.error('[GroqAiService] Error generating recommendation:', error);
    
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
    const response = await client.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'user', content: prompt }],
    });

    const reply = response.choices[0]?.message?.content;
    if (!reply) {
      throw new Error('Groq returned an empty chat response.');
    }

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
export function generateFallbackRecommendation({ userProfile = {}, targetCandidates = [], currentPortfolioItems = [] }) {
  const {
    purpose = 'wealth_creation',
    riskTolerance = 'moderate',
    experienceLevel = 'beginner',
    timeHorizon = '5-10y',
    customGoalText = '',
    specificComparison = false,
  } = userProfile;

  const goalDetails = {
    high_risk_high_reward: {
      label: 'High Risk, High Reward',
      matches: category => category === 'Small Cap' || category === 'Mid Cap',
    },
    wealth_creation: {
      label: 'Steady Long-Term Wealth',
      matches: category => ['Flexi Cap', 'Large & Mid Cap', 'Multi Cap'].includes(category),
    },
    capital_preservation: {
      label: 'Capital Preservation / Low Risk',
      matches: category => category === 'Large Cap' || category === 'Index Fund',
    },
    thematic_tech: {
      label: 'Thematic & Global Tech',
      matches: category => category.includes('Technology') || category.includes('International'),
    },
    custom_goal: {
      label: customGoalText.trim() || 'Custom Investment Purpose',
      matches: () => true,
    },
  };
  const goal = goalDetails[purpose] || {
    label: purpose,
    matches: () => true,
  };

  const goalAlignedCandidates = targetCandidates.filter(candidate => goal.matches(candidate.category));
  const recommendations = (goalAlignedCandidates.length ? goalAlignedCandidates : targetCandidates)
    .slice(0, 2);
  const highestOverlapCandidate = targetCandidates.reduce(
    (highest, candidate) => candidate.overlapPercentage > (highest?.overlapPercentage ?? -1) ? candidate : highest,
    null
  );
  const currentFundNames = currentPortfolioItems.map(item => item.fund.name).filter(Boolean);
  const riskDescription = {
    low: 'lower-risk',
    moderate: 'moderate-risk',
    high: 'higher-risk',
  }[riskTolerance] || riskTolerance;
  const alignmentNote = goalAlignedCandidates.length
    ? `The selected funds match your **${goal.label}** goal and **${riskDescription}** profile.`
    : `No candidate in this request matches the usual category for **${goal.label}**; the available options are ranked by overlap instead.`;
  const recommendationText = recommendations.length
    ? recommendations.map((candidate, index) => (
      `${index + 1}. **${candidate.fundName}** (${candidate.category}) — `
      + `**${candidate.overlapPercentage}% overlap**, ${candidate.newStocksCount} new holdings and `
      + `${candidate.commonStocksCount} shared holdings.`
    )).join('\n')
    : 'No eligible candidate funds were found. Refresh the rankings or clear the selected-fund filter and try again.';
  const overlapCaution = highestOverlapCandidate?.overlapPercentage >= 40
    ? `The highest-overlap option is **${highestOverlapCandidate.fundName}** at **${highestOverlapCandidate.overlapPercentage}%**.`
    : 'None of the funds analyzed has 40% or higher overlap.';
  const beginnerGuidance = experienceLevel === 'beginner'
    ? `\n#### Beginner note\nOverlap is the portion of a fund's holdings that duplicates stocks already in your portfolio. Lower overlap can add diversification, but does not remove investment risk.`
    : `\n#### Portfolio note\nCompare overlap alongside risk, fees, time horizon, and your existing asset allocation; low overlap alone does not make a fund suitable.`;

  return `### Personalized Mutual Fund Recommendation

#### Goal and profile
- **Goal:** ${goal.label}${customGoalText && purpose !== 'custom_goal' ? ` — ${customGoalText}` : ''}
- **Risk tolerance:** ${riskTolerance}
- **Time horizon:** ${timeHorizon}
- **Current funds considered:** ${currentFundNames.join(', ') || 'No active funds'}
- ${alignmentNote}

#### ${specificComparison ? 'Selected fund comparison' : 'Funds to review'}
${recommendationText}

#### Overlap context
- ${overlapCaution}
- A fund's overlap percentage measures shared holding weight; use it with the other profile details rather than as the only selection criterion.
${beginnerGuidance}

*Disclaimer: This is an educational, algorithmic analysis of your profile and portfolio data, not personalized financial advice. FolioScope is not a SEBI-registered advisor. Mutual fund investments are subject to market risks.*`;
}
