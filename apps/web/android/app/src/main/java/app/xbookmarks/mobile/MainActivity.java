package app.xbookmarks.mobile;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // X login / session cookies in the feed WebView need cookies enabled.
        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        if (getBridge() != null && getBridge().getWebView() != null) {
            cookies.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
        }

        // Debug-only: chrome://inspect for the host WebView
        WebView.setWebContentsDebuggingEnabled(true);
    }
}
