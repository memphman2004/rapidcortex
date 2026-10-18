import SwiftUI
import UIKit
import Photos
import MapKit
import CoreLocation

struct CodeDetailView: View {
    let code: QRNFCCode
    let agencyId: String
    var onChanged: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var liveCode: QRNFCCode
    @State private var showingNFCSheet = false
    @State private var showingShareSheet = false
    @State private var showingSignPackage = false
    @State private var showingRegisterLocation = false
    @State private var shareItems: [Any] = []
    @State private var copiedURL = false
    @State private var qrImage: UIImage?
    @State private var centerLogo: UIImage?
    @State private var saveMessage: String?

    init(code: QRNFCCode, agencyId: String, onChanged: (() -> Void)? = nil) {
        self.code = code
        self.agencyId = agencyId
        self.onChanged = onChanged
        _liveCode = State(initialValue: code)
    }

    private var reportURL: URL? { URL(string: liveCode.url) }

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
                    if let sms = liveCode.smsNumber, !sms.isEmpty {
                        smsCard(sms)
                    }
                    locationCard
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
            NFCWriterView(code: liveCode, agencyId: agencyId, batchMode: false)
        }
        .sheet(isPresented: $showingRegisterLocation, onDismiss: {
            Task {
                if let refreshed = try? await RCAPIClient.shared.getCode(qrId: liveCode.qrId) {
                    liveCode = refreshed
                }
                onChanged?()
            }
        }) {
            RegisterLocationView(code: liveCode)
        }
        .sheet(isPresented: $showingShareSheet) {
            ShareSheet(items: shareItems)
        }
        .sheet(isPresented: $showingSignPackage) {
            SignPackageView(code: liveCode, qrImage: qrImage)
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
                label: liveCode.active ? "Active" : "Inactive",
                tone: liveCode.active ? .success : .neutral,
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
            Text(liveCode.name)
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(RCTheme.textPrimary)
            if let zone = liveCode.zone, !zone.isEmpty {
                Text(zone)
                    .font(.system(size: 16))
                    .foregroundColor(RCTheme.textSecondary)
            }
            HStack(spacing: 8) {
                RCBadge(label: liveCode.vertical.uppercased(), tone: .accent, small: true)
                RCBadge(label: RCFormat.reportTypeLabel(liveCode.reportType), tone: .neutral, small: true)
            }
            .padding(.top, 6)
        }
        .padding(.bottom, 20)
    }

    private var locationCard: some View {
        Button { showingRegisterLocation = true } label: {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Installation Location")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(RCTheme.textPrimary)
                    RCBadge(
                        label: liveCode.locationVerified
                            ? "Verified"
                            : liveCode.hasRegisteredCoordinates ? "Unverified pin" : "No coordinates",
                        tone: liveCode.locationVerified
                            ? .success
                            : liveCode.hasRegisteredCoordinates ? .warning : .neutral,
                        small: true
                    )
                    if let lat = liveCode.latitude, let lng = liveCode.longitude {
                        Text(String(format: "%.5f, %.5f", lat, lng))
                            .font(.system(size: 12))
                            .foregroundColor(RCTheme.textSecondary)
                    } else {
                        Text("Capture GPS at the sign, adjust the pin, then verify.")
                            .font(.system(size: 12))
                            .foregroundColor(RCTheme.textSecondary)
                    }
                }
                Spacer()
                Text("Register")
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
            Text(liveCode.url)
                .font(.system(size: 13))
                .foregroundColor(RCTheme.textPrimary)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer()
            Button {
                UIPasteboard.general.string = liveCode.url
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
        Group {
            if NFCHardware.isAvailable {
                Button { showingNFCSheet = true } label: {
                    nfcCardContent(actionLabel: "Program NFC Tag")
                }
                .buttonStyle(.plain)
            } else {
                nfcCardContent(actionLabel: nil)
            }
        }
        .padding(.bottom, 12)
    }

    private func nfcCardContent(actionLabel: String?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("NFC Tag")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(RCTheme.textPrimary)
                    RCBadge(
                        label: liveCode.isNfcProgrammed ? "NFC Written" : "Not Programmed",
                        tone: liveCode.isNfcProgrammed ? .success : .warning,
                        small: true
                    )
                }
                Spacer()
                if let actionLabel {
                    Text(actionLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(RCTheme.amber)
                }
            }
            if actionLabel == nil {
                Text(NFCHardware.unavailableMessage)
                    .font(.system(size: 12))
                    .foregroundColor(RCTheme.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(16)
        .background(RCTheme.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(RCTheme.border, lineWidth: 1))
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
        let filename = QRCodeGenerator.filename(for: liveCode)
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

// MARK: - Register Installation Location (GPS + MapKit pin)

final class InstallationLocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var coordinate: CLLocationCoordinate2D?
    @Published var accuracyMeters: CLLocationAccuracy?
    @Published var altitudeMeters: CLLocationDistance?
    @Published var permissionDenied = false
    @Published var errorMessage: String?

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestAndCapture() {
        errorMessage = nil
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        default:
            permissionDenied = true
            errorMessage = "Location permission is required to register the installation pin."
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            switch status {
            case .authorizedWhenInUse, .authorizedAlways:
                self.permissionDenied = false
                self.manager.requestLocation()
            case .denied, .restricted:
                self.permissionDenied = true
                self.errorMessage = "Location permission is required to register the installation pin."
            default:
                break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        let coordinate = loc.coordinate
        let accuracy = loc.horizontalAccuracy
        let altitude = loc.altitude
        Task { @MainActor in
            self.coordinate = coordinate
            self.accuracyMeters = accuracy >= 0 ? accuracy : nil
            self.altitudeMeters = altitude
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let message = error.localizedDescription
        Task { @MainActor in
            self.errorMessage = message
        }
    }
}

private struct InstallationPin: Identifiable {
    let id = "installation"
    let coordinate: CLLocationCoordinate2D
}

struct RegisterLocationView: View {
    let code: QRNFCCode
    @Environment(\.dismiss) private var dismiss
    @StateObject private var location = InstallationLocationManager()
    @State private var pin: CLLocationCoordinate2D?
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 39.8283, longitude: -98.5795),
        latitudinalMeters: 80,
        longitudinalMeters: 80
    )
    @State private var accuracyMeters: Double?
    @State private var altitudeMeters: Double?
    @State private var busy = false
    @State private var statusMessage: String?
    @State private var showVerifyConfirm = false
    @State private var liveVerified = false

    var body: some View {
        NavigationStack {
            ZStack {
                RCTheme.bg.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 12) {
                    Text(code.name)
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(RCTheme.textPrimary)
                    Text("Capture GPS at the sign, drag the pin to correct, then save. Verification is a separate confirmation.")
                        .font(.system(size: 13))
                        .foregroundColor(RCTheme.textSecondary)

                    installationMap
                    .frame(maxWidth: .infinity)
                    .frame(height: 320)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(RCTheme.border, lineWidth: 1))

                    if let pin {
                        Text(String(format: "Lat %.6f · Lng %.6f", pin.latitude, pin.longitude)
                            + (accuracyMeters.map { String(format: " · ±%.0f m", $0) } ?? " · pin set"))
                            .font(.system(size: 12))
                            .foregroundColor(RCTheme.textSecondary)
                    }

                    if let statusMessage {
                        Text(statusMessage)
                            .font(.system(size: 12))
                            .foregroundColor(RCTheme.amber)
                    }

                    Button {
                        location.requestAndCapture()
                    } label: {
                        Text("Capture GPS")
                            .font(.system(size: 16, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(RCTheme.surface1)
                            .foregroundColor(RCTheme.amber)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(busy)

                    HStack(spacing: 8) {
                        Button {
                            nudgePin(latDelta: 0.00008, lngDelta: 0)
                        } label: { Text("N").frame(maxWidth: .infinity) }
                        Button {
                            nudgePin(latDelta: 0, lngDelta: -0.00008)
                        } label: { Text("W").frame(maxWidth: .infinity) }
                        Button {
                            nudgePin(latDelta: 0, lngDelta: 0.00008)
                        } label: { Text("E").frame(maxWidth: .infinity) }
                        Button {
                            nudgePin(latDelta: -0.00008, lngDelta: 0)
                        } label: { Text("S").frame(maxWidth: .infinity) }
                    }
                    .buttonStyle(.bordered)
                    .disabled(pin == nil || busy)

                    Button {
                        Task { await save(verify: false) }
                    } label: {
                        Text(busy ? "Saving…" : "Save installation pin")
                            .font(.system(size: 16, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(RCTheme.amber)
                            .foregroundColor(.black)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(pin == nil || busy)

                    Button {
                        showVerifyConfirm = true
                    } label: {
                        Text("Verify Installation Location")
                            .font(.system(size: 16, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(RCTheme.surface1)
                            .foregroundColor(liveVerified ? RCTheme.textMuted : RCTheme.success)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(pin == nil || busy || liveVerified)

                    Spacer(minLength: 8)
                }
                .padding(20)
            }
            .navigationTitle("Register Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundColor(RCTheme.amber)
                }
            }
            .onAppear {
                liveVerified = code.locationVerified
                if let lat = code.latitude, let lng = code.longitude {
                    let c = CLLocationCoordinate2D(latitude: lat, longitude: lng)
                    pin = c
                    accuracyMeters = code.locationAccuracyMeters
                    region = MKCoordinateRegion(center: c, latitudinalMeters: 80, longitudinalMeters: 80)
                }
            }
            .onChange(of: location.coordinate?.latitude) { _ in
                guard let c = location.coordinate else { return }
                pin = c
                accuracyMeters = location.accuracyMeters
                altitudeMeters = location.altitudeMeters
                region = MKCoordinateRegion(center: c, latitudinalMeters: 80, longitudinalMeters: 80)
            }
            .alert("Verify Installation Location", isPresented: $showVerifyConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Verify") {
                    Task { await save(verify: true) }
                }
            } message: {
                Text("Confirm you are at the installed QR/NFC sign and the map pin is accurate. Coordinates are never auto-verified.")
            }
        }
    }

    private func nudgePin(latDelta: Double, lngDelta: Double) {
        guard let pin else { return }
        let next = CLLocationCoordinate2D(latitude: pin.latitude + latDelta, longitude: pin.longitude + lngDelta)
        self.pin = next
        accuracyMeters = nil
        region = MKCoordinateRegion(center: next, latitudinalMeters: 80, longitudinalMeters: 80)
    }

    private var installationPins: [InstallationPin] {
        guard let pin else { return [] }
        return [InstallationPin(coordinate: pin)]
    }

    private var installationMap: some View {
        ZStack {
            if pin != nil {
                Map(coordinateRegion: $region, annotationItems: installationPins) { item in
                    MapMarker(coordinate: item.coordinate, tint: RCTheme.amber)
                }
            } else {
                Color.black.opacity(0.35)
                Text("Capture GPS to show the map")
                    .foregroundColor(RCTheme.textSecondary)
            }
        }
    }

    private func save(verify: Bool) async {
        guard let pin else { return }
        busy = true
        statusMessage = nil
        defer { busy = false }
        do {
            let updated = try await RCAPIClient.shared.updateCodeLocation(
                qrId: code.qrId,
                request: UpdateCodeLocationRequest(
                    latitude: pin.latitude,
                    longitude: pin.longitude,
                    locationAccuracyMeters: accuracyMeters,
                    locationSource: "gps",
                    altitudeMeters: altitudeMeters,
                    markLocationVerified: verify
                )
            )
            liveVerified = updated.locationVerified
            statusMessage = verify
                ? "Installation location verified."
                : "Saved as UNVERIFIED. Use Verify Installation Location when the pin is correct."
            if verify { dismiss() }
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}
