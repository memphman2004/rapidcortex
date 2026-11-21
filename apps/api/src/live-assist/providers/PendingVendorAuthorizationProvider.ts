/**
 * PendingVendorAuthorizationProvider
 *
 * Base class for manufacturers that require NexCort iQ to obtain formal API
 * authorization before connectivity can be established.
 *
 * Returns "vendor_authorization_required" on every operation.
 * Does NOT invent proprietary endpoints, bypass vendor authentication,
 * scrape dashboards, or reverse-engineer protected streams.
 *
 * When vendor documentation and credentials become available, replace this
 * base class with a concrete implementation.
 */
import type {
  BodyCameraProvider,
  BodyCameraProviderIdentity,
  BodyCameraProviderHealthResult,
  BodyCameraStreamParams,
  BodyCameraStreamResult,
  BodyCameraDeviceInfo,
  BodyCameraLocationResult,
  CoachingInviteParams,
  CoachingInviteResult,
} from "./BodyCameraProvider.js";
import type { BodyCameraResult } from "./BodyCameraProvider.js";
import { bwcUnsupported } from "./BodyCameraProvider.js";
import type { BodyCameraManufacturer, BodyCameraCapabilityManifest } from "rapid-cortex-shared";

export class PendingVendorAuthorizationProvider implements BodyCameraProvider {
  readonly identity: BodyCameraProviderIdentity;

  constructor(
    manufacturer: BodyCameraManufacturer,
    displayName: string,
    documentationUrl: string | null,
    defaultCapabilities: Partial<BodyCameraCapabilityManifest>,
  ) {
    this.identity = {
      manufacturer,
      displayName,
      integrationStatus: "vendor_authorization_required",
      defaultCapabilities,
      documentationUrl,
      pendingVendorAuthorization: true,
    };
  }

  private noAuth<T>(capability: string): BodyCameraResult<T> {
    return bwcUnsupported(
      this.identity.manufacturer,
      capability,
      `${this.identity.displayName} integration requires vendor authorization. ` +
        `Contact the manufacturer to obtain API credentials and integration approval ` +
        `before this capability can be enabled.`,
      "VENDOR_AUTHORIZATION_REQUIRED",
    );
  }

  async validateConnection(_agencyId: string): Promise<BodyCameraProviderHealthResult> {
    return {
      status: "unknown",
      lastChecked: new Date().toISOString(),
      detail: `${this.identity.displayName}: Vendor API authorization required. Configure credentials in Live Assist Administration.`,
    };
  }

  async listDevices(_agencyId: string) {
    return this.noAuth<{ devices: never[] }>("listDevices");
  }

  async getDeviceStatus(_agencyId: string, _providerDeviceId: string): Promise<BodyCameraResult<{ device: BodyCameraDeviceInfo }>> {
    return this.noAuth<{ device: BodyCameraDeviceInfo }>("getDeviceStatus");
  }

  async requestStream(_params: BodyCameraStreamParams): Promise<BodyCameraResult<BodyCameraStreamResult>> {
    return this.noAuth<BodyCameraStreamResult>("requestStream");
  }

  async getLocation(_agencyId: string, _providerDeviceId: string): Promise<BodyCameraResult<BodyCameraLocationResult>> {
    return this.noAuth<BodyCameraLocationResult>("getLocation");
  }

  async inviteToCoaching(_params: CoachingInviteParams): Promise<BodyCameraResult<CoachingInviteResult>> {
    return this.noAuth<CoachingInviteResult>("inviteToCoaching");
  }

  async terminateStream(_agencyId: string, _providerDeviceId: string, _providerSessionId: string): Promise<BodyCameraResult<{ terminated: boolean }>> {
    return this.noAuth<{ terminated: boolean }>("terminateStream");
  }
}
