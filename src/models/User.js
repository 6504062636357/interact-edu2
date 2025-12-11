import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
     learnedToday: { type: Number, default: 0 },
     goalMinutes: { type: Number, default: 60 }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
