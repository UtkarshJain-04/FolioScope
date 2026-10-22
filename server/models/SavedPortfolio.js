import mongoose from 'mongoose';

const savedPortfolioSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  items: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
}, { timestamps: true });

export const SavedPortfolio = mongoose.models.SavedPortfolio
  || mongoose.model('SavedPortfolio', savedPortfolioSchema);
