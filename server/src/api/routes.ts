import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Candidate, CandidateWithHistory, Stage, CreateCandidateInput, TransitionInput } from "shared";
import {
  createCandidate,
  getCandidateWithHistory,
  listCandidatesGroupedByStage,
  transitionCandidate,
} from "../db/repository.js";
import { executeSearch } from "../search/index.js";
import { TransitionError } from "../domain/transitions.js";

export const router = express.Router();

const createCandidateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable().transform((val) => val ?? undefined),
});

const transitionSchema = z.object({
  to: z.enum(["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"]),
  expectedStage: z.enum(["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"]),
  note: z.string().optional(),
});

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// POST /candidates
router.post(
  "/candidates",
  asyncHandler(async (req: Request, res: Response) => {
    const input = createCandidateSchema.parse(req.body);
    const candidate = createCandidate(input);
    res.status(201).json(candidate);
  })
);

// GET /candidates - grouped by stage
router.get(
  "/candidates",
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const grouped = listCandidatesGroupedByStage(now);
    res.json(grouped);
  })
);

// GET /candidates/:id - detail with history
router.get(
  "/candidates/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const now = new Date();
    const candidate = getCandidateWithHistory(id, now);
    if (!candidate) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }
    res.json(candidate);
  })
);

// POST /candidates/:id/transition
router.post(
  "/candidates/:id/transition",
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const input = transitionSchema.parse(req.body);
    const now = new Date();

    try {
      const candidate = transitionCandidate(id, input, now);
      if (!candidate) {
        res.status(404).json({ error: "Candidate not found" });
        return;
      }
      res.json(candidate);
    } catch (error) {
      if (error instanceof TransitionError) {
        res.status(422).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes("Expected stage")) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

// GET /search?q=...
router.get(
  "/search",
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query.q as string;
    if (!q || q.trim() === "") {
      res.json({ interpretation: "", results: [], error: "Query parameter 'q' is required" });
      return;
    }
    const now = new Date();
    const result = await executeSearch(q.trim(), now);
    res.json(result);
  })
);

// Error handler
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("API Error:", err);
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: "Invalid request", details: err.errors });
    return;
  }
  res.status(500).json({ error: err.message || "Internal server error" });
});