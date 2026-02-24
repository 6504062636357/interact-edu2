import express from "express";
import ClassSchedule from "../models/ClassSchedule.js";

const router = express.Router();

// ⭐ เพิ่มตารางเรียน
router.post("/", async (req, res) => {
  try {
    const {
      courseId,
      teacherId,
      date,
      startTime,
      endTime,
      capacity
    } = req.body;

    const schedule = await ClassSchedule.create({
      courseId,
      teacherId,
      date,
      startTime,
      endTime,
      capacity
    });

    res.status(201).json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;