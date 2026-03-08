import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
{
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course"
  },

  amount: Number,

  status: {
    type: String,
    default: "success"
  }
},
{ timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);