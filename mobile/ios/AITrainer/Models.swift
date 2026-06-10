import Foundation
import SwiftUI

enum ChatRole: String, Codable {
    case user
    case assistant
    case system
}

struct ChatMessage: Identifiable, Equatable {
    let id: UUID
    let role: ChatRole
    let text: String
    let createdAt: Date
    var signal: Signal?
    var audioData: Data?
    var audioFormat: String?

    init(id: UUID = UUID(), role: ChatRole, text: String, createdAt: Date = Date(), signal: Signal? = nil, audioData: Data? = nil, audioFormat: String? = nil) {
        self.id = id
        self.role = role
        self.text = text
        self.createdAt = createdAt
        self.signal = signal
        self.audioData = audioData
        self.audioFormat = audioFormat
    }
}

struct TopicPreset: Identifiable, Hashable {
    let id: String
    let label: String
    let languageName: String
    let topic: String
}

extension TopicPreset {
    static let presets = [
        TopicPreset(
            id: "french_for_german",
            label: "French for German learners",
            languageName: "French",
            topic: "French speaking practice for a German learner"
        ),
        TopicPreset(
            id: "history",
            label: "History discussion",
            languageName: "French",
            topic: "A history discussion in French"
        ),
        TopicPreset(
            id: "custom",
            label: "Daily conversation",
            languageName: "French",
            topic: "Daily French conversation practice"
        )
    ]
}

enum SpeakLevel: Int, CaseIterable, Identifiable {
    case yellow = 1
    case orange = 2
    case red = 3

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .yellow: "Yellow+"
        case .orange: "Orange+"
        case .red: "Red"
        }
    }
}

enum Signal: String, CaseIterable, Codable {
    case green
    case yellow
    case orange
    case red

    var level: Int {
        switch self {
        case .green: 0
        case .yellow: 1
        case .orange: 2
        case .red: 3
        }
    }

    var color: Color {
        switch self {
        case .green: .green
        case .yellow: .yellow
        case .orange: .orange
        case .red: .red
        }
    }

    var title: String { rawValue.capitalized }
}

enum SessionState: String {
    case idle
    case starting
    case connected
    case listening
    case playing
    case error
}

enum PeerState: String {
    case idle
    case connecting
    case connected
    case disconnected
    case failed
}

enum DataChannelState: String {
    case idle
    case connecting
    case open
    case closing
    case closed
}

enum OutgoingMicReason: String {
    case listenOff = "listen_off"
    case speakFeedback = "speak_feedback"
    case enabled
}

struct VoiceAgentTextChatResponse: Decodable {
    struct Status: Decodable {
        let ok: Bool
        let error: String?
    }

    struct Payload: Decodable {
        struct Flags: Decodable {
            let hasCorrections: Bool
            let correctionType: String
            let isChatAnswerOrCorrection: String

            enum CodingKeys: String, CodingKey {
                case hasCorrections = "has_corrections"
                case correctionType = "correction_type"
                case isChatAnswerOrCorrection = "is_chat_answer_or_correction"
            }
        }

        let flags: Flags
        let chatTextToUser: String
        let textCorrected: String
        let hint: String

        enum CodingKeys: String, CodingKey {
            case flags
            case chatTextToUser = "chat_text_to_user"
            case textCorrected = "text_corrected"
            case hint
        }
    }

    struct Audio: Decodable {
        let audioBase64: String
        let audioFormat: String
        let model: String?
    }

    let status: Status
    let json: Payload
    let audio: Audio?
}

struct VoiceTurnStreamResult {
    var text: String
    var audioData: Data?
    var audioFormat: String?
    var correctionLevel: Int
    var events: [String]
}

extension VoiceAgentTextChatResponse.Payload {
    var visibleText: String {
        let candidates = [chatTextToUser, textCorrected, hint].map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        return candidates.first(where: { !$0.isEmpty }) ?? "OK"
    }

    var signal: Signal {
        guard flags.hasCorrections else { return .green }
        switch flags.correctionType {
        case "pronunciation", "accent":
            return .yellow
        case "vocabulary", "meaning":
            return .orange
        case "grammar":
            return .red
        default:
            return .green
        }
    }
}

extension Signal {
    static func fromCorrectionLevel(_ level: Int) -> Signal {
        if level == 1 { return .yellow }
        if level == 2 { return .orange }
        if level >= 3 { return .red }
        return .green
    }
}
