const mongoose = require('mongoose');

const NFTSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenId: String,
  name: String,
  collection: String,
  image: String,
  purchasePrice: Number,
  currentPrice: Number,
  currency: String,
  status: { type: String, enum: ['owned', 'listed', 'sold'], default: 'owned' }
});

module.exports = mongoose.model('NFT', NFTSchema);
