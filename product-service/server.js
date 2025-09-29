const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib');
const Product = require('./models/Product');
const Order = require('./models/Order');

const PORT = process.env.PORT || 3001;
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

function publishProductEvent(type, product) {
  const msg = {
    event_type: type,
    payload: { id: product._id.toString(), name: product.name },
    timestamp: Date.now()
  };
  amqpChan.publish(EXCHANGE, type, Buffer.from(JSON.stringify(msg)), { contentType: 'application/json', persistent: true });
}

function publishOrderPlaced(orderDoc) {
  const msg = {
    event_type: 'order_placed',
    payload: { id: orderDoc._id.toString(), productId: orderDoc.productId.toString(), userId: String(orderDoc.userId || ''), quantity: orderDoc.quantity, totalPrice: orderDoc.totalPrice },
    timestamp: Date.now()
  };
  amqpChan.publish(EXCHANGE, 'order_placed', Buffer.from(JSON.stringify(msg)), { contentType: 'application/json', persistent: true });
  try { console.log('published order_placed', orderDoc._id.toString()); } catch (_) {}
}


app.post('/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
  try { publishProductEvent('product_created', product); } catch (e) { console.error('publish error', e.message); }
  res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific product by ID
app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    try { publishProductEvent('product_updated', product); } catch (e) { console.error('publish error', e.message); }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a product by ID
app.put('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a product by ID
app.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Place an order
app.post('/orders', async (req, res) => {
  try {
    const { productId, quantity = 1, userId } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const totalPrice = Number((product.price * quantity).toFixed(2));
    const order = new Order({ productId, userId: userId || 'anonymous', quantity, totalPrice });
    await order.save();
    try { publishOrderPlaced(order); } catch (e) { console.error('publish error', e.message); }
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('<h1>Product Service</h1>');
});

initRabbit()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Product service running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('RabbitMQ init failed', err);
    process.exit(1);
  });