import express from "express";
import mongoose from "mongoose";
import Gradebook from "../models/Gradebook.js";
import Grade from "../models/Grade.js";
import Enrollment from "../models/Enrollment.js";

const router = express.Router();
// 🧩 เส้นนี้สำหรับ "ครู" (ดึงนักเรียนทุกคนในวิชาที่ครูคนนี้สอน)
//router.get("/teacher-grades/:teacherAuthUid", async (req, res) => {
// try {
//   const { teacherAuthUid } = req.params;
//
//   console.log("teacherAuthUid:", teacherAuthUid);
//
//   // 1. หา teacher จาก authUid
//   const teacher = await mongoose.model("User").findOne({
//     authUid: teacherAuthUid,
//     role: "teacher"
//   });
//   if (!teacher) {
//     return res.status(404).json({ error: "ไม่พบข้อมูลครูในระบบ" });
//   }
//
//   console.log("teacher._id:", teacher._id);
//
//   // ✅ 2. หา gradebook แทน course
//   const gradebooks = await mongoose.model("Gradebook").find({
//     teacher_id: teacher._id
//   });
//
//   console.log("gradebooks:", gradebooks);
//
//   if (!gradebooks.length) {
//     return res.status(404).json({
//       error: "ครูคนนี้ยังไม่มีคอร์สที่สอน"
//     });
//   }
//
//   // ✅ 3. ดึง grades จาก course_id ใน gradebook
//   const courseIds = gradebooks.map(g => g.course_id);
//
//   const grades = await mongoose.model("Grade").find({
//     course_id: { $in: courseIds }
//   })
//   .populate("student_id", "name")
//   .lean();
//
//   // 4. format
//   const result = grades.map(g => ({
//     _id: g._id,
//     student_name: g.student_id ? g.student_id.name : "Unknown Student",
//     scores: g.scores || {},
//     comment: g.comment || ""
//   }));
//
//  //res.json(result);
//    res.json({
//      grades: result,
//      columns: gradebooks[0]?.columns || [],
//      course_id: gradebooks[0]?.course_id || null
//    });
//
// } catch (err) {
//   console.log("ERROR:", err);
//   res.status(500).json({ error: err.message });
// }
//});

