import { Request, Response, NextFunction } from "express";

/**
 * Central error handler. Every route/middleware error (thrown, passed to
 * next(), or surfaced by asyncErrorHandler) ends up here so the API always
 * responds with the same { success: false, message } shape.
 */
const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Malformed JSON body (express.json() throws a SyntaxError before any route runs)
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    statusCode = 400;
    message = "Malformed JSON in request body";
  }

  // Invalid Mongoose ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    statusCode = 400;
    message = `${field} already in use`;
  }

  // Mongoose schema validation
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors as Record<string, { message: string }>)
      .map((e) => e.message)
      .join(", ");
  }

  // Invalid/expired JWT that wasn't already caught closer to the source
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token, please login again";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Session expired, please login again";
  }

  if (process.env.NODE_ENV === "development") {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorMiddleware;
