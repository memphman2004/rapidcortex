import {
  canCreateQrNfcCodes,
  canDeactivateQrNfcCodes,
  canDownloadQrNfcCodes,
  canViewQrNfcCodes,
} from "rapid-cortex-security";
import type { UserContext } from "rapid-cortex-shared/types";

export function qrCodePermissions(user: UserContext, agencyId: string) {
  return {
    canCreate: canCreateQrNfcCodes(user, agencyId),
    canView: canViewQrNfcCodes(user, agencyId),
    canDownload: canDownloadQrNfcCodes(user, agencyId),
    canDeactivate: canDeactivateQrNfcCodes(user, agencyId),
  };
}
