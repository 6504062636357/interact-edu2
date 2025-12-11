import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema({
  title: String,
  subtitle: String,
  bannerUrl: String
}, { timestamps: true });

export default mongoose.model("Announcement", announcementSchema);
