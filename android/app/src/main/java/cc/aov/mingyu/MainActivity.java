package cc.aov.mingyu;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidAiAppLauncherPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
