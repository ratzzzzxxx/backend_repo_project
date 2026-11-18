require('dotenv').config();
const dns = require('dns');

// Configure public DNS resolvers to prevent Windows/router querySrv ECONNREFUSED with MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  // Ignore fallback if custom DNS cannot be set
}

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const User = require('./models/User');
const Note = require('./models/Note');
const Post = require('./models/Post');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable' });
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/posts', require('./routes/posts'));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  if (err.code === 11000) return res.status(409).json({ message: 'Email already in use' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

async function seedAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  if (await User.findOne({ email: ADMIN_EMAIL.toLowerCase() })) return;
  await User.create({ name: 'Admin', email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' });
  console.log('Admin user created');
}

async function start() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  await mongoose.connect(process.env.MONGO_URI);
  // make sure the schema.index() indexes exist
  await Promise.all([User.init(), Note.init(), Post.init()]);
  await seedAdmin();
  app.listen(process.env.PORT || 5000, () => console.log('API running'));
}

if (require.main === module) {
  start().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = app;
