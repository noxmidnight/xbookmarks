package app.xbookmarks.mobile;

import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Status / navigation bar heights in CSS px. The Feed dialog is positioned in
 * screen coordinates while the host WebView sits inside the system bars, and
 * env(safe-area-inset-*) in the host does not report the gap between them.
 */
@CapacitorPlugin(name = "SystemInsets")
public class SystemInsetsPlugin extends Plugin {

    @PluginMethod
    public void get(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            View decor = getActivity().getWindow().getDecorView();
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
            float density = getContext().getResources().getDisplayMetrics().density;
            JSObject result = new JSObject();
            if (insets == null) {
                result.put("top", 0);
                result.put("bottom", 0);
            } else {
                Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                result.put("top", bars.top / density);
                result.put("bottom", bars.bottom / density);
            }
            call.resolve(result);
        });
    }
}
