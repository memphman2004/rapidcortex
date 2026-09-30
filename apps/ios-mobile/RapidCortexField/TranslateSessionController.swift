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
    private var pingTask: Task<Void, Never>?
    private var player: AVPlayer?

    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var speechRecognizer: SFSpeechRecognizer?
    private var subjectLanguage = "es"

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
        self.subjectLanguage = subjectLanguage
        defer { starting = false }

        let body: TranslateSessionCreateBody
        if vertical == "campus" {
            body = TranslateSessionCreateBody(
                subjectLanguage: subjectLanguage,
                vertical: "campus",
                campusContext: .init(campusCode: agencyId),
                venueContext: nil
            )
        } else {
            body = TranslateSessionCreateBody(
                subjectLanguage: subjectLanguage,
                vertical: "venue",
                campusContext: nil,
                venueContext: .init(venueCode: agencyId)
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
        errorMessage = nil
        speaker = speakerRole

        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            Task { @MainActor in
                guard let self else { return }
                guard status == .authorized else {
                    self.errorMessage = "Speech recognition permission is required"
                    return
                }
                self.beginRecognition()
            }
        }
    }

    func stopMic() {
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        listening = false
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
            try audioSession.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .duckOthers])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            errorMessage = "Microphone unavailable"
            return
        }

        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        recognitionRequest = request
        audioEngine = engine
        listening = true

        recognitionTask = speechRecognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }
                if let result, result.isFinal {
                    let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                    self.stopMic()
                    if !text.isEmpty {
                        self.sendJSON([
                            "type": "phrase",
                            "speaker": self.speaker,
                            "text": text,
                        ])
                    }
                } else if let error {
                    self.stopMic()
                    let ns = error as NSError
                    if ns.code != 216 && ns.domain != "kAFAssistantErrorDomain" {
                        self.errorMessage = error.localizedDescription
                    }
                }
            }
        }

        do {
            try engine.start()
        } catch {
            stopMic()
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
        let session = URLSession(configuration: .default)
        urlSession = session
        let task = session.webSocketTask(with: url)
        webSocket = task
        task.resume()
        connected = true
        receiveLoop()
        pingTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 25_000_000_000)
                self?.sendJSON(["type": "ping"])
            }
        }
    }

    private func disconnectWebSocket() {
        pingTask?.cancel()
        pingTask = nil
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        urlSession = nil
        connected = false
    }

    private func receiveLoop() {
        webSocket?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure:
                Task { @MainActor in self.connected = false }
            case .success(let message):
                Task { @MainActor in
                    self.handleMessage(message)
                    self.receiveLoop()
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
