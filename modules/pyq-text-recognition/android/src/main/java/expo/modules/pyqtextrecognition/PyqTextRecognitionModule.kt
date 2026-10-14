package expo.modules.pyqtextrecognition

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// On-device OCR through the unbundled ML Kit Latin recognizer (model lives in
// Google Play Services, not in the APK). Rejects with ERR_OCR_UNAVAILABLE when
// the model is not on the phone yet and cannot be downloaded right now.
class PyqTextRecognitionModule : Module() {
  private val recognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  override fun definition() = ModuleDefinition {
    Name("PyqTextRecognition")

    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        promise.reject(CodedException("ERR_OCR_IMAGE", e.message, e))
        return@AsyncFunction
      }
      recognizer.process(image)
        .addOnSuccessListener { result -> promise.resolve(mapOf("text" to result.text)) }
        .addOnFailureListener { e ->
          promise.reject(CodedException("ERR_OCR_UNAVAILABLE", e.message, e))
        }
    }

    OnDestroy {
      recognizer.close()
    }
  }
}
