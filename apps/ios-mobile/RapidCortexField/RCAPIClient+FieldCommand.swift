import Foundation

struct FieldCommandHome: Decodable {
    let stats: FieldCommandStats
    let assistRequests: [FieldCommandIncident]
    let incidents: [FieldCommandIncident]
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
        var path = "/api/field/command/home"
        if !agencyId.isEmpty {
            let encoded = agencyId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? agencyId
            path += "?agencyId=\(encoded)"
        }
        return try await getFieldCommand(path: path)
    }

    func fieldCommandIncident(id: String) async throws -> FieldCommandIncident {
        let envelope: FieldIncidentEnvelope = try await getFieldCommand(path: "/api/field/command/incidents/\(id)")
        return envelope.incident
    }

    func fieldCommandTranscript(incidentId: String) async throws -> [FieldTranscriptTurn] {
        let envelope: FieldListEnvelope<FieldTranscriptTurn> = try await getFieldCommand(
            path: "/api/field/command/incidents/\(incidentId)/transcript"
        )
        return envelope.items
    }

    func fieldCommandMessage(incidentId: String, text: String) async throws {
        let _: FieldOkResponse = try await post(
            path: "/api/field/command/incidents/\(incidentId)/message",
            body: ["text": text]
        )
    }

    func fieldCommandQaFlag(incidentId: String) async throws {
        let _: FieldOkResponse = try await post(
            path: "/api/field/command/incidents/\(incidentId)/qa-flag",
            body: EmptyBody()
        )
    }

    func fieldCommandFollow(incidentId: String) async throws {
        let _: FieldOkResponse = try await post(
            path: "/api/field/command/incidents/\(incidentId)/follow",
            body: EmptyBody()
        )
    }

    func fieldCommandCoachingNote(_ body: FieldCoachingNoteBody) async throws {
        let _: FieldOkResponse = try await post(path: "/api/field/command/coaching-notes", body: body)
    }

    func fieldCommandStaff() async throws -> [FieldStaffMember] {
        let envelope: FieldListEnvelope<FieldStaffMember> = try await getFieldCommand(path: "/api/field/command/staff")
        return envelope.items
    }

    func fieldCommandContinuityLog() async throws -> [FieldContinuityEntry] {
        let envelope: FieldListEnvelope<FieldContinuityEntry> = try await getFieldCommand(
            path: "/api/field/command/continuity-log"
        )
        return envelope.items
    }

    func fieldCommandAddContinuityLog(category: String, text: String, critical: Bool) async throws {
        let _: FieldOkResponse = try await post(
            path: "/api/field/command/continuity-log",
            body: FieldContinuityBody(category: category, text: text, critical: critical)
        )
    }

    private func getFieldCommand<T: Decodable>(path: String) async throws -> T {
        do {
            return try await get(path: path)
        } catch RCAPIError.notFound {
            throw RCAPIError.serverError(
                404,
                "Operational dashboard APIs are not on this environment yet. Deploy AppSamFieldStack, then sign in again."
            )
        }
    }
}

private struct FieldIncidentEnvelope: Decodable {
    let incident: FieldCommandIncident
}

private struct FieldListEnvelope<T: Decodable>: Decodable {
    let items: [T]
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
