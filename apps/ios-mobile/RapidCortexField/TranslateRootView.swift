import SwiftUI

struct TranslateRootView: View {
    @EnvironmentObject var auth: CognitoAuthManager
    @EnvironmentObject var api: RCAPIClient
    @StateObject private var controller = TranslateSessionController()

    @State private var languages: [TranslateLanguageDTO] = [
        TranslateLanguageDTO(code: "es", label: "Spanish"),
        TranslateLanguageDTO(code: "zh-CN", label: "Mandarin (Chinese)"),
        TranslateLanguageDTO(code: "vi", label: "Vietnamese"),
        TranslateLanguageDTO(code: "ko", label: "Korean"),
        TranslateLanguageDTO(code: "ar", label: "Arabic"),
        TranslateLanguageDTO(code: "fr", label: "French"),
        TranslateLanguageDTO(code: "pt", label: "Portuguese"),
        TranslateLanguageDTO(code: "ht", label: "Haitian Creole"),
    ]
    @State private var subjectLanguage = "es"

    private var vertical: String {
        let v = auth.qrCodeVertical.lowercased()
        return v == "campus" ? "campus" : "venue"
    }

    private var staffLabel: String { "Staff" }
    private var subjectLabel: String { vertical == "campus" ? "Individual" : "Guest" }

    private var isActive: Bool {
        guard let session = controller.session else { return false }
        return session.status != "CLOSED" && session.status != "EXPIRED"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                RCTheme.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Speak to translate. Speech is sent live; the translation plays back as voice.")
                            .font(.system(size: 13))
                            .foregroundColor(RCTheme.textSecondary)

                        if !isActive {
                            startCard
                        } else if let session = controller.session {
                            activeCard(session)
                        }

                        if let errorMessage = controller.errorMessage {
                            Text(errorMessage)
                                .font(.system(size: 13))
                                .foregroundColor(RCTheme.danger)
                        }

                        Text("LIVE CAPTIONS")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(RCTheme.textMuted)
                            .tracking(0.6)

                        if controller.feed.isEmpty {
                            Text(isActive
                                 ? "Tap Staff or \(subjectLabel) and speak. Translation audio plays automatically."
                                 : "Start a session to begin speech translation.")
                                .font(.system(size: 13))
                                .foregroundColor(RCTheme.textSecondary)
                        } else {
                            ForEach(controller.feed) { seg in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text((seg.speaker == "officer" ? staffLabel : subjectLabel).uppercased()
                                         + (seg.isFinal ? "" : " · …"))
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundColor(RCTheme.amber)
                                    Text(seg.originalText)
                                        .font(.system(size: 14))
                                        .foregroundColor(RCTheme.textPrimary)
                                    if let translated = seg.translatedText, !translated.isEmpty {
                                        Text(translated)
                                            .font(.system(size: 13))
                                            .foregroundColor(RCTheme.textSecondary)
                                    }
                                    if seg.audioUrl != nil {
                                        Text("TTS played")
                                            .font(.system(size: 11))
                                            .foregroundColor(RCTheme.textMuted)
                                    }
                                }
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(RCTheme.surface1)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(RCTheme.border, lineWidth: 1)
                                )
                                .cornerRadius(10)
                            }
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Translator")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                do {
                    let list = try await api.fetchTranslateLanguages()
                    if !list.isEmpty { languages = list }
                } catch {
                    // keep fallbacks
                }
            }
            .onDisappear {
                controller.stopMic()
            }
        }
    }

    private var startCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Subject language")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(RCTheme.textMuted)
            FlexibleLanguageWrap(languages: languages, selected: $subjectLanguage)
            Button {
                Task {
                    await controller.start(
                        api: api,
                        subjectLanguage: subjectLanguage,
                        vertical: vertical,
                        agencyId: auth.operationalAgencyId
                    )
                }
            } label: {
                Text(controller.starting ? "Starting…" : "Start session")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundColor(.white)
                    .background(RCTheme.amber)
                    .cornerRadius(10)
            }
            .disabled(controller.starting)
        }
        .padding(14)
        .background(RCTheme.surface1)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(RCTheme.border, lineWidth: 1)
        )
        .cornerRadius(12)
    }

    private func activeCard(_ session: TranslateSessionDTO) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(controller.connected ? "Session live" : "Connecting…")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(RCTheme.textPrimary)
            Text("\(session.subjectLanguage.uppercased()) ↔ EN · \(session.status) · \(session.segmentCount) exchanges")
                .font(.system(size: 13))
                .foregroundColor(RCTheme.textSecondary)
            Text(controller.listening
                 ? "Listening as \(controller.speaker == "officer" ? staffLabel : subjectLabel)…"
                 : "Tap a speaker, speak, then wait for translation audio")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(controller.listening ? RCTheme.amber : RCTheme.textMuted)

            HStack(spacing: 10) {
                Button {
                    controller.startMic(as: "officer")
                } label: {
                    Text(staffLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundColor(.white)
                        .background(controller.listening && controller.speaker == "officer" ? RCTheme.danger : RCTheme.amber)
                        .cornerRadius(10)
                }
                .disabled(controller.listening)
                Button {
                    controller.startMic(as: "subject")
                } label: {
                    Text(subjectLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundColor(.white)
                        .background(controller.listening && controller.speaker == "subject" ? RCTheme.danger : RCTheme.amber)
                        .cornerRadius(10)
                }
                .disabled(controller.listening)
            }

            if controller.listening {
                Button {
                    controller.stopMic()
                } label: {
                    Text("Stop listening")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .foregroundColor(.white)
                        .background(RCTheme.danger)
                        .cornerRadius(10)
                }
            }

            HStack(spacing: 10) {
                Button {
                    Task { await controller.close(api: api, writebackNote: false) }
                } label: {
                    Text("End")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .foregroundColor(RCTheme.textPrimary)
                        .background(RCTheme.surface2)
                        .cornerRadius(10)
                }
                Button {
                    Task { await controller.close(api: api, writebackNote: true) }
                } label: {
                    Text("End + note")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .foregroundColor(.white)
                        .background(RCTheme.amber)
                        .cornerRadius(10)
                }
            }
        }
        .padding(14)
        .background(RCTheme.surface1)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(RCTheme.border, lineWidth: 1)
        )
        .cornerRadius(12)
    }
}

private struct FlexibleLanguageWrap: View {
    let languages: [TranslateLanguageDTO]
    @Binding var selected: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(chunked(languages, size: 3), id: \.first?.code) { row in
                HStack(spacing: 8) {
                    ForEach(row, id: \.code) { lang in
                        let isOn = lang.code == selected
                        Button {
                            selected = lang.code
                        } label: {
                            Text(lang.label)
                                .font(.system(size: 12, weight: isOn ? .semibold : .regular))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .foregroundColor(isOn ? RCTheme.amber : RCTheme.textPrimary)
                                .background(isOn ? RCTheme.amber.opacity(0.15) : RCTheme.surface2)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(isOn ? RCTheme.amber : RCTheme.border, lineWidth: 1)
                                )
                                .cornerRadius(8)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private func chunked<T>(_ items: [T], size: Int) -> [[T]] {
        stride(from: 0, to: items.count, by: size).map {
            Array(items[$0..<min($0 + size, items.count)])
        }
    }
}
