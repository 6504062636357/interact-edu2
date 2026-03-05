const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  time: { type: String, required: true }, // เช่น "09:00-10:00"
  isBooked: { type: Boolean, default: false },
  currentBookings: { type: Number, default: 0 }, // จำนวนคนจองปัจจุบัน
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // เก็บรายชื่อนักเรียน
});

const teacherAvailabilitySchema = new mongoose.Schema({
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  instructorName: { type: String, required: true }, // เก็บชื่อไว้แสดงผลได้เร็วขึ้น
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true }, // เชื่อมกับวิชา
  courseTitle: { type: String }, // ชื่อวิชา
  date: { type: Date, required: true },
  maxStudents: { type: Number, default: 5 }, // กำหนดจำนวนรับสูงสุด
  slots: [slotSchema]
}, { timestamps: true });

module.exports = mongoose.model('TeacherAvailability', teacherAvailabilitySchema);