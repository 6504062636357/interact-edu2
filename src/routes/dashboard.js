import express from "express";
import User from "../models/User.js";
import Course from "../models/Course.js";
import UserCourse from "../models/UserCourse.js";
import Announcement from "../models/Announcement.js";
// เอา authMiddleware ออก เพราะเราจะเช็คด้วย firebaseUid แทน
// import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET /api/dashboard
router.get("/", async (req, res) => {
  try {
    // เปลี่ยนจากรับ req.user.id เป็นรับ uid จาก Query String (?uid=...)
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ message: "Firebase UID is required" });
    }

    // 1. ค้นหา User ด้วย firebaseUid (แทนที่การใช้ findById)
    const user = await User.findOne({ firebaseUid: uid }).select("name learnedToday goalMinutes");

    if (!user) {
      return res.status(404).json({ message: "User not found in MongoDB" });
    }

    // 2. ดึงข้อมูลอื่นๆ โดยใช้ _id ของ User ที่เจอใน MongoDB
    const userIdInMongo = user._id;

    const hotCourse = await Course.findOne({ isHotCourse: true }).select("title description imageUrl");
    const userCourses = await UserCourse.find({ userId: userIdInMongo }).populate("courseId", "title totalLessons");
    const announcement = await Announcement.findOne().sort({ createdAt: -1 });

    // 3. ส่งข้อมูลกลับไป
    res.json({
      user,
      hotCourse,
      learningPlan: userCourses.map((uc) => ({
        title: uc.courseId ? uc.courseId.title : "Unknown Course",
        progress: uc.courseId ? `${uc.progress}/${uc.courseId.totalLessons}` : "0/0"
      })),
      announcement: announcement || { message: "No announcement" }
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;