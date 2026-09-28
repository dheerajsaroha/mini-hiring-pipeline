import { describe, it, expect, beforeEach, vi } from "vitest";
import { Stage, canTransition, getNextStage, isTerminalStage } from "shared";
import { TransitionError, validateTransition } from "../server/src/domain/transitions.js";

describe("Stage transitions", () => {
  describe("getNextStage", () => {
    it("returns next stage for Applied", () => {
      expect(getNextStage("Applied")).toBe("Screening");
    });

    it("returns next stage for Screening", () => {
      expect(getNextStage("Screening")).toBe("Interview");
    });

    it("returns next stage for Interview", () => {
      expect(getNextStage("Interview")).toBe("Offer");
    });

    it("returns Hired for Offer", () => {
      expect(getNextStage("Offer")).toBe("Hired");
    });

    it("returns null for Hired (terminal)", () => {
      expect(getNextStage("Hired")).toBeNull();
    });

    it("returns null for Rejected (terminal)", () => {
      expect(getNextStage("Rejected")).toBeNull();
    });
  });

  describe("isTerminalStage", () => {
    it("returns true for Hired", () => {
      expect(isTerminalStage("Hired")).toBe(true);
    });

    it("returns true for Rejected", () => {
      expect(isTerminalStage("Rejected")).toBe(true);
    });

    it("returns false for Applied", () => {
      expect(isTerminalStage("Applied")).toBe(false);
    });

    it("returns false for Interview", () => {
      expect(isTerminalStage("Interview")).toBe(false);
    });
  });

  describe("canTransition", () => {
    // Valid forward transitions
    it("allows Applied -> Screening", () => {
      expect(canTransition("Applied", "Screening")).toBe(true);
    });

    it("allows Screening -> Interview", () => {
      expect(canTransition("Screening", "Interview")).toBe(true);
    });

    it("allows Interview -> Offer", () => {
      expect(canTransition("Interview", "Offer")).toBe(true);
    });

    it("allows Offer -> Hired", () => {
      expect(canTransition("Offer", "Hired")).toBe(true);
    });

    // Valid rejection transitions
    it("allows Applied -> Rejected", () => {
      expect(canTransition("Applied", "Rejected")).toBe(true);
    });

    it("allows Screening -> Rejected", () => {
      expect(canTransition("Screening", "Rejected")).toBe(true);
    });

    it("allows Interview -> Rejected", () => {
      expect(canTransition("Interview", "Rejected")).toBe(true);
    });

    it("allows Offer -> Rejected", () => {
      expect(canTransition("Offer", "Rejected")).toBe(true);
    });

    // Invalid: no skipping
    it("rejects Applied -> Interview (skipping)", () => {
      expect(canTransition("Applied", "Interview")).toBe(false);
    });

    it("rejects Applied -> Offer (skipping)", () => {
      expect(canTransition("Applied", "Offer")).toBe(false);
    });

    it("rejects Screening -> Offer (skipping)", () => {
      expect(canTransition("Screening", "Offer")).toBe(false);
    });

    it("rejects Screening -> Hired (skipping)", () => {
      expect(canTransition("Screening", "Hired")).toBe(false);
    });

    // Invalid: no backward
    it("rejects Screening -> Applied (backward)", () => {
      expect(canTransition("Screening", "Applied")).toBe(false);
    });

    it("rejects Interview -> Screening (backward)", () => {
      expect(canTransition("Interview", "Screening")).toBe(false);
    });

    it("rejects Offer -> Interview (backward)", () => {
      expect(canTransition("Offer", "Interview")).toBe(false);
    });

    it("rejects Hired -> Offer (backward from terminal)", () => {
      expect(canTransition("Hired", "Offer")).toBe(false);
    });

    // Invalid: terminal stages
    it("rejects any transition from Hired", () => {
      expect(canTransition("Hired", "Rejected")).toBe(false);
      expect(canTransition("Hired", "Offer")).toBe(false);
    });

    it("rejects any transition from Rejected", () => {
      expect(canTransition("Rejected", "Applied")).toBe(false);
      expect(canTransition("Rejected", "Hired")).toBe(false);
    });

    // Invalid: same stage
    it("rejects same stage transitions", () => {
      expect(canTransition("Applied", "Applied")).toBe(false);
      expect(canTransition("Interview", "Interview")).toBe(false);
      expect(canTransition("Hired", "Hired")).toBe(false);
    });
  });

  describe("validateTransition", () => {
    it("throws TransitionError for invalid transitions", () => {
      expect(() => validateTransition("Applied", "Interview")).toThrow(TransitionError);
      expect(() => validateTransition("Screening", "Applied")).toThrow(TransitionError);
      expect(() => validateTransition("Hired", "Rejected")).toThrow(TransitionError);
    });

    it("does not throw for valid transitions", () => {
      expect(() => validateTransition("Applied", "Screening")).not.toThrow();
      expect(() => validateTransition("Interview", "Offer")).not.toThrow();
      expect(() => validateTransition("Offer", "Hired")).not.toThrow();
      expect(() => validateTransition("Interview", "Rejected")).not.toThrow();
    });

    it("provides helpful error message for skipping", () => {
      try {
        validateTransition("Applied", "Interview");
      } catch (e) {
        expect(e).toBeInstanceOf(TransitionError);
        expect((e as TransitionError).message).toContain("Can't move from Applied to Interview");
        expect((e as TransitionError).message).toContain("Next stage is Screening");
      }
    });

    it("provides helpful error message for terminal stage", () => {
      try {
        validateTransition("Hired", "Rejected");
      } catch (e) {
        expect(e).toBeInstanceOf(TransitionError);
        expect((e as TransitionError).message).toContain("terminal stage");
      }
    });
  });
});