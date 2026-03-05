import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
{
  authUid: {
    type: String,
    required: true,
    index: true
  },

  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Course'
  },

  instructor_id: {
    type: String,
    required: true,
    index: true
  },

  booking_date: {
    type: String,
    required: true
  },

  booking_time: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ['pending','accepted','rejected','completed'],
    default: 'pending'
  },

  progress: {
    type: Number,
    default: 0
  },

  enrolled_at: {
    type: Date,
    default: Date.now
  }
},
{ timestamps: true }
);

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);
export default Enrollment;