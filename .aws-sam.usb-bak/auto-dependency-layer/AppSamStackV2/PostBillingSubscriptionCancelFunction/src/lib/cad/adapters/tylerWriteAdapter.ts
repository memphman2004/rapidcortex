import type { CadWriteAdapter } from "./writeTypes.js";

export const tylerWriteAdapter: CadWriteAdapter = {
  vendor: "tyler_new_world",
  async submit({ payload, config, cadIncidentId }) {
    const apiUrl = (config.apiUrl ?? "").trim();
    if (!apiUrl) {
      return {
        success: true,
        cadResponse: JSON.stringify({ mock: true, vendor: "tyler_new_world", reason: "apiUrl not set" }),
      };
    }
    const apiKey = (config.apiKey ?? "").trim();
    const url = `${apiUrl.replace(/\/$/, "")}/calls/${encodeURIComponent(cadIncidentId)}/notes`;
    const body = { NoteText: payload.narrative, Priority: payload.priority };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        return { success: false, cadResponse: text.slice(0, 4000), errorMessage: `${res.status} ${res.statusText}` };
      }
      return { success: true, cadResponse: text || JSON.stringify({ status: res.status }) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "request_failed";
      return { success: false, cadResponse: "", errorMessage: msg };
    }
  },
};
