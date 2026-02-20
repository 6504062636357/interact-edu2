import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
  {
    // นี่คือฟิลด์ที่เราคุยกันว่าจะเพิ่ม เพื่อใช้เชื่อมกับ Firebase
    firebaseUid: {
      type: String,
      required: true,
      index: true
    },

    // ไอดีของ User ใน MongoDB (ถ้าคุณเก็บเป็น String ก็เปลี่ยนเป็น String ได้ครับ)
    user_id: {
      type: String,
      required: true
    },

    // ไอดีของ Course
    course_id: {
      type: String,
      required: true
    },

    enrolled_at: {
      type: Date,
      default: Date.now
    },

    status: {
      type: String,
      default: 'completed'
    },

    progress: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// ส่งออก Model เพื่อเอาไปใช้ใน server.js
const Enrollment = mongoose.model("Enrollment", enrollmentSchema);
export default Enrollment;