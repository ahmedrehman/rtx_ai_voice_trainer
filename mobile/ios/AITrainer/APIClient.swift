import Foundation

enum APIClientError: LocalizedError {
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            "Invalid server response."
        case .server(let message):
            message
        }
    }
}

struct APIClient {
    var config: AppConfig
    var session: URLSession = .shared

    func providers() async throws -> String {
        let request = URLRequest(url: config.backendBaseURL.appending(path: "/api/providers"))
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return String(data: data, encoding: .utf8) ?? ""
    }

    func textChat(text: String, history: [String], topic: TopicPreset, freeChatOn: Bool, speakEnabled: Bool) async throws -> VoiceAgentTextChatResponse {
        var request = URLRequest(url: config.backendBaseURL.appending(path: "/api/voice-agent/text-chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "textUserChat": text,
            "history5LastTextChats": history,
            "provider": "openai",
            "voice": AppDefaults.voice,
            "speakEnabled": speakEnabled,
            "settings": [
                "languageName": topic.languageName,
                "topicId": topic.id,
                "topic": topic.topic,
                "keywordOn": AppDefaults.keywordOn,
                "keywordOff": AppDefaults.keywordOff,
                "allowFreeChat": freeChatOn,
                "voice": AppDefaults.voice
            ],
            "additionalInstructions": "",
            "promptConfig": [
                "systemTask": freeChatOn
                    ? "Answer normal questions directly. Correct only when the user clearly asks for language feedback."
                    : "Correct or confirm the latest practice sentence briefly.",
                "howToRespond": freeChatOn
                    ? "Be concise and natural."
                    : "For corrections, return the corrected sentence only. For correct practice text, return no correction.",
                "responseJsonFormat": """
                {"flags":{"has_corrections":boolean,"correction_type":"none|pronunciation|accent|grammar|vocabulary|meaning","is_chat_answer_or_correction":"none|chat_answer|correction"},"chat_text_to_user":"string","text_corrected":"string","hint":"string"}
                """
            ]
        ])

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(VoiceAgentTextChatResponse.self, from: data)
    }

    func realtimeClientSecret(topic: TopicPreset) async throws -> String {
        var request = URLRequest(url: config.backendBaseURL.appending(path: "/api/voice-agent/realtime-client-secret"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "model": "gpt-realtime",
            "voice": AppDefaults.voice,
            "instructions": [
                "You are AI Voice Trainer.",
                "Topic: \(topic.topic).",
                "Give concise language practice feedback.",
                "Do not decide app playback rules."
            ].joined(separator: "\n")
        ])

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return String(data: data, encoding: .utf8) ?? ""
    }

    func audioRoundtrip(data: Data, contentType: String) async throws -> (data: Data, contentType: String, byteCount: Int) {
        var request = URLRequest(url: config.backendBaseURL.appending(path: "/api/voice-agent/audio-roundtrip"))
        request.httpMethod = "POST"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = data

        let (responseData, response) = try await session.data(for: request)
        try validate(response: response, data: responseData)

        let http = response as? HTTPURLResponse
        return (
            responseData,
            http?.value(forHTTPHeaderField: "Content-Type") ?? "application/octet-stream",
            Int(http?.value(forHTTPHeaderField: "X-Audio-Roundtrip-Bytes") ?? "") ?? responseData.count
        )
    }

