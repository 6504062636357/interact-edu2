import mongoose from "mongoose";

const columnSchema = new mongoose.Schema({
  key: String,
  label: String,
  max: Number
});

const gradebookSchema = new mongoose.Schema({
  course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  columns: [columnSchema]

}, { timestamps: true });

export default mongoose.model("Gradebook", gradebookSchema);