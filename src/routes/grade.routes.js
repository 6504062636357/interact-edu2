import express from "express";
import mongoose from "mongoose";
import Gradebook from "../models/Gradebook.js";
import Grade from "../models/Grade.js";
import Enrollment from "../models/Enrollment.js";

const router = express.Router();

router.get("/teacher-grades/:teacherAuthUid", async (req, res) => {
  try {
    const { teacherAuthUid } = req.params;

    const teacher = await mongoose.model("User").findOne({
      authUid: teacherAuthUid,
      role: "teacher"
    });
    if (!teacher) return res.status(404).json({ error: "ไม่พบครู" });

    // ★ FIX 1: หา course_id ที่ครูคนนี้สอนจริงๆ จาก Enrollment
    // ใช้ instructor_id เป็น ObjectId string ของครู (ตรงกับที่ book session เก็บไว้)
    const teacherCourseIds = await Enrollment.find({
      instructor_id: teacher._id.toString(),
      status: "accepted"
    }).distinct("course_id");

    console.log("📚 Teacher courses:", teacherCourseIds);

    if (!teacherCourseIds.length) {
      return res.status(404).json({ error: "ครูคนนี้ยังไม่มีคอร์สที่สอน" });
    }

    // ★ FIX 2: หา Gradebook เฉพาะ course ที่ครูคนนี้สอน
    // ไม่ใช้ teacher_id เพราะอาจ inconsistent — ใช้ course_id แทน
    let gradebook = await Gradebook.findOne({
      course_id: { $in: teacherCourseIds }
    });

    // ถ้ายังไม่มี Gradebook ให้สร้างใหม่
    if (!gradebook) {
      gradebook = await Gradebook.create({
        course_id: teacherCourseIds[0],
        teacher_id: teacher._id,
        columns: [{ key: "attend", label: "Attendance", max: 10 }]
      });
      console.log("✅ Created new Gradebook:", gradebook._id);
    }

    // ★ FIX 3: หา Grade เฉพาะ course_id ของครูคนนี้เท่านั้น
    // ไม่ใช้ $in หลายคอร์ส — ใช้แค่คอร์สเดียวที่ตรงกับ Gradebook
    const grades = await Grade.find({
      course_id: gradebook.course_id
    })
      .populate("student_id", "name")
      .lean();

    console.log("👨‍🎓 Grades found:", grades.length);

    // ★ FIX 4: filter เฉพาะนักเรียนที่ enrolled จริงๆ ในคอร์สนี้
    const enrolledUids = await Enrollment.find({
      course_id: gradebook.course_id,
      instructor_id: teacher._id.toString(),
      status: "accepted",
      sessionId: { $exists: true, $ne: null }
    }).distinct("authUid");

    const enrolledUsers = await mongoose.model("User").find({
      authUid: { $in: enrolledUids }
    }).lean();
    const enrolledUserIds = enrolledUsers.map(u => u._id.toString());

    // กรองเฉพาะ grade ที่ student อยู่ใน enrolled list
    const filteredGrades = grades.filter(g =>
      g.student_id && enrolledUserIds.includes(g.student_id._id.toString())
    );

    console.log("✅ Filtered grades:", filteredGrades.length);

    const result = filteredGrades.map(g => ({
      _id: g._id,
      student_name: g.student_id ? g.student_id.name : "Unknown Student",
      scores: g.scores || {},
      comment: g.comment || ""
    }));

    res.json({
      grades: result,
      columns: gradebook.columns || [],
      course_id: gradebook.course_id
    });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


router.get("/course/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentsEnrolled = await Enrollment.find({
      course_id: courseId,
      status: "accepted"
    }).populate({
      path: 'authUid',
      model: 'User',
      select: 'name photoUrl'
    });
    const existingGrades = await Grade.find({ course_id: courseId });
    res.json({ students: studentsEnrolled, grades: existingGrades });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/analysis/:authUid", async (req, res) => {
  try {
    const { authUid } = req.params;
    const user = await mongoose.model("User").findOne({ authUid });
    if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้" });

    const myGrades = await Grade.find({ student_id: user._id })
      .populate("course_id", "title")
      .lean();
    if (!myGrades.length) return res.json([]);

    const result = await Promise.all(myGrades.map(async (grade) => {
      const gradebook = await Gradebook.findById(grade.gradebook_id);
      const allGrades = await Grade.find({ course_id: grade.course_id._id }).lean();

      const classAvg = {};
      if (gradebook) {
        for (const col of gradebook.columns) {
          const scores = allGrades.map(g => Number(g.scores?.[col.key]) || 0);
          classAvg[col.key] = scores.length
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        }
      }

      const classTotal = allGrades.map(g =>
        Object.values(g.scores || {}).reduce((a, b) => a + (Number(b) || 0), 0)
      );
      const classAvgTotal = classTotal.length
        ? Math.round(classTotal.reduce((a, b) => a + b, 0) / classTotal.length) : 0;

      const myTotal = Object.values(grade.scores || {})
        .reduce((a, b) => a + (Number(b) || 0), 0);
      const maxTotal = gradebook
        ? gradebook.columns.reduce((a, col) => a + (Number(col.max) || 0), 0) : 0;

      return {
        course_id: grade.course_id._id,
        course_title: grade.course_id.title,
        my_scores: grade.scores || {},
        class_avg: classAvg,
        comment: grade.comment || "",
        summary: {
          my_total: myTotal,
          max_total: maxTotal,
          class_avg_total: classAvgTotal,
          percentage: maxTotal > 0 ? Math.round((myTotal / maxTotal) * 100) : 0,
          columns: gradebook?.columns || []
        }
      };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/create", async (req, res) => {
  try {
    const { course_id, teacher_id } = req.body;
    const exists = await Gradebook.findOne({ course_id });
    if (exists) return res.json(exists);
    const newGradebook = await Gradebook.create({
      course_id, teacher_id,
      columns: [{ key: "attend", label: "Attendance", max: 10 }]
    });
    res.json(newGradebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export async function createGradeIfNotExists(authUid, course_id) {
  try {
    const user = await mongoose.model("User").findOne({ authUid });
    if (!user) { console.log("❌ ไม่พบ user:", authUid); return; }

    const courseObjId = new mongoose.Types.ObjectId(course_id.toString());
    const gradebook = await Gradebook.findOne({ course_id: courseObjId });
    if (!gradebook) { console.log("❌ ไม่พบ Gradebook สำหรับ course:", course_id); return; }

    const exists = await Grade.findOne({ student_id: user._id, course_id: courseObjId });
    if (!exists) {
      await Grade.create({
        gradebook_id: gradebook._id,
        student_id: user._id,
        course_id: courseObjId,
        scores: {},
        comment: ""
      });
      console.log("✅ Created grade for:", user.name);
    }
  } catch (err) {
    console.log("🔥 Grade error:", err.message);
  }
}

router.post("/add-column", async (req, res) => {
  try {
    const { course_id, label, max } = req.body;
    const key = label.toLowerCase().replaceAll(" ", "");
    const updated = await Gradebook.findOneAndUpdate(
      { course_id },
      { $push: { columns: { key, label, max } } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/create-grade", async (req, res) => {
  try {
    const { student_id, course_id } = req.body;
    const gradebook = await Gradebook.findOne({ course_id });
    if (!gradebook) return res.status(404).json({ error: "No gradebook" });
    const exists = await Grade.findOne({ student_id, course_id });
    if (exists) return res.json(exists);
    const newGrade = await Grade.create({
      gradebook_id: gradebook._id, student_id, course_id, scores: {}
    });
    res.json(newGrade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/update-column", async (req, res) => {
  try {
    const { course_id, key, label, max } = req.body;
    const updated = await Gradebook.findOneAndUpdate(
      { course_id, "columns.key": key },
      { $set: { "columns.$.label": label, "columns.$.max": max } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { scores, comment } = req.body;
    const updated = await Grade.findByIdAndUpdate(
      req.params.id,
      { ...(scores && { scores }), ...(comment && { comment }) },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/student/:authUid", async (req, res) => {
  try {
    const { authUid } = req.params;
    const user = await mongoose.model("User").findOne({ authUid });
    if (!user) return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้งาน" });

    const grades = await Grade.find({ student_id: user._id })
      .populate("course_id", "title thumbnail")
      .lean();
    res.json(grades);
  } catch (err) {
    console.error("🔥 Get Student Grade Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ★ ลบ column
router.delete("/remove-column", async (req, res) => {
  try {
    const { course_id, key } = req.body;
    const updated = await Gradebook.findOneAndUpdate(
      { course_id },
      { $pull: { columns: { key } } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;