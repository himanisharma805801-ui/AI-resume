require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const Review = require('./models/Review');
const { createReview } = require('./services/reviewService');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '127.0.0.1';

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

let dbConnected = false;

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'resume-backend',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/reviews', async (_req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ message: 'Database is not connected. Configure MONGODB_URI and Atlas Network Access.' });
  }
  try {
    const reviews = await Review.find({}, 'name score summary aiGenerated createdAt')
      .sort({ createdAt: -1 }).limit(8).lean();
    return res.json({ reviews });
  } catch (error) {
    console.error('Could not load reviews:', error.message);
    return res.status(500).json({ message: 'Could not load review history.' });
  }
});

app.post('/reviews', async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
  const resume = typeof req.body.resume === 'string' ? req.body.resume.trim() : '';
  const jobDescription = typeof req.body.jobDescription === 'string' ? req.body.jobDescription.trim() : '';

  if (resume.length < 40 || resume.length > 20000) {
    return res.status(400).json({ message: 'Resume text must be between 40 and 20,000 characters.' });
  }
  if (jobDescription.length < 20 || jobDescription.length > 12000) {
    return res.status(400).json({ message: 'Job description must be between 20 and 12,000 characters.' });
  }
  if (!dbConnected) {
    return res.status(503).json({ message: 'Database is not connected. Configure MongoDB Atlas before saving reviews.' });
  }

  try {
    const feedback = await createReview(resume, jobDescription);
    const saved = await Review.create({
      name,
      resumeExcerpt: resume.slice(0, 20000),
      jobExcerpt: jobDescription.slice(0, 12000),
      ...feedback
    });
    return res.status(201).json({
      review: {
        _id: saved._id,
        score: saved.score,
        summary: saved.summary,
        strengths: saved.strengths,
        improvements: saved.improvements,
        actionPlan: saved.actionPlan,
        aiGenerated: saved.aiGenerated,
        createdAt: saved.createdAt
      }
    });
  } catch (error) {
    console.error('Review request failed:', error.message);
    return res.status(500).json({ message: 'Could not create review. Check backend logs and API configuration.' });
  }
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled request error:', err.message);
  res.status(400).json({ message: 'Invalid request body.' });
});

async function start() {
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('YOUR_CLUSTER')) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
      dbConnected = true;
      console.log('MongoDB connected');
    } catch (error) {
      dbConnected = false;
      console.error('MongoDB connection failed:', error.message);
      console.error('The API will start, but saving/listing reviews will return 503 until MongoDB is fixed.');
    }
  } else {
    console.warn('MONGODB_URI is not configured; health check will work, but review storage is disabled.');
  }

  mongoose.connection.on('disconnected', () => {
    dbConnected = false;
    console.error('MongoDB disconnected');
  });
  mongoose.connection.on('connected', () => { dbConnected = true; });

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

start();

process.on('SIGINT', async () => {
  await mongoose.disconnect().catch(() => {});
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await mongoose.disconnect().catch(() => {});
  process.exit(0);
});
