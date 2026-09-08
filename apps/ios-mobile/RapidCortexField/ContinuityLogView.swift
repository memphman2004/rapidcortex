import SwiftUI

struct ContinuityLogView: View {
    @State private var entries: [FieldContinuityEntry] = []
    @State private var error: String?
    @State private var showNew = false
    @EnvironmentObject var auth: CognitoAuthManager

    var body: some View {
        NavigationStack {
            ZStack {
                RCTheme.bg.ignoresSafeArea()
                if entries.isEmpty && error == nil {
                    Text("No continuity log entries yet.")
                        .font(.system(size: 14))
                        .foregroundColor(RCTheme.textMuted)
                } else {
                    List {
                        if let error {
                            Text(error).foregroundColor(RCTheme.danger)
                                .listRowBackground(RCTheme.surface1)
                        }
                        ForEach(entries) { entry in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(entry.category.uppercased())
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundColor(entry.critical ? RCTheme.danger : RCTheme.accentLight)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background((entry.critical ? RCTheme.danger : RCTheme.accentLight).opacity(0.12))
                                        .clipShape(Capsule())
                                    Spacer()
                                    Text(RCFormat.relative(entry.createdAt) ?? entry.createdAt)
                                        .font(.system(size: 11))
                                        .foregroundColor(RCTheme.textMuted)
                                }
                                Text(entry.text)
                                    .font(.system(size: 14))
                                    .foregroundColor(RCTheme.textPrimary)
                            }
                            .listRowBackground(RCTheme.surface1)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Continuity log")
            .toolbar {
                if auth.claims?.canActInDispatch911 == true {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            showNew = true
                        } label: {
                            Image(systemName: "plus")
                        }
                    }
                }
            }
            .task { await load() }
            .refreshable { await load() }
            .sheet(isPresented: $showNew) {
                NewLogEntryView {
                    await load()
                }
            }
        }
    }

    private func load() async {
        do {
            entries = try await RCAPIClient.shared.fieldCommandContinuityLog()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct NewLogEntryView: View {
    var onSaved: () async -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var category = "ops"
    @State private var text = ""
    @State private var critical = false
    @State private var saving = false
    @State private var error: String?

    private let categories = ["ops", "staffing", "equipment", "incident", "other"]

    var body: some View {
        NavigationStack {
            ZStack {
                RCTheme.bg.ignoresSafeArea()
                Form {
                    Section("Category") {
                        Picker("Category", selection: $category) {
                            ForEach(categories, id: \.self) { Text($0.capitalized).tag($0) }
                        }
                    }
                    Section("Entry") {
                        TextEditor(text: $text).frame(minHeight: 100)
                    }
                    Section {
                        Toggle("Critical flag", isOn: $critical)
                    }
                    if let error {
                        Section { Text(error).foregroundColor(RCTheme.danger) }
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("New log entry")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save") { Task { await save() } }
                        .disabled(saving || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
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
            try await RCAPIClient.shared.fieldCommandAddContinuityLog(
                category: category,
                text: text.trimmingCharacters(in: .whitespacesAndNewlines),
                critical: critical
            )
            await onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
