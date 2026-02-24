import mongoose from "mongoose";

const classScheduleSchema = new mongoose.Schema({
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
  date: {
    type: String,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    default: 1
  },
  bookedCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ["open", "closed", "cancelled"],
    default: "open"
  }
}, { timestamps: true });

export default mongoose.model("ClassSchedule", classScheduleSchema);