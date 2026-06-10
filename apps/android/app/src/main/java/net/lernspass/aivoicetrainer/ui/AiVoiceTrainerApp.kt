package net.lernspass.aivoicetrainer.ui

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.SettingsVoice
import androidx.compose.material.icons.filled.Speaker
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import net.lernspass.aivoicetrainer.AppConfig
import net.lernspass.aivoicetrainer.backend.AndroidServiceClient
import net.lernspass.aivoicetrainer.model.ChatMessage
import net.lernspass.aivoicetrainer.model.SignalLevel
import net.lernspass.aivoicetrainer.model.SpeakLevel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiVoiceTrainerApp() {
    val client = remember { AndroidServiceClient(AppConfig.backendBaseUrl) }
    val scope = rememberCoroutineScope()
    val messages = remember {
        mutableStateListOf(
            ChatMessage(1, false, "Ready.", SignalLevel.Green)
        )
    }

    var topic by remember { mutableStateOf("Daily") }
    var listenOn by remember { mutableStateOf(false) }
    var speakOn by remember { mutableStateOf(false) }
    var freeChatOn by remember { mutableStateOf(false) }
    var speakLevel by remember { mutableStateOf(SpeakLevel.Yellow) }
    var input by remember { mutableStateOf("") }
    var selectedTab by remember { mutableStateOf(0) }
    var debugOpen by remember { mutableStateOf(false) }
    var micPermission by remember { mutableStateOf("unknown") }
    var backendStatus by remember { mutableStateOf("idle") }
    var micLevel by remember { mutableFloatStateOf(0.0f) }

    val micPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        micPermission = if (granted) "granted" else "denied"
        listenOn = granted && listenOn
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = "AI Voice Trainer",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                actions = {
                    IconButton(onClick = { debugOpen = true }) {
                        Icon(Icons.Filled.BugReport, contentDescription = "Debug")
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Filled.SettingsVoice, contentDescription = null) },
                    label = { Text("Trainer") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Filled.GraphicEq, contentDescription = null) },
                    label = { Text("Signal") }
                )
            }
        },
        contentWindowInsets = WindowInsets(0.dp)
    ) { innerPadding ->
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            color = MaterialTheme.colorScheme.background
        ) {
            if (selectedTab == 0) {
                TrainerScreen(
                    topic = topic,
                    onTopicChange = { topic = it },
                    listenOn = listenOn,
                    onListenChange = {
                        listenOn = it
                        if (it) micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    },
                    speakOn = speakOn,
                    onSpeakChange = { speakOn = it },
                    freeChatOn = freeChatOn,
                    onFreeChatChange = { freeChatOn = it },
                    speakLevel = speakLevel,
                    onSpeakLevelChange = { speakLevel = it },
                    messages = messages,
                    input = input,
                    onInputChange = { input = it },
                    onSend = {
                        val text = input.trim()
                        if (text.isNotEmpty()) {
                            messages.add(ChatMessage(System.nanoTime(), true, text))
                            input = ""
                            scope.launch {
                                runCatching { client.textChat(text, topic, freeChatOn) }
                                    .onSuccess { messages.add(ChatMessage(System.nanoTime(), false, it, SignalLevel.Green)) }
                                    .onFailure { messages.add(ChatMessage(System.nanoTime(), false, it.message ?: "Request failed.", SignalLevel.Red)) }
                            }
                        }
                    }
                )
            } else {
                SignalScreen(
                    listenOn = listenOn,
                    speakOn = speakOn,
                    micPermission = micPermission,
                    backendStatus = backendStatus,
                    micLevel = micLevel,
                    onFakeLevel = { micLevel = if (micLevel < 0.9f) micLevel + 0.18f else 0.05f }
                )
            }
        }
    }

    if (debugOpen) {
        DebugSheet(
            backendStatus = backendStatus,
            micPermission = micPermission,
            onDismiss = { debugOpen = false },
            onTestBackend = {
                backendStatus = "checking"
                scope.launch {
                    backendStatus = runCatching { client.health() }
                        .fold(onSuccess = { "reachable" }, onFailure = { it.message ?: "error" })
                }
            },
            onRequestMic = { micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO) }
        )
    }
}

