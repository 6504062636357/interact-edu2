import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    authUid: { type: String, required: true, unique: true, index: true },
    name:  { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },


    phone: { type: String, default: "" },
    bio: { type: String, default: "" },
    photoUrl: { type: String, default: "" },
    role: { type: String, default: "student" },

    passwordHash: { type: String, required: false },
    learnedToday: { type: Number, default: 0 },
    goalMinutes: { type: Number, default: 60 }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);