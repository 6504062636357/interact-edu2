import mongoose from "mongoose";

const gradeSchema = new mongoose.Schema({
  gradebook_id: { type: mongoose.Schema.Types.ObjectId, ref: "Gradebook", required: true },
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },

  scores: {
    type: Map,
    of: Number,
    default: {}
  },

  comment: { type: String, default: "" }

}, { timestamps: true });

export default mongoose.model("Grade", gradeSchema);