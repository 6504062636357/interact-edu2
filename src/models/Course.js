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
  isBookmarked: Boolean
}, { timestamps: true });

export default mongoose.model("Course", courseSchema);
