import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import cloudinary from "cloudinary";

import User, { IUser } from "../models/userModel";
import asyncErrorHandler from "../middlewares/helpers/asyncErrorHandler";
import sendToken from "../utils/sendToken";
import ErrorHandler from "../utils/errorHandler";
import sendEmail from "../utils/sendEmail";
import { loginSchema } from "../utils/validators";

// Extend Request (if not using global typing yet)
interface AuthRequest extends Request {
  user?: IUser;
}

// ================= REGISTER =================
export const registerUser = asyncErrorHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
      folder: "avatars",
      width: 150,
      crop: "scale",
    });

    const { name, email, gender, password } = req.body;

    const user = await User.create({
      name,
      email,
      gender,
      password,
      avatar: {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      },
    });

    sendToken(user, 201, res);
  }
);

// ================= LOGIN =================
export const loginUser = asyncErrorHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return next(new ErrorHandler(parsed.error.issues[0].message, 400));
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({ email }).select("+password");

    // Same message whether the email doesn't exist or the password is wrong,
    // so a caller can't use this endpoint to enumerate registered emails.
    if (!user || !(await user.comparePassword(password))) {
      return next(new ErrorHandler("Invalid email or password", 401));
    }

    const token = user.getJWTToken();

    res
      .status(200)
      .cookie("token", token, {
        expires: new Date(
          Date.now() +
            Number(process.env.COOKIE_EXPIRE ?? 7) * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      })
      .json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      });
  }
);

// ================= LOGOUT =================
export const logoutUser = asyncErrorHandler(
  async (req: Request, res: Response) => {
    res.cookie("token", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: "Logged Out",
    });
  }
);

// ================= USER DETAILS =================
export const getUserDetails = asyncErrorHandler(
  async (req: AuthRequest, res: Response) => {
    const user = await User.findById(req.user?._id);

    res.status(200).json({
      success: true,
      user,
    });
  }
);

// ================= FORGOT PASSWORD =================
export const forgotPassword = asyncErrorHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return next(new ErrorHandler("User Not Found", 404));
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetPasswordUrl = `https://${req.get(
      "host"
    )}/password/reset/${resetToken}`;

    try {
      await sendEmail({
        email: user.email,
        templateId: process.env.SENDGRID_RESET_TEMPLATEID as string,
        data: {
          reset_url: resetPasswordUrl,
        },
      });

      res.status(200).json({
        success: true,
        message: `Email sent to ${user.email} successfully`,
      });
    } catch (error: any) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save({ validateBeforeSave: false });
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// ================= RESET PASSWORD =================
export const resetPassword = asyncErrorHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = req.params.token as string;

    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return next(new ErrorHandler("Invalid reset password token", 404));
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();
    sendToken(user, 200, res);
  }
);

// ================= UPDATE PASSWORD =================
export const updatePassword = asyncErrorHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = await User.findById(req.user?._id).select("+password");

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

    if (!isPasswordMatched) {
      return next(new ErrorHandler("Old Password is Invalid", 400));
    }

    user.password = req.body.newPassword;
    await user.save();

    sendToken(user, 200, res);
  }
);

// ================= UPDATE PROFILE =================
export const updateProfile = asyncErrorHandler(
  async (req: AuthRequest, res: Response) => {
    const newUserData: Partial<IUser> = {
      name: req.body.name,
      email: req.body.email,
    };

    if (req.body.avatar && req.body.avatar !== "") {
      const user = await User.findById(req.user?._id);

      if (user?.avatar?.public_id) {
        await cloudinary.v2.uploader.destroy(user.avatar.public_id);
      }

      const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
        folder: "avatars",
        width: 150,
        crop: "scale",
      });

      newUserData.avatar = {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      };
    }

    await User.findByIdAndUpdate(req.user?._id, newUserData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true });
  }
);

// ================= ADMIN =================

// Get all users
export const getAllUsers = asyncErrorHandler(
  async (_req: Request, res: Response) => {
    const users = await User.find();

    res.status(200).json({
      success: true,
      users,
    });
  }
);

// Get single user
export const getSingleUser = asyncErrorHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(
        new ErrorHandler(`User doesn't exist with id: ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      user,
    });
  }
);

// Update user role
export const updateUserRole = asyncErrorHandler(
  async (req: Request, res: Response) => {
    const newUserData = {
      name: req.body.name,
      email: req.body.email,
      gender: req.body.gender,
      role: req.body.role,
    };

    await User.findByIdAndUpdate(req.params.id, newUserData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true });
  }
);

// Delete user
export const deleteUser = asyncErrorHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(
        new ErrorHandler(`User doesn't exist with id: ${req.params.id}`, 404)
      );
    }

    await user.deleteOne();

    res.status(200).json({ success: true });
  }
);
