import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  displayName: {
    type: String,
    trim: true,
    default: '',
  },
  passwordHash: {
    type: String,
    select: false,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
