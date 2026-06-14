require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib');
const axios = require('axios');
const cors = require('cors');
const Task = require('./Task');

const app = express();
app.use(express.json());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const PORT = process.env.PORT || 3001;
const PROCESSING_SERVICE_URL = process.env.PROCESSING_SERVICE_URL || 'http://localhost:3002';

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/content_tasks')
    .then(() => console.log('API Service connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Connect to RabbitMQ
let channel = null;
async function connectQueue() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URI || 'amqp://localhost');
        channel = await connection.createChannel();
        await channel.assertQueue('content_tasks_queue');
        console.log('API Service connected to RabbitMQ');
    } catch (err) {
        console.error('RabbitMQ connection error:', err);
    }
}
connectQueue();

app.post('/tasks', async (req, res) => {
    const { originalText, type } = req.body;
    if (!originalText || !type) {
        return res.status(400).json({ error: 'originalText and type are required' });
    }

    try {
        // Create pending task in DB
        const task = new Task({ originalText, type });
        await task.save();

        if (type === 'quick') {
            // Synchronous Processing via HTTP
            task.status = 'processing';
            await task.save();

            try {
                // Call Processing Service
                const response = await axios.post(`${PROCESSING_SERVICE_URL}/process/sync`, {
                    taskId: task._id,
                    text: originalText
                });
                
                // Processing service returns the processed result
                task.result = response.data.result;
                task.status = 'completed';
                await task.save();
                
                return res.json({ message: 'Task processed synchronously', task });
            } catch (err) {
                task.status = 'failed';
                await task.save();
                return res.status(500).json({ error: 'Sync processing failed', task });
            }
        } else if (type === 'heavy') {
            // Asynchronous Processing via Message Queue
            if (!channel) {
                return res.status(500).json({ error: 'Message queue is not ready' });
            }
            
            const message = JSON.stringify({ taskId: task._id, text: originalText });
            channel.sendToQueue('content_tasks_queue', Buffer.from(message));
            
            return res.json({ message: 'Task queued for async processing', task });
        } else {
            return res.status(400).json({ error: 'Invalid task type. Must be "quick" or "heavy"' });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`API Service running on http://localhost:${PORT}`);
});
