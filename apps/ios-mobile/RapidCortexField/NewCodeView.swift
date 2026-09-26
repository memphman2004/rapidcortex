import SwiftUI
import UIKit

@MainActor
final class NewCodeViewModel: ObservableObject {
    @Published var name = ""
    @Published var zone = ""
    @Published var reportType = "both"
    @Published var smsNumber = ""
    @Published private(set) var isSaving = false
    @Published private(set) var createdCode: QRNFCCode?
    @Published var error: String?

    var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !zone.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func save(agencyId: String, vertical: String) async {
        isSaving = true
        error = nil
        createdCode = nil
        defer { isSaving = false }

        var sms: String? = nil
        let trimmedSms = smsNumber.trimmingCharacters(in: .whitespaces)
        if !trimmedSms.isEmpty {
            let digits = trimmedSms.filter(\.isNumber)
            if digits.count < 10 {
                error = "Enter a valid text reporting number."
                return
            }
            sms = digits
        }

        let request = NewQRNFCCodeRequest(
            agencyId: agencyId,
            name: name.trimmingCharacters(in: .whitespaces),
            zone: zone.trimmingCharacters(in: .whitespaces),
            reportType: reportType,
            vertical: vertical,
            smsNumber: sms
        )

        do {
            createdCode = try await RCAPIClient.shared.createCode(agencyId: agencyId, request: request)
            name = ""
            zone = ""
            smsNumber = ""
            reportType = "both"
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct NewCodeView: View {
    let agencyId: String
    var defaultVertical: String = "venue"
    var onCreated: ((QRNFCCode) -> Void)?
    var onBack: (() -> Void)?

    @StateObject private var vm = NewCodeViewModel()
    @State private var nfcCode: QRNFCCode?

    private var namePlaceholder: String {
        "e.g. Gate A, Student Center, Bus 2145"
    }

    private var zonePlaceholder: String {
        "e.g. Section 112, East Entrance, Platform 3"
    }

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()
            if agencyId.isEmpty {
                Text("Your account is missing an agency assignment. Contact your admin.")
                    .font(.system(size: 15))
                    .foregroundColor(RCTheme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(32)
            } else {
                form
            }
        }
        .sheet(item: $nfcCode) { code in
            NFCWriterView(code: code, agencyId: agencyId, batchMode: false)
        }
    }

    private var form: some View {
        ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Button(action: goBack) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                            Text("Back")
                        }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(RCTheme.amber)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Back")

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Create Reporting Point")
                            .font(.system(size: 34, weight: .bold))
                            .foregroundColor(RCTheme.textPrimary)
                        Text("Set up a QR code and/or NFC tag for a certainlocation.")
                            .font(.system(size: 15))
                            .foregroundColor(RCTheme.textSecondary)
                    }

                    RCField(label: "Reporting Point Name", placeholder: namePlaceholder, text: $vm.name)
                    RCField(label: "Location Details", placeholder: zonePlaceholder, text: $vm.zone)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Reporting Options")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(RCTheme.textPrimary)
                        HStack(spacing: 8) {
                            ForEach(["anonymous", "identified", "both"], id: \.self) { type in
                                Button {
                                    vm.reportType = type
                                } label: {
                                    RCBadge(
                                        label: RCFormat.reportTypeLabel(type),
                                        tone: vm.reportType == type ? .accent : .neutral
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    RCField(
                        label: "Text Reporting Number",
                        placeholder: "(555) 000-0000",
                        text: $vm.smsNumber,
                        keyboard: .phonePad,
                        helper: "Optional. Shown on the printed sign."
                    )

                    if let error = vm.error {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundColor(RCTheme.danger)
                    }

                    RCPrimaryButton(
                        title: "Create Reporting Point",
                        enabled: vm.isValid,
                        loading: vm.isSaving
                    ) {
                        Task { await create() }
                    }
                }
                .padding(20)
                .padding(.bottom, 40)
            }
    }

    private func goBack() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        onBack?()
    }

    private func create() async {
        await vm.save(agencyId: agencyId, vertical: defaultVertical == "911" ? "venue" : defaultVertical)
        guard let code = vm.createdCode else { return }
        onCreated?(code)
        if NFCHardware.isAvailable {
            nfcCode = code
        }
    }
}
