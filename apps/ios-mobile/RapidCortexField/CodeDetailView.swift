import SwiftUI
import UIKit
import Photos

struct CodeDetailView: View {
    let code: QRNFCCode
    let agencyId: String
    var onChanged: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var showingNFCSheet = false
    @State private var showingShareSheet = false
    @State private var showingSignPackage = false
    @State private var shareItems: [Any] = []
    @State private var copiedURL = false
    @State private var qrImage: UIImage?
    @State private var centerLogo: UIImage?
    @State private var saveMessage: String?

    private var reportURL: URL? { URL(string: code.url) }

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    identity
                    qrSection
                    actionRow
                    urlRow
                    if let sms = code.smsNumber, !sms.isEmpty {
                        smsCard(sms)
                    }
                    nfcCard
                    signReferenceRow
                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task { await rebuildQR() }
        .sheet(isPresented: $showingNFCSheet, onDismiss: { onChanged?() }) {
            NFCWriterView(code: code, agencyId: agencyId, batchMode: false)
        }
        .sheet(isPresented: $showingShareSheet) {
            ShareSheet(items: shareItems)
        }
        .sheet(isPresented: $showingSignPackage) {
            SignPackageView(code: code, qrImage: qrImage)
        }
        .alert("Photos", isPresented: Binding(
            get: { saveMessage != nil },
            set: { if !$0 { saveMessage = nil } }
        )) {
            Button("OK", role: .cancel) { saveMessage = nil }
        } message: {
            Text(saveMessage ?? "")
        }
    }

    private var header: some View {
        HStack {
            Button { dismiss() } label: {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                    Text("Back")
                }
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(RCTheme.amber)
            }
            Spacer()
            RCBadge(
                label: code.active ? "Active" : "Inactive",
                tone: code.active ? .success : .neutral,
                small: true
            )
        }
        .padding(.top, 8)
        .padding(.bottom, 16)
    }

    private var identity: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("SIGN IDENTITY")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.8)
                .foregroundColor(RCTheme.textSecondary)
            Text(code.name)
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(RCTheme.textPrimary)
            if let zone = code.zone, !zone.isEmpty {
                Text(zone)
                    .font(.system(size: 16))
                    .foregroundColor(RCTheme.textSecondary)
            }
            HStack(spacing: 8) {
                RCBadge(label: code.vertical.uppercased(), tone: .accent, small: true)
                RCBadge(label: RCFormat.reportTypeLabel(code.reportType), tone: .neutral, small: true)
            }
            .padding(.top, 6)
        }
        .padding(.bottom, 20)
    }

    private var qrSection: some View {
        VStack(spacing: 10) {
            Text("QR CODE")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.8)
                .foregroundColor(RCTheme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            Group {
                if let image = qrImage {
                    Image(uiImage: image)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .padding(16)
                } else {
                    ProgressView().tint(RCTheme.amber)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 240)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 16))

            Text("Print at minimum 2 inches for wall signs")
                .font(.system(size: 13))
                .foregroundColor(RCTheme.textSecondary)
        }
        .padding(.bottom, 16)
    }

    private var actionRow: some View {
        HStack(spacing: 8) {
            RCSecondaryButton(title: "Save to Photos", action: saveToPhotos)
            RCSecondaryButton(title: "Share", action: shareQR)
        }
        .padding(.bottom, 16)
    }

    private var urlRow: some View {
        HStack(spacing: 8) {
            Text(code.url)
                .font(.system(size: 13))
                .foregroundColor(RCTheme.textPrimary)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer()
            Button {
                UIPasteboard.general.string = code.url
                copiedURL = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { copiedURL = false }
            } label: {
                Text(copiedURL ? "Copied" : "Copy URL")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(RCTheme.amber)
            }
        }
        .padding(14)
        .background(RCTheme.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(RCTheme.border, lineWidth: 1))
        .padding(.bottom, 12)
    }

    private func smsCard(_ sms: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("SMS NUMBER")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.8)
                .foregroundColor(RCTheme.textSecondary)
            Text(RCFormat.phone(sms))
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(RCTheme.textPrimary)
            Text("Visitors text this number to report an incident. Include this on the printed sign.")
                .font(.system(size: 13))
                .foregroundColor(RCTheme.textSecondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RCTheme.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(RCTheme.border, lineWidth: 1))
        .padding(.bottom, 12)
    }

    private var nfcCard: some View {
        Button { showingNFCSheet = true } label: {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("NFC Tag")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(RCTheme.textPrimary)
                    RCBadge(
                        label: code.isNfcProgrammed ? "NFC Written" : "Not Programmed",
                        tone: code.isNfcProgrammed ? .success : .warning,
                        small: true
                    )
                }
                Spacer()
                Text("Program NFC Tag")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(RCTheme.amber)
            }
            .padding(16)
            .background(RCTheme.surface1)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(RCTheme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .padding(.bottom, 12)
    }

    private var signReferenceRow: some View {
        Button { showingSignPackage = true } label: {
            HStack {
                Text("Complete Sign Reference")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(RCTheme.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundColor(RCTheme.textSecondary)
            }
            .padding(16)
            .background(RCTheme.surface1)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(RCTheme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func saveToPhotos() {
        guard let image = qrImage else { return }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            DispatchQueue.main.async {
                guard status == .authorized || status == .limited else {
                    saveMessage = "Photos permission is required to save the QR code."
                    return
                }
                UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
                saveMessage = "Saved to Photos."
            }
        }
    }

    private func shareQR() {
        guard let url = reportURL,
              let data = QRCodeGenerator.pngData(url: url, centerLogo: centerLogo) else { return }
        let filename = QRCodeGenerator.filename(for: code)
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        try? data.write(to: tempURL)
        shareItems = [tempURL]
        showingShareSheet = true
    }

    @MainActor
    private func rebuildQR() async {
        guard let url = reportURL else { return }
        let fallback = QRCodeGenerator.fallbackLogo()
        centerLogo = QRCodeGenerator.cachedLogo(for: agencyId) ?? fallback
        qrImage = QRCodeGenerator.generate(url: url, centerLogo: centerLogo)
        do {
            let agency = try await RCAPIClient.shared.getAgency(agencyId: agencyId)
            if let remote = await QRCodeGenerator.loadRemoteLogo(from: agency.logoUrl) {
                QRCodeGenerator.storeLogo(remote, for: agencyId)
                centerLogo = remote
                qrImage = QRCodeGenerator.generate(url: url, centerLogo: remote)
            }
        } catch {}
    }
}

struct SignPackageView: View {
    let code: QRNFCCode
    var qrImage: UIImage?
    @Environment(\.dismiss) private var dismiss
    @State private var showingShareSheet = false
    @State private var shareItems: [Any] = []

    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()
            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    Button("Close") { dismiss() }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(RCTheme.printClose)
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)

                ScrollView {
                    VStack(spacing: 8) {
                        Text("\(code.vertical.uppercased()) SAFETY REPORTING")
                            .font(.system(size: 12, weight: .bold))
                            .tracking(1)
                            .foregroundColor(RCTheme.printMuted)
                            .padding(.top, 8)

                        Text(code.name)
                            .font(.system(size: 26, weight: .heavy))
                            .foregroundColor(RCTheme.printText)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 16)

                        if let zone = code.zone, !zone.isEmpty {
                            Text(zone)
                                .font(.system(size: 15))
                                .foregroundColor(RCTheme.printMuted)
                        }

                        if let image = qrImage {
                            Image(uiImage: image)
                                .interpolation(.none)
                                .resizable()
                                .scaledToFit()
                                .frame(width: 260, height: 260)
                                .padding(.top, 16)
                        }

                        Text("Print at minimum 2 inches for wall signs")
                            .font(.system(size: 13))
                            .foregroundColor(Color(hex: "#9CA3AF"))
                            .padding(.top, 8)

                        VStack(alignment: .leading, spacing: 16) {
                            Rectangle()
                                .fill(RCTheme.printRule)
                                .frame(height: 1)
                                .padding(.top, 16)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("NFC Tag")
                                    .font(.system(size: 13))
                                    .foregroundColor(RCTheme.printMuted)
                                Text(code.isNfcProgrammed ? "Programmed" : "Not Programmed")
                                    .font(.system(size: 17, weight: .semibold))
                                    .foregroundColor(RCTheme.printText)
                            }

                            if let sms = code.smsNumber, !sms.isEmpty {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("SMS Number")
                                        .font(.system(size: 13))
                                        .foregroundColor(RCTheme.printMuted)
                                    Text(RCFormat.phone(sms))
                                        .font(.system(size: 17, weight: .semibold))
                                        .foregroundColor(RCTheme.printText)
                                }
                            }

                            Button {
                                sharePackage()
                            } label: {
                                Text("Share Sign Package")
                                    .font(.system(size: 16, weight: .semibold))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 48)
                                    .foregroundColor(.white)
                                    .background(RCTheme.amber)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                            .padding(.top, 16)
                        }
                        .padding(.horizontal, 4)
                    }
                    .padding(24)
                    .padding(.bottom, 32)
                }
            }
        }
        .sheet(isPresented: $showingShareSheet) {
            ShareSheet(items: shareItems)
        }
    }

    private func sharePackage() {
        guard let image = qrImage,
              let data = image.pngData() else { return }
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent("rc-sign-\(code.qrId).png")
        try? data.write(to: temp)
        shareItems = [temp]
        showingShareSheet = true
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
