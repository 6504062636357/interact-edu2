import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.js";
import courseRoutes from "./routes/course.routes.js";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import classScheduleRoutes from "./routes/classSchedule.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import gradeRoutes from "./routes/grade.routes.js";
import instructorRoutes from "./routes/instructor.routes.js";
import { createGradeIfNotExists } from "./routes/grade.routes.js";

import User from "./models/User.js";
import Course from "./models/Course.js";
import Payment from "./models/Payment.js";
import Grade from "./models/Grade.js";
import Gradebook from "./models/Gradebook.js";
import Enrollment from "./models/Enrollment.js";
import { firebaseAuth } from "./middlewares/firebaseAuth.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use("/images", express.static("public/images"));
app.use("/uploads", express.static("uploads"));

app.use(express.json());

app.get("/", (req, res) => res.send("API OK"));
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", courseRoutes);
app.use("/api/class-schedules", classScheduleRoutes);
app.use("/api/instructors", instructorRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/users", userRoutes);
app.use("/api/grades", gradeRoutes);

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
//app.post('/api/bookings', async (req, res) => {
//  try {
//    const { authUid, course_id, instructor_id, booking_date, booking_time } = req.body;
//
//    const newBooking = new Enrollment({
//      authUid,         // ID นักเรียนจาก Firebase
//      course_id,      // ID วิชาที่เลือก
//      instructor_id,  // ID ครูที่เลือก
//      booking_date,   // วันที่เลือกเรียน
//      booking_time,   // ช่วงเวลา (เช่น 11:00 AM - 13:00 PM)
//      status: 'pending' // สถานะเริ่มต้นคือ "รออนุมัติ"
//    });
//
//    await newBooking.save();
//    res.status(201).json({ message: "ส่งคำขอจองสำเร็จ!", id: newBooking._id });
//  } catch (err) {
//    res.status(500).json({ error: err.message });
//  }
//});
//แก้โดยเก็บเช็คสถานะจาก payment ก่อนว่าจ่ายตังยัง

app.post('/api/bookings', async (req, res) => {
  try {
    const { authUid, course_id, instructor_id, booking_date, booking_time, payment_id } = req.body;

    console.log("--- New Booking Request ---");
    console.log("Course ID:", course_id);
    console.log("Payment ID ที่ส่งมา:", payment_id);

    // 2. ตรวจสอบสถานะการจ่ายเงิน
    // ค้นหา Payment ที่ ID ตรงกัน และสถานะต้องเป็น 'successful' เท่านั้น
    const payment = await Payment.findOne({
      _id: payment_id,
      status: 'successful'
    });

    if (!payment) {
      console.log(" ไม่พบรายการจ่ายเงินที่สำเร็จสำหรับ ID:", payment_id);
      return res.status(400).json({ error: "ยังไม่ได้ชำระเงิน หรือรหัสการชำระเงินไม่ถูกต้อง" });
    }

    console.log(" ตรวจสอบการจ่ายเงินสำเร็จ (Payment Found)");

    // 3. สร้างรายการจองใหม่ (Enrollment)
    const newBooking = new Enrollment({
      authUid,         // ID นักเรียนจาก Firebase
      course_id,      // ID วิชา
      instructor_id,  // ID ครู
      booking_date,   // วันที่จอง
      booking_time,   // เวลาที่จอง
      payment_id: payment._id, // เก็บอ้างอิงกลับไปที่ตาราง Payment
      status: 'pending' // เริ่มต้นเป็น Pending เพื่อให้ครูกด Accept
    });

    await newBooking.save();

    console.log(" สร้างการจองสำเร็จ ID:", newBooking._id);
    res.status(201).json({
      message: "ส่งคำขอจองสำเร็จ!",
      id: newBooking._id
    });

  } catch (err) {
    console.error(" Booking Error:", err);
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

app.patch('/api/bookings/accept/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const currentBooking = await Enrollment.findById(bookingId);

    if (!currentBooking) {
      return res.status(404).json({ error: "ไม่พบการจอง" });
    }

    const course = await Course.findById(currentBooking.course_id);

    const acceptedCount = await Enrollment.countDocuments({
      course_id: currentBooking.course_id,
      booking_date: currentBooking.booking_date,
      booking_time: currentBooking.booking_time,
      status: { $in: ['accepted', 'completed'] }
    });

    if (acceptedCount >= course.maxStudents) {
      return res.status(400).json({
        message: `คลาสรอบนี้เต็มแล้ว (รับสูงสุด ${course.maxStudents} คน)`
      });
    }

    currentBooking.status = 'accepted';
    await currentBooking.save();

    // ✅ log ดูก่อนเสมอ
    console.log("📌 course_id จาก booking:", currentBooking.course_id);
    console.log("📌 instructor_id จาก booking:", currentBooking.instructor_id);

    // ✅ หา Gradebook จาก course_id ของ booking นี้โดยตรง
    let gradebook = await Gradebook.findOne({
      course_id: currentBooking.course_id
    });

    if (!gradebook) {
      // ❌ ไม่มี → สร้างใหม่
      gradebook = await Gradebook.create({
        course_id: currentBooking.course_id,
        teacher_id: new mongoose.Types.ObjectId(currentBooking.instructor_id),
        columns: [{ key: "attend", label: "Attendance", max: 10 }]
      });
      console.log("✅ Created Gradebook:", gradebook._id, "for course:", currentBooking.course_id);
    } else {
      console.log("✅ Gradebook already exists:", gradebook._id);
    }

    // ✅ สร้าง Grade ให้นักเรียน
    await createGradeIfNotExists(
      currentBooking.authUid,
      currentBooking.course_id
    );

    res.json({ message: "ยืนยันการสอนเรียบร้อย! ระบบจะขึ้นสีส้มในปฏิทิน" });

  } catch (err) {
    console.error("❌ Accept Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/grades/sync', async (req, res) => {
  try {
    const acceptedEnrollments = await Enrollment.find({ status: 'accepted' });
    console.log(`Found ${acceptedEnrollments.length} accepted enrollments`);

    for (const enrollment of acceptedEnrollments) {

      // ✅ เช็ค user ก่อน — ถ้าไม่มีให้ข้ามไป
      const user = await mongoose.model("User").findOne({ authUid: enrollment.authUid });
      if (!user) {
        console.log("⚠️ Skip - ไม่พบ user:", enrollment.authUid);
        continue; // ข้ามไป enrollment ถัดไป
      }

      // ✅ เช็ค Gradebook — ถ้าไม่มีให้สร้าง
      let gradebook = await Gradebook.findOne({ course_id: enrollment.course_id });
      if (!gradebook) {
        console.log("➕ Creating Gradebook for course:", enrollment.course_id);
        gradebook = await Gradebook.create({
          course_id: enrollment.course_id,
          teacher_id: new mongoose.Types.ObjectId(enrollment.instructor_id),
          columns: [{ key: "attend", label: "Attendance", max: 10 }]
        });
        console.log("✅ Created Gradebook:", gradebook._id);
      }

      // ✅ สร้าง Grade ให้นักเรียน
      await createGradeIfNotExists(enrollment.authUid, enrollment.course_id);
    }

    const totalGradebooks = await Gradebook.countDocuments();
    const totalGrades = await Grade.countDocuments();
    console.log("📊 Total Gradebooks:", totalGradebooks);
    console.log("📊 Total Grades:", totalGrades);

    res.json({ message: `Synced ${acceptedEnrollments.length} enrollments`, totalGradebooks, totalGrades });
  } catch (err) {
    console.error("Sync Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/grades/fix-gradebook-id', async (req, res) => {
  try {
    const grades = await Grade.find();
    let fixed = 0;

    for (const grade of grades) {
      // ✅ หา Gradebook ทั้งหมดของ course นี้
      const gradebooks = await Gradebook.find({
        course_id: grade.course_id
      });

      if (!gradebooks.length) continue;

      // ✅ เลือกอันที่มี columns มากที่สุด
      const best = gradebooks.sort((a, b) => b.columns.length - a.columns.length)[0];

      console.log(`Grade ${grade._id} → Gradebook ${best._id} (${best.columns.length} columns)`);

      await Grade.findByIdAndUpdate(grade._id, {
        gradebook_id: best._id
      });
      fixed++;
    }

    res.json({ message: `Fixed ${fixed} grades` });
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
