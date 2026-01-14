import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config.js";

import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.js";
import courseRoutes from "./routes/course.routes.js";
import { authMiddleware } from "./middlewares/authMiddleware.js";

const app = express();
app.use(cors());
app.use(express.json());

// 1. Routes พื้นฐาน
app.get("/", (req, res) => res.send("API OK"));
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", courseRoutes);

// 2. API สำหรับซื้อคอร์ส (Enroll) ที่ถูกต้องสำหรับ Node.js
app.post('/api/enroll', authMiddleware, async (req, res) => {
    try {
        const { course_id } = req.body;
        // ดึง user_id จาก token ที่ผ่าน authMiddleware มาแล้ว
        const user_id = req.user.id;

        const db = mongoose.connection.db;
        const enrollments = db.collection('enrollments');

        const newDoc = {
            user_id: user_id,
            course_id: course_id,
            enrolled_at: new Date(),
            status: 'completed',
            progress: 0
        };

        const result = await enrollments.insertOne(newDoc);
        res.status(201).json({ message: "Success", id: result.insertedId });
    } catch (error) {
        console.error("Enrollment Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 3. เชื่อมต่อ MongoDB
const { PORT = 4000, MONGO_URI } = process.env;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });