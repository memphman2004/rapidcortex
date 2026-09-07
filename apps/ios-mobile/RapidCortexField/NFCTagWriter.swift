import Combine
import CoreNFC
import Foundation

/// Programs NDEF URI records onto NTAG Type 2 stickers (and ISO15693 tags).
///
/// Uses `NFCTagReaderSession` (not `NFCNDEFReaderSession`) so factory-blank
/// NTAG213 tags are detected. All Core NFC I/O stays on the session queue;
/// hopping to the main actor mid-write is a common cause of a hung “Ready to Scan” sheet.
final class NFCTagWriter: NSObject, ObservableObject {
    @Published private(set) var state: WriteState = .idle
    @Published private(set) var tagsWritten = 0

    private var session: NFCTagReaderSession?
    private var targetURL: URL?
    private var completion: ((NFCWriteResult) -> Void)?
    private var batchMode = false
    /// True after a successful write so session close is not reported as failure.
    private var wroteThisSession = false
    private var successfulWrites = 0

    enum WriteState: Equatable {
        case idle
        case scanning
        case writing
        case success(bytesWritten: Int)
        case failure(String)
    }

    func beginWriting(url: URL, batch: Bool = false, completion: @escaping (NFCWriteResult) -> Void) {
        guard NFCTagReaderSession.readingAvailable else {
            publish {
                self.state = .failure(NFCWriteError.hardwareUnavailable.localizedDescription)
            }
            completion(.failure(error: NFCWriteError.hardwareUnavailable))
            return
        }

        session?.invalidate()
        session = nil

        targetURL = url
        batchMode = batch
        self.completion = completion
        tagsWritten = 0
        successfulWrites = 0
        wroteThisSession = false
        publish { self.state = .scanning }

        let alertMessage = batch
            ? "Hold the top of your iPhone to each sticker. Keep this sheet open for multiple tags."
            : "Hold the top of your iPhone against the sticker."

        guard let session = NFCTagReaderSession(
            pollingOption: [.iso14443, .iso15693],
            delegate: self,
            queue: nil
        ) else {
            let err = NFCWriteError.sessionUnavailable
            publish { self.state = .failure(err.localizedDescription) }
            completion(.failure(error: err))
            return
        }

        self.session = session
        session.alertMessage = alertMessage
        session.begin()
    }

    func reportFailure(_ message: String) {
        publish { self.state = .failure(message) }
    }

    func cancel() {
        session?.invalidate()
        session = nil
        publish { self.state = .idle }
    }

    private func publish(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }

    private func ndefTag(from tag: NFCTag) -> (any NFCNDEFTag)? {
        switch tag {
        case .miFare(let t): return t
        case .iso15693(let t): return t
        case .iso7816(let t): return t
        case .feliCa(let t): return t
        @unknown default: return nil
        }
    }

    private func writeNDEF(to ndef: any NFCNDEFTag, session: NFCTagReaderSession, capacity: Int) {
        guard let url = targetURL else {
            session.invalidate(errorMessage: "Missing URL for this code.")
            return
        }
        guard let payload = NFCNDEFPayload.wellKnownTypeURIPayload(url: url) else {
            publish { self.state = .failure("Could not encode URL as NDEF payload.") }
            session.invalidate(errorMessage: "URL encoding failed.")
            return
        }

        let message = NFCNDEFMessage(records: [payload])
        let bytes = message.length
        if capacity > 0, bytes > capacity {
            let msg = "URL is \(bytes) bytes but this tag only holds \(capacity)."
            publish { self.state = .failure(msg) }
            session.invalidate(errorMessage: msg)
            return
        }

        publish { self.state = .writing }

        ndef.writeNDEF(message) { [weak self] error in
            guard let self else { return }
            if let error {
                self.publish { self.state = .failure(error.localizedDescription) }
                session.invalidate(errorMessage: "Write failed. Hold still and try again.")
                return
            }

            self.wroteThisSession = true
            self.successfulWrites += 1
            let count = self.successfulWrites
            self.publish {
                self.tagsWritten = count
                self.state = .success(bytesWritten: bytes)
                self.completion?(.success(bytesWritten: bytes))
            }

            if self.batchMode {
                session.alertMessage = "Tag \(count) written. Hold to the next sticker."
                session.restartPolling()
                self.publish { self.state = .scanning }
            } else {
                session.alertMessage = "Tag programmed."
                session.invalidate()
            }
        }
    }
}

