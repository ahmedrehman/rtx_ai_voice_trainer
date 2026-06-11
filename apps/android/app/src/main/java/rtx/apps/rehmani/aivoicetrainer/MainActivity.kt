package rtx.apps.rehmani.aivoicetrainer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import rtx.apps.rehmani.aivoicetrainer.ui.AiVoiceTrainerApp
import rtx.apps.rehmani.aivoicetrainer.ui.theme.AiVoiceTrainerTheme

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
