# FolioScope

FolioScope is a mutual-fund portfolio analysis application. It helps users inspect stock overlap between funds, model a prospective purchase, explore a fund catalog, import portfolio statements, and compare candidate funds with their goals.

> **Important:** FolioScope is an educational analysis tool, not investment advice. Its catalog and sample account data are bundled/demo data and may not reflect current market information. Verify all information independently.

## Contents

- [Features](#features)
- [Application areas](#application-areas)
- [Technology and project layout](#technology-and-project-layout)
- [Run locally](#run-locally)
- [Configuration](#configuration)
- [API conventions](#api-conventions)
- [API reference](#api-reference)
  - [Authentication](#authentication)
  - [Health](#health)
  - [Funds and catalog](#funds-and-catalog)
  - [Overlap and simulation](#overlap-and-simulation)
  - [AI advisor](#ai-advisor)
  - [Portfolio storage](#portfolio-storage)
  - [Custom funds](#custom-funds)
  - [CAS import](#cas-import)
  - [Setu Account Aggregator](#setu-account-aggregator)
- [Data and calculation notes](#data-and-calculation-notes)

## Features

- Analyze pairwise fund overlap and build an overlap matrix.
- Aggregate holdings across a portfolio, including stock, sector, and market-cap exposure.
- Simulate adding a prospective fund and compare portfolio metrics before and after.
- Search the bundled and custom-fund catalog.
- Save, load, and delete portfolios; load example portfolios for evaluation.
- Import schemes from CAS PDF, CSV, text, or pasted statement content.
- Create custom funds with user-supplied holdings.
- Rank funds by overlap and generate profile-aware recommendations.
- Connect to Setu sandbox APIs or use the built-in Setu simulator.
- Register and sign in with a username/email and password, or use Google OAuth.
- Require an authenticated session to access application APIs; keep saved portfolios private per account.

## Application areas

The React client is a single-page application. Main views are selected in the header and also linked from the Home landing page:

| Area | Purpose |
| --- | --- |
| Home | Introduces FolioScope and links to analysis tools. |
| Pre-Purchase Simulator | Models the effect of a proposed fund purchase on overlap, concentration, and holdings distribution. |
| Overlap Matrix | Compares pairwise stock overlap across selected funds. |
| 2-Fund Venn | Compares two funds and shows shared and unique holdings. |
| AI Advisor | Ranks funds against the current portfolio, provides recommendation and chat interfaces, and includes educational guidance. AI generation may use Groq or the server's algorithmic fallback. |
| Fund Catalog | Searches and filters available funds and provides fund details/actions. |
| Portfolio import | Authenticated CAS upload/paste and Setu AA flows can populate the current portfolio. |

## Technology and project layout

- **Client:** React 19, Vite, `lucide-react`
- **Server:** Node.js, Express, `pdf-parse`, OpenAI-compatible Groq client
- **Persistence:** JSON file at `server/data/userStorage.json` for custom funds; MongoDB for accounts, sessions, and saved portfolios
- **Sessions:** Express sessions stored in MongoDB and protected by HttpOnly cookies
- **Setu state:** Consent and data-session records are held in server memory.

```text
client/
  src/
    App.jsx                         Application state, navigation, and page composition
    components/
      LandingPage.jsx               Home page
      Header.jsx                    Main navigation and global actions
      SimulatorView.jsx             Pre-purchase simulation
      MatrixView.jsx                Multi-fund overlap matrix
      ComparatorView.jsx            Two-fund comparison
      AIAdvisorView.jsx              Recommendations, comparison, guide, and chat
      CatalogView.jsx               Fund catalog
      CasUploadModal.jsx             CAS import UI
      SetuAccountAggregatorModal.jsx Setu consent and data-session UI
  vite.config.js                    Dev server and API proxy
server/
  data/
    fundsData.js                    Bundled fund catalog and holdings
    userStorage.json                JSON-backed user data when present
  models/
    User.js                         Password/Google account records
    SavedPortfolio.js               Account-owned portfolio records
  services/
    auth.js                         Password auth, Google OAuth, and sessions
    overlapCalculator.js            Pairwise overlap and portfolio aggregation
    simulationEngine.js             Before/after purchase analysis
    groqAiService.js                 AI ranking, recommendation, and chat
    casParser.js                     CAS extraction and catalog matching
    setuService.js                   Setu live-sandbox/simulator integration
    dbStore.js                       JSON-backed portfolio/custom-fund store
  server.js                          Express routes and static client serving
```

## Run locally

Requirements: Node.js and npm.

```powershell
npm install --prefix server
npm install --prefix client
```

Start the API and client in separate terminals from the repository root:

```powershell
npm run dev:server
npm run client
```

The Vite client runs at `http://localhost:3000` and proxies `/api` calls to `http://localhost:5000`. `PORT` changes the API listen port; if you change it during development, also update the proxy target in `client/vite.config.js`. For a production client build:

```powershell
npm run build:client
npm start
```

When `client/dist` exists, the API server serves the built client as well as the API.

## Configuration

Authentication requires a reachable MongoDB database and a session secret. Create a `.env` file in the working directory used to start the server:

| Variable | Purpose |
| --- | --- |
| `PORT` | Express API port; defaults to `5000`. |
| `MONGODB_URI` (`MONGO_URI` accepted as an alias) | MongoDB connection string for accounts, sessions, and user-owned saved portfolios. |
| `SESSION_SECRET` | Random secret of at least 32 characters for signing session cookies. |
| `CLIENT_URL` | Client base URL for OAuth redirects; defaults to `http://localhost:3000`. |
| `GOOGLE_CLIENT_ID` (`OAUTH_CLIENT_ID` accepted as an alias) | Google OAuth client ID. Leave unset to disable Google sign-in. |
| `GOOGLE_CLIENT_SECRET` (`OAUTH_CLIENT_SECRET` accepted as an alias) | Google OAuth client secret. Leave unset to disable Google sign-in. |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL; defaults to `http://localhost:<PORT>/api/auth/google/callback`. |
| `CLIENT_PORT` | Client port used to construct the Setu consent callback URL; defaults to `3000`. |
| `GROQ_API_KEY` | Enables Groq-backed AI recommendations and chat. `API_KEY` is also accepted as a fallback variable name by the AI service. |
| `SETU_BASE_URL` | Setu sandbox base URL; defaults to `https://fiu-sandbox.setu.co`. |
| `SETU_CLIENT_ID` | Optional Setu sandbox client ID. |
| `SETU_CLIENT_SECRET` | Optional Setu sandbox client secret. |
| `SETU_PRODUCT_INSTANCE_ID` | Optional Setu product instance ID. |

Example local configuration:

```dotenv
PORT=5000
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/folioscope
SESSION_SECRET=replace-with-a-random-secret-of-at-least-32-characters
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

In Google Cloud, register `http://localhost:5000/api/auth/google/callback` as an authorized redirect URI and enable the `profile` and `email` scopes. For deployment, use the corresponding HTTPS client and callback URLs. Do not commit `.env` files or secrets.

The server loads `.env` from the `server` directory or project root, so the same configuration works whether it is launched from the repository root or from `server`. It still starts for health checks when MongoDB or `SESSION_SECRET` is missing, but authentication and protected API routes are unavailable. Without a Groq key or when Groq is unavailable, recommendation/chat functions use their fallback behavior. Without Setu credentials, the app uses simulated Setu consent and sample mutual-fund data.

## Authentication and account privacy

- Users can create accounts with a unique username, email, and password; passwords must be 10-128 characters and are hashed with bcrypt before storage.
- Users can also sign in with Google when OAuth credentials are configured. Google accounts must provide a verified email.
- Session cookies are HttpOnly, SameSite=Lax, expire after 24 hours, and are marked Secure in production. Sessions are stored in MongoDB.
- All application APIs require a signed-in session, except `GET /api/health`, authentication routes, and the Setu webhook receiver.
- Saved portfolios are stored in MongoDB with an owner reference. Each user can list and delete only their own saved portfolios. Built-in preset portfolios remain available to signed-in users.
- Existing saved portfolio records in the old ownerless JSON store are not automatically assigned to an account; only built-in presets are shown from that store.
- Authentication does not make FolioScope an investment advisor.

## API conventions

- Base URL in development: `http://localhost:5000`; from the Vite client, use the relative `/api/...` paths shown below.
- JSON routes accept and return `application/json`, except CAS file uploads and the browser-rendered Setu callback.
- Most API responses use `{ "success": true, "data": ... }`. Errors usually use `{ "success": false, "message": "..." }`; the health endpoint and some Setu routes have their own response shapes.
- Fund identifiers are catalog IDs such as `ppfas-flexi-cap`. Portfolio request items use `{ "fundId", "investmentAmount", "weight" }`. Amounts are numeric currency values; weights are decimal shares (for example, `0.5` means 50%).
- Percentages in analysis results are represented as numbers, not strings.
- Unknown/invalid IDs are generally filtered or returned as 400/404 errors depending on the endpoint; see endpoint notes.

## API reference

### Authentication

Authentication endpoints are public so users can establish a session. Signup/login are rate-limited. Successful authentication sets a session cookie; browser requests should use the same origin so the browser includes it. Invalid or missing sessions receive HTTP 401 from protected APIs.

#### `GET /api/auth/me`

Returns the current session and provider configuration:

```json
{
  "success": true,
  "authenticated": true,
  "authEnabled": true,
  "googleEnabled": true,
  "user": {
    "id": "mongodb-user-id",
    "username": "investor_01",
    "email": "investor@example.com",
    "displayName": "Investor"
  }
}
```

When signed out, `authenticated` is `false` and `user` is `null`. If MongoDB or the session secret is unavailable, `authEnabled` and `googleEnabled` are `false`.

#### `POST /api/auth/signup`

Creates an account and signs the user in:

```json
{
  "username": "investor_01",
  "email": "investor@example.com",
  "password": "at-least-10-characters"
}
```

Returns HTTP 201 and `{ "success": true, "user": <public user> }`. Username must be 3-32 characters and contain only letters, numbers, `.`, `_`, or `-`. Password must be 10-128 characters. Duplicate usernames/emails return HTTP 409; invalid fields return HTTP 400.

#### `POST /api/auth/login`

```json
{
  "identifier": "investor_01",
  "password": "your-password"
}
```

`identifier` may be the account username or email. Returns `{ "success": true, "user": <public user> }`; invalid credentials return HTTP 401.

#### `POST /api/auth/logout`

Destroys the current session and clears the session cookie:

```json
{ "success": true }
```

#### `GET /api/auth/google`

Starts Google OAuth and redirects to Google. Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

#### `GET /api/auth/google/callback`

OAuth callback registered with Google Cloud. On success, establishes the session and redirects to `CLIENT_URL/?auth=success`; on failure, redirects to `CLIENT_URL/?authError=google_signin_failed`.

Authentication errors use `{ "success": false, "message": "..." }`, except Google OAuth routes which redirect. If MongoDB or `SESSION_SECRET` is not configured, signup/login return HTTP 503.

### Health

#### `GET /api/health`

Returns server status and the current total number of catalog funds, including custom funds.

```json
{
  "status": "online",
  "timestamp": "2026-10-21T12:00:00.000Z",
  "fundsCount": 16
}
```

### Funds and catalog

#### `GET /api/funds`

Returns lightweight catalog summaries. Optional query parameters:

| Parameter | Behavior |
| --- | --- |
| `search` | Case-insensitive match on fund name, AMC, category, holding name, or ticker. |
| `category` | Exact category filter; `All` disables the filter. |
| `amc` | Exact AMC filter; `All` disables the filter. |

```http
GET /api/funds?search=nifty&category=Index%20Fund
```

```json
{
  "success": true,
  "count": 1,
  "data": [{
    "id": "uti-nifty-50-index",
    "name": "UTI Nifty 50 Index Fund",
    "amc": "UTI Mutual Fund",
    "category": "Index Fund",
    "riskRating": "Very High",
    "aum": 0,
    "nav": 0,
    "expenseRatio": 0,
    "cagr3Y": 0,
    "benchmark": "NIFTY 50 TRI",
    "holdingsCount": 20,
    "topHoldings": [{ "stock": "Example Ltd", "weight": 8.5 }],
    "isCustom": false
  }]
}
```

`topHoldings` contains up to five `{ stock, weight }` entries. Numeric values above are illustrative.

#### `GET /api/funds/:id`

Returns the full fund record, including holdings, plus a sector-weight map:

```json
{
  "success": true,
  "data": {
    "id": "ppfas-flexi-cap",
    "name": "Parag Parikh Flexi Cap Fund",
    "amc": "PPFAS Mutual Fund",
    "category": "Flexi Cap",
    "riskRating": "Very High",
    "aum": 68520,
    "nav": 79.45,
    "expenseRatio": 0.62,
    "cagr3Y": 22.4,
    "benchmark": "NIFTY 500 TRI",
    "holdings": [{
      "stock": "HDFC Bank Ltd",
      "ticker": "HDFCBANK",
      "sector": "Financial Services",
      "marketCap": "Large Cap",
      "weight": 7.82
    }],
    "sectorBreakdown": { "Financial Services": 10.4 }
  }
}
```

The actual `holdings` array and sector breakdown depend on the fund. Unknown IDs return HTTP 404.

### Overlap and simulation

#### `POST /api/overlap/calculate`

Send either a pair of IDs or an array of IDs.

**Pairwise request**

```json
{ "fundAId": "ppfas-flexi-cap", "fundBId": "mirae-large-midcap" }
```

`data` contains:

- `fundA`, `fundB`: `{ id, name, category }`
- `overlapPercentage`: sum of the minimum holding weights for each shared stock
- `commonStocksCount`, `totalUniqueStocksCount`, `commonStocksRatio`
- `weightOfCommonInFundA`, `weightOfCommonInFundB`
- `commonStocks`: shared holding details (`weightInA`, `weightInB`, `minOverlapWeight`, `weightDifference`, stock identifiers and metadata)
- `uniqueToA`, `uniqueToB`: holdings unique to each fund

**Matrix request**

```json
{ "fundIds": ["ppfas-flexi-cap", "mirae-large-midcap", "hdfc-top-100"] }
```

`data` is `{ "funds": [{ "id", "name", "category", "amc" }], "matrix": [...] }`. Each matrix cell has `fundAId`, `fundBId`, `overlapPercentage`, and `commonStocksCount`. Diagonal cells are 100% self-overlap.

Errors: HTTP 400 for invalid inputs or fewer than two valid matrix funds; HTTP 404 if either pairwise fund does not exist.

#### `POST /api/overlap/portfolio`

Aggregates a portfolio's holdings:

```json
{
  "items": [
    { "fundId": "ppfas-flexi-cap", "investmentAmount": 50000, "weight": 0.5 },
    { "fundId": "mirae-large-midcap", "investmentAmount": 50000, "weight": 0.5 }
  ]
}
```

`data` contains `totalAmount`, `fundsCount`, `stocks`, `sectorBreakdown`, `marketCapBreakdown`, `totalUniqueStocks`, `overlappingStocksCount`, `portfolioOverlapWeight`, and `top10Concentration`. Each stock has `stock`, `ticker`, `sector`, `marketCap`, `effectiveWeight`, `effectiveAmount`, `heldInFunds`, and `fundCount`.

Errors: HTTP 400 when `items` is empty or missing; HTTP 404 if no submitted fund IDs resolve.

#### `POST /api/overlap/simulate`

Simulates an additional investment. `currentPortfolio` must contain at least one valid item.

```json
{
  "currentPortfolio": [
    { "fundId": "ppfas-flexi-cap", "investmentAmount": 50000, "weight": 0.5 }
  ],
  "prospectiveFundId": "hdfc-top-100",
  "prospectiveAmount": 30000,
  "prospectiveWeight": 0.2
}
```

`prospectiveAmount` is used when current amounts are present; if omitted or zero, the engine uses 25% of current capital. When current total amount is zero, the engine uses weights and defaults to an equal split if no prospective weight is provided.

`data` contains:

- `prospectiveFund`: selected fund summary.
- `investmentSummary`: current, proposed, and resulting total amounts plus allocation share.
- `metrics`: direct overlap, before/after unique stock counts and top-10 concentration, net new/common holdings, overlap changes, and diversification score.
- `diagnosis`: `riskLevel`, `badgeColor`, `recommendationSummary`, `keyInsights`, and `highRiskStocks`.
- `overlappingStocks`, `brandNewStocks`, `pairwiseWithCurrentFunds`, `detailedStockShifts`, and `sectorShifts`.
- `beforeAggregation`, `afterAggregation`: full portfolio aggregation records.

Errors: HTTP 400 for missing fund ID or current portfolio; HTTP 404 for an unknown prospective fund or no valid current funds.

### AI advisor

#### `POST /api/ai/overlap-rankings`

```json
{
  "currentPortfolio": [
    { "fundId": "ppfas-flexi-cap", "investmentAmount": 50000, "weight": 0.5 }
  ]
}
```

Returns `{ "success": true, "data": [...] }`, sorted from lowest overlap to highest. Each candidate includes `fundId`, `fundName`, `category`, `riskRating`, `cagr3Y`, `expenseRatio`, `overlapPercentage`, `commonStocksCount`, `newStocksCount`, `commonStocks`, `newStocks`, and `overlapLevel`. Requires at least one portfolio item (HTTP 400 otherwise).

#### `POST /api/ai/recommend`

Generates a recommendation against the current portfolio and catalog:

```json
{
  "currentPortfolio": [
    { "fundId": "ppfas-flexi-cap", "investmentAmount": 50000, "weight": 0.5 }
  ],
  "userProfile": {
    "purpose": "wealth_creation",
    "riskTolerance": "moderate",
    "experienceLevel": "beginner",
    "timeHorizon": "5-10y",
    "customGoalText": ""
  },
  "selectedCandidateFundIds": ["nippon-small-cap"]
}
```

`selectedCandidateFundIds` is optional; when supplied, recommendations are based on those ranked candidates. `userProfile` fields are optional. Common `purpose` values include `high_risk_high_reward`, `wealth_creation`, `capital_preservation`, `thematic_tech`, and `custom_goal`.

Response `data` fields:

| Field | Description |
| --- | --- |
| `success` | Whether AI generation succeeded; algorithmic fallback is also returned as successful analysis. |
| `aiAnalysis` | Recommendation text in Markdown. |
| `modelUsed` | Groq model or fallback engine name. |
| `userProfile` | Profile passed with the request. |
| `rankedCandidates` | Up to six ranked candidate records. |
| `disclaimer` | Educational-use disclaimer text. |
| `errorNote` | Optional generation error when the service fell back from Groq. |

The endpoint wraps the result in `{ "success": true, "data": ... }`. The fallback is generated from the submitted profile and actual ranked funds.

#### `POST /api/ai/chat`

```json
{
  "message": "Which fund has the lowest overlap?",
  "currentPortfolio": [
    { "fundId": "ppfas-flexi-cap", "investmentAmount": 50000, "weight": 1 }
  ],
  "userProfile": {
    "purpose": "wealth_creation",
    "riskTolerance": "moderate",
    "experienceLevel": "beginner",
    "timeHorizon": "5-10y"
  },
  "chatHistory": []
}
```

`message` is required (HTTP 400 otherwise). Response `data` contains `{ success, reply, modelUsed, disclaimer }`. The service can return a fallback reply if Groq is unavailable.

#### `GET /api/ai/disclaimer`

Returns:

```json
{
  "success": true,
  "data": {
    "disclaimer": "FolioScope AI is an algorithmic decision-support and educational analysis tool...",
    "termsVersion": "1.0.0",
    "complianceFramework": "SEBI Educational & Decision Support Guidelines"
  }
}
```

### Portfolio storage

#### `GET /api/portfolios`

Returns `{ "success": true, "data": [...] }`. Records include `id`, `name`, optional `description`, `createdAt`, optional `updatedAt`, and `items` (`fundId`, `investmentAmount`, `weight`). The store includes preset portfolios.

#### `POST /api/portfolios`

```json
{
  "name": "Long-term portfolio",
  "description": "Optional notes",
  "items": [
    { "fundId": "ppfas-flexi-cap", "investmentAmount": 50000, "weight": 1 }
  ]
}
```

Requires `name` and an `items` array. Returns `{ "success": true, "data": <saved portfolio> }`. HTTP 400 if required values are missing.

#### `DELETE /api/portfolios/:id`

Deletes a saved portfolio and returns:

```json
{ "success": true, "message": "Portfolio deleted successfully" }
```

#### Persistence notes

Portfolio and custom-fund records are stored in the JSON-backed in-memory adapter and written to `server/data/userStorage.json`. Writes are local to this deployment.

### Custom funds

#### `POST /api/funds/custom`

Creates a custom catalog fund:

```json
{
  "name": "Example Custom Fund",
  "amc": "Custom Portfolio",
  "category": "Custom Equity",
  "aum": 1000,
  "expenseRatio": 0.5,
  "holdings": [
    {
      "stock": "Example Ltd",
      "ticker": "EXAMPLE",
      "sector": "Technology",
      "marketCap": "Mid Cap",
      "weight": 12.5
    }
  ]
}
```

Only `name` and a non-empty `holdings` array are required. Optional fields receive server defaults. Response: `{ "success": true, "data": <created fund> }`; HTTP 400 for missing name/holdings.

### CAS import

#### `POST /api/portfolio/upload-cas`

Accepts either:

1. `multipart/form-data` with file field `casFile` and optional `password` (PDF uploads can be password-protected), or
2. JSON `{ "casText": "..." }` with pasted statement text.

PDF, CSV, and text uploads are accepted. Maximum uploaded file size is 25 MiB. The parser attempts to match detected scheme names to catalog funds; unmatched schemes are registered as custom placeholder funds so they can be included in analysis.

Response:

```json
{
  "success": true,
  "data": {
    "investor": {
      "name": "Mutual Fund Investor",
      "pan": "XXXXX0000X",
      "statementPeriod": "Consolidated Account Statement"
    },
    "summary": {
      "schemesCount": 1,
      "totalValuation": 75344,
      "totalCost": 50000,
      "unrealizedGain": 25344,
      "gainPercentage": 50.7
    },
    "schemes": [{
      "id": "cas-ppfas-flexi-cap-0",
      "fundId": "ppfas-flexi-cap",
      "name": "Parag Parikh Flexi Cap Fund",
      "rawName": "Statement scheme name",
      "category": "Flexi Cap",
      "amc": "PPFAS Mutual Fund",
      "folio": "10458921/0",
      "investmentAmount": 75344,
      "currentValuation": 75344,
      "costValue": 50000,
      "isMatched": true,
      "holdingsCount": 20
    }]
  }
}
```

`units` and `nav` may also be detected from source text but are not included in this parser's normalized `schemes` response. Errors include HTTP 400 for missing/empty input and HTTP 500 for parsing/password failures.

#### `GET /api/portfolio/sample-cas`

Returns `{ "success": true, "sampleText": "...", "parsed": <CAS parser result> }`. Intended for demo/testing.

### Setu Account Aggregator

Setu routes support a live Setu sandbox configuration and an in-memory simulator. In simulator mode, sample ReBIT-like data is returned and the simulated OTP is `123456`. Consent/session records are not persisted across server restarts.

#### `GET /api/setu/config`

Returns `{ "success": true, "data": <configuration> }`. `data` includes `baseUrl`, `isConfigured`, `hasClientId`, `clientIdMasked`, `productInstanceId`, `mode`, `supportedFiTypes`, and `supportedAAs`. The client secret is not returned.

#### `POST /api/setu/config`

Updates runtime configuration. Accepted JSON fields: `baseUrl`, `clientId`, `clientSecret`, `productInstanceId`, `mode`. Returns `{ "success": true, "data": <updated configuration>, "message": "Setu configuration updated" }`. This is runtime-only; environment variables are preferred for deployment.

#### `POST /api/setu/consent` and `POST /api/setu/consent/create`

The second route is a compatibility alias. Optional request:

```json
{
  "mobileNumber": "9999999999",
  "purposeText": "Portfolio overlap and diversification analysis",
  "fips": ["CAMS", "KFintech"],
  "redirectUrl": "http://localhost:5000/api/setu/consent"
}
```

The response includes `success`, `consentId`, `url`, `redirectUrl`, `status`, and `isLiveApi`; simulator responses also include `testOtp` and a message. In the simulator, status starts as `PENDING`.

#### `GET /api/setu/consent`

Handles the Setu redirect callback and updates consent status. Callback query parameters may include `id` (or `consent_id`, `consentCollectionId`, `consentHandle`), `status`, `success`, `error_code`, and `error_message`.

- With a consent ID and `Accept: application/json` or `?format=json`, returns `{ success, consentId, status, message, data }`.
- In a browser request, returns an HTML callback/status page.
- Without a consent ID, returns the Setu connection/diagnostic page.

#### `GET /api/setu/consent/:consentId/status`

Returns `{ "success": true, "consentId": "...", "status": "PENDING|ACTIVE|...", "isLiveApi": true|false }`. A live Setu response may also include its raw status object in `data`.

#### `POST /api/setu/consent/:consentId/simulate-approve`

Request: `{ "otp": "123456" }`. A six-digit OTP activates the simulator consent and returns `{ success, consentId, status: "ACTIVE", message }`. Invalid input returns HTTP 400 with `{ "success": false, "message": "Invalid OTP..." }`.

#### `POST /api/setu/session/create`

Request: `{ "consentId": "..." }`. Requires `consentId` (HTTP 400 otherwise). Returns `{ success, sessionId, status, isLiveApi, message? }`.

#### `GET /api/setu/session/:sessionId/data`

Fetches and normalizes mutual-fund data into FolioScope items. Successful data is:

```json
{
  "success": true,
  "data": {
    "investor": { "name": "Investor", "pan": "ABCDE1234F", "fips": ["CAMS"] },
    "metrics": {
      "totalFolios": 1,
      "totalSchemes": 1,
      "totalValuation": 75344,
      "catalogMatchedCount": 1
    },
    "schemes": [{
      "id": "aa-holding-0",
      "schemeName": "Scheme name",
      "isin": "INF...",
      "folioNumber": "10458921/0",
      "amc": "Example AMC",
      "registrar": "CAMS",
      "units": 948.321,
      "nav": 79.45,
      "currentValuation": 75344,
      "investedValue": 50000,
      "fundId": "ppfas-flexi-cap",
      "isCatalogMatched": true,
      "fundMeta": {
        "name": "Parag Parikh Flexi Cap Fund",
        "category": "Flexi Cap",
        "amc": "PPFAS Mutual Fund",
        "aum": 68520,
        "holdingsCount": 20,
        "cagr3Y": 22.4
      },
      "weight": 100
    }],
    "portfolioItems": [{
      "fundId": "ppfas-flexi-cap",
      "investmentAmount": 75344,
      "weight": 1
    }]
  }
}
```

An in-progress live session can return `{ success: true, sessionId, status: "PENDING", message }` instead of normalized data.

#### `POST /api/setu/webhook`

Accepts Setu event JSON. Recognized fields include `type`, `consentId`, `status`, and `sessionId`. Returns `{ "success": true, "acknowledged": true }`.

## Data and calculation notes

- Bundled fund records and holdings are in `server/data/fundsData.js`. The API includes custom funds from the local store.
- Pairwise overlap is calculated by matching stock identifiers and summing the lower holding weight for each shared stock.
- Portfolio aggregation weights funds by investment amount when amounts are available; otherwise, it uses supplied weights or equal weights.
- The simulator reports overlap and concentration metrics from the bundled holdings data. It is not a forecast of returns.
- CAS scheme matching is fuzzy. Review imported schemes and generated portfolio items before using them.
- Setu simulator records are in memory and include sample investor/account data for demonstration.
