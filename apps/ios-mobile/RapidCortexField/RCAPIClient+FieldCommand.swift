import Foundation

struct FieldCommandHome: Decodable {
    let stats: FieldCommandStats
    let assistRequests: [FieldCommandIncident]
    let incidents: [FieldCommandIncident]

    init(
        stats: FieldCommandStats,
        assistRequests: [FieldCommandIncident],
        incidents: [FieldCommandIncident]
    ) {
        self.stats = stats
        self.assistRequests = assistRequests
        self.incidents = incidents
    }
}

struct FieldCommandStats: Decodable {
    let activeCalls: Int
    let queue: Int
    let onlineCount: Int

    init(activeCalls: Int = 0, queue: Int = 0, onlineCount: Int = 0) {
        self.activeCalls = activeCalls
        self.queue = queue
        self.onlineCount = onlineCount
    }
}

struct FieldCommandIncident: Identifiable, Decodable, Hashable {
    var id: String { incidentId }
    let incidentId: String
    let title: String
    let status: String
    let urgency: String
    let category: String?
    let summary: String?
    let escalationFlag: Bool?
    let createdAt: String?
    let updatedAt: String?
    let location: String?

    init(
        incidentId: String,
        title: String,
        status: String,
        urgency: String,
        category: String? = nil,
        summary: String? = nil,
        escalationFlag: Bool? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        location: String? = nil
    ) {
        self.incidentId = incidentId
        self.title = title
        self.status = status
        self.urgency = urgency
        self.category = category
        self.summary = summary
        self.escalationFlag = escalationFlag
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.location = location
    }
}

struct FieldTranscriptTurn: Identifiable, Decodable, Hashable {
    var id: Int { sequence }
    let sequence: Int
    let speaker: String
    let text: String
    let timestamp: String?
}

struct FieldStaffMember: Identifiable, Decodable, Hashable {
    var id: String { userId }
    let userId: String
    let displayName: String
    let role: String
    let position: String?
    let status: String
}

struct FieldContinuityEntry: Identifiable, Decodable, Hashable {
    var id: String { entryId }
    let entryId: String
    let category: String
    let text: String
    let critical: Bool
    let createdAt: String
    let actorId: String?
}

struct FieldOkResponse: Decodable {
    let ok: Bool?
}

extension RCAPIClient {
    func fieldCommandHome(agencyId: String) async throws -> FieldCommandHome {
        let tenant = RCConfig.resolvedAgencyId(selected: agencyId, jwt: CognitoAuthManager.shared.claims?.agencyId)
        do {
            var path = "/api/field/command/home"
            if RCConfig.isTenantAgencyId(tenant) {
                let encoded = tenant.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? tenant
                path += "?agencyId=\(encoded)"
            }
            return try await get(path: path)
        } catch {
            guard Self.isMissingRoute(error) else { throw error }
            return try await liveIncidentHome(agencyId: tenant)
        }
    }

    func fieldCommandIncident(id: String) async throws -> FieldCommandIncident {
        let encoded = Self.pathId(id)
        do {
            let envelope: FieldIncidentEnvelope = try await get(path: "/api/field/command/incidents/\(encoded)")
            return envelope.incident
        } catch {
            guard Self.isMissingRoute(error) else { throw error }
            let dto: LiveIncidentDTO = try await get(path: "/api/incidents/\(encoded)")
            return dto.asFieldCommandIncident()
        }
    }

    func fieldCommandTranscript(incidentId: String) async throws -> [FieldTranscriptTurn] {
        let encoded = Self.pathId(incidentId)
        do {
            let envelope: FieldListEnvelope<FieldTranscriptTurn> = try await get(
                path: "/api/field/command/incidents/\(encoded)/transcript"
            )
            return envelope.items
        } catch {
            guard Self.isMissingRoute(error) else { throw error }
            do {
                let envelope: FieldListEnvelope<LiveTranscriptSegmentDTO> = try await get(
                    path: "/api/incidents/\(encoded)/transcripts"
                )
                return envelope.items.enumerated().map { $0.element.asTurn(fallbackIndex: $0.offset) }
            } catch {
                if Self.isMissingRoute(error) { return [] }
                throw error
            }
        }
    }