    func voiceTurnStream(audioData: Data, audioFormat: String, history: [String], topic: TopicPreset, freeChatOn: Bool) async throws -> VoiceTurnStreamResult {
        var request = URLRequest(url: config.backendBaseURL.appending(path: "/api/voice-agent/voice-turn-stream"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "audioBase64": audioData.base64EncodedString(),
            "audioFormat": audioFormat,
            "textUserChat": "",
            "history5LastTextChats": freeChatOn ? history : [],
            "provider": "openai",
            "voice": AppDefaults.voice,
            "settings": [
                "languageName": topic.languageName,
                "topicId": topic.id,
                "topic": topic.topic,
                "keywordOn": AppDefaults.keywordOn,
                "keywordOff": AppDefaults.keywordOff,
                "allowFreeChat": freeChatOn,
                "voice": AppDefaults.voice
            ],
            "additionalInstructions": voiceTurnInstructions(freeChatOn: freeChatOn)
        ])

        let (bytes, response) = try await session.bytes(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            var body = Data()
            for try await byte in bytes {
                body.append(byte)
            }
            let message = String(data: body, encoding: .utf8) ?? "Server returned \(http.statusCode)."
            throw APIClientError.server(message)
        }

        var parser = VoiceTurnSSEParser()
        for try await line in bytes.lines {
            parser.consume(line: line)
        }
        return try parser.result()
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Server returned \(http.statusCode)."
            throw APIClientError.server(message)
        }
    }

    private func voiceTurnInstructions(freeChatOn: Bool) -> String {
        if freeChatOn {
            return [
                "This is one user audio pack. Treat it as the current user message.",
                "Free chat is enabled: answer the user's question or request normally.",
                "Be as short as possible. For simple questions, answer with only the result.",
                "Do not translate unless the user explicitly asks for translation.",
                "Do not correct unless the user explicitly asks for correction or feedback.",
                "Never react to your own previous audio if it appears in the microphone input."
            ].joined(separator: "\n")
        }
        return [
            "This is one user audio pack. Answer only this pack.",
            "If you mark the level, use exactly one app signal word at the start: SignalVert, SignalJaune, SignalOrange, or SignalRouge.",
            "A foreign accent is OK when the words are understandable: use SignalVert and do not correct it.",
            "Use SignalJaune only for a concrete pronunciation/accent issue that makes a word unclear.",
            "Use SignalOrange for vocabulary or meaning problems.",
            "Use SignalRouge only for a real grammar mistake or severe meaning mistake.",
            "Pronunciation or accent must never be SignalOrange or SignalRouge.",
            "Keep spoken correction text as short as possible after the signal word.",
            "Prefer 2 to 8 words. Never add filler or encouragement.",
            "Never react to your own previous audio if it appears in the microphone input."
        ].joined(separator: "\n")
    }
}

private struct VoiceTurnSSEParser {
    private var finalText = ""
    private var audioBase64 = ""
    private var audioFormat: String?
    private var correctionLevel = 0
    private var eventTypes: [String] = []
    private var errorMessage: String?

    mutating func consume(line: String) {
        guard line.hasPrefix("data: ") else { return }
        let jsonText = String(line.dropFirst(6))
        guard let data = jsonText.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = object["type"] as? String else {
            return
        }

        eventTypes.append(type)

        if type == "text_delta", let text = object["text"] as? String {
            finalText += text
            updateCorrectionLevel(from: text)
        }
        if type == "audio_transcript_delta", let text = object["text"] as? String {
            finalText += text
            updateCorrectionLevel(from: text)
        }
        if type == "audio_delta", let chunk = object["audioBase64"] as? String {
            audioBase64 += chunk
            audioFormat = object["audioFormat"] as? String ?? audioFormat
        }
        if type == "done" {
            if let text = object["text"] as? String {
                finalText = text
                updateCorrectionLevel(from: text)
            }
            if let audio = object["audio"] as? [String: Any],
               let completeAudio = audio["audioBase64"] as? String {
                audioBase64 = completeAudio
                audioFormat = audio["audioFormat"] as? String ?? audioFormat
            }
        }
        if type == "error", let status = object["status"] as? [String: Any] {
            errorMessage = status["error"] as? String ?? "Voice turn failed."
        }
    }

    func result() throws -> VoiceTurnStreamResult {
        if let errorMessage {
            throw APIClientError.server(errorMessage)
        }
        let stripped = stripSignal(finalText.trimmingCharacters(in: .whitespacesAndNewlines))
        return VoiceTurnStreamResult(
            text: stripped.isEmpty ? "OK" : stripped,
            audioData: Data(base64Encoded: audioBase64),
            audioFormat: audioFormat,
            correctionLevel: correctionLevel,
            events: eventTypes
        )
    }

    private mutating func updateCorrectionLevel(from text: String) {
        let lowercased = text.lowercased()
        if lowercased.contains("signalrouge") {
            correctionLevel = max(correctionLevel, 3)
        } else if lowercased.contains("signalorange") {
            correctionLevel = max(correctionLevel, 2)
        } else if lowercased.contains("signaljaune") {
            correctionLevel = max(correctionLevel, 1)
        } else if lowercased.contains("signalvert") {
            correctionLevel = max(correctionLevel, 0)
        }
    }

    private func stripSignal(_ text: String) -> String {
        text.replacingOccurrences(
            of: #"^\s*Signal(?:Vert|Jaune|Orange|Rouge)\s*[:,-]?\s*"#,
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
    }
}
