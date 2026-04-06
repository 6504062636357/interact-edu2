import express from "express";
import User from "../models/User.js";
import Course from "../models/Course.js";
import UserCourse from "../models/UserCourse.js";
import Announcement from "../models/Announcement.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ message: "UID is required" });
    }

    const user = await User.findOne({ authUid: uid })
      .select("name learnedToday goalMinutes");

    if (!user) {
      return res.status(404).json({ message: "User not found in MongoDB (check authUid)" });
    }

    const hotCourse = await Course.findOne({ isHotCourse: true })
      .select("title description imageUrl");
    const userCourses = await UserCourse.find({ userId: user._id })
      .populate("courseId", "title totalLessons");
    const announcement = await Announcement.findOne().sort({ createdAt: -1 });

    res.json({
      user: {
        name: user.name,
        learnedToday: user.learnedToday || 0, // 👈 สำคัญ
        goalMinutes: user.goalMinutes || 60,
      },
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