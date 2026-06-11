import AVFoundation

@MainActor
final class AudioSessionManager: ObservableObject {
    @Published var inputRoute = "Unknown"
    @Published var outputRoute = "Unknown"
    @Published var permissionGranted = false
    @Published var lastError: String?

    func configureForVoiceChat() async {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP])
            try session.setActive(true)
            permissionGranted = await requestMicrophonePermission()
            refreshRoute()
        } catch {
            lastError = error.localizedDescription
        }
    }

    func requestMicrophonePermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    func refreshRoute() {
        let route = AVAudioSession.sharedInstance().currentRoute
        inputRoute = route.inputs.map(\.portName).joined(separator: ", ")
        outputRoute = route.outputs.map(\.portName).joined(separator: ", ")
        if inputRoute.isEmpty { inputRoute = "No input" }
        if outputRoute.isEmpty { outputRoute = "No output" }
    }
}

