import { z } from "zod";
import { CARD_LIMITS as L } from "@bm/engine";

export const CardSchema = z.object({
  headline: z.string().max(L.headline),
  recap: z.array(z.string().max(L.recap)).min(2).max(3),
  why_it_matters: z.string().max(L.why),
  watch_next: z.string().max(L.watch),
  review_explainer: z.object({
    under_review: z.string().max(L.explainer), if_stays: z.string().max(L.explainer), if_changes: z.string().max(L.explainer),
  }).optional(),
  chosen_question_id: z.string(),
  uncertainties: z.array(z.string().max(L.uncertainty)).max(5),
});

export const BreakBody = z.object({
  stoppageId: z.string().min(1).max(40),
  lang: z.enum(["hinglish", "en"]),
  team: z.string().min(1).max(60).default("any"),
});
// The fan is identified by the login token, never by a field in the body.
export const PredictBody = z.object({
  stoppageId: z.string().min(1).max(40),
  questionId: z.string().min(1).max(60), optionId: z.string().min(1).max(20),
});
export const ResolveBody = z.object({ stoppageId: z.string().min(1).max(40), seq: z.number().int().min(0) });

const Email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
export const RegisterBody = z.object({
  email: Email,
  password: z.string().min(8, "Use at least 8 characters").max(128, "Use 128 characters or fewer"),
});
export const LoginBody = z.object({ email: Email, password: z.string().min(1, "Enter your password").max(128) });
