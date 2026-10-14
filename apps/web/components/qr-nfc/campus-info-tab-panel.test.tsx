/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { describe, expect, it } from "vitest";
import { CampusInfoTabPanel } from "./campus-info-tab-panel";

describe("CampusInfoTabPanel", () => {
  it("renders display name, contact, and section", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);

    flushSync(() => {
      root.render(
        <CampusInfoTabPanel
          locationLabel="Building C — Main Entrance"
          infoTab={{
            displayName: "Riverside Community College",
            brandColor: "#0F766E",
            emergencyContacts: [{ label: "Campus Police", phone: "901-555-0100" }],
            sections: [
              { title: "Evacuation", content: "Exit via **Main Entrance**.", order: 0, visible: true },
            ],
            alertBanner: { message: "Weather alert", severity: "warning", active: true },
          }}
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(el.textContent).toContain("Riverside Community College");
    expect(el.textContent).toContain("Campus Police");
    expect(el.textContent).toContain("Weather alert");
    expect(el.textContent).toContain("Evacuation");
    expect(el.innerHTML).toContain("<strong>Main Entrance</strong>");

    await act(async () => {
      root.unmount();
    });
    el.remove();
  });

  it("shows Campus Alerts Register / Renew when available", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    let clicked = false;

    flushSync(() => {
      root.render(
        <CampusInfoTabPanel
          infoTab={{ displayName: "State University", emergencyContacts: [], sections: [] }}
          campusAlertsAvailable
          onRegisterCampusAlerts={() => {
            clicked = true;
          }}
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(el.textContent).toContain("Campus Alerts");
    expect(el.textContent).toContain("Register / Renew Notifications");
    const btn = el.querySelector("button");
    expect(btn?.textContent).toContain("Register / Renew");
    await act(async () => {
      btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clicked).toBe(true);

    await act(async () => {
      root.unmount();
    });
    el.remove();
  });
});
