import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Please enter your email" })
    .email("Please enter a valid email"),
  password: z
    .string({ required_error: "Please enter your password" })
    .min(1, "Please enter your password"),
});

export type LoginInput = z.infer<typeof loginSchema>;