    func fieldCommandMessage(incidentId: String, text: String) async throws {
        try await fieldWrite {
            let _: FieldOkResponse = try await post(
                path: "/api/field/command/incidents/\(Self.pathId(incidentId))/message",
                body: ["text": text]
            )
        }
    }

    func fieldCommandQaFlag(incidentId: String) async throws {
        try await fieldWrite {
            let _: FieldOkResponse = try await post(
                path: "/api/field/command/incidents/\(Self.pathId(incidentId))/qa-flag",
                body: EmptyBody()
            )
        }
    }

    func fieldCommandFollow(incidentId: String) async throws {
        try await fieldWrite {
            let _: FieldOkResponse = try await post(
                path: "/api/field/command/incidents/\(Self.pathId(incidentId))/follow",
                body: EmptyBody()
            )
        }
    }

    func fieldCommandCoachingNote(_ body: FieldCoachingNoteBody) async throws {
        try await fieldWrite {
            let _: FieldOkResponse = try await post(path: "/api/field/command/coaching-notes", body: body)
        }
    }

    func fieldCommandStaff() async throws -> [FieldStaffMember] {
        do {
            let envelope: FieldListEnvelope<FieldStaffMember> = try await get(path: "/api/field/command/staff")
            return envelope.items
        } catch {
            if Self.isMissingRoute(error) { return [] }
            throw error
        }
    }

    func fieldCommandContinuityLog() async throws -> [FieldContinuityEntry] {
        do {
            let envelope: FieldListEnvelope<FieldContinuityEntry> = try await get(
                path: "/api/field/command/continuity-log"
            )
            return envelope.items
        } catch {
            if Self.isMissingRoute(error) { return [] }
            throw error
        }
    }

    func fieldCommandAddContinuityLog(category: String, text: String, critical: Bool) async throws {
        try await fieldWrite {
            let _: FieldOkResponse = try await post(
                path: "/api/field/command/continuity-log",
                body: FieldContinuityBody(category: category, text: text, critical: critical)
            )
        }
    }

    private func liveIncidentHome(agencyId: String) async throws -> FieldCommandHome {
        var path = "/api/incidents"
        if RCConfig.isTenantAgencyId(agencyId) {
            let encoded = agencyId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? agencyId
            path += "?agencyId=\(encoded)"
        }
        let envelope: LiveIncidentListEnvelope = try await get(path: path)
        let open = envelope.items
            .map { $0.asFieldCommandIncident() }
            .filter { Self.isOpenIncident($0.status) }
            .sorted(by: Self.rankIncidents)
        let assist = open.filter { $0.escalationFlag == true }
        return FieldCommandHome(
            stats: FieldCommandStats(
                activeCalls: open.count,
                queue: open.count,
                onlineCount: 0
            ),
            assistRequests: assist,
            incidents: open
        )
    }

    private func fieldWrite(_ work: () async throws -> Void) async throws {
        do {
            try await work()
        } catch {
            throw Self.remapWriteError(error)
        }
    }

    private static func isMissingRoute(_ error: Error) -> Bool {
        guard let api = error as? RCAPIError else { return false }
        switch api {
        case .notFound:
            return true
        case .serverError(let code, _):
            return code == 404
        default:
            return false
        }
    }

    private static func remapWriteError(_ error: Error) -> Error {
        if isMissingRoute(error) {
            return RCAPIError.serverError(
                404,
                "This action isn’t available in this release."
            )
        }
        return error
    }

    private static func pathId(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }

    private static func isOpenIncident(_ status: String) -> Bool {
        let s = status.lowercased()
        return s == "active" || s == "in_progress"
    }

