const express = require("express");
const mongoose = require("mongoose");
const amqp = require("amqplib");
const nodemailer = require("nodemailer");

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://root:root@mongodb:27017/mydb?authSource=admin";
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";

const app = express();
app.use(express.json());


mongoose.connect(MONGO_URI)
  .then(() => console.log("connected"))
  .catch(err => console.error("not connected:", err));
let amqpConn;
let amqpChan;
const EXCHANGE = "events";
let mailTransporter;

async function initRabbit() {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  let attempts = 0;
  while (true) {
    try {
      attempts++;
      amqpConn = await amqp.connect(RABBITMQ_URL);
      amqpChan = await amqpConn.createChannel();
      await amqpChan.assertExchange(EXCHANGE, "direct", { durable: true });

      const userQ = await amqpChan.assertQueue("main_user_registered", { durable: true });
      const prodCreatedQ = await amqpChan.assertQueue("main_product_created", { durable: true });
      const prodUpdatedQ = await amqpChan.assertQueue("main_product_updated", { durable: true });
  const orderPlacedQ = await amqpChan.assertQueue("main_order_placed", { durable: true });

      await amqpChan.bindQueue(userQ.queue, EXCHANGE, "user_registered");
      await amqpChan.bindQueue(prodCreatedQ.queue, EXCHANGE, "product_created");
      await amqpChan.bindQueue(prodUpdatedQ.queue, EXCHANGE, "product_updated");
  await amqpChan.bindQueue(orderPlacedQ.queue, EXCHANGE, "order_placed");

      amqpChan.consume(userQ.queue, (msg) => { if (!msg) return; console.log("user_registered:", msg.content.toString()); amqpChan.ack(msg); });
      amqpChan.consume(prodCreatedQ.queue, (msg) => { if (!msg) return; console.log("product_created:", msg.content.toString()); amqpChan.ack(msg); });
      amqpChan.consume(prodUpdatedQ.queue, (msg) => { if (!msg) return; console.log("product_updated:", msg.content.toString()); amqpChan.ack(msg); });
  amqpChan.consume(orderPlacedQ.queue, async (msg) => {
        if (!msg) return;
        const text = msg.content.toString();
        console.log("order_placed:", text);
        try {
          await sendOrderEmail(JSON.parse(text));
        } catch (e) {
          console.error('email error', e);
        }
        amqpChan.ack(msg);
      });
      break;
    } catch (e) {
      const backoff = Math.min(5000, attempts * 500);
      console.error(`RabbitMQ connect failed (attempt ${attempts}), retrying in ${backoff}ms`);
      await wait(backoff);
    }
  }
}

function initMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  mailTransporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // STARTTLS on 587
    auth: user && pass ? { user, pass } : undefined,
    requireTLS: true
  });
  return mailTransporter.verify()
    .then(() => console.log('SMTP verified'))
    .catch((e) => console.error('SMTP verify failed', e));
}

async function sendOrderEmail(event) {
  if (!mailTransporter) await initMailer();
  const fromAddr = process.env.SMTP_USER || 'no-reply@fsdlab.local';
  let toAddr = event?.payload?.userEmail;
  const userId = event?.payload?.userId;
  if (!toAddr && userId) {
    try {
      const resp = await fetch(`http://user-service:3002/users/${userId}`);
      if (resp.ok) {
        const user = await resp.json();
        toAddr = user?.email;
      }
    } catch (e) {
      console.error('lookup user email failed', e);
    }
  }
  if (!toAddr) {
    toAddr = process.env.ADMIN_EMAIL || fromAddr;
  }
  const subject = `Order placed: ${event?.payload?.id}`;
  const body = `New order placed\n\n` + JSON.stringify(event, null, 2);
  await mailTransporter.sendMail({ from: fromAddr, to: toAddr, subject, text: body });
}

app.get("/", (req, res) => res.send("<h1>Main Server</h1><p>This is the main server. User and Product services are available on their respective ports.</p>"));

Promise.resolve()
  .then(() => initMailer())
  .then(() => initRabbit())
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error("RabbitMQ init failed", err);
    process.exit(1);
  });
