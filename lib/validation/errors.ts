import { z } from "zod";

export function getValidationErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Please check the form and try again";
  }

  return "Please check the form and try again";
}