router.get("/teacher-grades/:teacherAuthUid", async (req, res) => {
  try {
    const { teacherAuthUid } = req.params;

    const teacher = await mongoose.model("User").findOne({
      authUid: teacherAuthUid,
      role: "teacher"
    });
    if (!teacher) return res.status(404).json({ error: "ไม่พบครู" });

    const gradebooks = await mongoose.model("Gradebook").find({
      teacher_id: teacher._id
    });

    // ✅ LOG ดูว่า gradebook มีกี่อัน และ course_id คืออะไรบ้าง
    console.log("📚 Gradebooks found:", gradebooks.length);
    gradebooks.forEach(g => console.log("  → course_id:", g.course_id));

    if (!gradebooks.length) {
      return res.status(404).json({ error: "ครูคนนี้ยังไม่มีคอร์สที่สอน" });
    }

    const courseIds = gradebooks.map(g => g.course_id);

    const grades = await mongoose.model("Grade").find({
      course_id: { $in: courseIds }
    })
    .populate("student_id", "name")
    .lean();

    // ✅ LOG ดูว่า Grade มีกี่คน
    console.log("👨‍🎓 Grades found:", grades.length);
    grades.forEach(g => console.log("  → student:", g.student_id?.name, "course:", g.course_id));

    const result = grades.map(g => ({
      _id: g._id,
      student_name: g.student_id ? g.student_id.name : "Unknown Student",
      scores: g.scores || {},
      comment: g.comment || ""
    }));

    res.json({
      grades: result,
      columns: gradebooks[0]?.columns || [],
      course_id: gradebooks[0]?.course_id || null
    });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


// 🧩 1. สำหรับครู: ดึงรายชื่อนักเรียน + เกรดที่มีอยู่แล้วในวิชานั้น
router.get("/course/:courseId", async (req, res) => {
 try {
   const { courseId } = req.params;

   // 1. หาว่ามีใครลงทะเบียนเรียนวิชานี้บ้าง (Enrollment)
   // และดึงข้อมูลชื่อนักเรียนมาด้วย (populate user)
   const studentsEnrolled = await Enrollment.find({
     course_id: courseId,
     status: "accepted" // หรือ "completed" ตามที่คุณตั้งไว้
   }).populate({
     path: 'authUid', // สมมติว่าใน Enrollment เก็บ authUid เชื่อมกับ User
     model: 'User',
     select: 'name photoUrl'
   });

   // 2. ดึงเกรดที่เคยกรอกไว้แล้วในวิชานี้
   const existingGrades = await Grade.find({ course_id: courseId });

   res.json({
     students: studentsEnrolled,
     grades: existingGrades
   });

 } catch (err) {
   res.status(500).json({ error: err.message });
 }
});
// วิเคราะห์คะแนนนักเรียน + เปรียบเทียบห้อง
router.get("/analysis/:authUid", async (req, res) => {
  try {
    const { authUid } = req.params;

    // 1. หา student
    const user = await mongoose.model("User").findOne({ authUid });
    if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้" });

    // 2. หาเกรดของนักเรียนคนนี้
    const myGrades = await Grade.find({ student_id: user._id })
      .populate("course_id", "title")
      .lean();

    if (!myGrades.length) return res.json([]);

    // 3. วิเคราะห์แต่ละวิชา
    const result = await Promise.all(myGrades.map(async (grade) => {

      // ดึง gradebook เพื่อรู้ columns + max score
//      const gradebook = await Gradebook.findOne({
//        course_id: grade.course_id._id
//      });
    const gradebook = await Gradebook.findById(grade.gradebook_id);
      // ดึงคะแนนทุกคนในห้อง
      const allGrades = await Grade.find({
        course_id: grade.course_id._id
      }).lean();

      // คำนวณ avg ห้องแต่ละ column
      const classAvg = {};
      if (gradebook) {
        for (const col of gradebook.columns) {
          const scores = allGrades.map(g => Number(g.scores?.[col.key]) || 0);
          classAvg[col.key] = scores.length
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;
        }
      }

      // ✅ ต้องประกาศก่อนใช้
      const classTotal = allGrades.map(g =>
        Object.values(g.scores || {}).reduce((a, b) => a + (Number(b) || 0), 0)
      );

      const classAvgTotal = classTotal.length  // ✅ ประกาศตรงนี้
        ? Math.round(classTotal.reduce((a, b) => a + b, 0) / classTotal.length)
        : 0;

      // คะแนนรวม
      const myTotal = Object.values(grade.scores || {})
        .reduce((a, b) => a + (Number(b) || 0), 0);

      const maxTotal = gradebook
        ? gradebook.columns.reduce((a, col) => a + (Number(col.max) || 0), 0)
        : 0;

      return {
        course_id: grade.course_id._id,
        course_title: grade.course_id.title,
        my_scores: grade.scores || {},
        class_avg: classAvg,
        comment: grade.comment || "",
        summary: {
          my_total: myTotal,
          max_total: maxTotal,
          class_avg_total: classAvgTotal,  // ✅ ใช้ได้แล้ว
          percentage: maxTotal > 0
            ? Math.round((myTotal / maxTotal) * 100)
            : 0,
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

// 🧩 2. CREATE gradebook (ครั้งแรก)
router.post("/create", async (req, res) => {
 try {
   const { course_id, teacher_id } = req.body;

   const exists = await Gradebook.findOne({ course_id });
   if (exists) return res.json(exists);

   const newGradebook = await Gradebook.create({
     course_id,
     teacher_id,
     columns: [
       { key: "attend", label: "Attendance", max: 10 }
     ]
   });

   res.json(newGradebook);

 } catch (err) {
   res.status(500).json({ error: err.message });
 }
});

export async function createGradeIfNotExists(authUid, course_id) {
 try {
   const user = await mongoose.model("User").findOne({ authUid });
   if (!user) {
     console.log("❌ ไม่พบ user:", authUid);
     return;
   }

   // แปลงเป็น ObjectId เสมอ
   const courseObjId = new mongoose.Types.ObjectId(course_id.toString());

   const gradebook = await mongoose.model("Gradebook").findOne({
     course_id: courseObjId
   });
   if (!gradebook) {
     console.log("❌ ไม่พบ Gradebook สำหรับ course:", course_id);
     return;
   }

   const exists = await mongoose.model("Grade").findOne({
     student_id: user._id,
     course_id: courseObjId,
   });

   if (!exists) {
     await mongoose.model("Grade").create({
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
// 🧩 3. ADD COLUMN
router.post("/add-column", async (req, res) => {
 try {
   const { course_id, label, max } = req.body;

   const key = label.toLowerCase().replaceAll(" ", "");

   const updated = await Gradebook.findOneAndUpdate(
     { course_id },
     {
       $push: {
         columns: { key, label, max }
       }
     },
     { new: true }
   );

   res.json(updated);

 } catch (err) {
   res.status(500).json({ error: err.message });
 }
});


// 🧩 4. CREATE grade (auto ตอนมี student)
router.post("/create-grade", async (req, res) => {
 try {
   const { student_id, course_id } = req.body;

   const gradebook = await Gradebook.findOne({ course_id });

   if (!gradebook) return res.status(404).json({ error: "No gradebook" });

   const exists = await Grade.findOne({ student_id, course_id });
   if (exists) return res.json(exists);

   const newGrade = await Grade.create({
     gradebook_id: gradebook._id,
     student_id,
     course_id,
     scores: {}
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
      {
        $set: {
          "columns.$.label": label,
          "columns.$.max": max
        }
      },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🧩 5. UPDATE score
router.patch("/:id", async (req, res) => {
 try {
   const { scores, comment } = req.body;

   const updated = await Grade.findByIdAndUpdate(
     req.params.id,
     {
       ...(scores && { scores }),
       ...(comment && { comment })
     },
     { new: true }
   );

   res.json(updated);

 } catch (err) {
   res.status(500).json({ error: err.message });
 }
});

// 🧩 6. GET grades by student UID (สำหรับฝั่งนักเรียนดูเกรดตัวเอง)
router.get("/student/:authUid", async (req, res) => {
 try {
   const { authUid } = req.params;

   // 1. หา User ID จาก authUid (Firebase UID) ก่อน
   const user = await mongoose.model("User").findOne({ authUid });
   if (!user) {
     return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้งาน" });
   }

   // 2. หาข้อมูลเกรดทั้งหมดที่ student_id นี้ครอบครองอยู่
   // และใช้ .populate เพื่อดึงรายละเอียดวิชา (Course) มาแสดงด้วย
   const grades = await Grade.find({ student_id: user._id })
     .populate("course_id", "title thumbnail") // ดึงชื่อวิชาและรูปมาโชว์
     .lean();

   res.json(grades);
 } catch (err) {
   console.error("🔥 Get Student Grade Error:", err);
   res.status(500).json({ error: err.message });
 }
});



export default router;
