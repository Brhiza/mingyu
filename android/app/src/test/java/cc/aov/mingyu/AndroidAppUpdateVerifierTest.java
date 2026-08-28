package cc.aov.mingyu;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.net.URL;

import org.junit.Test;

public class AndroidAppUpdateVerifierTest {
    @Test
    public void onlyAcceptsOfficialReleaseAssets() throws Exception {
        URL apk = AndroidAppUpdateVerifier.requireReleaseAssetUrl(
            "https://github.com/Brhiza/mingyu/releases/download/android-v1.2.3/mingyu-1.2.3.apk",
            ".apk"
        );
        assertEquals("github.com", apk.getHost());

        assertThrows(
            IllegalArgumentException.class,
            () -> AndroidAppUpdateVerifier.requireReleaseAssetUrl(
                "https://example.com/Brhiza/mingyu/releases/download/android-v1.2.3/mingyu.apk",
                ".apk"
            )
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> AndroidAppUpdateVerifier.requireReleaseAssetUrl(
                "https://github.com/other/repo/releases/download/android-v1.2.3/mingyu.apk",
                ".apk"
            )
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> AndroidAppUpdateVerifier.requireReleaseAssetUrl(
                "https://github.com/Brhiza/mingyu/releases/download/android-preview/mingyu.apk",
                ".apk"
            )
        );
    }

    @Test
    public void requiresAssetsFromTheSameRelease() throws Exception {
        URL apk = new URL(
            "https://github.com/Brhiza/mingyu/releases/download/android-v1.2.3/mingyu-1.2.3.apk"
        );
        URL checksum = new URL(
            "https://github.com/Brhiza/mingyu/releases/download/android-v1.2.3/mingyu-1.2.3.apk.sha256"
        );
        AndroidAppUpdateVerifier.requireMatchingReleaseAssets(apk, checksum);

        assertThrows(
            IllegalArgumentException.class,
            () -> AndroidAppUpdateVerifier.requireMatchingReleaseAssets(
                apk,
                new URL(
                    "https://github.com/Brhiza/mingyu/releases/download/android-v1.2.4/mingyu-1.2.3.apk.sha256"
                )
            )
        );
    }

    @Test
    public void acceptsOnlyTheFourOfficialApkRoutes() throws Exception {
        URL checksum = new URL(
            "https://github.com/Brhiza/mingyu/releases/download/android-v1.2.3/mingyu-1.2.3.apk.sha256"
        );
        String github = "https://github.com/Brhiza/mingyu/releases/download/android-v1.2.3/mingyu-1.2.3.apk";
        assertEquals("github.com", AndroidAppUpdateVerifier.requireOfficialApkUrl(github, checksum).getHost());
        assertEquals(
            "lanzou-cloudflare-api.brhiza.workers.dev",
            AndroidAppUpdateVerifier.requireOfficialApkUrl(
                "https://lanzou-cloudflare-api.brhiza.workers.dev/v1/public/mingyu/1.2.3",
                checksum
            ).getHost()
        );
        assertEquals(
            "gh-proxy.com",
            AndroidAppUpdateVerifier.requireOfficialApkUrl("https://gh-proxy.com/" + github, checksum).getHost()
        );
        assertEquals(
            "ghfast.top",
            AndroidAppUpdateVerifier.requireOfficialApkUrl("https://ghfast.top/" + github, checksum).getHost()
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> AndroidAppUpdateVerifier.requireOfficialApkUrl(
                "https://lanzou-cloudflare-api.brhiza.workers.dev/v1/public/mingyu/1.2.4",
                checksum
            )
        );
    }

    @Test
    public void validatesRedirectHostsAndChecksum() throws Exception {
        assertTrue(
            AndroidAppUpdateVerifier.isAllowedRedirectUrl(
                new URL(
                    "https://release-assets.githubusercontent.com/github-production-release-asset/file.apk?token=temporary"
                )
            )
        );
        assertFalse(
            AndroidAppUpdateVerifier.isAllowedRedirectUrl(new URL("https://downloads.example.com/file.apk"))
        );
        assertFalse(
            AndroidAppUpdateVerifier.isAllowedRedirectUrl(new URL("https://github.com/other/file.apk"))
        );
        assertEquals(
            "a".repeat(64),
            AndroidAppUpdateVerifier.parseSha256("A".repeat(64) + "  mingyu.apk\n")
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> AndroidAppUpdateVerifier.parseSha256("not-a-checksum")
        );
    }
}
