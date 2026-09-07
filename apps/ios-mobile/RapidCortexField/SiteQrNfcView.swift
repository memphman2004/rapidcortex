import SwiftUI

/// QR + NFC for www.rapidcortex.us (tracked via /go/site/{home|demo}).
struct SiteQrNfcView: View {
    @State private var destination: TradeShowSite.Destination = .home
    @State private var showingNFCSheet = false
    @State private var showingShareSheet = false
    @State private var shareItems: [Any] = []
    @State private var copiedURL = false
    @State private var qrImage: UIImage?

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Text("Booth and Rapid Cortex marketing signs. Scans are counted, then the visitor lands on the public site. Do not use New Code — that opens a location report form.")
                        .font(.system(size: 13))
                        .foregroundColor(RCTheme.textMuted)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                        .padding(.top, 16)

                    Picker("Destination", selection: $destination) {
                        ForEach(TradeShowSite.Destination.allCases) { dest in
                            Text(dest.label).tag(dest)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .onChange(of: destination) { _ in rebuildQR() }

                    qrPreview
                        .padding(.top, 20)

                    VStack(spacing: 4) {
                        Text(destination.displayName)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(RCTheme.textPrimary)
                            .multilineTextAlignment(.center)

                        Text(destination.landingHost)
                            .font(.system(size: 13))
                            .foregroundColor(RCTheme.accentLight)

                        Text("QR encodes a tracked link")
                            .font(.system(size: 11))
                            .foregroundColor(RCTheme.textMuted)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)

                    urlPill
                    actionButtons
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 32)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle("Rapid Cortex site")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { rebuildQR() }
        .sheet(isPresented: $showingNFCSheet) {
            NFCWriterView(
                code: destination.asCode(),
                agencyId: TradeShowSite.agencyId,
                batchMode: true,
                logWrite: false
            )
        }
        .sheet(isPresented: $showingShareSheet) {
            ShareSheet(items: shareItems)
        }
    }

    private var qrPreview: some View {
        Group {
            if let image = qrImage {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 200, height: 200)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white)
                    .frame(width: 200, height: 200)
                    .overlay(ProgressView().tint(RCTheme.accent))
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var urlPill: some View {
        HStack(spacing: 8) {
            Text(destination.qrURL.absoluteString)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(RCTheme.textMuted)
                .lineLimit(1)
                .truncationMode(.middle)

            Spacer()

            Button {
                UIPasteboard.general.string = destination.qrURL.absoluteString
                withAnimation { copiedURL = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    withAnimation { copiedURL = false }
                }
            } label: {
                Image(systemName: copiedURL ? "checkmark" : "doc.on.doc")
                    .font(.system(size: 12))
                    .foregroundColor(copiedURL ? RCTheme.success : RCTheme.accentLight)
            }
            .accessibilityLabel("Copy URL")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(RCTheme.surface2)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.border, lineWidth: 0.5))
        .padding(.horizontal, 16)
    }

    private var actionButtons: some View {
        HStack(spacing: 10) {
            Button {
                showingNFCSheet = true
            } label: {
                Text("Program NFC Tag")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .foregroundColor(RCTheme.amber)
                    .background(RCTheme.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(RCTheme.amber, lineWidth: 1))
            }

            RCSecondaryButton(title: "Share QR") { exportQR() }
        }
    }

    private func rebuildQR() {
        qrImage = QRCodeGenerator.generate(
            url: destination.qrURL,
            centerLogo: QRCodeGenerator.fallbackLogo()
        )
    }

    private func exportQR() {
        guard let data = QRCodeGenerator.pngData(
            url: destination.qrURL,
            centerLogo: QRCodeGenerator.fallbackLogo()
        ) else { return }
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(destination.fileName)
        try? data.write(to: tempURL)
        shareItems = [tempURL]
        showingShareSheet = true
    }
}
