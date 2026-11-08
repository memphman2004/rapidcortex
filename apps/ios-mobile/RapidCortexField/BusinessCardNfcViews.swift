import SwiftUI

@MainActor
final class BusinessCardNfcListViewModel: ObservableObject {
    @Published private(set) var cards: [BusinessCardNfcCard] = []
    @Published private(set) var namesByProfile: [String: String] = [:]
    @Published private(set) var isLoading = false
    @Published var error: String?

    private let api = RCAPIClient.shared

    var writableCards: [BusinessCardNfcCard] {
        cards.filter { !$0.isRevoked }
    }

    func ownerName(for card: BusinessCardNfcCard) -> String {
        if let profileId = card.assignedProfileId,
           let name = namesByProfile[profileId],
           !name.isEmpty {
            return name
        }
        return "Unassigned"
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            cards = try await api.listBusinessCardNfcCards()
        } catch {
            self.error = error.localizedDescription
            return
        }
        if let people = try? await api.listBusinessCardProfiles() {
            var map: [String: String] = [:]
            for profile in people {
                map[profile.profileId] = profile.displayName
            }
            namesByProfile = map
        } else {
            namesByProfile = [:]
        }
    }
}

struct BusinessCardNfcListView: View {
    @StateObject private var vm = BusinessCardNfcListViewModel()
    @State private var selectedCard: BusinessCardNfcCard?

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                Text("Pick an assigned NTAG, then write its permanent /c/… URL. Do not write the public /card/… profile link.")
                    .font(.system(size: 13))
                    .foregroundColor(RCTheme.textSecondary)
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
                    .padding(.bottom, 12)

                if let error = vm.error, vm.writableCards.isEmpty {
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundColor(RCTheme.danger)
                        .padding(.horizontal, 20)
                    Spacer()
                } else if vm.isLoading && vm.writableCards.isEmpty {
                    ProgressView()
                        .tint(RCTheme.amber)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if vm.writableCards.isEmpty {
                    Text("No NFC cards yet. Create and assign tags in RC Admin → NFC Card Management.")
                        .font(.system(size: 14))
                        .foregroundColor(RCTheme.textSecondary)
                        .padding(.horizontal, 20)
                    Spacer()
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(vm.writableCards) { card in
                                Button {
                                    selectedCard = card
                                } label: {
                                    cardRow(card)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 32)
                    }
                    .refreshable { await vm.load() }
                }
            }
        }
        .navigationTitle("Business Card NFC")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load() }
        .sheet(item: $selectedCard, onDismiss: {
            Task { await vm.load() }
        }) { card in
            BusinessCardNfcWriteView(card: card, ownerName: vm.ownerName(for: card))
        }
    }

    private func cardRow(_ card: BusinessCardNfcCard) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(vm.ownerName(for: card))
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(RCTheme.textPrimary)
                    .lineLimit(1)
                Spacer()
                RCBadge(label: card.status, tone: statusTone(card.status))
            }
            Text("\(card.tagType) · \(card.shortId)")
                .font(.system(size: 12))
                .foregroundColor(RCTheme.textSecondary)
            Text(card.permanentUrl)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(RCTheme.amber)
                .lineLimit(2)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RCTheme.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(RCTheme.border, lineWidth: 1)
        )
        .accessibilityLabel("Program NFC for \(vm.ownerName(for: card))")
    }

    private func statusTone(_ status: String) -> RCBadgeTone {
        switch status {
        case "programmed", "verified": return .success
        case "assigned": return .accent
        case "revoked": return .danger
        default: return .neutral
        }
    }
}

struct BusinessCardNfcWriteView: View {
    @State var card: BusinessCardNfcCard
    let ownerName: String

    @StateObject private var writer = NFCTagWriter()
    @Environment(\.dismiss) private var dismiss
    @State private var statusNote: String?
    @State private var statusNoteOk = true

    private var writeURL: URL? { URL(string: card.permanentUrl) }

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()

