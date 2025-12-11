import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  totalLessons: Number,
  imageUrl: String,
  isHotCourse: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("Course", courseSchema);
