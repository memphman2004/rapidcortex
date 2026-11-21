/**
 * Manufacturer connector instances.
 *
 * Each connector is either:
 *   - SyntheticBodyCameraProvider (always available, clearly labeled)
 *   - PendingVendorAuthorizationProvider (authorization required from vendor)
 *   - A future concrete implementation (replace PendingVendorAuthorizationProvider)
 *
 * To add a new manufacturer, add a new PendingVendorAuthorizationProvider here
 * and register it in BodyCameraProviderRegistry.ts without touching the dashboard.
 *
 * Priority vendor targets per implementation specification:
 *   1. Getac BC-04 — Getac Video Solutions API
 *   2. Axis body-worn cameras — documented Body Worn Live Self-hosted SDK
 *   3. ZEPCAM — documented generic API + RTSP
 *   4. Axon Body cameras — Axon Respond integration
 *   5. Motorola Solutions V700 — CommandCentral API
 */
import { SyntheticBodyCameraProvider } from "./SyntheticBodyCameraProvider.js";
import { PendingVendorAuthorizationProvider } from "./PendingVendorAuthorizationProvider.js";
import type { BodyCameraProvider } from "./BodyCameraProvider.js";

export const syntheticProvider = new SyntheticBodyCameraProvider();

/**
 * Getac BC-04 / Getac Video Solutions
 * Integration approach: Getac Video Solutions API
 * Status: PENDING_VENDOR_AUTHORIZATION — NexCort iQ must obtain API access from Getac.
 * Priority: HIGH — preferred initial live manufacturer target.
 */
export const getacProvider: BodyCameraProvider = new PendingVendorAuthorizationProvider(
  "getac",
  "Getac BC-04 / Getac Video Solutions",
  "https://www.getac.com/en/solutions/bodycam/",
  {
    manufacturer: "getac",
    liveVideoSupported: true,
    liveAudioSupported: true,
    gpsSupported: true,
    remoteStreamActivationSupported: true,
    supportedMediaProtocols: ["webrtc-vendor"],
    streamAuthMechanism: "vendor-sdk",
    manufacturerLicensingRequired: true,
    maxConcurrentViewers: 0,
    audioCodecs: [],
    videoCodecs: ["H.264"],
    thirdPartyIntegrationAuthorized: false, // pending vendor authorization
  },
);

/**
 * Axon Body cameras
 * Integration approach: Authorized Axon Respond API
 * Status: PENDING_VENDOR_AUTHORIZATION — requires Axon Respond partner agreement.
 */
export const axonProvider: BodyCameraProvider = new PendingVendorAuthorizationProvider(
  "axon",
  "Axon Body Cameras / Axon Respond",
  "https://www.axon.com/products/axon-respond",
  {
    manufacturer: "axon",
    liveVideoSupported: true,
    liveAudioSupported: true,
    gpsSupported: true,
    remoteStreamActivationSupported: true,
    supportedMediaProtocols: ["webrtc-vendor"],
    streamAuthMechanism: "oauth",
    manufacturerLicensingRequired: true,
    maxConcurrentViewers: 0,
    audioCodecs: ["OPUS"],
    videoCodecs: ["H.264"],
    thirdPartyIntegrationAuthorized: false,
  },
);

/**
 * Motorola Solutions V700
 * Integration approach: Authorized CommandCentral integration
 * Status: PENDING_VENDOR_AUTHORIZATION — requires Motorola Solutions partner agreement.
 */
export const motorolaProvider: BodyCameraProvider = new PendingVendorAuthorizationProvider(
  "motorola",
  "Motorola Solutions V700 / CommandCentral",
  "https://www.motorolasolutions.com/en_us/video-security-access-control/body-worn-cameras/si500.html",
  {
    manufacturer: "motorola",
    liveVideoSupported: true,
    liveAudioSupported: true,
    gpsSupported: true,
    remoteStreamActivationSupported: true,
    supportedMediaProtocols: ["webrtc-vendor"],
    streamAuthMechanism: "vendor-sdk",
    manufacturerLicensingRequired: true,
    maxConcurrentViewers: 0,
    audioCodecs: [],
    videoCodecs: ["H.264"],
    thirdPartyIntegrationAuthorized: false,
  },
);

