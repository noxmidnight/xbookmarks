package app.xbookmarks.mobile;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import androidx.browser.customtabs.CustomTabsIntent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens URLs in Brave when installed (Custom Tabs), falling back to the system browser.
 * The in-app Feed WebView cannot use Brave's engine — only external / Custom Tabs can.
 */
@CapacitorPlugin(name = "BraveBrowser")
public class BraveBrowserPlugin extends Plugin {
    private static final String[] BRAVE_PACKAGES = new String[] {
        "com.brave.browser",
        "com.brave.browser_beta",
        "com.brave.browser_nightly",
    };

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }

        String brave = findInstalledBrave();
        Uri uri = Uri.parse(url);

        try {
            CustomTabsIntent.Builder builder = new CustomTabsIntent.Builder();
            builder.setShowTitle(true);
            CustomTabsIntent tabs = builder.build();
            if (brave != null) {
                tabs.intent.setPackage(brave);
            }
            tabs.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            tabs.launchUrl(getContext(), uri);

            JSObject result = new JSObject();
            result.put("package", brave != null ? brave : "system");
            result.put("brave", brave != null);
            call.resolve(result);
        } catch (ActivityNotFoundException e) {
            try {
                Intent fallback = new Intent(Intent.ACTION_VIEW, uri);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (brave != null) {
                    fallback.setPackage(brave);
                }
                getContext().startActivity(fallback);
                JSObject result = new JSObject();
                result.put("package", brave != null ? brave : "system");
                result.put("brave", brave != null);
                call.resolve(result);
            } catch (ActivityNotFoundException e2) {
                call.reject("No browser available to open URL");
            }
        }
    }

    @PluginMethod
    public void isBraveInstalled(PluginCall call) {
        JSObject result = new JSObject();
        String pkg = findInstalledBrave();
        result.put("installed", pkg != null);
        result.put("package", pkg);
        call.resolve(result);
    }

    private String findInstalledBrave() {
        PackageManager pm = getContext().getPackageManager();
        for (String pkg : BRAVE_PACKAGES) {
            try {
                pm.getPackageInfo(pkg, 0);
                return pkg;
            } catch (PackageManager.NameNotFoundException ignored) {
            }
        }
        return null;
    }
}
