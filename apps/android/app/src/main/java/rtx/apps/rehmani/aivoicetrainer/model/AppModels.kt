package rtx.apps.rehmani.aivoicetrainer.model

enum class SignalLevel {
    Green,
    Yellow,
    Orange,
    Red
}

enum class SpeakLevel(val label: String) {
    Yellow("Yellow"),
    Orange("Orange"),
    Red("Red")
}

data class ChatMessage(
    val id: Long,
    val fromUser: Boolean,
    val text: String,
    val signal: SignalLevel? = null
)
