import SwiftUI

struct NFCWriterView: View {
    let code: QRNFCCode
    let agencyId: String
    let batchMode: Bool
    var logWrite: Bool = true

    @StateObject private var writer = NFCTagWriter()
    @Environment(\.dismiss) private var dismiss

    private var reportURL: URL? { URL(string: code.url) }

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()

            VStack(spacing: 0) {
                VStack(spacing: 6) {
                    Text(code.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(RCTheme.textPrimary)
                        .multilineTextAlignment(.center)
                    if let zone = code.zone {
                        Text(zone + (code.zoneCode.map { " · \($0)" } ?? ""))
                            .font(.system(size: 12))
                            .foregroundColor(RCTheme.textMuted)
                    }
                }
                .padding(.top, 40)
                .padding(.horizontal, 24)

                Spacer()
                stateView
                    .animation(.easeInOut(duration: 0.3), value: writer.state)
                Spacer()

                if batchMode && writer.tagsWritten > 0 {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(RCTheme.success)
                        Text("\(writer.tagsWritten) tag\(writer.tagsWritten == 1 ? "" : "s") written this session")
                            .font(.system(size: 13))
                            .foregroundColor(RCTheme.textSecondary)
                    }
                    .padding(.bottom, 8)
                }

                Text(code.url)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(RCTheme.textMuted)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 24)

                actionButton
                    .padding(.horizontal, 24)
                    .padding(.bottom, 40)
            }
        }
        // Core NFC's system sheet fails to attach if begin() runs during the SwiftUI sheet animation.
        .task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            startWriting()
        }
    }

    @ViewBuilder
    private var stateView: some View {
        switch writer.state {
        case .idle, .scanning:
            scanningView
        case .writing:
            writingView
        case .success(let bytes):
            successView(bytes: bytes)
        case .failure(let msg):
            failureView(message: msg)
        }
    }

    private var scanningView: some View {
        VStack(spacing: 20) {
            ZStack {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .stroke(RCTheme.accentLight.opacity(0.3 - Double(i) * 0.08), lineWidth: 1.5)
                        .frame(width: CGFloat(80 + i * 28), height: CGFloat(80 + i * 28))
                        .scaleEffect(writer.state == .scanning ? 1 : 0.7)
                        .animation(
                            .easeInOut(duration: 1.4).repeatForever(autoreverses: true).delay(Double(i) * 0.2),
                            value: writer.state == .scanning
                        )
                }
                Image(systemName: "wave.3.right")
                    .font(.system(size: 30))
                    .foregroundColor(RCTheme.accentLight)
            }
            .frame(width: 160, height: 160)

            Text("Hold to NFC tag")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(RCTheme.textPrimary)

            Text("Rest the top of your iPhone against the sticker and hold still. The system Ready to Scan sheet must be visible.")
                .font(.system(size: 13))
                .foregroundColor(RCTheme.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }

    private var writingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(1.5)
                .tint(RCTheme.accentLight)

            Text("Writing…")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(RCTheme.textPrimary)

            Text("Keep tag in contact until complete.")
                .font(.system(size: 13))
                .foregroundColor(RCTheme.textMuted)
        }
    }

    private func successView(bytes: Int) -> some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color(hex: "#0A2A1A"))
                    .frame(width: 80, height: 80)
                Image(systemName: "checkmark")
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundColor(RCTheme.success)
            }

            Text("Tag written")
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(RCTheme.textPrimary)

            Text("\(bytes) bytes · NTAG213 programmed.")
                .font(.system(size: 13))
                .foregroundColor(RCTheme.textMuted)

            if batchMode {
                Text("Ready for next tag")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(RCTheme.accentLight)
            }
        }
    }

    private func failureView(message: String) -> some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color(hex: "#2A0808"))
                    .frame(width: 80, height: 80)
                Image(systemName: "xmark")
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundColor(RCTheme.danger)
            }

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
                if batchMode {
                    Button { startWriting() } label: {
                        Text("Write another tag")
                            .font(.system(size: 15, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(RCTheme.accent)
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                Button { dismiss() } label: {
                    Text("Done")
                        .font(.system(size: 15))
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(RCTheme.surface1)
                        .foregroundColor(RCTheme.textSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(RCTheme.border, lineWidth: 0.5))
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
        guard let url = reportURL else {
            writer.reportFailure("This code has no NFC URL, so the writer cannot start. Close and open the code again.")
            return
        }
        writer.beginWriting(url: url, batch: batchMode) { result in
            guard logWrite, case .success(let bytes) = result else { return }
            Task {
                try? await RCAPIClient.shared.recordNFCWrite(
                    agencyId: agencyId,
                    qrId: code.qrId,
                    bytesWritten: bytes
                )
            }
        }
    }
}
