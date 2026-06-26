import { describe, expect, it, vi } from "vitest";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { postAuthRedirect } from "./postAuthRedirect";

describe("postAuthRedirect", () => {
  it("uses full document navigation by default after sign-in", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    const router = { replace: vi.fn() } as unknown as AppRouterInstance;

    postAuthRedirect(router, "/dispatcher/dashboard");

    expect(assign).toHaveBeenCalledWith("/dispatcher/dashboard");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("allows soft router.replace when hard navigation is disabled", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    const replace = vi.fn();
    const router = { replace } as unknown as AppRouterInstance;

    postAuthRedirect(router, "/dispatcher/dashboard", "/dashboard", { hard: false });

    expect(replace).toHaveBeenCalledWith("/dispatcher/dashboard");
    expect(assign).not.toHaveBeenCalled();
  });
});
