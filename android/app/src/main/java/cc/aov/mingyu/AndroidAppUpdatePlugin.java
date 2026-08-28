package cc.aov.mingyu;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name = "AndroidAppUpdate")
public class AndroidAppUpdatePlugin extends Plugin {
    private static final int CONNECT_TIMEOUT_MS = 20_000;
    private static final int READ_TIMEOUT_MS = 60_000;
    private static final int MAX_REDIRECTS = 5;
    private static final int MAX_CHECKSUM_BYTES = 4 * 1024;
    private static final long MAX_APK_BYTES = 150L * 1024L * 1024L;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            PackageManager packageManager = getContext().getPackageManager();
            PackageInfo info = packageManager.getPackageInfo(getContext().getPackageName(), 0);
            JSObject result = new JSObject();
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            result.put(
                "versionCode",
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? info.getLongVersionCode()
                    : info.versionCode
            );
            result.put("canInstallPackages", canInstallPackages(packageManager));
            call.resolve(result);
        } catch (PackageManager.NameNotFoundException error) {
            call.reject("无法读取当前应用版本。", error);
        }
    }

    @PluginMethod
    public void openInstallPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            getActivity().startActivity(intent);
            call.resolve();
        } catch (RuntimeException error) {
            call.reject("无法打开安装权限设置。", error);
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        if (!canInstallPackages(getContext().getPackageManager())) {
            call.reject("请先允许命语安装应用更新。", "INSTALL_PERMISSION_REQUIRED");
            return;
        }

        final URL apkUrl;
        final URL checksumUrl;
        try {
            checksumUrl = AndroidAppUpdateVerifier.requireReleaseAssetUrl(
                call.getString("checksumUrl"),
                ".sha256"
            );
            apkUrl = AndroidAppUpdateVerifier.requireOfficialApkUrl(call.getString("apkUrl"), checksumUrl);
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage(), error);
            return;
        }

        executor.execute(() -> downloadAndOpenInstaller(call, apkUrl, checksumUrl));
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private void downloadAndOpenInstaller(PluginCall call, URL apkUrl, URL checksumUrl) {
        File partialFile = null;
        try {
            String expectedSha256 = AndroidAppUpdateVerifier.parseSha256(
                downloadText(checksumUrl, MAX_CHECKSUM_BYTES)
            );
            File downloads = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (downloads == null) throw new IOException("设备没有可用的下载目录。");
            File updateDirectory = new File(downloads, "updates");
            if (!updateDirectory.exists() && !updateDirectory.mkdirs()) {
                throw new IOException("无法创建更新目录。");
            }
            partialFile = new File(updateDirectory, "mingyu-update.apk.part");
            File apkFile = new File(updateDirectory, "mingyu-update.apk");
            downloadFile(apkUrl, partialFile, MAX_APK_BYTES);
            String actualSha256 = AndroidAppUpdateVerifier.sha256(partialFile);
            if (!expectedSha256.equals(actualSha256)) throw new IOException("更新包校验失败，请重新下载。");
            if (apkFile.exists() && !apkFile.delete()) throw new IOException("无法替换旧更新包。");
            if (!partialFile.renameTo(apkFile)) throw new IOException("无法保存更新包。");
            partialFile = null;
            openInstaller(call, apkFile);
        } catch (IllegalArgumentException | IOException | SecurityException error) {
            if (partialFile != null && partialFile.exists()) partialFile.delete();
            call.reject(error.getMessage() == null ? "下载更新失败，请稍后重试。" : error.getMessage(), error);
        }
    }

    private void openInstaller(PluginCall call, File apkFile) {
        getActivity().runOnUiThread(() -> {
            try {
                Uri uri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apkFile
                );
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                    call.reject("设备上没有可用的安装程序。");
                    return;
                }
                getActivity().startActivity(intent);
                call.resolve();
            } catch (RuntimeException error) {
                call.reject("无法打开系统安装页面。", error);
            }
        });
    }

    private String downloadText(URL url, int limit) throws IOException {
        HttpsURLConnection connection = openConnection(url);
        try {
            long contentLength = connection.getContentLengthLong();
            if (contentLength > limit) throw new IOException("更新校验文件过大。");
            try (
                InputStream input = connection.getInputStream();
                ByteArrayOutputStream output = new ByteArrayOutputStream()
            ) {
                copyWithLimit(input, output, limit);
                return output.toString(StandardCharsets.UTF_8);
            }
        } finally {
            connection.disconnect();
        }
    }

    private void downloadFile(URL url, File destination, long limit) throws IOException {
        HttpsURLConnection connection = openConnection(url);
        try {
            long contentLength = connection.getContentLengthLong();
            if (contentLength > limit) throw new IOException("更新包过大，已停止下载。");
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(destination)) {
                copyWithLimit(input, output, limit);
            }
        } finally {
            connection.disconnect();
        }
    }

    private HttpsURLConnection openConnection(URL initialUrl) throws IOException {
        URL currentUrl = initialUrl;
        for (int redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
            HttpsURLConnection connection = (HttpsURLConnection) currentUrl.openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/octet-stream, text/plain");
            connection.setRequestProperty("User-Agent", "Mingyu-Android-Updater");
            connection.setUseCaches(false);
            int status = connection.getResponseCode();
            if (status >= 200 && status < 300) return connection;
            if (status < 300 || status >= 400 || redirectCount == MAX_REDIRECTS) {
                connection.disconnect();
                throw new IOException("更新线路下载失败（" + status + "）。");
            }
            String location = connection.getHeaderField("Location");
            URL nextUrl = location == null ? null : new URL(currentUrl, location);
            connection.disconnect();
            if (!AndroidAppUpdateVerifier.isAllowedRedirectUrl(nextUrl)) {
                throw new IOException("更新线路返回了不受信任的地址。");
            }
            currentUrl = nextUrl;
        }
        throw new IOException("更新线路重定向次数过多。");
    }

    private void copyWithLimit(InputStream input, java.io.OutputStream output, long limit) throws IOException {
        byte[] buffer = new byte[32 * 1024];
        long total = 0;
        int count;
        while ((count = input.read(buffer)) != -1) {
            total += count;
            if (total > limit) throw new IOException("更新文件超过允许大小。");
            output.write(buffer, 0, count);
        }
    }

    private boolean canInstallPackages(PackageManager packageManager) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls();
    }
}
