import SwiftUI

struct IncidentDetailView: View {
    let incidentId: String
    let seed: FieldCommandIncident?

    @EnvironmentObject var auth: CognitoAuthManager
    @State private var incident: FieldCommandIncident?
    @State private var turns: [FieldTranscriptTurn] = []
    @State private var error: String?
    @State private var showMessage = false
    @State private var showCoach = false
    @State private var messageText = ""
    @State private var followed = false
    @State private var banner: String?

    private var canAct: Bool { auth.claims?.canActInDispatch911 == true }

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                transcript
                if canAct { actions }
            }
        }
        .navigationTitle("Incident")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            incident = seed
            await refresh()
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                await refresh(silent: true)
            }
        }
        .sheet(isPresented: $showMessage) { messageSheet }
        .sheet(isPresented: $showCoach) {
            CoachingNoteView(incidentId: incidentId)
        }
        .alert("Notice", isPresented: Binding(
            get: { banner != nil },
            set: { if !$0 { banner = nil } }
        )) {
            Button("OK", role: .cancel) { banner = nil }
        } message: {
            Text(banner ?? "")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(incident?.title ?? incidentId)
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(RCTheme.textPrimary)
            HStack(spacing: 8) {
                if let urgency = incident?.urgency {
                    Text(urgency.uppercased())
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(RCTheme.danger)
                }
                Text(incident?.status.replacingOccurrences(of: "_", with: " ") ?? "")
                    .font(.system(size: 12))
                    .foregroundColor(RCTheme.textSecondary)
            }
            if let location = incident?.location, !location.isEmpty {
                Text(location)
                    .font(.system(size: 13))
                    .foregroundColor(RCTheme.textSecondary)
            }
            Text("No dispatch or CAD controls in this view.")
                .font(.system(size: 11))
                .foregroundColor(RCTheme.textMuted)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RCTheme.surface1)
    }

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    if let error {
                        Text(error).font(.system(size: 13)).foregroundColor(RCTheme.danger)
                    }
                    if turns.isEmpty {
                        Text("Waiting for transcript…")
                            .font(.system(size: 13))
                            .foregroundColor(RCTheme.textMuted)
                            .padding(.top, 24)
                    }
                    ForEach(turns) { turn in
                        transcriptBubble(turn)
                            .id(turn.sequence)
                    }
                }
                .padding(16)
            }
            .onChange(of: turns.count) { _ in
                if let last = turns.last {
                    withAnimation { proxy.scrollTo(last.sequence, anchor: .bottom) }
                }
            }
        }
    }

    private func transcriptBubble(_ turn: FieldTranscriptTurn) -> some View {
        let speaker = turn.speaker.lowercased()
        let label: String
        let alignment: HorizontalAlignment
        let bg: Color
        let fg: Color
        switch speaker {
        case "caller":
            label = "Caller"
            alignment = .leading
            bg = RCTheme.surface2
            fg = RCTheme.textPrimary
        case "dispatcher":
            label = "Dispatcher"
            alignment = .trailing
            bg = Color(hex: "#1A2A50")
            fg = Color(hex: "#5B8AFF")
        default:
            label = "RC AI"
            alignment = .leading
            bg = Color(hex: "#1A1408")
            fg = RCTheme.amber
        }
        return VStack(alignment: alignment, spacing: 4) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(RCTheme.textMuted)
            Text(turn.text)
                .font(.system(size: 14))
                .foregroundColor(fg)
                .padding(10)
                .background(bg)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .frame(maxWidth: .infinity, alignment: alignment == .trailing ? .trailing : .leading)
    }

    private var actions: some View {
        HStack(spacing: 8) {
            actionButton("Message", icon: "message") { showMessage = true }
            actionButton("Coach", icon: "text.bubble") { showCoach = true }
            actionButton("Flag QA", icon: "flag") {
                Task { await flagQa() }
            }
            actionButton(followed ? "Following" : "Follow", icon: followed ? "star.fill" : "star") {
                Task { await follow() }
            }
        }
        .padding(12)
        .background(RCTheme.surface1)
    }

    private func actionButton(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundColor(RCTheme.textPrimary)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(RCTheme.surface2)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    private var messageSheet: some View {
        NavigationStack {
            ZStack {
                RCTheme.bg.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 12) {
                    Text("Sends to the dispatcher’s workstation. Does not dispatch units or write to CAD.")
                        .font(.system(size: 13))
                        .foregroundColor(RCTheme.textSecondary)
                    TextEditor(text: $messageText)
                        .font(.system(size: 15))
                        .foregroundColor(RCTheme.textPrimary)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 120)
                        .padding(8)
                        .background(RCTheme.surface1)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    Spacer()
                }
                .padding(16)
            }
            .navigationTitle("Message")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showMessage = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
                        Task { await sendMessage() }
                    }
                    .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func refresh(silent: Bool = false) async {
        do {
            async let header = RCAPIClient.shared.fieldCommandIncident(id: incidentId)
            async let transcript = RCAPIClient.shared.fieldCommandTranscript(incidentId: incidentId)
            incident = try await header
            turns = try await transcript
            error = nil
        } catch {
            if !silent { self.error = error.localizedDescription }
        }
    }

    private func sendMessage() async {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        do {
            try await RCAPIClient.shared.fieldCommandMessage(incidentId: incidentId, text: text)
            messageText = ""
            showMessage = false
            banner = "Message sent to the dispatcher workstation."
        } catch {
            banner = error.localizedDescription
        }
    }

    private func flagQa() async {
        do {
            try await RCAPIClient.shared.fieldCommandQaFlag(incidentId: incidentId)
            banner = "Flagged for QA review."
        } catch {
            banner = error.localizedDescription
        }
    }

    private func follow() async {
        do {
            try await RCAPIClient.shared.fieldCommandFollow(incidentId: incidentId)
            followed = true
        } catch {
            banner = error.localizedDescription
        }
    }
}

