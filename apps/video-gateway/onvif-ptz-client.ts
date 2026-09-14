export type GatewayPtzCommand =
  | "ContinuousMove"
  | "Stop"
  | "Zoom"
  | "GotoPreset"
  | "SetPreset"
  | "GetPresets";

export type GatewayPtzRequest = {
  cameraIp?: string;
  command: GatewayPtzCommand;
  direction?: string;
  zoomDirection?: "in" | "out";
  speed?: number;
  presetToken?: string;
  presetName?: string;
};

function velocity(speed: number | undefined): number {
  const n = Number.isFinite(speed) ? Math.min(5, Math.max(1, Math.round(speed ?? 3))) : 3;
  return n / 10;
}

function panTilt(direction: string | undefined, speed: number | undefined): { x: number; y: number } {
  const v = velocity(speed);
  switch (direction) {
    case "up":
      return { x: 0, y: v };
    case "down":
      return { x: 0, y: -v };
    case "left":
      return { x: -v, y: 0 };
    case "right":
      return { x: v, y: 0 };
    case "up-left":
      return { x: -v, y: v };
    case "up-right":
      return { x: v, y: v };
    case "down-left":
      return { x: -v, y: -v };
    case "down-right":
      return { x: v, y: -v };
    default:
      return { x: 0, y: 0 };
  }
}

function envelope(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
  <s:Body>${body}</s:Body>
</s:Envelope>`;
}

export function buildOnvifPtzSoap(req: GatewayPtzRequest): string | null {
  if (req.command === "Stop") {
    return envelope("<tptz:Stop><tptz:PanTilt>true</tptz:PanTilt><tptz:Zoom>true</tptz:Zoom></tptz:Stop>");
  }
  if (req.command === "ContinuousMove") {
    const { x, y } = panTilt(req.direction, req.speed);
    return envelope(
      `<tptz:ContinuousMove><tptz:Velocity><tt:PanTilt x="${x}" y="${y}"/><tt:Zoom x="0"/></tptz:Velocity></tptz:ContinuousMove>`,
    );
  }
  if (req.command === "Zoom") {
    const z = req.zoomDirection === "out" ? -velocity(req.speed) : velocity(req.speed);
    return envelope(
      `<tptz:ContinuousMove><tptz:Velocity><tt:PanTilt x="0" y="0"/><tt:Zoom x="${z}"/></tptz:Velocity></tptz:ContinuousMove>`,
    );
  }
  if (req.command === "GotoPreset" && req.presetToken) {
    return envelope(`<tptz:GotoPreset><tptz:PresetToken>${escapeXml(req.presetToken)}</tptz:PresetToken></tptz:GotoPreset>`);
  }
  if (req.command === "SetPreset" && req.presetName) {
    return envelope(`<tptz:SetPreset><tptz:PresetName>${escapeXml(req.presetName)}</tptz:PresetName></tptz:SetPreset>`);
  }
  if (req.command === "GetPresets") {
    return envelope("<tptz:GetPresets/>");
  }
  return null;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendOnvifPtz(req: GatewayPtzRequest): Promise<{ ok: boolean; status?: number }> {
  if (process.env.ONVIF_MOCK === "1" || process.env.ONVIF_MOCK === "true") {
    return { ok: true, status: 200 };
  }
  const ip = req.cameraIp?.trim();
  if (!ip) return { ok: false };
  const soap = buildOnvifPtzSoap(req);
  if (!soap) return { ok: false };
  const url = `http://${ip}/onvif/PTZ`;
  const user = process.env.ONVIF_USER?.trim() ?? "";
  const pass = process.env.ONVIF_PASS?.trim() ?? "";
  const headers: Record<string, string> = { "content-type": "application/soap+xml; charset=utf-8" };
  if (user) {
    headers.authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  }
  const res = await fetch(url, { method: "POST", headers, body: soap, signal: AbortSignal.timeout(3000) });
  return { ok: res.ok, status: res.status };
}