@Composable
private fun TrainerScreen(
    topic: String,
    onTopicChange: (String) -> Unit,
    listenOn: Boolean,
    onListenChange: (Boolean) -> Unit,
    speakOn: Boolean,
    onSpeakChange: (Boolean) -> Unit,
    freeChatOn: Boolean,
    onFreeChatChange: (Boolean) -> Unit,
    speakLevel: SpeakLevel,
    onSpeakLevelChange: (SpeakLevel) -> Unit,
    messages: List<ChatMessage>,
    input: String,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        TopicRow(topic, onTopicChange)
        ControlPanel(
            listenOn = listenOn,
            onListenChange = onListenChange,
            speakOn = speakOn,
            onSpeakChange = onSpeakChange,
            freeChatOn = freeChatOn,
            onFreeChatChange = onFreeChatChange,
            speakLevel = speakLevel,
            onSpeakLevelChange = onSpeakLevelChange
        )
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(messages, key = { it.id }) { message ->
                ChatBubble(message)
            }
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = onInputChange,
                modifier = Modifier.weight(1f),
                placeholder = { Text("Message") },
                maxLines = 4,
                shape = RoundedCornerShape(28.dp)
            )
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = onSend) {
                Icon(Icons.Filled.Send, contentDescription = "Send")
            }
        }
    }
}

@Composable
private fun TopicRow(topic: String, onTopicChange: (String) -> Unit) {
    val topics = listOf("Daily", "Travel", "Work", "School")
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        topics.forEach { item ->
            FilterChip(
                selected = topic == item,
                onClick = { onTopicChange(item) },
                label = { Text(item) },
                leadingIcon = if (topic == item) {
                    { Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ControlPanel(
    listenOn: Boolean,
    onListenChange: (Boolean) -> Unit,
    speakOn: Boolean,
    onSpeakChange: (Boolean) -> Unit,
    freeChatOn: Boolean,
    onFreeChatChange: (Boolean) -> Unit,
    speakLevel: SpeakLevel,
    onSpeakLevelChange: (SpeakLevel) -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            ToggleRow("Listen", listenOn, onListenChange)
            ToggleRow("Speak", speakOn, onSpeakChange)
            ToggleRow("Free chat", freeChatOn, onFreeChatChange)
            if (speakOn && !freeChatOn) {
                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    SpeakLevel.entries.forEachIndexed { index, level ->
                        SegmentedButton(
                            selected = speakLevel == level,
                            onClick = { onSpeakLevelChange(level) },
                            shape = SegmentedButtonDefaults.itemShape(index = index, count = SpeakLevel.entries.size),
                            label = { Text(level.label) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun ChatBubble(message: ChatMessage) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (message.fromUser) Arrangement.End else Arrangement.Start
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(0.86f),
            color = if (message.fromUser) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
            contentColor = if (message.fromUser) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
            shape = RoundedCornerShape(8.dp)
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.Top
            ) {
                message.signal?.let { SignalDot(it) }
                Text(message.text, style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

@Composable
private fun SignalDot(signal: SignalLevel) {
    val color = when (signal) {
        SignalLevel.Green -> Color(0xFF2E7D32)
        SignalLevel.Yellow -> Color(0xFFF9A825)
        SignalLevel.Orange -> Color(0xFFEF6C00)
        SignalLevel.Red -> Color(0xFFC62828)
    }
    Box(
        modifier = Modifier
            .padding(top = 5.dp)
            .size(10.dp)
            .clip(CircleShape)
            .background(color)
    )
}

@Composable
private fun SignalScreen(
    listenOn: Boolean,
    speakOn: Boolean,
    micPermission: String,
    backendStatus: String,
    micLevel: Float,
    onFakeLevel: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatusCard("Session", if (listenOn) "listening" else "idle")
        StatusCard("Playback", if (speakOn) "enabled" else "off")
        StatusCard("Microphone", micPermission)
        StatusCard("Backend", backendStatus)
        Card(shape = RoundedCornerShape(8.dp)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Mic level", fontWeight = FontWeight.Medium)
                LinearProgressIndicator(progress = { micLevel }, modifier = Modifier.fillMaxWidth())
                TextButton(onClick = onFakeLevel) {
                    Text("Sample")
                }
            }
        }
    }
}

@Composable
private fun StatusCard(label: String, value: String) {
    Card(shape = RoundedCornerShape(8.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            AssistChip(onClick = {}, label = { Text(value) })
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DebugSheet(
    backendStatus: String,
    micPermission: String,
    onDismiss: () -> Unit,
    onTestBackend: () -> Unit,
    onRequestMic: () -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text("Debug", style = MaterialTheme.typography.titleLarge)
            DebugActionRow("Backend", backendStatus, onTestBackend)
            DebugActionRow("Microphone", micPermission, onRequestMic)
            DebugActionRow("Speaker", "ready") {}
            DebugActionRow("WebRTC AI", "not connected") {}
            Spacer(Modifier.height(20.dp))
        }
    }
}

@Composable
private fun DebugActionRow(label: String, value: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
        Text(value, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant)
        IconButton(onClick = onClick) {
            Icon(Icons.Filled.Mic.takeIf { label == "Microphone" } ?: Icons.Filled.Speaker, contentDescription = label)
        }
    }
}
