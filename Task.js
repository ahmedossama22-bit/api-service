const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    originalText: { type: String, required: true },
    type: { type: String, enum: ['quick', 'heavy'], required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    result: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', TaskSchema);