struct CoachingNoteView: View {
    let incidentId: String
    @Environment(\.dismiss) private var dismiss
    @State private var category = "call_control"
    @State private var observation = ""
    @State private var discuss = false
    @State private var qaQueue = false
    @State private var positive = false
    @State private var saving = false
    @State private var error: String?

    private let categories: [(id: String, label: String)] = [
        ("call_control", "Call control"),
        ("questioning", "Questioning"),
        ("de_escalation", "De-escalation"),
        ("protocol", "Protocol"),
        ("communication", "Communication"),
        ("positive", "Positive"),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                RCTheme.bg.ignoresSafeArea()
                Form {
                    Section("Category") {
                        Picker("Category", selection: $category) {
                            ForEach(categories, id: \.id) { item in
                                Text(item.label).tag(item.id)
                            }
                        }
                    }
                    Section("Observation") {
                        TextEditor(text: $observation)
                            .frame(minHeight: 100)
                    }
                    Section {
                        Toggle("Discuss in next review", isOn: $discuss)
                        Toggle("Add to QA queue", isOn: $qaQueue)
                        Toggle("Positive recognition", isOn: $positive)
                    }
                    if let error {
                        Section { Text(error).foregroundColor(RCTheme.danger) }
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Coaching note")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save") {
                        Task { await save() }
                    }
                    .disabled(saving || observation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func save() async {
        saving = true
        error = nil
        defer { saving = false }
        do {
            try await RCAPIClient.shared.fieldCommandCoachingNote(
                FieldCoachingNoteBody(
                    incidentId: incidentId,
                    dispatcherUserId: "",
                    category: category,
                    observation: observation.trimmingCharacters(in: .whitespacesAndNewlines),
                    discussInNextReview: discuss,
                    addToQaQueue: qaQueue,
                    positiveRecognition: positive
                )
            )
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
