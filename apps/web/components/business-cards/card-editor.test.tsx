/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardEditor } from "./card-editor";

vi.mock("next/navigation", () => ({
  usePathname: () => "/rc-admin/profile/business-card",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: async () => "data:image/png;base64,aaa",
    toString: async () => "<svg xmlns='http://www.w3.org/2000/svg'/>",
  },
}));

const profile = {
  profileId: "profile-1",
  publicProfileId: "public-1",
  version: 3,
  status: "inactive",
  slug: "ada-lovelace",
  displayName: "Ada Lovelace",
  companyName: "NexCort iQ",
  title: "Engineer",
  department: "Research",
  biography: "Analytical engines.",
  website: "https://www.nexcortiq.us",
  emailAddresses: [{ type: "primary", address: "ada@nexcortiq.us", public: true }],
  phoneNumbers: [{ type: "mobile", number: "+14155552671", public: true }],
  socialLinks: [],
  cardTheme: "navy",
  lockedFields: ["companyName", "website", "primaryEmail"],
};

describe("CardEditor", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads the signed-in card and updates the phone preview while typing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(profile), { status: 200, headers: { "Content-Type": "application/json" } })),
    );
    render(<CardEditor mode="self" />);
    expect(await screen.findByRole("heading", { name: "Digital Business Card Studio" })).toBeTruthy();
    expect(await screen.findAllByText("Ada Lovelace")).not.toHaveLength(0);
    const avatars = screen.getAllByText("AL").map((node) => node.closest("[data-card-avatar]")).filter(Boolean);
    expect(avatars.length).toBeGreaterThan(0);
    expect(avatars.every((node) => node?.closest("[data-card-cover]") === null)).toBe(true);
    const name = screen.getByDisplayValue("Ada Lovelace");
    fireEvent.change(name, { target: { value: "Ada King" } });
    await waitFor(() => {
      expect(screen.getAllByText("Ada King").length).toBeGreaterThan(0);
    });
    expect(screen.getByDisplayValue("NexCort iQ")).toBeTruthy();
    expect((screen.getByDisplayValue("NexCort iQ") as HTMLInputElement).disabled).toBe(true);
    const email = screen.getByDisplayValue("ada@nexcortiq.us") as HTMLInputElement;
    const website = screen.getByDisplayValue("https://www.nexcortiq.us") as HTMLInputElement;
    expect(email.disabled).toBe(false);
    expect(website.disabled).toBe(false);
    fireEvent.change(email, { target: { value: "ada@example.com" } });
    fireEvent.change(website, { target: { value: "https://ada.example" } });
    expect((screen.getByDisplayValue("ada@example.com") as HTMLInputElement).value).toBe("ada@example.com");
    expect((screen.getByDisplayValue("https://ada.example") as HTMLInputElement).value).toBe("https://ada.example");
  });

  it("paints a custom background on the phone and restores the preset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(profile), { status: 200, headers: { "Content-Type": "application/json" } })),
    );
    render(<CardEditor mode="self" />);
    await screen.findByRole("heading", { name: "Digital Business Card Studio" });
    const background = screen.getByPlaceholderText("#1e1b4b") as HTMLInputElement;
    fireEvent.change(background, { target: { value: "#112233" } });
    await waitFor(() => {
      const face = document.querySelector("article");
      expect(face?.getAttribute("style")).toContain("background: rgb(17, 34, 51)");
    });
    fireEvent.click(screen.getByRole("button", { name: /Executive Gold/ }));
    await waitFor(() => {
      expect((screen.getByPlaceholderText("#1e1b4b") as HTMLInputElement).value).toBe("");
    });
  });
});
