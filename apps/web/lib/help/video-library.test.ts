import { describe, expect, it } from "vitest";
import { normalizeHelpRole, getHelpIndex, findArticle } from "./help-content";
import {
  countVideosByStatus,
  getTrainingVideosForRole,
  TRAINING_VIDEO_LIBRARY,
} from "./video-library";

describe("normalizeHelpRole — Call Assist & superadmin", () => {
  it("maps Call Assist roles to dedicated help keys (not dispatcher)", () => {
    expect(normalizeHelpRole("CALL_ASSIST_OPERATOR")).toBe("call_assist_operator");
    expect(normalizeHelpRole("call_assist_admin")).toBe("call_assist_admin");
    expect(normalizeHelpRole("call_assist_supervisor")).toBe("call_assist_supervisor");
  });

  it("keeps rcsuperadmin distinct from rcadmin", () => {
    expect(normalizeHelpRole("rcsuperadmin")).toBe("rcsuperadmin");
    expect(normalizeHelpRole("rcadmin")).toBe("rcadmin");
  });
});

describe("Call Assist help index", () => {
  it("loads operator articles including emergency transfer", () => {
    const index = getHelpIndex("CALL_ASSIST_OPERATOR");
    const topics = index.flatMap((s) => s.articles.map((a) => a.topic));
    expect(topics).toContain("emergency-transfer");
    expect(findArticle("call_assist_operator", "takeover")?.title).toMatch(/Takeover/i);
  });
});

describe("training video library", () => {
  it("has no live URLs until production assets are published", () => {
    const counts = countVideosByStatus();
    expect(counts.live).toBe(0);
    expect(counts.scripted).toBeGreaterThanOrEqual(8);
    expect(TRAINING_VIDEO_LIBRARY.length).toBeGreaterThan(10);
  });

  it("returns Call Assist videos for operators", () => {
    const videos = getTrainingVideosForRole("call_assist_operator");
    expect(videos.some((v) => v.id === "ca-emergency-transfer")).toBe(true);
  });

  it("returns campus vertical videos for CAMPUS_SECURITY", () => {
    const videos = getTrainingVideosForRole("CAMPUS_SECURITY");
    expect(videos.some((v) => v.id === "campus-overview-911")).toBe(true);
  });
});
