import SwiftUI

struct TrainerView: View {
    @EnvironmentObject private var viewModel: TrainerViewModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                List {
                    Section {
                        Picker("Topic", selection: $viewModel.selectedTopic) {
                            ForEach(TopicPreset.presets) { topic in
                                Text(topic.label).tag(topic)
                            }
                        }

                        Toggle("Listen", isOn: $viewModel.listenOn)
                        Toggle("Speak", isOn: $viewModel.speakOn)
                        Toggle("Free chat", isOn: $viewModel.freeChatOn)

                        if viewModel.speakOn && !viewModel.freeChatOn {
                            Picker("Speak level", selection: $viewModel.speakLevel) {
                                ForEach(SpeakLevel.allCases) { level in
                                    Text(level.title).tag(level)
                                }
                            }
                            .pickerStyle(.segmented)
                        }
                    }

                    Section {
                        HStack {
                            Circle()
                                .fill(viewModel.signal.color)
                                .frame(width: 12, height: 12)
                            Text(viewModel.freeChatOn ? "Free chat" : viewModel.signal.title)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(viewModel.sessionState.rawValue)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Section {
                        ForEach(viewModel.messages) { message in
                            MessageRow(message: message) {
                                viewModel.playMessageAudio(message)
                            }
                        }
                    }
                }

                ComposerBar(
                    text: $viewModel.typedText,
                    isSending: viewModel.isSending,
                    onSend: {
                        Task { await viewModel.sendTypedText() }
                    }
                )
            }
            .navigationTitle("AI Voice Trainer")
            .alert("Error", isPresented: Binding(
                get: { viewModel.lastError != nil },
                set: { if !$0 { viewModel.lastError = nil } }
            )) {
                Button("OK", role: .cancel) { viewModel.lastError = nil }
            } message: {
                Text(viewModel.lastError ?? "")
            }
        }
    }
}

private struct MessageRow: View {
    let message: ChatMessage
    let playAudio: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if let signal = message.signal {
                Circle()
                    .fill(signal.color)
                    .frame(width: 10, height: 10)
                    .padding(.top, 6)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(message.role.rawValue.capitalized)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(message.text)
                    .font(.body)
                    .textSelection(.enabled)
            }

            Spacer()

            if message.audioData != nil {
                Button(action: playAudio) {
                    Image(systemName: "play.circle")
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Play audio")
            }
        }
        .padding(.vertical, 4)
    }
}

private struct ComposerBar: View {
    @Binding var text: String
    let isSending: Bool
    let onSend: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            TextField("Message", text: $text, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(1...4)
                .submitLabel(.send)
                .onSubmit(onSend)

            Button(action: onSend) {
                if isSending {
                    ProgressView()
                } else {
                    Image(systemName: "paperplane.fill")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isSending || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Send")
        }
        .padding()
        .background(.bar)
    }
}
