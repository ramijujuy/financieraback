const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Person'
    }],
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Active Loan'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Group', groupSchema);
