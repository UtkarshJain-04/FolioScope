# FolioScope

FolioScope is a mutual-fund portfolio analysis app for exploring holdings overlap and assessing how a prospective fund could change a portfolio's stock and sector exposure.

## Features

- **Pre-purchase simulator:** Compare a portfolio before and after a proposed investment, including overlap, concentration, stock-level changes, sector shifts, and a diversification score.
- **Overlap analysis:** Compare two funds or view pairwise overlap across a selection of funds.
- **Fund catalog:** Search and filter the bundled mutual-fund catalog, inspect holdings, and select funds for analysis.
- **Portfolio management:** Load sample portfolios and save or delete portfolios.
- **CAS import:** Upload a CAS PDF, CSV, or text file, or paste statement text to import recognized schemes. PDF uploads can include a password.
- **Custom funds:** Add funds with user-specified holdings for portfolio analysis.

## Tech stack

- **Client:** React, Vite, and lucide-react
- **Server:** Node.js, Express, and pdf-parse
- **Storage:** JSON file at `server/data/userStorage.json` for saved portfolios and custom funds

## Project structure

```text
client/
  src/
    components/       React views and modals
    App.jsx           Application state and navigation
  vite.config.js      Development server and API proxy configuration
server/
  data/
    fundsData.js      Bundled mutual-fund catalog
    userStorage.json  Persisted portfolios and custom funds
  services/
    casParser.js      CAS statement parsing and fund matching
    dbStore.js        JSON-backed portfolio and custom-fund storage
    overlapCalculator.js
    simulationEngine.js
  server.js           Express API
```

## Setup status

This checkout contains `client/package-lock.json` and `server/package-lock.json`, but does not contain `package.json` files. Restore or add the package manifests before installing dependencies or starting the application. The lockfiles alone do not define the project scripts or provide a reliable setup command.

The configured development ports are **3000** for the Vite client and **5000** for the API. Vite proxies `/api` requests to `http://localhost:5000`. The server can serve the client production build from `client/dist` when it exists.

## API overview

The server exposes these routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check server status and catalog size |
| `GET` | `/api/funds` | List funds; supports `search`, `category`, and `amc` filters |
| `GET` | `/api/funds/:id` | Get a fund and its sector breakdown |
| `POST` | `/api/overlap/calculate` | Calculate pairwise overlap or a multi-fund overlap matrix |
| `POST` | `/api/overlap/portfolio` | Aggregate holdings across portfolio items |
| `POST` | `/api/overlap/simulate` | Simulate adding a prospective fund |
| `GET` | `/api/portfolios` | List saved and preset portfolios |
| `POST` | `/api/portfolios` | Save a portfolio |
| `DELETE` | `/api/portfolios/:id` | Delete a portfolio |
| `POST` | `/api/funds/custom` | Create a custom fund |
| `POST` | `/api/portfolio/upload-cas` | Parse an uploaded CAS file or submitted statement text |
| `GET` | `/api/portfolio/sample-cas` | Get a sample CAS statement for demonstration |

## Data and financial disclaimer

The built-in fund catalog is bundled with the server; analysis reflects the holdings and figures present in that local data, not necessarily current market information. CAS parsing and scheme matching are best-effort, so review imported holdings before relying on results. FolioScope is an analysis aid, not financial advice. Verify fund information with the relevant provider and consult a qualified financial adviser for investment decisions.
