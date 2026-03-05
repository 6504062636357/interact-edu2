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

  omise_charge_id: String,

  status: {
    type: String,
    enum: ["pending","success","failed"],
    default: "pending"
  }

},
{ timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);