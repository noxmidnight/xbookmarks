package app.xbookmarks.mobile;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.webkit.CookieManager;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private final ViewTreeObserver.OnGlobalLayoutListener cookieEnabler =
        new ViewTreeObserver.OnGlobalLayoutListener() {
            @Override
            public void onGlobalLayout() {
                enableCookiesOnAllWebViews(getWindow().getDecorView());
            }
        };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep system nav/status bars from drawing under our WebView chrome.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);

        // Host Capacitor WebView (Appwrite PWA).
        if (getBridge() != null && getBridge().getWebView() != null) {
            cookies.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
        }

        // Capgo Feed WebView is created later — re-enable third-party cookies
        // whenever the view tree changes (required for X / Google auth cookies).
        View decor = getWindow().getDecorView();
        decor.getViewTreeObserver().addOnGlobalLayoutListener(cookieEnabler);
        decor.post(() -> enableCookiesOnAllWebViews(decor));

        // Debug-only: chrome://inspect for the host WebView
        WebView.setWebContentsDebuggingEnabled(true);
    }

    @Override
    public void onDestroy() {
        try {
            getWindow()
                .getDecorView()
                .getViewTreeObserver()
                .removeOnGlobalLayoutListener(cookieEnabler);
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }

    private void enableCookiesOnAllWebViews(View root) {
        if (root == null) return;
        if (root instanceof WebView) {
            WebView webView = (WebView) root;
            CookieManager mgr = CookieManager.getInstance();
            mgr.setAcceptCookie(true);
            mgr.setAcceptThirdPartyCookies(webView, true);
            return;
        }
        if (root instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) root;
            for (int i = 0; i < group.getChildCount(); i++) {
                enableCookiesOnAllWebViews(group.getChildAt(i));
            }
        }
    }
}
