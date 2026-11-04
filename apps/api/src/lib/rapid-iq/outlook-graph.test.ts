import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildOutlookAuthorizeUrl,
  buildPersonalOutlookAuthorizeUrl,
  isOutlookGraphMock,
  isOutlookOAuthConfigured,
  isPersonalSalesMailbox,
  signOutlookOAuthState,
  verifyOutlookOAuthState,
} from "./outlook-graph.js";

describe("outlook-graph campaign OAuth helpers", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.OUTLOOK_OAUTH_CLIENT_ID = "client-123";
    process.env.OUTLOOK_OAUTH_REDIRECT_URI =
      "https://app.rapidcortex.us/rc-admin/sales-automation/outlook-callback";
    process.env.OUTLOOK_OAUTH_TENANT = "common";
    delete process.env.OUTLOOK_GRAPH_MOCK;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("treats a client id as configured and mock as explicit", () => {
    expect(isOutlookOAuthConfigured()).toBe(true);
    expect(isOutlookGraphMock()).toBe(false);
    process.env.OUTLOOK_GRAPH_MOCK = "1";
    expect(isOutlookGraphMock()).toBe(true);
  });

  it("builds a Graph authorize URL for the RC sales callback", () => {
    const url = buildOutlookAuthorizeUrl("state-1");
    expect(url).toContain("login.microsoftonline.com/");
    expect(url).toContain("/oauth2/v2.0/authorize");
    expect(url).toContain("client_id=client-123");
    expect(url).toContain("Mail.Send");
    expect(url).toContain("offline_access");
    expect(url).toContain("outlook-callback");
    expect(url).toContain(encodeURIComponent("jeff@nexcortiq.us"));
    expect(url).toContain("login_hint");
  });

  it("only allows jeff@nexcortiq.us as the campaign mailbox", async () => {
    const { isAllowedSalesMailbox, salesOutlookMailbox } = await import("./outlook-graph.js");
    expect(salesOutlookMailbox()).toBe("jeff@nexcortiq.us");
    expect(isAllowedSalesMailbox("Jeff@nexcortiq.us")).toBe(true);
    expect(isAllowedSalesMailbox("hello@nexcortiq.us")).toBe(false);
  });

  it("allows any @nexcortiq.us mailbox for personal Sales Tools connect", () => {
    expect(isPersonalSalesMailbox("rep@nexcortiq.us")).toBe(true);
    expect(isPersonalSalesMailbox("hello@nexcortiq.us")).toBe(true);
    expect(isPersonalSalesMailbox("sales@appondemand.net")).toBe(false);
  });

  it("builds a personal authorize URL without platform login_hint", () => {
    process.env.OUTLOOK_OAUTH_PERSONAL_REDIRECT_URI =
      "https://app.rapidcortex.us/sales/outlook-callback";
    const url = buildPersonalOutlookAuthorizeUrl("state-2");
    expect(url).toContain(encodeURIComponent("https://app.rapidcortex.us/sales/outlook-callback"));
    expect(url).not.toContain(encodeURIComponent("jeff@nexcortiq.us"));
    expect(url).toContain("select_account");
  });

  it("round-trips signed OAuth state", () => {
    const state = signOutlookOAuthState("u-admin", "state-secret");
    expect(verifyOutlookOAuthState(state, "state-secret")).toEqual({ userId: "u-admin" });
    expect(verifyOutlookOAuthState(state, "wrong")).toBeNull();
    expect(verifyOutlookOAuthState("not-a-state", "state-secret")).toBeNull();
  });
});

describe("sendOutlookMail Graph envelope", () => {
  it("posts saveToSentItems true to /me/sendMail", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendOutlookMail } = await import("./outlook-graph.js");
    await sendOutlookMail({
      accessToken: "tok",
      to: "director@example.gov",
      subject: "Walkthrough",
      text: "Hi",
      html: "<p>Hi</p>",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.microsoft.com/v1.0/me/sendMail");
    const body = JSON.parse(String(init.body));
    expect(body.saveToSentItems).toBe(true);
    expect(body.message.toRecipients[0].emailAddress.address).toBe("director@example.gov");
    expect(body.message.from.emailAddress.address).toBe("jeff@nexcortiq.us");
    expect(body.message.replyTo[0].emailAddress.address).toBe("jeff@nexcortiq.us");
    vi.unstubAllGlobals();
  });

  it("uses fromMailbox for personal send", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendOutlookMail } = await import("./outlook-graph.js");
    await sendOutlookMail({
      accessToken: "tok",
      to: "director@example.gov",
      subject: "Walkthrough",
      text: "Hi",
      fromMailbox: "rep@nexcortiq.us",
      fromName: "rep@nexcortiq.us",
      cc: ["ops@example.gov"],
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.message.from.emailAddress.address).toBe("rep@nexcortiq.us");
    expect(body.message.ccRecipients[0].emailAddress.address).toBe("ops@example.gov");
    vi.unstubAllGlobals();
  });

  it("retries Graph 429 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("throttled", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendOutlookMail } = await import("./outlook-graph.js");
    await sendOutlookMail({
      accessToken: "tok",
      to: "director@example.gov",
      subject: "Walkthrough",
      text: "Hi",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