    private static func rankIncidents(_ a: FieldCommandIncident, _ b: FieldCommandIncident) -> Bool {
        let ra = urgencyRank(a.urgency)
        let rb = urgencyRank(b.urgency)
        if ra != rb { return ra < rb }
        return (b.updatedAt ?? "") < (a.updatedAt ?? "")
    }

    private static func urgencyRank(_ urgency: String) -> Int {
        switch urgency.lowercased() {
        case "critical": return 0
        case "high": return 1
        case "moderate": return 2
        default: return 3
        }
    }
}

private struct FieldIncidentEnvelope: Decodable {
    let incident: FieldCommandIncident
}

private struct FieldListEnvelope<T: Decodable>: Decodable {
    let items: [T]
}

private struct LiveIncidentListEnvelope: Decodable {
    let items: [LiveIncidentDTO]

    enum CodingKeys: String, CodingKey { case items }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        items = try c.decodeIfPresent([LiveIncidentDTO].self, forKey: .items) ?? []
    }
}

private struct LiveIncidentDTO: Decodable {
    let incidentId: String
    let title: String
    let status: String
    let urgency: String
    let category: String?
    let summary: String?
    let escalationFlag: Bool?
    let createdAt: String?
    let updatedAt: String?
    let callerAddressLine: String?
    let cadLocation: String?

    enum CodingKeys: String, CodingKey {
        case incidentId, title, status, urgency, category, summary, escalationFlag
        case createdAt, updatedAt, callerAddressLine, cadLocation
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        incidentId = try c.decode(String.self, forKey: .incidentId)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? incidentId
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "active"
        urgency = try c.decodeIfPresent(String.self, forKey: .urgency) ?? "moderate"
        category = try c.decodeIfPresent(String.self, forKey: .category)
        summary = try c.decodeIfPresent(String.self, forKey: .summary)
        escalationFlag = try c.decodeIfPresent(Bool.self, forKey: .escalationFlag)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
        callerAddressLine = try c.decodeIfPresent(String.self, forKey: .callerAddressLine)
        cadLocation = try c.decodeIfPresent(String.self, forKey: .cadLocation)
    }

    func asFieldCommandIncident() -> FieldCommandIncident {
        let loc = callerAddressLine?.trimmingCharacters(in: .whitespacesAndNewlines)
        let cad = cadLocation?.trimmingCharacters(in: .whitespacesAndNewlines)
        return FieldCommandIncident(
            incidentId: incidentId,
            title: title,
            status: status,
            urgency: urgency,
            category: category,
            summary: summary,
            escalationFlag: escalationFlag,
            createdAt: createdAt,
            updatedAt: updatedAt,
            location: (loc?.isEmpty == false ? loc : nil) ?? (cad?.isEmpty == false ? cad : nil)
        )
    }
}

private struct LiveTranscriptSegmentDTO: Decodable {
    let segmentIndex: Int?
    let speaker: String?
    let text: String?
    let originalTranscript: String?
    let timestamp: String?

    func asTurn(fallbackIndex: Int) -> FieldTranscriptTurn {
        let rawSpeaker = (speaker ?? "system").lowercased()
        let mapped: String
        if rawSpeaker == "caller" {
            mapped = "caller"
        } else if rawSpeaker == "dispatcher" {
            mapped = "dispatcher"
        } else {
            mapped = "rc_ai"
        }
        let body = originalTranscript?.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return FieldTranscriptTurn(
            sequence: segmentIndex ?? fallbackIndex,
            speaker: mapped,
            text: (body?.isEmpty == false ? body : nil) ?? fallback,
            timestamp: timestamp
        )
    }
}

private struct EmptyBody: Encodable {}

struct FieldCoachingNoteBody: Encodable {
    let incidentId: String?
    let dispatcherUserId: String
    let category: String
    let observation: String
    let discussInNextReview: Bool
    let addToQaQueue: Bool
    let positiveRecognition: Bool
}

private struct FieldContinuityBody: Encodable {
    let category: String
    let text: String
    let critical: Bool
}