            VStack(spacing: 0) {
                VStack(spacing: 6) {
                    Text(ownerName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(RCTheme.textPrimary)
                        .multilineTextAlignment(.center)
                    Text("Business card NFC")
                        .font(.system(size: 12))
                        .foregroundColor(RCTheme.textMuted)
                }
                .padding(.top, 40)
                .padding(.horizontal, 24)

                Spacer()
                stateView
                    .animation(.easeInOut(duration: 0.3), value: writer.state)
                Spacer()

                if let note = statusNote {
                    Text(note)
                        .font(.system(size: 12))
                        .foregroundColor(statusNoteOk ? RCTheme.success : RCTheme.danger)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                        .padding(.bottom, 8)
                }

                Text(card.permanentUrl)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(RCTheme.textMuted)
                    .lineLimit(2)
                    .truncationMode(.middle)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 24)

                actionButton
                    .padding(.horizontal, 24)
                    .padding(.bottom, 40)
            }
        }
        .task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            startWriting()
        }
    }

    @ViewBuilder
    private var stateView: some View {
        switch writer.state {
        case .idle, .scanning:
            VStack(spacing: 20) {
                Image(systemName: "wave.3.right")
                    .font(.system(size: 36))
                    .foregroundColor(RCTheme.accentLight)
                Text("Hold to NFC tag")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(RCTheme.textPrimary)
                Text("Rest the top of your iPhone against the sticker and hold still.")
                    .font(.system(size: 13))
                    .foregroundColor(RCTheme.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
        case .writing:
            VStack(spacing: 16) {
                ProgressView()
                    .tint(RCTheme.accentLight)
                    .scaleEffect(1.5)
                Text("Writing…")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(RCTheme.textPrimary)
            }
        case .success(let bytes):
            VStack(spacing: 16) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(RCTheme.success)
                Text("Tag written")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(RCTheme.textPrimary)
                Text("\(bytes) bytes · Opens this person’s digital business card.")
                    .font(.system(size: 13))
                    .foregroundColor(RCTheme.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
        case .failure(let message):
            VStack(spacing: 16) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(RCTheme.danger)
                Text("Write failed")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(RCTheme.textPrimary)
                Text(message)
                    .font(.system(size: 13))
                    .foregroundColor(RCTheme.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
        }
    }

    @ViewBuilder
    private var actionButton: some View {
        switch writer.state {
        case .idle, .scanning, .writing:
            Button(role: .destructive) {
                writer.cancel()
                dismiss()
            } label: {
                Text("Cancel")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(RCTheme.surface1)
                    .foregroundColor(RCTheme.textMuted)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(writer.state == .writing)

        case .success:
            VStack(spacing: 10) {
                Button { startWriting() } label: {
                    Text("Write another tag")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(RCTheme.accent)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                Button { dismiss() } label: {
                    Text("Done")
                        .font(.system(size: 15))
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(RCTheme.surface1)
                        .foregroundColor(RCTheme.textSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }

        case .failure:
            VStack(spacing: 10) {
                Button { startWriting() } label: {
                    Text("Try again")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(RCTheme.accent)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                Button { dismiss() } label: {
                    Text("Cancel")
                        .font(.system(size: 15))
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(RCTheme.surface1)
                        .foregroundColor(RCTheme.textMuted)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    private func startWriting() {
        statusNote = nil
        statusNoteOk = true

        guard !card.isRevoked else {
            writer.reportFailure("This tag was revoked. Issue a new NTAG instead.")
            return
        }
        guard card.isPermanentNfcUrl, let url = writeURL else {
            writer.reportFailure("This card does not have a valid permanent /c/… URL.")
            return
        }

        writer.beginWriting(url: url, batch: false) { result in
            guard case .success = result else { return }
            Task { @MainActor in
                do {
                    let updated = try await RCAPIClient.shared.setBusinessCardNfcStatus(
                        cardId: card.cardId,
                        status: "programmed",
                        version: card.version
                    )
                    card = updated
                    statusNoteOk = true
                    statusNote = "Marked programmed in NFC Card Management."
                } catch {
                    statusNoteOk = false
                    statusNote = error.localizedDescription.isEmpty
                        ? "Tag was written, but status could not be updated. Mark programmed in RC Admin if needed."
                        : error.localizedDescription
                }
            }
        }
    }
}
