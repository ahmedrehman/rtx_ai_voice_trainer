import SwiftUI

struct DebugView: View {
    @EnvironmentObject private var viewModel: TrainerViewModel
    @State private var backendResult = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Backend") {
                    TextField("Backend", text: Binding(
                        get: { viewModel.config.backendBaseURL.absoluteString },
                        set: { value in
                            if let url = URL(string: value) {
                                viewModel.config.backendBaseURL = url
                            }
                        }
                    ))
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)

                    Button("Test backend reachable") {
                        Task { backendResult = await viewModel.testBackendReachable() }
                    }

                    Button("Request realtime client secret") {
                        Task { await viewModel.requestRealtimeSecret() }
                    }

                    if !backendResult.isEmpty {
                        Text(backendResult)
                            .font(.footnote.monospaced())
                            .textSelection(.enabled)
                    }

                    if !viewModel.realtime.redactedClientSecretJSON.isEmpty {
                        Text(viewModel.realtime.redactedClientSecretJSON)
                            .font(.footnote.monospaced())
                            .textSelection(.enabled)
                    }
                }

                Section("Microphone") {
                    Button("Request permission") {
                        Task { await viewModel.requestMicPermission() }
                    }

                    HStack {
                        Button(viewModel.micMonitor.isRunning ? "Stop mic monitor" : "Start mic monitor") {
                            viewModel.micMonitor.isRunning ? viewModel.stopMicMonitor() : viewModel.startMicMonitor()
                        }
                        Spacer()
                        Text(viewModel.micMonitor.voiceDetected ? "Voice" : "No voice")
                            .foregroundStyle(viewModel.micMonitor.voiceDetected ? .green : .secondary)
                    }

                    ProgressView(value: viewModel.micMonitor.rms, total: 0.2)
                    Text("Input: \(viewModel.audioSession.inputRoute)")
                    Text("Permission: \(viewModel.audioSession.permissionGranted ? "Granted" : "Not granted")")
                }

                Section("Speaker") {
                    Button("Play local tone") {
                        viewModel.speaker.playTone()
                    }
                    Text(viewModel.speaker.status)
                    Text("Output: \(viewModel.audioSession.outputRoute)")
                }

                Section("Voice Pack AI") {
                    Toggle("Listen records voice pack", isOn: $viewModel.listenOn)
                    LabeledContent("Session", value: viewModel.sessionState.rawValue)
                    LabeledContent("Recorder", value: viewModel.voiceRecorder.status)
                    LabeledContent("Last pack", value: "\(viewModel.voiceRecorder.lastByteCount) bytes")

                    ForEach(viewModel.realtime.eventLog.indices, id: \.self) { index in
                        Text(viewModel.realtime.eventLog[index])
                            .font(.footnote)
                    }
                }

                Section("Exact App Audio") {
                    HStack {
                        Button("Record exact pack") {
                            viewModel.startExactVoicePackTest()
                        }
                        Button("Stop") {
                            viewModel.stopExactVoicePackTest()
                        }
                    }

                    Button("Play exact pack") {
                        viewModel.playExactVoicePack()
                    }
                    .disabled(viewModel.exactVoicePackBytes == 0)

                    Button("Send exact server echo") {
                        Task { await viewModel.sendExactVoicePackRoundtrip() }
                    }
                    .disabled(viewModel.exactVoicePackBytes == 0)

                    Button("Play server echo") {
                        viewModel.playExactRoundtrip()
                    }
                    .disabled(viewModel.exactRoundtripBytes == 0)

                    Button("Send exact AI stream") {
                        Task { await viewModel.sendExactVoicePackToAIStream() }
                    }
                    .disabled(viewModel.exactVoicePackBytes == 0)

                    Button("Play exact AI response") {
                        viewModel.playExactAIResponse()
                    }
                    .disabled(viewModel.exactAIText.isEmpty)

                    LabeledContent("Status", value: viewModel.exactVoicePackStatus)
                    LabeledContent("Recorded", value: "\(viewModel.exactVoicePackBytes) bytes")
                    LabeledContent("Echo", value: "\(viewModel.exactRoundtripBytes) bytes")
                    if !viewModel.exactAIText.isEmpty {
                        Text(viewModel.exactAIText)
                            .font(.footnote)
                            .textSelection(.enabled)
                    }
                    if !viewModel.exactAIEvents.isEmpty {
                        Text(viewModel.exactAIEvents)
                            .font(.footnote.monospaced())
                            .textSelection(.enabled)
                    }
                }

                Section("Server Roundtrip") {
                    HStack {
                        Button("Record sample") {
                            viewModel.roundtrip.startRecording()
                        }
                        Button("Stop") {
                            viewModel.roundtrip.stopRecording()
                        }
                    }

                    Button("Send to server roundtrip") {
                        Task { await viewModel.uploadRoundtripRecording() }
                    }

                    Button("Play returned audio") {
                        if let data = viewModel.roundtrip.returnedData {
                            try? viewModel.speaker.play(data: data)
                        }
                    }
                    .disabled(viewModel.roundtrip.returnedData == nil)

                    LabeledContent("Status", value: viewModel.roundtrip.status)
                    LabeledContent("Request size", value: "\(viewModel.roundtrip.recordedBytes) bytes")
                    LabeledContent("Response size", value: "\(viewModel.roundtrip.returnedBytes) bytes")
                    LabeledContent("Content type", value: viewModel.roundtrip.returnedContentType)
                }
            }
            .navigationTitle("Debug")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.audioSession.refreshRoute()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("Refresh route")
                }
            }
        }
    }
}
