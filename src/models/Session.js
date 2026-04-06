import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  date: { type: String, required: true },        // "2026-04-10"
  startTime: { type: String, required: true },    // "10:00"
  endTime: { type: String, required: true },      // "12:00"
  meetLink: { type: String, default: "" },        // ครูใส่ Google Meet link
  maxSeats: { type: Number, default: 10 },
  bookedSeats: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["open", "live", "completed"],
    default: "open"
  },
}, { timestamps: true });

export default mongoose.model("Session", sessionSchema);