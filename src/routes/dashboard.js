import express from "express";
import User from "../models/User.js";
import Course from "../models/Course.js";
import UserCourse from "../models/UserCourse.js";
import Announcement from "../models/Announcement.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET /api/dashboard
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // มาจาก JWT

    const user = await User.findById(userId).select("name learnedToday goalMinutes");
    const hotCourse = await Course.findOne({ isHotCourse: true }).select("title description imageUrl");
    const userCourses = await UserCourse.find({ userId }).populate("courseId", "title totalLessons");
    const announcement = await Announcement.findOne().sort({ createdAt: -1 });

    res.json({
      user,
      hotCourse,
      learningPlan: userCourses.map((uc) => ({
        title: uc.courseId.title,
        progress: `${uc.progress}/${uc.courseId.totalLessons}`
      })),
      announcement
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
