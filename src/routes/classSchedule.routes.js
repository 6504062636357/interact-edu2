import express from "express";
import ClassSchedule from "../models/ClassSchedule.js";

const router = express.Router();

// GET schedules by course
router.get("/course/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;

    const schedules = await ClassSchedule.find({ courseId });


    res.json(schedules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
