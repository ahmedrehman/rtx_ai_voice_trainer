import Foundation

@MainActor
final class TrainerViewModel: ObservableObject {
    @Published var config = AppConfig.live
    @Published var selectedTopic = TopicPreset.presets[0]
    @Published var listenOn = false {
        didSet { handleListenToggle() }
    }
    @Published var speakOn = false {
        didSet { applyRemoteAudioGate(reason: "speak changed") }
    }
    @Published var freeChatOn = false
    @Published var speakLevel: SpeakLevel = .yellow
    @Published var signal: Signal = .green
    @Published var typedText = ""
    @Published var messages: [ChatMessage] = []
    @Published var isSending = false
    @Published var lastError: String?

    @Published var micLevel: Double = 0
    @Published var micVoiceDetected = false
    @Published var aiSpeaking = false {
        didSet { realtime.setListenOn(listenOn, aiSpeaking: aiSpeaking) }
    }

    let audioSession = AudioSessionManager()
    let micMonitor = MicrophoneLevelMonitor()
    let speaker = SpeakerTonePlayer()
    let roundtrip = AudioRoundtripRecorder()
    let voiceRecorder = VoiceTurnRecorder()
    lazy var realtime = RealtimeSession { [weak self] in
        APIClient(config: self?.config ?? .live)
    }

    var sessionState: SessionState { realtime.sessionState }
    var peerState: PeerState { realtime.peerState }
    var dataChannelState: DataChannelState { realtime.dataChannelState }
    var outgoingMicEnabled: Bool { realtime.outgoingMicEnabled }
    var outgoingMicReason: OutgoingMicReason { realtime.outgoingMicReason }
    var remoteAudioMuted: Bool { realtime.remoteAudioMuted }

    private var apiClient: APIClient { APIClient(config: config) }

    func prepareAudioSession() async {
        await audioSession.configureForVoiceChat()
    }

    func requestMicPermission() async {
        audioSession.permissionGranted = await audioSession.requestMicrophonePermission()
        audioSession.refreshRoute()
    }

    func startMicMonitor() {
        micMonitor.start()
    }

    func stopMicMonitor() {
        micMonitor.stop()
    }

    func sendTypedText() async {
        let text = typedText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }

        typedText = ""
        isSending = true
        lastError = nil
        messages.append(ChatMessage(role: .user, text: text))

        do {
            let response = try await apiClient.textChat(
                text: text,
                history: recentHistory(),
                topic: selectedTopic,
                freeChatOn: freeChatOn,
                speakEnabled: speakOn
            )

            guard response.status.ok else {
                throw APIClientError.server(response.status.error ?? "Text chat failed.")
            }

            let assistantText = response.json.visibleText
            let turnSignal = freeChatOn ? Signal.green : response.json.signal
            let audioData = response.audio.flatMap { Data(base64Encoded: $0.audioBase64) }
            signal = turnSignal

            messages.append(ChatMessage(
                role: .assistant,
                text: assistantText,
                signal: freeChatOn ? nil : turnSignal,
                audioData: audioData,
                audioFormat: response.audio?.audioFormat
            ))

            if shouldAutoPlayAudio(signal: turnSignal, audioAvailable: audioData != nil), let audioData {
                aiSpeaking = true
                try speaker.play(data: audioData)
                aiSpeaking = false
            }
        } catch {
            lastError = error.localizedDescription
            messages.append(ChatMessage(role: .assistant, text: error.localizedDescription, signal: .red))
        }

        isSending = false
    }

    func startVoiceTurn() {
        lastError = nil
        Task {
            await prepareAudioSession()
            do {
                try voiceRecorder.start()
                realtime.sessionState = .listening
                realtime.eventLog.append("voice pack recording started")
            } catch {
                listenOn = false
                lastError = error.localizedDescription
            }
        }
    }

    func finishVoiceTurn() {
        guard voiceRecorder.isRecording else { return }
        Task {
            isSending = true
            realtime.sessionState = .starting
            lastError = nil
            do {
                let audioData = try voiceRecorder.stop()
                guard !audioData.isEmpty else {
                    throw APIClientError.server("Voice recording was empty.")
                }
                realtime.eventLog.append("send voice pack \(audioData.count) bytes")
                let result = try await apiClient.voiceTurnStream(
                    audioData: audioData,
                    audioFormat: "wav",
                    history: recentHistory(),
                    topic: selectedTopic,
                    freeChatOn: freeChatOn
                )
                applyVoiceTurn(result)
                realtime.eventLog.append("voice stream events: \(result.events.joined(separator: ", "))")
                realtime.sessionState = .connected
            } catch {
                lastError = error.localizedDescription
                messages.append(ChatMessage(role: .assistant, text: error.localizedDescription, signal: .red))
                realtime.sessionState = .error
            }
            isSending = false
        }
    }

    func playMessageAudio(_ message: ChatMessage) {
        guard let audioData = message.audioData else { return }
        do {
            try speaker.play(data: audioData)
        } catch {
            lastError = error.localizedDescription
        }
    }

    func testBackendReachable() async -> String {
        do {
            return try await apiClient.providers()
        } catch {
            return error.localizedDescription
        }
    }

    func requestRealtimeSecret() async {
        await realtime.connect(topic: selectedTopic)
    }

    func disconnectRealtime() {
        realtime.disconnect()
    }

    func uploadRoundtripRecording() async {
        do {
            let data = try roundtrip.recordedData()
            let result = try await apiClient.audioRoundtrip(data: data, contentType: "audio/mp4")
            roundtrip.storeReturned(data: result.data, contentType: result.contentType, byteCount: result.byteCount)
        } catch {
            roundtrip.status = error.localizedDescription
        }
    }

    private func recentHistory() -> [String] {
        messages
            .suffix(5)
            .map { "\($0.role.rawValue): \($0.text)" }
    }

    private func shouldAutoPlayAudio(signal: Signal, audioAvailable: Bool) -> Bool {
        guard speakOn, audioAvailable else { return false }
        if freeChatOn { return true }
        guard signal.level > 0 else { return false }
        return signal.level >= speakLevel.rawValue
    }

    private func applyVoiceTurn(_ result: VoiceTurnStreamResult) {
        let turnSignal = freeChatOn ? Signal.green : Signal.fromCorrectionLevel(result.correctionLevel)
        signal = turnSignal
        messages.append(ChatMessage(
            role: .assistant,
            text: result.text,
            signal: freeChatOn ? nil : turnSignal,
            audioData: result.audioData,
            audioFormat: result.audioFormat
        ))
        if shouldAutoPlayAudio(signal: turnSignal, audioAvailable: result.audioData != nil), let audioData = result.audioData {
            do {
                aiSpeaking = true
                try speaker.play(data: audioData)
                aiSpeaking = false
            } catch {
                lastError = error.localizedDescription
                aiSpeaking = false
            }
        }
    }

    private func handleListenToggle() {
        realtime.setListenOn(listenOn, aiSpeaking: aiSpeaking)
        if listenOn {
            startVoiceTurn()
        } else {
            finishVoiceTurn()
        }
    }

    private func applyRemoteAudioGate(reason: String) {
        if freeChatOn {
            realtime.setRemoteAudioMuted(!speakOn)
            return
        }
        let shouldSpeak = speakOn && signal.level > 0 && signal.level >= speakLevel.rawValue
        realtime.setRemoteAudioMuted(!shouldSpeak)
        realtime.eventLog.append("audio gate: \(reason)")
    }
}
