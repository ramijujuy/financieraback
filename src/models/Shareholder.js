const mongoose = require('mongoose');

const shareholderSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    dni: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    contactInfo: {
        email: String,
        phone: String
    },
    capitalContributed: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Shareholder', shareholderSchema);