extension NFCTagWriter: NFCTagReaderSessionDelegate {
    nonisolated func tagReaderSessionDidBecomeActive(_ session: NFCTagReaderSession) {}

    nonisolated func tagReaderSession(_ session: NFCTagReaderSession, didInvalidateWithError error: Error) {
        DispatchQueue.main.async {
            self.session = nil
            if self.wroteThisSession, !self.batchMode {
                return
            }
            let nfcError = error as? NFCReaderError
            switch nfcError?.code {
            case .readerSessionInvalidationErrorUserCanceled:
                self.state = .idle
                self.completion?(.cancelled)
            case .readerSessionInvalidationErrorSessionTimeout:
                self.state = .failure("NFC timed out. Tap Try again and hold the top of the iPhone to the sticker.")
                self.completion?(.failure(error: error))
            case .readerSessionInvalidationErrorSessionTerminatedUnexpectedly:
                self.state = .failure(
                    "NFC stopped unexpectedly. Rebuild the app with the NFC Tag Reading capability enabled for us.rapidcortex.field."
                )
                self.completion?(.failure(error: error))
            default:
                if case .failure = self.state { return }
                if case .success = self.state { return }
                self.state = .failure(error.localizedDescription)
                self.completion?(.failure(error: error))
            }
        }
    }

    nonisolated func tagReaderSession(_ session: NFCTagReaderSession, didDetect tags: [NFCTag]) {
        if tags.count > 1 {
            session.alertMessage = "More than one tag detected. Present a single sticker."
            session.restartPolling()
            return
        }
        guard let tag = tags.first else { return }

        session.connect(to: tag) { [weak self] error in
            guard let self else { return }
            if error != nil {
                session.alertMessage = "Hold still — rest the top of the iPhone on the sticker."
                session.restartPolling()
                return
            }

            guard let ndef = self.ndefTag(from: tag) else {
                session.invalidate(errorMessage: "Tag type not supported. Use NTAG213 / NTAG215 stickers.")
                return
            }

            ndef.queryNDEFStatus { [weak self] status, capacity, error in
                guard let self else { return }
                if let error {
                    self.publish { self.state = .failure(error.localizedDescription) }
                    session.invalidate(errorMessage: "Could not read this tag. Try another sticker.")
                    return
                }

                switch status {
                case .readOnly:
                    session.invalidate(errorMessage: "This tag is locked and cannot be programmed.")
                case .readWrite:
                    self.writeNDEF(to: ndef, session: session, capacity: capacity)
                case .notSupported:
                    // Factory-blank Type 2 tags often report notSupported until the first NDEF write.
                    self.writeNDEF(to: ndef, session: session, capacity: capacity)
                @unknown default:
                    session.invalidate(errorMessage: "Unknown tag status.")
                }
            }
        }
    }
}

enum NFCWriteError: LocalizedError {
    case hardwareUnavailable
    case sessionUnavailable
    case tagNotWritable
    case payloadTooLarge(Int, Int)

    var errorDescription: String? {
        switch self {
        case .hardwareUnavailable:
            return "NFC is not available on this device. Requires a physical iPhone 7 or later."
        case .sessionUnavailable:
            return "Could not start NFC. Enable Near Field Communication Tag Reading for us.rapidcortex.field, then rebuild."
        case .tagNotWritable:
            return "This tag is locked and cannot be programmed."
        case .payloadTooLarge(let payload, let capacity):
            return "URL is \(payload) bytes but tag capacity is only \(capacity) bytes."
        }
    }
}
