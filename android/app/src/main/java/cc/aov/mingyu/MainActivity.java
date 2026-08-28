package cc.aov.mingyu;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String ANDROID_BACK_SCRIPT =
        "(function(){var event=new Event('mingyu:android-back',{cancelable:true});" +
        "return !window.dispatchEvent(event);})()";
    private boolean backDispatchPending = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidAiAppLauncherPlugin.class);
        registerPlugin(AndroidDirectAiPlugin.class);
        registerPlugin(AndroidAppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    dispatchBackToWebApp();
                }
            }
        );
    }

    private void dispatchBackToWebApp() {
        if (backDispatchPending || bridge == null) return;
        WebView webView = bridge.getWebView();
        if (webView == null) {
            moveAppToBackground();
            return;
        }
        if (hideKeyboardIfVisible(webView)) return;

        backDispatchPending = true;
        webView.evaluateJavascript(
            ANDROID_BACK_SCRIPT,
            handled -> {
                backDispatchPending = false;
                if ("true".equals(handled)) return;
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    moveAppToBackground();
                }
            }
        );
    }

    private boolean hideKeyboardIfVisible(WebView webView) {
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(webView);
        if (insets == null || !insets.isVisible(WindowInsetsCompat.Type.ime())) return false;
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), webView);
        controller.hide(WindowInsetsCompat.Type.ime());
        return true;
    }

    private void moveAppToBackground() {
        if (!moveTaskToBack(true)) finish();
    }
}
