import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config.js";

import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.js";
import courseRoutes from "./routes/course.routes.js";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import classScheduleRoutes from "./routes/classSchedule.routes.js";
import paymentRoutes from "./routes/payment.routes.js";

import User from "./models/User.js";
import Course from "./models/Course.js";
import instructorRoutes from "./routes/instructor.routes.js";

import Enrollment from "./models/Enrollment.js";


const app = express();
app.use(cors());
app.use("/images", express.static("public/images"));

app.use(express.json());

// 1. Routes พื้นฐาน
app.get("/", (req, res) => res.send("API OK"));
app.use("/api/auth", authRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", courseRoutes);
app.use("/api/class-schedules", classScheduleRoutes);
//app.use("/api/users", userRoutes);
app.use('/api/instructors', instructorRoutes);

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

// เพิ่ม Route เพื่อรับข้อมูลวันว่างจาก Flutter
app.post('/teacher-availability', async (req, res) => {
    try {
        const availabilityData = req.body;
        // บันทึกลง MongoDB (สมมติว่าใช้ Model ชื่อ TeacherAvailability)
        // const newAvail = new TeacherAvailability(availabilityData);
        // await newAvail.save();
        console.log("ได้รับข้อมูลวันว่าง:", availabilityData);
        res.status(201).json({ message: "บันทึกข้อมูลสำเร็จ" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// POST: นักเรียนส่งคำขอจอง
app.post('/api/bookings', async (req, res) => {
  try {
    const { authUid, course_id, instructor_id, booking_date, booking_time } = req.body;

    const newBooking = new Enrollment({
      authUid,         // ID นักเรียนจาก Firebase
      course_id,      // ID วิชาที่เลือก
      instructor_id,  // ID ครูที่เลือก
      booking_date,   // วันที่เลือกเรียน
      booking_time,   // ช่วงเวลา (เช่น 11:00 AM - 13:00 PM)
      status: 'pending' // สถานะเริ่มต้นคือ "รออนุมัติ"
    });

    await newBooking.save();
    res.status(201).json({ message: "ส่งคำขอจองสำเร็จ!", id: newBooking._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH: ครูตอบรับหรือปฏิเสธการจอง
app.patch('/api/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // รับค่า 'accepted' หรือ 'rejected'

    const updatedBooking = await Enrollment.findByIdAndUpdate(
      id,
      { status: status },
      { new: true }
    );

    if (!updatedBooking) return res.status(404).json({ error: "ไม่พบข้อมูลการจอง" });
    res.json({ message: `เปลี่ยนสถานะเป็น ${status} เรียบร้อย`, data: updatedBooking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// 1. ดึงรายการจองเฉพาะของครูคนนี้ (ใช้ได้กับครูทุกคนผ่าน parameter :instructorId)
app.get('/api/bookings/teacher/:instructorId', async (req, res) => {
  try {
    const { instructorId } = req.params;

    const enrollments = await Enrollment.find({ instructor_id: instructorId }).lean();

    // ✅ ใส่โค้ดตรงนี้
    const enrichedData = await Promise.all(enrollments.map(async (item) => {

      const user = await User.findOne({ authUid: item.authUid });

      const course = await Course.findById(item.course_id);

      return {
        ...item,
        student_name: user ? user.name : "Unknown Student",
        student_photo: user ? user.photoUrl : "",
        course_name: course ? course.title : "Unknown Course"
      };
    }));

    res.json(enrichedData);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// เปลี่ยนจากแบบเดิม เป็นแบบ Regex เพื่อความแม่นยำ
app.get('/api/instructors/search', async (req, res) => {
  try {
    const { name } = req.query;
    const instructor = await mongoose.model('User').findOne({
      name: { $regex: new RegExp("^" + name.trim() + "$", "i") }, // ค้นหาแบบไม่สนตัวพิมพ์เล็กใหญ่
      role: 'teacher'
    });

    if (!instructor) return res.status(404).json({ message: "Instructor not found" });
    res.json(instructor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. อัปเดตสถานะ (Accept/Decline)
app.patch('/api/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // รับค่า 'accepted' หรือ 'rejected'
    const updated = await Enrollment.findByIdAndUpdate(
      id,
      { status: status },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ ตัวอย่าง Logic ในการเช็คคนเต็มก่อนกดยืนยัน (Accept)
app.patch('/api/bookings/accept/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;

    // 1. ดึงข้อมูลการจองที่ครูกำลังจะกดรับมาดู
    const currentBooking = await Enrollment.findById(bookingId);

    // 2. ดึงข้อมูลคอร์สเพื่อดูค่า maxStudents (ที่เราเพิ่งแก้เป็น 5)
    const course = await Course.findById(currentBooking.course_id);

    // 3. นับจำนวนคนที่ "จองสำเร็จแล้ว" (Accepted หรือ Completed)
    // ในคอร์สนี้ วันนี้ และเวลานี้
    const acceptedCount = await Enrollment.countDocuments({
      course_id: currentBooking.course_id,
      booking_date: currentBooking.booking_date,
      booking_time: currentBooking.booking_time,
      status: { $in: ['accepted', 'completed'] }
    });

    // 4. เช็คเงื่อนไข: ถ้าคนจองเต็มแล้ว ให้ส่ง Error กลับไป
    if (acceptedCount >= course.maxStudents) {
      return res.status(400).json({
        message: `คลาสรอบนี้เต็มแล้ว (รับสูงสุด ${course.maxStudents} คน)`
      });
    }

    // 5. ถ้ายังไม่เต็ม ให้เปลี่ยนสถานะเป็น accepted (ขึ้นสีส้ม)
    currentBooking.status = 'accepted';
    await currentBooking.save();

    res.json({ message: "ยืนยันการสอนเรียบร้อย! ระบบจะขึ้นสีส้มในปฏิทิน" });

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
