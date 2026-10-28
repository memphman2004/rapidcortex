import AVFoundation
import Foundation
import Speech

@MainActor
final class TranslateSessionController: NSObject, ObservableObject {
    @Published var session: TranslateSessionDTO?
    @Published var feed: [TranslateFeedItem] = []
    @Published var errorMessage: String?
    @Published var connected = false
    @Published var listening = false
    @Published var starting = false
    @Published var speaker: String = "officer"

    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var socketEvents: SocketEvents?
    private var pingTask: Task<Void, Never>?
    private var apiClient: RCAPIClient?
    private var socketGeneration = 0
    private var closingSocket = false
    private var player: AVPlayer?

    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var speechRecognizer: SFSpeechRecognizer?
    private var subjectLanguage = "es"
    private var pendingUtterance = ""
    private var micGeneration = 0
    private var utteranceSent = false

    struct TranslateFeedItem: Identifiable {
        let id: String
        var speaker: String
        var originalText: String
        var translatedText: String?
        var isFinal: Bool
        var audioUrl: String?
    }

    func start(
        api: RCAPIClient,
        subjectLanguage: String,
        vertical: String,
        agencyId: String
    ) async {
        starting = true
        errorMessage = nil
        feed = []
        apiClient = api
        self.subjectLanguage = subjectLanguage
        defer { starting = false }

        let body: TranslateSessionCreateBody
        switch vertical {
        case "campus":
            body = TranslateSessionCreateBody(
                subjectLanguage: subjectLanguage,
                vertical: "campus",
                campusContext: .init(campusCode: agencyId),
                venueContext: nil,
                hospitalContext: nil
            )
        case "hospital":
            body = TranslateSessionCreateBody(
                subjectLanguage: subjectLanguage,
                vertical: "hospital",
                campusContext: nil,
                venueContext: nil,
                hospitalContext: .init(hospitalId: agencyId)
            )
        case "law_enforcement":
            body = TranslateSessionCreateBody(
                subjectLanguage: subjectLanguage,
                vertical: "law_enforcement",
                campusContext: nil,
                venueContext: nil,
                hospitalContext: nil
            )
        default:
            body = TranslateSessionCreateBody(
                subjectLanguage: subjectLanguage,
                vertical: "venue",
                campusContext: nil,
                venueContext: .init(venueCode: agencyId),
                hospitalContext: nil
            )
        }

        do {
            let created = try await api.createTranslateSession(body: body)
            session = created
            let tokenResp = try await api.getTranslateWsToken(sessionId: created.sessionId)
            connectWebSocket(endpoint: tokenResp.wsEndpoint)
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func close(api: RCAPIClient, writebackNote: Bool) async {
        stopMic()
        stopPlayback()
        guard let sessionId = session?.sessionId else { return }
        do {
            let result = try await api.closeTranslateSession(
                sessionId: sessionId,
                writebackNote: writebackNote
            )
            session = result.session
            disconnectWebSocket()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func startMic(as speakerRole: String) {
        if listening { return }
        guard connected else {
            errorMessage = "Translator is still connecting"
            return
        }
        errorMessage = nil
        speaker = speakerRole

        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] micAllowed in
            Task { @MainActor in
                guard let self else { return }
                guard micAllowed else {
                    self.errorMessage = "Microphone permission is required"
                    return
                }
                SFSpeechRecognizer.requestAuthorization { status in
                    Task { @MainActor in
                        guard status == .authorized else {
                            self.errorMessage = "Speech recognition permission is required"
                            return
                        }
                        self.beginRecognition()
                    }
                }
            }
        }
    }

    func stopMic() {
        let text = pendingUtterance
        tearDownMic()
        submitPhrase(text)
    }

    private func tearDownMic() {
        micGeneration += 1
        pendingUtterance = ""
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        if let engine = audioEngine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
        }
        audioEngine = nil
        listening = false
    }

    private func submitPhrase(_ raw: String) {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !utteranceSent else { return }
        guard connected else {
            errorMessage = "Translator is not connected"
            return
        }
        utteranceSent = true
        sendJSON([
            "type": "phrase",
            "speaker": speaker,
            "text": text,
        ])
    }

    private func beginRecognition() {
        let localeId = sttLocale(for: speaker)
        speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: localeId))
        guard let speechRecognizer, speechRecognizer.isAvailable else {
            errorMessage = "Speech recognition unavailable for \(localeId)"
            return
        }

        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            errorMessage = "Microphone unavailable"
            return
        }

        let engine = AVAudioEngine()
        engine.prepare()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0 else {
            errorMessage = "Microphone unavailable"
            return
        }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        recognitionRequest = request
        audioEngine = engine
        listening = true
        pendingUtterance = ""
        utteranceSent = false
        let generation = micGeneration

        recognitionTask = speechRecognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self, generation == self.micGeneration else { return }
                if let result {
                    let text = result.bestTranscription.formattedString
                    self.pendingUtterance = text
                    if result.isFinal {
                        self.tearDownMic()
                        self.submitPhrase(text)
                    }
                } else if let error {
                    let spoken = self.pendingUtterance
                    self.tearDownMic()
                    let ns = error as NSError
                    if ns.domain == "kAFAssistantErrorDomain" && (ns.code == 216 || ns.code == 1110) {
                        self.submitPhrase(spoken)
                    } else if !spoken.isEmpty {
                        self.submitPhrase(spoken)
                    } else {
                        self.errorMessage = error.localizedDescription
                    }
                }
            }
        }

        do {
            try engine.start()
        } catch {
            tearDownMic()
            errorMessage = "Could not start microphone"
        }
    }

    private func sttLocale(for speakerRole: String) -> String {
        if speakerRole == "officer" { return "en-US" }
        let map: [String: String] = [
            "es": "es-US",
            "zh-CN": "zh-CN",
            "zh-TW": "zh-TW",
            "vi": "vi-VN",
            "ko": "ko-KR",
            "ar": "ar-SA",
            "tl": "fil-PH",
            "ru": "ru-RU",
            "fr": "fr-FR",
            "de": "de-DE",
            "pt": "pt-BR",
            "hi": "hi-IN",
            "ht": "ht-HT",
        ]
        return map[subjectLanguage] ?? subjectLanguage
    }

    private func connectWebSocket(endpoint: String) {
        disconnectWebSocket()
        guard let url = URL(string: endpoint) else {
            errorMessage = "Invalid translate live endpoint"
            return
        }
        socketGeneration += 1
        let generation = socketGeneration
        closingSocket = false
        connected = false

        let events = SocketEvents()
        events.onOpen = { [weak self] in
            guard let self, generation == self.socketGeneration else { return }
            self.connected = true
            self.errorMessage = nil
            self.sendJSON(["type": "ping"])
            Task { await self.refreshSessionStatus() }
        }
        events.onClose = { [weak self] in
            guard let self, generation == self.socketGeneration, !self.closingSocket else { return }
            self.connected = false
            if self.errorMessage == nil {
                self.errorMessage = "Translator connection closed"
            }
        }
        socketEvents = events

        let session = URLSession(configuration: .default, delegate: events, delegateQueue: nil)
        urlSession = session
        let task = session.webSocketTask(with: url)
        webSocket = task
        task.resume()
        receiveLoop(generation: generation)
        pingTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 25_000_000_000)
                self?.sendJSON(["type": "ping"])
            }
        }
    }

    private func refreshSessionStatus() async {
        guard let apiClient, let sessionId = session?.sessionId else { return }
        guard let latest = try? await apiClient.getTranslateSession(sessionId: sessionId) else { return }
        session = latest
    }

    private func disconnectWebSocket() {
        closingSocket = true
        pingTask?.cancel()
        pingTask = nil
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        socketEvents = nil
        connected = false
    }

    private func receiveLoop(generation: Int) {
        webSocket?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure:
                Task { @MainActor in
                    guard generation == self.socketGeneration, !self.closingSocket else { return }
                    self.connected = false
                    if self.errorMessage == nil {
                        self.errorMessage = "Translator connection failed"
                    }
                }
            case .success(let message):
                Task { @MainActor in
                    guard generation == self.socketGeneration else { return }
                    self.connected = true
                    self.handleMessage(message)
                    self.receiveLoop(generation: generation)
                }
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        let text: String?
        switch message {
        case .string(let s): text = s
        case .data(let d): text = String(data: d, encoding: .utf8)
        @unknown default: text = nil
        }
        guard let text,
              let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = obj["type"] as? String
        else { return }

        connected = true

        switch type {
        case "error":
            errorMessage = obj["message"] as? String ?? "Translate error"
        case "transcript_partial", "transcript_final":
            let segmentId = obj["segmentId"] as? String ?? UUID().uuidString
            feed.removeAll { $0.id == segmentId }
            feed.append(
                TranslateFeedItem(
                    id: segmentId,
                    speaker: obj["speaker"] as? String ?? "officer",
                    originalText: obj["originalText"] as? String ?? "",
                    translatedText: nil,
                    isFinal: type == "transcript_final",
                    audioUrl: nil
                )
            )
        case "translation_ready":
            let segmentId = obj["segmentId"] as? String ?? ""
            if let idx = feed.firstIndex(where: { $0.id == segmentId }) {
                feed[idx].translatedText = obj["translatedText"] as? String
                feed[idx].isFinal = true
            }
        case "audio_ready":
            let segmentId = obj["segmentId"] as? String ?? ""
            let url = obj["audioPresignedUrl"] as? String
            if let idx = feed.firstIndex(where: { $0.id == segmentId }) {
                feed[idx].audioUrl = url
            }
            if let url { playTTS(urlString: url) }
        case "language_detected":
            if let code = obj["languageCode"] as? String {
                subjectLanguage = code
            }
        case "session_state":
            if let status = obj["status"] as? String,
               let count = obj["segmentCount"] as? Int,
               let current = session
            {
                session = TranslateSessionDTO(
                    sessionId: current.sessionId,
                    agencyId: current.agencyId,
                    status: status,
                    subjectLanguage: current.subjectLanguage,
                    primaryLanguage: current.primaryLanguage,
                    segmentCount: count,
                    startedAt: current.startedAt,
                    endedAt: current.endedAt,
                    vertical: current.vertical
                )
            }
        default:
            break
        }
    }

    private func sendJSON(_ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let text = String(data: data, encoding: .utf8)
        else { return }
        webSocket?.send(.string(text)) { _ in }
    }

    private func playTTS(urlString: String) {
        guard let url = URL(string: urlString) else { return }
        stopPlayback()
        let next = AVPlayer(playerItem: AVPlayerItem(url: url))
        player = next
        next.play()
    }

    private func stopPlayback() {
        player?.pause()
        player = nil
    }
}

/// URLSession has no completion for "socket open". Staff stays disabled until this fires.
private final class SocketEvents: NSObject, URLSessionWebSocketDelegate {
    var onOpen: (@MainActor () -> Void)?
    var onClose: (@MainActor () -> Void)?

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        let open = onOpen
        Task { @MainActor in open?() }
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        let close = onClose
        Task { @MainActor in close?() }
    }
}
