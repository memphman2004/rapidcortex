import SwiftUI

enum CodesStatusFilter: String, CaseIterable, Identifiable {
    case all
    case active
    case inactive
    case nfcWritten
    case notWritten

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "All"
        case .active: return "Active"
        case .inactive: return "Inactive"
        case .nfcWritten: return "NFC Written"
        case .notWritten: return "Not Written"
        }
    }
}

@MainActor
final class CodesListViewModel: ObservableObject {
    @Published private(set) var codes: [QRNFCCode] = []
    @Published private(set) var isLoading = false
    @Published var error: String?
    @Published var search = ""
    @Published var statusFilter: CodesStatusFilter = .all

    private let api = RCAPIClient.shared

    var filteredCodes: [QRNFCCode] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return codes.filter { code in
            switch statusFilter {
            case .all: break
            case .active: if !code.active { return false }
            case .inactive: if code.active { return false }
            case .nfcWritten: if !code.isNfcProgrammed { return false }
            case .notWritten: if code.isNfcProgrammed { return false }
            }
            if query.isEmpty { return true }
            return code.name.lowercased().contains(query)
                || (code.zone ?? "").lowercased().contains(query)
        }
    }

    func load(agencyId: String) async {
        guard !agencyId.isEmpty else {
            codes = []
            return
        }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            codes = try await api.listCodes(agencyId: agencyId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func refresh(agencyId: String) async {
        await load(agencyId: agencyId)
    }
}

struct CodesListView: View {
    @EnvironmentObject var auth: CognitoAuthManager
    @StateObject private var vm = CodesListViewModel()
    @State private var nfcCode: QRNFCCode?
    @State private var path = NavigationPath()

    private var agencyId: String { auth.selectedAgencyId }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                RCTheme.bg.ignoresSafeArea()
                VStack(spacing: 0) {
                    header
                    if let error = vm.error, vm.codes.isEmpty {
                        errorState(error)
                    } else if agencyId.isEmpty {
                        missingAgency
                    } else {
                        list
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(RCTheme.bg, for: .navigationBar)
            .navigationDestination(for: QRNFCCode.self) { code in
                CodeDetailView(code: code, agencyId: agencyId, onChanged: {
                    Task { await vm.refresh(agencyId: agencyId) }
                })
            }
            .task(id: agencyId) { await vm.load(agencyId: agencyId) }
            .refreshable { await vm.refresh(agencyId: agencyId) }
            .sheet(item: $nfcCode, onDismiss: {
                Task { await vm.refresh(agencyId: agencyId) }
            }) { code in
                NFCWriterView(code: code, agencyId: agencyId, batchMode: false)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("QR & NFC Codes")
                .font(.system(size: 34, weight: .bold))
                .foregroundColor(RCTheme.textPrimary)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(RCTheme.textMuted)
                TextField("Search by name or zone", text: $vm.search)
                    .foregroundColor(RCTheme.textPrimary)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            }
            .padding(.horizontal, 14)
            .frame(height: 44)
            .background(RCTheme.surface1)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(RCTheme.border, lineWidth: 1))

            Text("Tap a code for QR details, or Program NFC Tag on the card.")
                .font(.system(size: 13))
                .foregroundColor(RCTheme.textSecondary)

            if auth.claims?.isPlatformAdmin == true {
                NavigationLink {
                    SiteQrNfcView()
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Rapid Cortex site QR & NFC")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(RCTheme.amber)
                        Text("Writes www.rapidcortex.us or /demo/ for booth visitors")
                            .font(.system(size: 12))
                            .foregroundColor(RCTheme.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(RCTheme.amber, lineWidth: 1)
                    )
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(CodesStatusFilter.allCases) { filter in
                        Button {
                            vm.statusFilter = filter
                        } label: {
                            RCBadge(
                                label: filter.label,
                                tone: vm.statusFilter == filter ? .accent : .neutral
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if vm.isLoading && vm.codes.isEmpty {
                    ProgressView().tint(RCTheme.amber).padding(.top, 40)
                } else if vm.filteredCodes.isEmpty {
                    EmptyCodesView()
                        .padding(.top, 48)
                } else {
                    ForEach(vm.filteredCodes) { code in
                        CodeCardView(
                            code: code,
                            onOpen: { path.append(code) },
                            onProgramNfc: { nfcCode = code }
                        )
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Text(message)
                .font(.system(size: 13))
                .foregroundColor(RCTheme.danger)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button("Retry") { Task { await vm.load(agencyId: agencyId) } }
                .foregroundColor(RCTheme.amber)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var missingAgency: some View {
        Text("Your account is missing an agency assignment. Contact your admin.")
            .font(.system(size: 15))
            .foregroundColor(RCTheme.textSecondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct CodeCardView: View {
    let code: QRNFCCode
    let onOpen: () -> Void
    let onProgramNfc: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: onOpen) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .top, spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(code.name)
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(RCTheme.textPrimary)
                                .multilineTextAlignment(.leading)
                            if let zone = code.zone, !zone.isEmpty {
                                Text(zone)
                                    .font(.system(size: 13))
                                    .foregroundColor(RCTheme.textSecondary)
                            }
                        }
                        Spacer()
                        RCBadge(label: code.vertical.uppercased(), tone: .accent, small: true)
                    }

                    HStack(spacing: 8) {
                        RCBadge(
                            label: code.active ? "Active" : "Inactive",
                            tone: code.active ? .success : .neutral,
                            small: true
                        )
                        RCBadge(
                            label: code.isNfcProgrammed ? "NFC Written" : "Not Programmed",
                            tone: code.isNfcProgrammed ? .success : .warning,
                            small: true
                        )
                    }

                    Text("NFC Taps: \(code.nfcTapCount)    QR Scans: \(code.scanCount)")
                        .font(.system(size: 12))
                        .foregroundColor(RCTheme.textSecondary)

                    if let last = code.lastActivityAt, let rel = RCFormat.relative(last) {
                        Text("Last activity: \(rel)")
                            .font(.system(size: 12))
                            .foregroundColor(RCTheme.textSecondary)
                    }

                    Text("View QR & details →")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(RCTheme.amber)
                }
            }
            .buttonStyle(.plain)

            Button(action: onProgramNfc) {
                Text("Program NFC Tag")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .foregroundColor(RCTheme.amber)
                    .background(RCTheme.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(RCTheme.amber, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Program NFC tag for \(code.name)")
        }
        .padding(16)
        .background(RCTheme.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(RCTheme.border, lineWidth: 1))
    }
}

struct EmptyCodesView: View {
    var body: some View {
        VStack(spacing: 12) {
            Text("🏷️")
                .font(.system(size: 48))
            Text("No codes match your filters yet.")
                .font(.system(size: 15))
                .foregroundColor(RCTheme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
        }
    }
}
