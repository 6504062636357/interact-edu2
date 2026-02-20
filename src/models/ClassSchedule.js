import mongoose from "mongoose";

const classScheduleSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },

  // ใช้ teacherName ไปก่อน (ยังไม่ ref instructor)
  teacherName: {
    type: String,
    required: true,
  },

  teacherRating: {
    type: Number,
    default: 0,
  },

  // level ยังเก็บไว้ได้ (แม้ frontend ยังไม่ใช้)
  level: {
    type: Number,
    required: true,
  },

  date: {
    type: String, // "2025-04-07"
    required: true,
  },

  startTime: {
    type: String, // "13:00"
    required: true,
  },

  endTime: {
    type: String, // "14:00"
    required: true,
  },

  maxStudents: {
    type: Number,
    default: 10,
  },

  bookedCount: {
    type: Number,
    default: 0,
  },
});

export default mongoose.model("ClassSchedule", classScheduleSchema);
