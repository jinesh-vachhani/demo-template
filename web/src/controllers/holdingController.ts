import { Response } from "express";
import Holding, { AssetType } from "../models/holdingModel";
import asyncErrorHandler from "../middlewares/helpers/asyncErrorHandler";
import { AuthenticatedRequest } from "../middlewares/user_actions/auth";

type HoldingsResponse = Partial<
  Record<AssetType, { amount: number; updatedAt: Date }>
>;

// ================= GET HOLDINGS =================
export const getHoldings = asyncErrorHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const holdings = await Holding.find({ userId: req.user._id });

    const data: HoldingsResponse = {};
    for (const holding of holdings) {
      data[holding.assetType] = {
        amount: holding.amount,
        updatedAt: holding.updatedAt,
      };
    }

    res.status(200).json({
      success: true,
      data,
    });
  }
);
