import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AssetType = "gold" | "silver" | "platinum";

export interface IHolding extends Document {
  userId: Types.ObjectId;
  assetType: AssetType;
  amount: number;
  updatedAt: Date;
}

const holdingSchema: Schema<IHolding> = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  assetType: {
    type: String,
    enum: ["gold", "silver", "platinum"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

holdingSchema.index({ userId: 1, assetType: 1 }, { unique: true });

const Holding: Model<IHolding> = mongoose.model<IHolding>(
  "Holding",
  holdingSchema
);
export default Holding;
