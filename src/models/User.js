import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // เพิ่มบรรทัดนี้ครับ สำคัญมาก!
    firebaseUid: { type: String, required: true, unique: true, index: true },

    name:  { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },

    // ปรับให้ไม่ต้อง required เพราะเราสมัครผ่าน Firebase
    passwordHash: { type: String, required: false },

    learnedToday: { type: Number, default: 0 },
    goalMinutes: { type: Number, default: 60 }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);