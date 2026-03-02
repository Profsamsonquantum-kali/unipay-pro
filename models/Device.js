const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceId: String,
  deviceName: String,
  platform: String,
  lastActive: Date,
  isCurrent: { type: Boolean, default: false }
});

module.exports = mongoose.model('Device', DeviceSchema);
