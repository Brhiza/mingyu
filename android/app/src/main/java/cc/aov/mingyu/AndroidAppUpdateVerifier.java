package cc.aov.mingyu;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class AndroidAppUpdateVerifier {
    private static final Set<String> REDIRECT_HOSTS = Set.of(
        "github.com",
        "gh-proxy.com",
        "ghfast.top",
        "lanzou-cloudflare-api.brhiza.workers.dev",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com"
    );
    private static final Pattern RELEASE_ASSET_PATH_PATTERN = Pattern.compile(
        "^/Brhiza/mingyu/releases/download/(android-v\\d+\\.\\d+\\.\\d+)/([^/]+)$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern SHA256_PATTERN = Pattern.compile(
        "^([0-9a-fA-F]{64})(?:\\s+\\*?[^\\r\\n]+)?$"
    );

    private AndroidAppUpdateVerifier() {}

    static URL requireOfficialApkUrl(String rawUrl, URL checksumUrl) {
        Matcher checksumMatcher = RELEASE_ASSET_PATH_PATTERN.matcher(checksumUrl.getPath());
        if (!checksumMatcher.matches() || !checksumMatcher.group(2).toLowerCase(Locale.ROOT).endsWith(".apk.sha256")) {
            throw new IllegalArgumentException("更新校验地址无效。");
        }
        String tagName = checksumMatcher.group(1);
        String apkName = checksumMatcher.group(2).substring(0, checksumMatcher.group(2).length() - ".sha256".length());
        String version = tagName.substring("android-v".length());
        String githubPath = "/Brhiza/mingyu/releases/download/" + tagName + "/" + apkName;
        String acceleratedPath = "/https://github.com" + githubPath;
        final URL url;
        try {
            url = new URL(rawUrl == null ? "" : rawUrl.trim());
        } catch (MalformedURLException error) {
            throw new IllegalArgumentException("更新地址无效。", error);
        }
        String host = url.getHost().toLowerCase(Locale.ROOT);
        String path = url.getPath();
        boolean matches = "github.com".equals(host) && githubPath.equals(path)
            || "gh-proxy.com".equals(host) && acceleratedPath.equals(path)
            || "ghfast.top".equals(host) && acceleratedPath.equals(path)
            || "lanzou-cloudflare-api.brhiza.workers.dev".equals(host)
                && ("/v1/public/mingyu/" + version).equals(path);
        if (
            !"https".equalsIgnoreCase(url.getProtocol())
                || url.getUserInfo() != null
                || url.getPort() != -1
                || url.getQuery() != null
                || url.getRef() != null
                || !matches
        ) {
            throw new IllegalArgumentException("更新地址不是命语官方发布线路。");
        }
        return url;
    }

    static URL requireReleaseAssetUrl(String rawUrl, String expectedSuffix) {
        final URL url;
        try {
            url = new URL(rawUrl == null ? "" : rawUrl.trim());
        } catch (MalformedURLException error) {
            throw new IllegalArgumentException("更新地址无效。", error);
        }
        String path = url.getPath();
        if (
            !"https".equalsIgnoreCase(url.getProtocol()) ||
            url.getUserInfo() != null ||
            url.getPort() != -1 ||
            url.getQuery() != null ||
            url.getRef() != null ||
            !"github.com".equalsIgnoreCase(url.getHost()) ||
            path == null ||
            !RELEASE_ASSET_PATH_PATTERN.matcher(path).matches() ||
            !path.toLowerCase(Locale.ROOT).endsWith(expectedSuffix)
        ) {
            throw new IllegalArgumentException("更新地址不是命语官方 GitHub Release。");
        }
        return url;
    }

    static void requireMatchingReleaseAssets(URL apkUrl, URL checksumUrl) {
        Matcher apkMatcher = RELEASE_ASSET_PATH_PATTERN.matcher(apkUrl.getPath());
        Matcher checksumMatcher = RELEASE_ASSET_PATH_PATTERN.matcher(checksumUrl.getPath());
        if (
            !apkMatcher.matches() ||
            !checksumMatcher.matches() ||
            !apkMatcher.group(1).equalsIgnoreCase(checksumMatcher.group(1)) ||
            !checksumMatcher.group(2).equalsIgnoreCase(apkMatcher.group(2) + ".sha256")
        ) {
            throw new IllegalArgumentException("更新包和校验文件不匹配。");
        }
    }

    static boolean isAllowedRedirectUrl(URL url) {
        if (
            url == null ||
            !"https".equalsIgnoreCase(url.getProtocol()) ||
            url.getUserInfo() != null ||
            (url.getPort() != -1 && url.getPort() != 443) ||
            url.getRef() != null ||
            !REDIRECT_HOSTS.contains(url.getHost().toLowerCase(Locale.ROOT))
        ) {
            return false;
        }
        String host = url.getHost().toLowerCase(Locale.ROOT);
        if ("github.com".equals(host)) {
            return url.getQuery() == null && RELEASE_ASSET_PATH_PATTERN.matcher(url.getPath()).matches();
        }
        if ("lanzou-cloudflare-api.brhiza.workers.dev".equals(host)) {
            return url.getQuery() == null && url.getPath().matches("^/v1/public/mingyu/\\d+\\.\\d+\\.\\d+$");
        }
        return true;
    }

    static String parseSha256(String content) {
        String firstLine = content == null ? "" : content.trim().split("\\R", 2)[0].trim();
        Matcher matcher = SHA256_PATTERN.matcher(firstLine);
        if (!matcher.matches()) throw new IllegalArgumentException("更新校验文件格式不正确。");
        return matcher.group(1).toLowerCase(Locale.ROOT);
    }

    static String sha256(File file) throws IOException {
        final MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("当前设备不支持 SHA-256。", error);
        }
        byte[] buffer = new byte[32 * 1024];
        try (FileInputStream input = new FileInputStream(file)) {
            int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        StringBuilder value = new StringBuilder(64);
        for (byte item : digest.digest()) value.append(String.format(Locale.ROOT, "%02x", item));
        return value.toString();
    }
}
