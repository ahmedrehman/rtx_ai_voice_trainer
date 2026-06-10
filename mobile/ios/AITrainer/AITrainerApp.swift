import SwiftUI

@main
struct AITrainerApp: App {
    @StateObject private var viewModel = TrainerViewModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(viewModel)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var viewModel: TrainerViewModel

    var body: some View {
        TabView {
            TrainerView()
                .tabItem {
                    Label("Trainer", systemImage: "waveform.and.mic")
                }

            DebugView()
                .tabItem {
                    Label("Debug", systemImage: "stethoscope")
                }
        }
        .tint(.blue)
        .task {
            await viewModel.prepareAudioSession()
        }
    }
}

