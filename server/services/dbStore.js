// Mongoose models and in-memory persistent store adapter
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'data', 'userStorage.json');

// Ensure storage file exists
function readStorage() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading storage file:', err);
  }
  return {
    portfolios: [
      {
        id: "preset-core-satellite",
        name: "Core & Satellite Growth Portfolio",
        description: "Balanced foundation with Flexi Cap + Large & Mid Cap",
        createdAt: new Date().toISOString(),
        items: [
          { fundId: "ppfas-flexi-cap", investmentAmount: 50000, weight: 0.5 },
          { fundId: "mirae-large-midcap", investmentAmount: 50000, weight: 0.5 }
        ]
      },
      {
        id: "preset-aggressive-growth",
        name: "Aggressive Equity Basket",
        description: "Index anchor + Mid Cap + Small Cap growth engines",
        createdAt: new Date().toISOString(),
        items: [
          { fundId: "uti-nifty-50-index", investmentAmount: 40000, weight: 0.4 },
          { fundId: "kotak-emerging-equity", investmentAmount: 30000, weight: 0.3 },
          { fundId: "nippon-small-cap", investmentAmount: 30000, weight: 0.3 }
        ]
      }
    ],
    customFunds: []
  };
}

function writeStorage(data) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to storage file:', err);
  }
}

// In-Memory store initialized with saved file or defaults
let memoryStore = readStorage();

export const PortfolioStore = {
  getAll: () => {
    return memoryStore.portfolios || [];
  },

  getById: (id) => {
    return (memoryStore.portfolios || []).find(p => p.id === id);
  },

  save: (portfolio) => {
    const id = portfolio.id || `portfolio-${Date.now()}`;
    const newRecord = {
      ...portfolio,
      id,
      createdAt: portfolio.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const existingIndex = (memoryStore.portfolios || []).findIndex(p => p.id === id);
    if (existingIndex >= 0) {
      memoryStore.portfolios[existingIndex] = newRecord;
    } else {
      memoryStore.portfolios.unshift(newRecord);
    }

    writeStorage(memoryStore);
    return newRecord;
  },

  delete: (id) => {
    memoryStore.portfolios = (memoryStore.portfolios || []).filter(p => p.id !== id);
    writeStorage(memoryStore);
    return true;
  }
};

export const CustomFundStore = {
  getAll: () => {
    return memoryStore.customFunds || [];
  },

  save: (fund) => {
    const id = fund.id || `custom-${fund.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    const newFund = {
      ...fund,
      id,
      isCustom: true,
      createdAt: new Date().toISOString()
    };
    
    memoryStore.customFunds.push(newFund);
    writeStorage(memoryStore);
    return newFund;
  }
};
