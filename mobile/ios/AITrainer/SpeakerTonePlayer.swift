import AVFoundation
import Foundation

@MainActor
final class SpeakerTonePlayer: NSObject, ObservableObject, AVAudioPlayerDelegate {
    @Published var status = "Idle"
    private var player: AVAudioPlayer?

    func playTone() {
        do {
            let data = Self.toneWavData()
            try play(data: data)
            status = "Tone playing"
        } catch {
            status = error.localizedDescription
        }
    }

    func play(data: Data) throws {
        player?.stop()
        player = try AVAudioPlayer(data: data)
        player?.delegate = self
        player?.prepareToPlay()
        player?.play()
        status = "Playback started"
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            status = flag ? "Playback finished" : "Playback stopped"
        }
    }

    private static func toneWavData(sampleRate: Int = 44_100, duration: Double = 0.5, frequency: Double = 660) -> Data {
        let frameCount = Int(Double(sampleRate) * duration)
        var pcm = Data()
        for frame in 0..<frameCount {
            let phase = 2 * Double.pi * frequency * Double(frame) / Double(sampleRate)
            var sample = Int16(sin(phase) * 0.35 * Double(Int16.max)).littleEndian
            withUnsafeBytes(of: &sample) { pcm.append(contentsOf: $0) }
        }

        var data = Data()
        data.append("RIFF".data(using: .ascii)!)
        data.append(UInt32(36 + pcm.count).littleEndianData)
        data.append("WAVEfmt ".data(using: .ascii)!)
        data.append(UInt32(16).littleEndianData)
        data.append(UInt16(1).littleEndianData)
        data.append(UInt16(1).littleEndianData)
        data.append(UInt32(sampleRate).littleEndianData)
        data.append(UInt32(sampleRate * 2).littleEndianData)
        data.append(UInt16(2).littleEndianData)
        data.append(UInt16(16).littleEndianData)
        data.append("data".data(using: .ascii)!)
        data.append(UInt32(pcm.count).littleEndianData)
        data.append(pcm)
        return data
    }
}

private extension FixedWidthInteger {
    var littleEndianData: Data {
        var value = littleEndian
        return Data(bytes: &value, count: MemoryLayout<Self>.size)
    }
}

