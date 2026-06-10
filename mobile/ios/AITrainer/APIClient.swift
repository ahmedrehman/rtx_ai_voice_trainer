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

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Server returned \(http.statusCode)."
            throw APIClientError.server(message)
        }
    }
}

