package cc.aov.mingyu;

import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.Collator;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "AndroidAiAppLauncher")
public class AndroidAiAppLauncherPlugin extends Plugin {
    private static final String MIME_TYPE = "text/plain";

    private static final class TargetInfo {
        final String packageName;
        final String activityName;
        final String label;

        TargetInfo(String packageName, String activityName, String label) {
            this.packageName = packageName;
            this.activityName = activityName;
            this.label = label;
        }
    }

    @PluginMethod
    public void listTargets(PluginCall call) {
        PackageManager packageManager = getContext().getPackageManager();
        Intent probeIntent = buildSendIntent("命语提示词");
        List<ResolveInfo> resolved = packageManager.queryIntentActivities(
            probeIntent,
            PackageManager.MATCH_DEFAULT_ONLY
        );
        List<TargetInfo> targets = new ArrayList<>();
        Set<String> seenPackages = new HashSet<>();
        String ownPackage = getContext().getPackageName();

        for (ResolveInfo item : resolved) {
            ActivityInfo activity = item.activityInfo;
            if (
                activity == null ||
                !activity.enabled ||
                !activity.exported ||
                ownPackage.equals(activity.packageName) ||
                !seenPackages.add(activity.packageName)
            ) {
                continue;
            }
            CharSequence appLabel = activity.applicationInfo.loadLabel(packageManager);
            String label = appLabel == null ? activity.packageName : appLabel.toString().trim();
            if (label.isEmpty()) label = activity.packageName;
            targets.add(new TargetInfo(activity.packageName, activity.name, label));
        }

        Collator collator = Collator.getInstance(Locale.getDefault());
        targets.sort((left, right) -> collator.compare(left.label, right.label));

        JSArray targetArray = new JSArray();
        for (TargetInfo target : targets) {
            JSObject item = new JSObject();
            item.put("packageName", target.packageName);
            item.put("activityName", target.activityName);
            item.put("label", target.label);
            targetArray.put(item);
        }

        JSObject result = new JSObject();
        result.put("targets", targetArray);
        call.resolve(result);
    }

    @PluginMethod
    public void sendText(PluginCall call) {
        String packageName = trim(call.getString("packageName"));
        String activityName = trim(call.getString("activityName"));
        String text = call.getString("text");
        if (packageName.isEmpty() || activityName.isEmpty() || text == null || text.trim().isEmpty()) {
            call.reject("发送目标或提示词为空。");
            return;
        }

        ComponentName component = new ComponentName(packageName, activityName);
        PackageManager packageManager = getContext().getPackageManager();
        try {
            ActivityInfo activity = packageManager.getActivityInfo(component, 0);
            if (!activity.enabled || !activity.exported) {
                call.reject("所选应用当前无法接收文本。");
                return;
            }

            Intent intent = buildSendIntent(text);
            intent.setComponent(component);
            if (intent.resolveActivity(packageManager) == null) {
                call.reject("所选应用当前无法接收文本。");
                return;
            }
            getActivity().startActivity(intent);
            call.resolve();
        } catch (PackageManager.NameNotFoundException error) {
            call.reject("所选应用未安装，请重新选择。");
        } catch (RuntimeException error) {
            call.reject("无法打开所选应用，请重新选择。");
        }
    }

    private Intent buildSendIntent(String text) {
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType(MIME_TYPE);
        intent.putExtra(Intent.EXTRA_TEXT, text);
        intent.putExtra(Intent.EXTRA_TITLE, "命语提示词");
        return intent;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
