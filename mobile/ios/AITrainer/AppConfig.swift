import Foundation

struct AppConfig: Equatable {
    var backendBaseURL: URL

    static let live = AppConfig(backendBaseURL: URL(string: "https://aitutor.lernspass.net")!)
}

enum AppDefaults {
    static let voice = "marin"
    static let languageName = "French"
    static let keywordOn = "computer"
    static let keywordOff = "computer off"
}

