import AVFoundation
import Foundation

@MainActor
final class AudioRoundtripRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published var status = "Idle"
    @Published var recordedBytes = 0
    @Published var returnedBytes = 0
    @Published var returnedContentType = ""
    @Published var returnedData: Data?

    private var recorder: AVAudioRecorder?
    private var recordingURL: URL?

    func startRecording() {
        do {
            let url = FileManager.default.temporaryDirectory.appending(path: "ai-trainer-roundtrip.m4a")
            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44_100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
            ]
            recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder?.delegate = self
            recorder?.record(forDuration: 3)
            recordingURL = url
            status = "Recording"
        } catch {
            status = error.localizedDescription
        }
    }

    func stopRecording() {
        recorder?.stop()
        recorder = nil
        updateRecordedBytes()
        status = "Recorded"
    }

    func recordedData() throws -> Data {
        guard let recordingURL else { throw APIClientError.server("No recording available.") }
        return try Data(contentsOf: recordingURL)
    }

    func storeReturned(data: Data, contentType: String, byteCount: Int) {
        returnedData = data
        returnedContentType = contentType
        returnedBytes = byteCount
        status = "Roundtrip complete"
    }

    nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        Task { @MainActor in
            updateRecordedBytes()
            status = flag ? "Recorded" : "Recording stopped"
        }
    }

    private func updateRecordedBytes() {
        guard let recordingURL else {
            recordedBytes = 0
            return
        }
        let attributes = try? FileManager.default.attributesOfItem(atPath: recordingURL.path)
        recordedBytes = attributes?[.size] as? Int ?? 0
    }
}

