package cc.aov.mingyu;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AndroidAiAppCatalogTest {
    @Test
    public void commonAiAppsUseFixedPriority() {
        assertEquals(0, AndroidAiAppCatalog.priorityOf("com.larus.nova"));
        assertTrue(
            AndroidAiAppCatalog.priorityOf("com.deepseek.chat") <
            AndroidAiAppCatalog.priorityOf("com.openai.chatgpt")
        );
        assertTrue(AndroidAiAppCatalog.contains("com.tencent.hunyuan.app.chat"));
        assertTrue(AndroidAiAppCatalog.contains("com.google.android.apps.bard"));
    }

    @Test
    public void unrelatedTextReceiversAreRejected() {
        assertEquals(-1, AndroidAiAppCatalog.priorityOf("com.tencent.mobileqq"));
        assertEquals(-1, AndroidAiAppCatalog.priorityOf("com.android.bluetooth"));
        assertFalse(AndroidAiAppCatalog.contains("com.openai.chatgpt.fake"));
        assertFalse(AndroidAiAppCatalog.contains(null));
    }
}
