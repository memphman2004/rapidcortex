export type OnvifDeviceCtor = new (options: {
  xaddr: string;
  user?: string;
  pass?: string;
}) => {
  init(): Promise<void>;
  getInformation?(): Promise<{ Manufacturer?: string; Model?: string }>;
  getCurrentProfile(): { token?: string; name?: string } | null;
  fetchStreamUri(options: { ProfileToken: string; Protocol: "RTSP" }): Promise<{ uri?: string }>;
};

export type VenueOnvifDiscoveryResult = {
  displayName: string;
  rtspUrl: string;
  ptzCapable: boolean;
  vendor: "onvif";
  cameraIp: string;
  model?: string;
  manufacturer?: string;
};

function onvifMockEnabled(): boolean {
  return process.env.ONVIF_DISCOVERY_MOCK === "true" || process.env.NODE_ENV === "test";
}

/** Discover ONVIF camera stream URL and metadata from IP + credentials. */
export async function discoverVenueOnvifCamera(input: {
  ip: string;
  username?: string;
  password?: string;
  port?: number;
}): Promise<VenueOnvifDiscoveryResult> {
  const ip = input.ip.trim();
  const port = input.port ?? 80;

  if (onvifMockEnabled()) {
    return {
      displayName: `ONVIF Camera ${ip}`,
      rtspUrl: `rtsp://${ip}:554/stream1`,
      ptzCapable: false,
      vendor: "onvif",
      cameraIp: ip,
      manufacturer: "Mock",
      model: "MockCam",
    };
  }

  const imported = (await import("node-onvif")) as { OnvifDevice?: OnvifDeviceCtor };
  if (!imported.OnvifDevice) {
    throw new Error("node-onvif module missing OnvifDevice export");
  }

  const device = new imported.OnvifDevice({
    xaddr: `http://${ip}:${port}/onvif/device_service`,
    user: input.username?.trim() || undefined,
    pass: input.password ?? undefined,
  });

  await device.init();

  let manufacturer: string | undefined;
  let model: string | undefined;
  if (device.getInformation) {
    try {
      const info = await device.getInformation();
      manufacturer = info.Manufacturer?.trim();
      model = info.Model?.trim();
    } catch {
      /* optional */
    }
  }

  const profile = device.getCurrentProfile();
  if (!profile?.token) {
    throw new Error(`ONVIF device at ${ip} returned no stream profiles`);
  }

  const { uri } = await device.fetchStreamUri({
    ProfileToken: profile.token,
    Protocol: "RTSP",
  });
  if (!uri?.trim()) {
    throw new Error(`ONVIF device at ${ip} did not provide an RTSP URI`);
  }

  const displayName =
    [manufacturer, model].filter(Boolean).join(" ").trim() ||
    profile.name?.trim() ||
    `ONVIF ${ip}`;

  return {
    displayName,
    rtspUrl: uri.trim(),
    ptzCapable: false,
    vendor: "onvif",
    cameraIp: ip,
    model,
    manufacturer,
  };
}
