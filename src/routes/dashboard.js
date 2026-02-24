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
    const { uid } = req.query; // รับ uid จาก frontend

    if (!uid) {
      return res.status(400).json({ message: "UID is required" });
    }

    // แก้ตรงนี้: เปลี่ยน firebaseUid -> authUid
    const user = await User.findOne({ authUid: uid }).select("name learnedToday goalMinutes");

    if (!user) {
      return res.status(404).json({ message: "User not found in MongoDB (check authUid)" });
    }

    const userIdInMongo = user._id;
    const hotCourse = await Course.findOne({ isHotCourse: true }).select("title description imageUrl");
    const userCourses = await UserCourse.find({ userId: userIdInMongo }).populate("courseId", "title totalLessons");
    const announcement = await Announcement.findOne().sort({ createdAt: -1 });

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