import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config.js";

import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.js";
import courseRoutes from "./routes/course.routes.js";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import classScheduleRoutes from "./routes/classSchedule.routes.js";

import User from "./models/User.js";

const app = express();
app.use(cors());
app.use("/images", express.static("public/images"));

app.use(express.json());
app.use('/api/class-schedules', classScheduleRoutes);
// 1. Routes พื้นฐาน
app.get("/", (req, res) => res.send("API OK"));
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", courseRoutes);

// 2. API สำหรับซื้อคอร์ส (Enroll) ที่ถูกต้องสำหรับ Node.js ต้องแก้
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

// ใน server.js
app.post('/api/users/sync', async (req, res) => {
  try {
    const { firebaseUid, email, name, learnedToday, goalMinutes } = req.body;

    // ใช้ firebaseUid เป็นตัวค้นหา ถ้าไม่เจอจะสร้างใหม่ (upsert: true)
    const user = await User.findOneAndUpdate(
      { firebaseUid: firebaseUid },
      {
        firebaseUid,
        email,
        name,
        learnedToday: learnedToday || 0,
        goalMinutes: goalMinutes || 60
      },
      { upsert: true, new: true }
    );

    res.status(201).json(user);
  } catch (err) {
    console.error("Sync Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { firebaseUid, course_id } = req.body;

    // 1. หาตัวตนของ User ใน MongoDB จาก Firebase UID
    const user = await User.findOne({ firebaseUid: firebaseUid });
    if (!user) return res.status(404).json({ error: "User not found" });

    // 2. บันทึกลงในตาราง enrollments (เพื่อให้มันไปโชว์ใน My Class)
    const db = mongoose.connection.db;
    const newEnrollment = {
      user_id: user._id.toString(), // ใช้เลข ID ของ MongoDB ที่เราหามาได้
      course_id: course_id,
      enrolled_at: new Date(),
      status: 'completed', // หรือ 'pending' ถ้าต้องจ่ายเงินก่อน
      progress: 0
    };

    await db.collection('enrollments').insertOne(newEnrollment);
    res.status(201).json({ message: "Booking success!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

import Enrollment from "./models/Enrollment.js"; // Import ตัวที่เราเพิ่งสร้าง

// ตอนจองคอร์ส (Booking)
app.post('/api/bookings', async (req, res) => {
  try {
    const { firebaseUid, course_id, user_id } = req.body;

    // บันทึกลง MongoDB โดยใช้ Model ที่เราเพิ่งสร้าง
    const newBooking = new Enrollment({
      firebaseUid: firebaseUid,
      user_id: user_id,
      course_id: course_id,
      status: 'completed',
      progress: 0
    });

    await newBooking.save();
    res.status(201).json({ message: "Success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
