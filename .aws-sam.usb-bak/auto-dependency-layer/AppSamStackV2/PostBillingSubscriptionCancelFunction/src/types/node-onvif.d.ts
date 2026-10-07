declare module "node-onvif" {
  export class OnvifDevice {
    constructor(options: { xaddr: string; user?: string; pass?: string });
    init(): Promise<void>;
    getCurrentProfile(): { token?: string } | null;
    fetchStreamUri(options: { ProfileToken: string; Protocol: "RTSP" }): Promise<{ uri?: string }>;
  }
}
