import AVFoundation
import Foundation

@MainActor
final class MicrophoneLevelMonitor: ObservableObject {
    @Published var rms: Double = 0
    @Published var voiceDetected = false
    @Published var isRunning = false
    @Published var lastError: String?

    private let engine = AVAudioEngine()

    func start() {
        guard !isRunning else { return }
        do {
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                let value = Self.rmsValue(buffer: buffer)
                Task { @MainActor in
                    self?.rms = value
                    self?.voiceDetected = value > 0.035
                }
            }
            engine.prepare()
            try engine.start()
            isRunning = true
        } catch {
            lastError = error.localizedDescription
            stop()
        }
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        isRunning = false
        rms = 0
        voiceDetected = false
    }

    private static func rmsValue(buffer: AVAudioPCMBuffer) -> Double {
        guard let channelData = buffer.floatChannelData else { return 0 }
        let frames = Int(buffer.frameLength)
        guard frames > 0 else { return 0 }

        let samples = channelData[0]
        var sum: Float = 0
        for index in 0..<frames {
            sum += samples[index] * samples[index]
        }
        return Double(sqrt(sum / Float(frames)))
    }
}

