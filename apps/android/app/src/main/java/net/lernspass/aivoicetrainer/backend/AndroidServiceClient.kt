package net.lernspass.aivoicetrainer.backend

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class AndroidServiceClient(
    private val baseUrl: String,
    private val httpClient: OkHttpClient = OkHttpClient()
) {
    suspend fun health(): String = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/api/androidservice/health")
            .get()
            .build()

        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("Backend returned ${response.code}")
            response.body?.string().orEmpty()
        }
    }

    suspend fun textChat(text: String, topic: String, freeChatOn: Boolean): String = withContext(Dispatchers.IO) {
        val bodyJson = JSONObject()
            .put("textUserChat", text)
            .put("settings", JSONObject().put("topic", topic))
            .put("freeChatOn", freeChatOn)

        val request = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/api/androidservice/text-chat")
            .post(bodyJson.toString().toRequestBody("application/json".toMediaType()))
            .build()

        httpClient.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) error(raw.ifBlank { "Backend returned ${response.code}" })
            raw
        }
    }
}
