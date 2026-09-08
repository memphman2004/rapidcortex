import Foundation

extension RCAPIClient {
    func submitAccessRequest(request: AccessRequest) async throws {
        let _: AccessRequestResponse = try await post(path: "/api/access-requests", body: request)
    }
}

struct AccessRequest: Encodable {
    let requestedWorkspace: String
    let requestedWorkspaceTitle: String
    let agencyId: String
    let userEmail: String
    let reason: String
}

struct AccessRequestResponse: Decodable {
    let requestId: String?
    let status: String?
    let agencyId: String?
}

// MARK: - Role → destination (lockstep with RCRouter / packages/shared field workspaces)
//
// Destination is derived from JWT only. `director` is not a Rapid Cortex role.
// Leftover `commsupervisor` JWT values canonicalize to supervisor.
//
// Role                  Destination
// ─────────────────────────────────────────────────────────────────
// campus_* / venue_* / transit_*     QR & NFC
// supervisor / dispatcher / analyst
//   / auditor / agencyit             Operational dashboard
// agencyadmin                        From custom:agencyVertical
//                                    (campus/venue → QR; 911 → dashboard;
//                                     missing → QR)
// rcsuperadmin / rcadmin / rcitadmin Agency selector (names only)
// unknown                            No access
