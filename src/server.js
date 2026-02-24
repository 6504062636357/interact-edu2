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

// 1. Routes พื้นฐาน
app.get("/", (req, res) => res.send("API OK"));
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", courseRoutes);
app.use("/api/class-schedules", classScheduleRoutes);
//app.use("/api/users", userRoutes);



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

app.post('/api/users/sync', async (req, res) => {
  try {
    const { firebaseUid, email, name, learnedToday, goalMinutes } = req.body;

    const user = await User.findOneAndUpdate(
      { authUid: firebaseUid }, // ค้นหาด้วย authUid
      {
        authUid: firebaseUid,    // บันทึกเข้า authUid
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

// API สำหรับจองคอร์ส (แก้ให้เหลืออันเดียวและใช้ authUid)
app.post('/api/bookings', async (req, res) => {
  try {
    const { firebaseUid, course_id } = req.body;

    // เปลี่ยน firebaseUid -> authUid
    const user = await User.findOne({ authUid: firebaseUid });
    if (!user) return res.status(404).json({ error: "User not found" });

    const db = mongoose.connection.db;
    const newEnrollment = {
      user_id: user._id.toString(),
      course_id: course_id,
      enrolled_at: new Date(),
      status: 'completed',
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

import { firebaseAuth } from "./middlewares/firebaseAuth.js";

app.get('/api/users/me', firebaseAuth, async (req, res) => {
  try {
    // req.user จะถูกยัดมาจาก firebaseAuth middleware
    if (!req.user) return res.status(404).json({ message: "User not found" });
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

//สำหรับการ Save/Update ข้อมูล
app.patch('/api/users/me', firebaseAuth, async (req, res) => {
  try {
    const { name, phone, bio, goalMinutes } = req.body;

    // อัปเดตข้อมูลโดยใช้ req.user.authUid (ที่ได้มาจาก middleware)
    const updatedUser = await User.findOneAndUpdate(
      { authUid: req.user.authUid },
      {
        $set: {
          ...(name && { name }),
          ...(phone && { phone }),
          ...(bio && { bio }),
          ...(goalMinutes && { goalMinutes })
        }
      },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json(updatedUser);
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ error: "Failed to update profile" });
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
