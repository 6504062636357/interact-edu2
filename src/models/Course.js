import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  totalLessons: Number,
  imageUrl: String,
  isHotCourse: Boolean,
  category: String,
  instructor: String,
  price: Number,
  durationHours: Number,
  instructorImage: String,
  rating: Number,
  isBookmarked: Boolean,
  maxStudents: { type: Number, default: 1 }, // ค่าเริ่มต้นเป็น 1 สำหรับเรียนตัวต่อตัว
    currentStudents: { type: Number, default: 0 } // สำหรับนับจำนวนคนที่จ่ายเงินแล้ว
}, { timestamps: true });

export default mongoose.model("Course", courseSchema);
