import { createServer } from "node:http";
import { gatewayAuthValid } from "./gateway-auth.ts";
import { sendOnvifPtz, type GatewayPtzRequest } from "./onvif-ptz-client.ts";

/**
 * On-prem PTZ sidecar. Runs next to the KVS producer — never expose camera IPs to the internet.
 *
 *   GATEWAY_SECRET=... ONVIF_MOCK=1 node --experimental-strip-types ptz-relay-server.ts
 *
 * NexCort iQ Lambda POSTs HMAC-signed JSON to POST /relay/ptz.
 */
const PORT = Number(process.env.PORT ?? "8787");
const SECRET = process.env.GATEWAY_SECRET?.trim() ?? "";

const server = createServer((req, res) => {
  void (async () => {
    if (req.method !== "POST" || req.url !== "/relay/ptz") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString("utf8");
    const header = req.headers["x-gateway-auth"];
    const auth = Array.isArray(header) ? header[0] : header;
    if (!gatewayAuthValid(SECRET, body, auth)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    let payload: GatewayPtzRequest & { agencyId?: string; cameraId?: string };
    try {
      payload = JSON.parse(body) as GatewayPtzRequest;
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
    try {
      const result = await sendOnvifPtz(payload);
      res.writeHead(result.ok ? 200 : 502, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: result.ok, status: result.status }));
    } catch (error) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "ONVIF failed" }));
    }
  })();
});

server.listen(PORT, () => {
  console.log(JSON.stringify({ msg: "rc_video_ptz_gateway_listen", port: PORT, mock: process.env.ONVIF_MOCK === "1" }));
});
