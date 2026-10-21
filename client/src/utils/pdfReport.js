import html2pdf from "html2pdf.js";

const formatINR = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const number = (value, digits = 1) =>
  `${(Number(value) || 0).toFixed(digits)}%`;

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const bar = (label, value, color = "#84cc16") => {
  const percentage = Math.max(0, Number(value) || 0);
  const width = Math.min(100, percentage);

  return `
    <div class="bar-row">
      <div class="bar-label">
        <span>${escapeHTML(label)}</span>
        <strong>${number(percentage)}</strong>
      </div>
      <div class="bar-track">
        <div class="bar-fill"
          style="width:${width}%;background:${color}"></div>
      </div>
    </div>`;
};

const table = (headers, rows) => `
  <table>
    <thead><tr>
      ${headers.map((h) => `<th>${escapeHTML(h)}</th>`).join("")}
    </tr></thead>
    <tbody>
      ${rows.length
        ? rows.map((row) => `
          <tr>${row.map((cell) =>
            `<td>${cell ?? "—"}</td>`
          ).join("")}</tr>
        `).join("")
        : `<tr><td colspan="${headers.length}">No data available</td></tr>`
      }
    </tbody>
  </table>`;

export async function downloadPortfolioReport({
  funds = [],
  currentPortfolio = [],
  prospectiveFundId,
  prospectiveAmount = 30000,
  simulationResult,
}) {
  if (!simulationResult) {
    alert("Please run the portfolio simulation before downloading.");
    return;
  }

  const result = simulationResult;
  const metrics = result.metrics || {};
  const diagnosis = result.diagnosis || {};
  const summary = result.investmentSummary || {};

  const getFund = (id) => funds.find((fund) => fund.id === id);

  const currentTotal = currentPortfolio.reduce(
    (sum, item) => sum + (Number(item.investmentAmount) || 0),
    0
  );

  const prospectiveFund =
    result.prospectiveFund || getFund(prospectiveFundId);

  const reportDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const fundRows = currentPortfolio.map((item) => {
    const fund = getFund(item.fundId);
    const amount = Number(item.investmentAmount) || 0;

    return [
      escapeHTML(fund?.name || item.fundId),
      escapeHTML(fund?.category || "—"),
      formatINR(amount),
      number(currentTotal ? (amount / currentTotal) * 100 : 0),
    ];
  });

  const sectorShifts = result.sectorShifts || [];
  const stockShifts = result.detailedStockShifts || [];
  const pairwise = result.pairwiseWithCurrentFunds || [];

  const sectorBars = sectorShifts.slice(0, 10).map((sector) => `
    <div class="sector">
      <div class="sector-heading">
        <strong>${escapeHTML(sector.sector)}</strong>
        <span>${number(sector.beforePct)} → ${number(sector.afterPct)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="
          width:${Math.min(100, Math.max(0, Number(sector.beforePct) || 0))}%;
          background:#64748b"></div>
      </div>
      <div class="bar-track after-track">
        <div class="bar-fill" style="
          width:${Math.min(100, Math.max(0, Number(sector.afterPct) || 0))}%;
          background:#84cc16"></div>
      </div>
    </div>
  `).join("");

  const topStocks = stockShifts.slice(0, 10);

  const stockBars = topStocks.map((stock) =>
    bar(stock.stock || stock.ticker, stock.afterWeight)
  ).join("");

  const stockRows = stockShifts.slice(0, 30).map((stock) => [
    escapeHTML(stock.stock),
    escapeHTML(stock.ticker || "—"),
    escapeHTML(stock.sector || "—"),
    number(stock.beforeWeight),
    number(stock.afterWeight),
    `<span class="${Number(stock.weightDelta) > 0 ? "positive" : "neutral"}">
      ${Number(stock.weightDelta) > 0 ? "+" : ""}
      ${number(stock.weightDelta)}
    </span>`,
  ]);

  const overlapRows = pairwise.map((item) => [
    escapeHTML(item.fundName),
    escapeHTML(item.category || "—"),
    number(item.overlapPercentage),
    String(item.commonStocksCount ?? 0),
  ]);

  const insights = Array.isArray(diagnosis.keyInsights)
    ? diagnosis.keyInsights
    : [];

  const report = document.createElement("div");

  report.innerHTML = `
    <style>
      .folio-report {
        font-family: Arial, Helvetica, sans-serif;
        color: #17251f;
        background: #ffffff;
        font-size: 10px;
        line-height: 1.55;
      }

      .folio-report * { box-sizing: border-box; }

      .cover {
        background: #10251d;
        color: #ffffff;
        padding: 36px 32px;
        border-bottom: 7px solid #a3e635;
      }

      .brand {
        color: #bef264;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 2px;
      }

      .cover h1 {
        font-size: 30px;
        line-height: 1.15;
        margin: 45px 0 12px;
      }

      .cover p { color: #d1fae5; font-size: 12px; }

      .cover-meta {
        margin-top: 35px;
        color: #d1fae5;
        font-size: 10px;
      }

      .content { padding: 24px 30px; }

      h2 {
        font-size: 17px;
        color: #153c2c;
        margin: 0 0 12px;
      }

      h3 {
        font-size: 12px;
        color: #244c38;
        margin: 18px 0 9px;
      }

      .muted { color: #64748b; }

      .section { margin-bottom: 22px; }

      .kpis {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 9px;
        margin: 14px 0 22px;
      }

      .kpi {
        background: #f1f7ee;
        border: 1px solid #dce9d5;
        border-radius: 7px;
        padding: 12px;
      }

      .kpi-label {
        color: #64748b;
        font-size: 9px;
      }

      .kpi-value {
        font-size: 19px;
        font-weight: 800;
        color: #183d2a;
        margin-top: 5px;
      }

      .callout {
        padding: 14px;
        border-left: 4px solid #84cc16;
        background: #f5f9f1;
        margin: 12px 0;
      }

      .bar-row { margin: 9px 0; }

      .bar-label {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 4px;
      }

      .bar-track {
        background: #e8edf0;
        height: 8px;
        border-radius: 8px;
        overflow: hidden;
        margin: 3px 0;
      }

      .bar-fill { height: 100%; border-radius: 8px; }

      .sector { margin: 13px 0; }

      .sector-heading {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }

      .after-track { margin-bottom: 8px; }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 8px;
        margin: 10px 0 18px;
      }

      th {
        background: #173b2b;
        color: #ffffff;
        text-align: left;
        padding: 8px 6px;
      }

      td {
        padding: 7px 6px;
        border-bottom: 1px solid #e5e7eb;
        overflow-wrap: anywhere;
      }

      tr { page-break-inside: avoid; }

      tbody tr:nth-child(even) { background: #f6f8f5; }

      .positive { color: #15803d; font-weight: bold; }

      .neutral { color: #64748b; }

      .insight {
        padding: 8px 10px;
        margin: 6px 0;
        background: #f5f8f2;
        border-radius: 5px;
      }

      .legend { color: #64748b; font-size: 8px; }

      .disclaimer {
        border-top: 1px solid #d1d5db;
        padding-top: 12px;
        font-size: 8px;
        color: #64748b;
      }

      .footer {
        padding: 10px 30px 18px;
        color: #64748b;
        font-size: 8px;
        border-top: 1px solid #e5e7eb;
      }

      .new-page { page-break-before: always; }

      .avoid-break { page-break-inside: avoid; }
    </style>

    <div class="folio-report">
      <div class="cover">
        <div class="brand">FOLIOSCOPE AI</div>
        <h1>Portfolio X-Ray<br/> & Investment Analysis</h1>
        <p>Mutual fund overlap, concentration and pre-purchase simulation</p>
        <div class="cover-meta">
          <strong>REPORT DATE</strong><br/>
          ${escapeHTML(reportDate)}<br/><br/>
          <strong>PROSPECTIVE FUND</strong><br/>
          ${escapeHTML(prospectiveFund?.name || "Selected fund")}<br/><br/>
          <strong>EXISTING PORTFOLIO VALUE</strong><br/>
          ${formatINR(currentTotal)}
        </div>
      </div>

      <div class="content">
        <div class="section">
          <h2>01 / Executive Summary</h2>
          <p class="muted">
            This report compares your current mutual fund portfolio with a
            simulated purchase. Figures are based on the holdings and
            calculations available in FolioScope at report generation time.
          </p>

          <div class="callout">
            <strong>${escapeHTML(diagnosis.riskLevel || "Portfolio analysis")}</strong>
            <p>${escapeHTML(diagnosis.recommendationSummary || "Review the metrics and holdings below.")}</p>
          </div>

          <div class="kpis">
            <div class="kpi">
              <div class="kpi-label">Direct Overlap</div>
              <div class="kpi-value">${number(metrics.directOverlapPercentage)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Diversification Score</div>
              <div class="kpi-value">${escapeHTML(metrics.diversificationScore ?? "—")}/100</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Unique Stocks Before</div>
              <div class="kpi-value">${escapeHTML(metrics.beforeUniqueStocks ?? "—")}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Unique Stocks After</div>
              <div class="kpi-value">${escapeHTML(metrics.afterUniqueStocks ?? "—")}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Common Stocks</div>
              <div class="kpi-value">${escapeHTML(metrics.commonStocksCount ?? "—")}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">New Equities</div>
              <div class="kpi-value">${escapeHTML(metrics.netNewStocksCount ?? "—")}</div>
            </div>
          </div>

          ${insights.map((item) =>
            `<div class="insight">• ${escapeHTML(item)}</div>`
          ).join("")}
        </div>

        <div class="section">
          <h2>02 / Current Portfolio Allocation</h2>
          <p class="muted">Current investments by fund.</p>
          ${table(
            ["Fund", "Category", "Investment", "Portfolio Share"],
            fundRows
          )}
        </div>

        <div class="section">
          <h2>03 / Sector Allocation Shift</h2>
          <p class="legend">
            Grey = before purchase &nbsp; | &nbsp; Green = after purchase
          </p>
          ${sectorBars || '<p class="muted">Sector data unavailable.</p>'}
        </div>

        <div class="section new-page">
          <h2>04 / Top Stock Exposures</h2>
          <p class="muted">
            Largest stock weights after the simulated purchase.
          </p>
          ${stockBars || '<p class="muted">Stock data unavailable.</p>'}
        </div>

        <div class="section">
          <h2>05 / Fund-by-Fund Overlap</h2>
          ${table(
            ["Existing Fund", "Category", "Overlap", "Common Stocks"],
            overlapRows
          )}
        </div>

        <div class="section new-page">
          <h2>06 / Detailed Stock Weight Changes</h2>
          <p class="muted">
            Showing up to 30 stocks, sorted by post-purchase weight.
          </p>
          ${table(
            ["Stock", "Ticker", "Sector", "Before", "After", "Change"],
            stockRows
          )}
        </div>

        <div class="section">
          <h2>07 / Interpretation & Limitations</h2>
          <p>
            Direct overlap estimates duplication between the prospective
            fund and existing holdings. Sector weights and stock exposures
            show how the portfolio composition may change under the
            simulation assumptions.
          </p>
          <p>
            These metrics do not guarantee diversification quality,
            future returns or lower investment risk. Review fund documents,
            current holdings, costs, tax implications and your own financial
            circumstances before investing.
          </p>
        </div>

        <div class="disclaimer">
          <strong>Disclaimer:</strong> FolioScope AI is an analytical
          tool and does not provide personalized investment advice.
          Report figures depend on the data supplied to the application
          and may not represent live holdings. Past performance and
          portfolio composition do not guarantee future results.
        </div>
      </div>

      <div class="footer">
        FOLIOSCOPE AI · Portfolio X-Ray Report · Generated ${escapeHTML(reportDate)}
      </div>
    </div>
  `;

  const filenameDate = new Date().toISOString().slice(0, 10);
  const safeFundName = (prospectiveFund?.name || "Portfolio")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");

  const options = {
    margin: [8, 7, 10, 7],
    filename: `FolioScope-${safeFundName}-${filenameDate}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    },
    pagebreak: {
      mode: ["css", "legacy"],
      avoid: ["tr", ".avoid-break"],
    },
  };

  try {
    const generator = typeof html2pdf === "function" ? html2pdf : html2pdf.default;
    await generator().set(options).from(report).save();
  } catch (error) {
    console.error("PDF generation failed:", error);
    alert("Could not generate the PDF. Please try again.");
  }
}