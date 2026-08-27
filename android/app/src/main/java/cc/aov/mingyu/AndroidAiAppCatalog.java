package cc.aov.mingyu;

final class AndroidAiAppCatalog {
    private static final String[] PREFERRED_PACKAGES = {
        "com.larus.nova",
        "com.deepseek.chat",
        "com.tencent.hunyuan.app.chat",
        "com.moonshot.kimichat",
        "com.aliyun.tongyi",
        "com.baidu.newapp",
        "com.iflytek.spark",
        "com.zhipuai.qingyan",
        "com.tencent.ima",
        "com.qihoo.namiso",
        "com.singularity.tiangong",
        "com.openai.chatgpt",
        "com.google.android.apps.bard",
        "com.anthropic.claude",
        "com.microsoft.copilot",
        "ai.perplexity.app.android",
        "ai.x.grok",
        "com.poe.android",
    };

    private AndroidAiAppCatalog() {}

    static int priorityOf(String packageName) {
        if (packageName == null) return -1;
        for (int index = 0; index < PREFERRED_PACKAGES.length; index++) {
            if (PREFERRED_PACKAGES[index].equals(packageName)) return index;
        }
        return -1;
    }

    static boolean contains(String packageName) {
        return priorityOf(packageName) >= 0;
    }
}
