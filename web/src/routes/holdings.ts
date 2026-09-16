import express, { Router } from "express";
import { getHoldings } from "../controllers/holdingController";
import { isAuthenticatedUser } from "../middlewares/user_actions/auth";

const router: Router = express.Router();

router.get("/", isAuthenticatedUser, getHoldings);

export default router;
