import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  totalLessons: Number,
  imageUrl: String,
  isHotCourse: { type: Boolean, default: false },

  // ** ฟิลด์ใหม่ที่ถูกเพิ่มเพื่อรองรับหน้า Course (Courses-1) **

  // ใช้สำหรับ Filter (Maths, Robotic)
  category: {
    type: String,
    required: true
  },

  // ชื่อผู้สอน (Robertson Connie, Nguyen Shane)
  instructor: {
    type: String,
    required: true
  },

  // ราคา (20,000 Bath, 17,000 Bath)
  price: {
    type: Number,
    required: true
  },

  // ระยะเวลาเรียน (16 hours, 14 hours)
  durationHours: {
    type: Number,
    required: true
  }

}, { timestamps: true });

export default mongoose.model("Course", courseSchema);