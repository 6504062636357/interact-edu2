import Grade from "../models/Grade.js";
import Gradebook from "../models/Gradebook.js";
import User from "../models/User.js";

// ในไฟล์ routes/grade.routes.js
import express from "express";
const router = express.Router();
import { getGradesByStudent } from "../controllers/grade.controller.js"; // หรือ path ที่คุณเก็บ function ไว้

// สังเกตตรงนี้ครับ ต้องมี /student/:authUid
router.get("/teacher-grades/:authUid", async (req, res) => {
  try {
    const { authUid } = req.params;

    console.log("authUid:", authUid);

    const user = await User.findOne({ authUid });
    console.log("user:", user);

    const gradebooks = await Gradebook.find({
      teacher_id: user?._id
    });
    console.log("gradebooks:", gradebooks);

    // เช็คผลลัพธ์
    if (!gradebooks.length) {
      return res.status(404).json({
        error: "ครูคนนี้ยังไม่มีคอร์สที่สอน"
      });
    }

    res.json(gradebooks);

  } catch (err) {
    console.log("ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
// ✅ create grade ถ้ายังไม่มี
export async function createGradeIfNotExists(authUid, course_id) {
  try {
    const user = await User.findOne({ authUid });
    if (!user) return;

    const gradebook = await Gradebook.findOne({ course_id });
    if (!gradebook) return;

    const exists = await Grade.findOne({
      student_id: user._id,
      course_id,
    });

    if (!exists) {
      await Grade.create({
        gradebook_id: gradebook._id,
        student_id: user._id,
        course_id,
        scores: {},
      });

      console.log("✅ Created grade");
    }
  } catch (err) {
    console.log("🔥 Grade error:", err.message);
  }
}

// ✅ get grade ของ student
export async function getGradesByStudent(authUid) {
  const user = await User.findOne({ authUid });
  if (!user) return [];

  return await Grade.find({ student_id: user._id });
}

// ✅ update score
export async function updateScore(gradeId, key, value) {
  const grade = await Grade.findById(gradeId);
  if (!grade) return null;

  grade.scores[key] = value;
  await grade.save();

  return grade;
}