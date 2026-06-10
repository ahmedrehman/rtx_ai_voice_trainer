import Foundation

@MainActor
final class RealtimeSession: ObservableObject {
    @Published var sessionState: SessionState = .idle
    @Published var peerState: PeerState = .idle
    @Published var dataChannelState: DataChannelState = .idle
    @Published var outgoingMicEnabled = false
    @Published var outgoingMicReason: OutgoingMicReason = .listenOff
    @Published var remoteAudioMuted = true
    @Published var aiSpeaking = false
    @Published var eventLog: [String] = []
    @Published var redactedClientSecretJSON = ""

    private let apiClient: () -> APIClient

    init(apiClient: @escaping () -> APIClient) {
        self.apiClient = apiClient
    }

    func connect(topic: TopicPreset) async {
        sessionState = .starting
        peerState = .connecting
        dataChannelState = .connecting
        eventLog.append("request realtime client secret")

        do {
            let json = try await apiClient().realtimeClientSecret(topic: topic)
            redactedClientSecretJSON = Self.redactClientSecret(json)
            eventLog.append("client secret received")

            sessionState = .error
            peerState = .failed
            dataChannelState = .closed
            eventLog.append("WebRTC iOS framework not linked yet")
        } catch {
            sessionState = .error
            peerState = .failed
            dataChannelState = .closed
            eventLog.append(error.localizedDescription)
        }
    }

    func disconnect() {
        sessionState = .idle
        peerState = .disconnected
        dataChannelState = .closed
        outgoingMicEnabled = false
        outgoingMicReason = .listenOff
        remoteAudioMuted = true
        aiSpeaking = false
        eventLog.append("disconnect")
    }

    func setListenOn(_ listenOn: Bool, aiSpeaking: Bool) {
        if aiSpeaking {
            outgoingMicEnabled = false
            outgoingMicReason = .speakFeedback
        } else if listenOn {
            outgoingMicEnabled = true
            outgoingMicReason = .enabled
        } else {
            outgoingMicEnabled = false
            outgoingMicReason = .listenOff
        }
    }

    func setRemoteAudioMuted(_ muted: Bool) {
        remoteAudioMuted = muted
        eventLog.append(muted ? "remote audio muted" : "remote audio unmuted")
    }

    private static func redactClientSecret(_ text: String) -> String {
        text.replacingOccurrences(
            of: #"(?i)("(?:client_secret|secret|value)"\s*:\s*")[^"]+""#,
            with: "$1[redacted]\"",
            options: .regularExpression
        )
    }
}

