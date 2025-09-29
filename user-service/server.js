const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib');
const User = require('./models/User');

const PORT = process.env.PORT || 3002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://root:root@mongodb:27017/mydb?authSource=admin';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

const app = express();
app.use(express.json());


mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

let amqpConn;
let amqpChan;
const EXCHANGE = 'events';

async function initRabbit() {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  let attempts = 0;
  while (true) {
    try {
      attempts++;
      amqpConn = await amqp.connect(RABBITMQ_URL);
      amqpChan = await amqpConn.createChannel();
      await amqpChan.assertExchange(EXCHANGE, 'direct', { durable: true });
      break;
    } catch (e) {
      const backoff = Math.min(5000, attempts * 500);
      console.error(`RabbitMQ connect failed (attempt ${attempts}), retrying in ${backoff}ms`);
      await wait(backoff);
    }
  }
}

function publishUserRegistered(user) {
  const msg = {
    event_type: 'user_registered',
    payload: { id: user._id.toString(), name: user.name, email: user.email },
    timestamp: Date.now()
  };
  amqpChan.publish(EXCHANGE, 'user_registered', Buffer.from(JSON.stringify(msg)), { contentType: 'application/json', persistent: true });
}


app.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    
    const user = new User({ name, email, password, role });
    await user.save();
  try { publishUserRegistered(user); } catch (e) { console.error('publish error', e.message); }
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// Login user
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    
    // Check password (simple comparison, no hashing)
    if (user.password !== password) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    
    // naive token: base64 of userId:role (for demo only)
    const token = Buffer.from(`${user._id}:${user.role}`).toString('base64');

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// very simple auth middleware: expects Authorization: Bearer <base64 userId:role>
function auth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = Buffer.from(parts[1], 'base64').toString('utf8');
    const [userId, role] = decoded.split(':');
    if (!userId || !role) return res.status(401).json({ error: 'Unauthorized' });
    req.user = { id: userId, role };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// role authorization middleware
function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// example protected routes
app.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id, { password: 0 });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.get('/admin-only', auth, authorize(['admin']), (req, res) => {
  res.json({ message: 'Hello Admin' });
});

app.get('/manager-or-admin', auth, authorize(['manager', 'admin']), (req, res) => {
  res.json({ message: 'Hello Manager/Admin' });
});

// Get all users
app.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }); // Exclude passwords
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific user by ID
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, { password: 0 }); // Exclude password
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('<h1>User Service</h1>');
});

initRabbit()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`User service running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('RabbitMQ init failed', err);
    process.exit(1);
  });