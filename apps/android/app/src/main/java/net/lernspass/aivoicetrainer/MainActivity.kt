package net.lernspass.aivoicetrainer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import net.lernspass.aivoicetrainer.ui.AiVoiceTrainerApp
import net.lernspass.aivoicetrainer.ui.theme.AiVoiceTrainerTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AiVoiceTrainerTheme {
                AiVoiceTrainerApp()
            }
        }
    }
}
