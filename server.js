const express = require("express");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://root:root@mongodb:27017/mydb?authSource=admin";

const app = express();
app.use(express.json());

// Connect to Mongo
mongoose.connect(MONGO_URI)
  .then(() => console.log("connected"))
  .catch(err => console.error("not connected:", err));

// Main route
app.get("/", (req, res) => res.send("<h1>Main Server</h1><p>This is the main server. User and Product services are available on their respective ports.</p>"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
