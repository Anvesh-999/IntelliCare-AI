const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  dosageForm: {
    type: String,
    default: 'Tablet' // 'Tablet', 'Capsule', 'Syrup', 'Inhaler'
  },
  stockQuantity: {
    type: Number,
    required: true,
    default: 0
  },
  price: {
    type: Number,
    required: true
  },
  expiryDate: Date,
  location: String, // shelf / rack location
  status: {
    type: String,
    enum: ['instock', 'outofstock', 'lowstock'],
    default: 'instock'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Medicine', MedicineSchema);
