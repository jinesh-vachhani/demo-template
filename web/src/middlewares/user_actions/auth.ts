import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../../models/userModel";
import ErrorHandler from "../../utils/errorHandler";
import asyncErrorHandler from "../helpers/asyncErrorHandler";

/**
 * Extend Express Request to include user
 * (Ideally place this in a global typings file)
 */
export interface AuthenticatedRequest extends Request {
  user?: any; // replace `any` with IUser if you have a User interface
}

interface DecodedToken extends JwtPayload {
  id: string;
}

/**
 * Reads the JWT from an httpOnly cookie (preferred) or an
 * `Authorization: Bearer <token>` header, so the same API can be
 * consumed by a same-origin browser client or a separate/non-cookie client.
 */
const extractToken = (req: AuthenticatedRequest): string | undefined => {
  if (req.cookies?.token) {
    return req.cookies.token;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }

  return undefined;
};

// Check if user is authenticated
export const isAuthenticatedUser = asyncErrorHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = extractToken(req);

    if (!token) {
      return next(new ErrorHandler("Please login to access this resource", 401));
    }

    let decodedData: DecodedToken;
    try {
      decodedData = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as DecodedToken;
    } catch {
      return next(new ErrorHandler("Session expired, please login again", 401));
    }

    const user = await User.findById(decodedData.id);

    if (!user) {
      return next(new ErrorHandler("Please login to access this resource", 401));
    }

    req.user = user;
    next();
  }
);

// Role-based authorization
export const authorizeRoles =
  (...roles: string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(`Role: ${req.user?.role} is not allowed`, 403)
      );
    }

    next();
  };