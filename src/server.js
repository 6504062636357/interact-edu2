import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config.js";

import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.js";
import courseRoutes from "./routes/course.routes.js"; // <--- 1. Import Course Routes

const app = express();
app.use(cors());
app.use(express.json());

// routes
app.get("/", (req, res) => res.send("API OK"));

// Authentication and Dashboard Routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);

// ** 2. เพิ่ม Course Routes สำหรับหน้า Course (Courses-1) **
app.use("/api", courseRoutes);

const { PORT = 4000, MONGO_URI } = process.env;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });