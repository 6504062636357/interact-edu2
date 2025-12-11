import mongoose from "mongoose";

const userCourseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  progress: Number,
  completed: { type: Boolean, default: false },
  lastAccess: Date
});

export default mongoose.model("UserCourse", userCourseSchema);