/**
 * Axis body-worn cameras
 * Integration approach: Body Worn Live Self-hosted SDK
 * Status: PENDING_VENDOR_AUTHORIZATION — SDK available but credentials/license needed.
 * Priority: HIGH — Axis documents a third-party live-stream integration path.
 */
export const axisProvider: BodyCameraProvider = new PendingVendorAuthorizationProvider(
  "axis",
  "Axis Body Worn System",
  "https://www.axis.com/developer-community/body-worn-live-sdk",
  {
    manufacturer: "axis",
    liveVideoSupported: true,
    liveAudioSupported: true,
    gpsSupported: true,
    remoteStreamActivationSupported: false,
    supportedMediaProtocols: ["hls", "rtsp"],
    streamAuthMechanism: "api-key",
    manufacturerLicensingRequired: true,
    maxConcurrentViewers: 0,
    audioCodecs: ["G.711", "G.726"],
    videoCodecs: ["H.264", "H.265"],
    thirdPartyIntegrationAuthorized: false,
  },
);

/**
 * ZEPCAM
 * Integration approach: Generic API and RTSP stream integration
 * Status: PENDING_VENDOR_AUTHORIZATION — ZEPCAM documents third-party paths.
 * Priority: HIGH — ZEPCAM documents open API and RTSP access.
 */
export const zepcamProvider: BodyCameraProvider = new PendingVendorAuthorizationProvider(
  "zepcam",
  "ZEPCAM Body Worn Camera",
  "https://www.zepcam.com/technology/",
  {
    manufacturer: "zepcam",
    liveVideoSupported: true,
    liveAudioSupported: true,
    gpsSupported: true,
    remoteStreamActivationSupported: false,
    supportedMediaProtocols: ["rtsp", "hls"],
    streamAuthMechanism: "api-key",
    manufacturerLicensingRequired: true,
    maxConcurrentViewers: 0,
    audioCodecs: ["AAC"],
    videoCodecs: ["H.264"],
    thirdPartyIntegrationAuthorized: false,
  },
);

/**
 * Generic RTSP-compatible
 * For agencies with any body camera or IP camera that exposes an authorized RTSP stream.
 * Status: Configuration required (RTSP URL + credentials from agency).
 */
export const rtspProvider: BodyCameraProvider = new PendingVendorAuthorizationProvider(
  "rtsp",
  "Generic Authorized RTSP System",
  null,
  {
    manufacturer: "rtsp",
    liveVideoSupported: true,
    liveAudioSupported: true,
    gpsSupported: false,
    remoteStreamActivationSupported: false,
    supportedMediaProtocols: ["rtsp", "hls"],
    streamAuthMechanism: "open",
    manufacturerLicensingRequired: false,
    maxConcurrentViewers: 0,
    audioCodecs: ["AAC", "G.711"],
    videoCodecs: ["H.264", "H.265"],
    thirdPartyIntegrationAuthorized: false,
  },
);

/**
 * Generic WebRTC-compatible
 * For agencies with body camera solutions that support WebRTC or KVS-compatible push.
 */
export const webrtcProvider: BodyCameraProvider = new PendingVendorAuthorizationProvider(
  "webrtc",
  "Generic Authorized WebRTC System",
  null,
  {
    manufacturer: "webrtc",
    liveVideoSupported: true,
    liveAudioSupported: true,
    gpsSupported: false,
    remoteStreamActivationSupported: false,
    supportedMediaProtocols: ["kvs-webrtc", "webrtc-vendor"],
    streamAuthMechanism: "open",
    manufacturerLicensingRequired: false,
    maxConcurrentViewers: 0,
    audioCodecs: ["OPUS"],
    videoCodecs: ["H.264", "VP8"],
    thirdPartyIntegrationAuthorized: false,
  },
);
