import AVFoundation
import Foundation

@MainActor
final class VoiceTurnRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published var isRecording = false
    @Published var lastByteCount = 0
    @Published var status = "Idle"

    private var recorder: AVAudioRecorder?
    private var recordingURL: URL?

    func start() throws {
        if isRecording { return }
        let url = FileManager.default.temporaryDirectory.appending(path: "ai-trainer-voice-turn.wav")
        try? FileManager.default.removeItem(at: url)
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatLinearPCM),
            AVSampleRateKey: 24_000,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false
        ]
        recorder = try AVAudioRecorder(url: url, settings: settings)
        recorder?.delegate = self
        recorder?.isMeteringEnabled = true
        recorder?.record()
        recordingURL = url
        isRecording = true
        status = "Recording"
    }

    func stop() throws -> Data {
        guard let recorder, let recordingURL else {
            throw APIClientError.server("No active voice recording.")
        }
        recorder.stop()
        self.recorder = nil
        isRecording = false
        let data = try Data(contentsOf: recordingURL)
        lastByteCount = data.count
        status = data.isEmpty ? "Empty recording" : "Recorded \(data.count) bytes"
        return data
    }

    func cancel() {
        recorder?.stop()
        recorder = nil
        isRecording = false
        status = "Idle"
    }
}

