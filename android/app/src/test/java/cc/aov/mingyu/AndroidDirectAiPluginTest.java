package cc.aov.mingyu;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.cert.Certificate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

import javax.net.ssl.HttpsURLConnection;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public class AndroidDirectAiPluginTest {
    private static final String REQUEST_ID = "native-parser-test";
    private static final String OPENING = "data: {\"choices\":[{\"delta\":{\"content\":\"半段正文\"}}]}\n\n";
    private static final String DONE = "data: [DONE]\n\n";
    private static final String MALFORMED = "AI 服务流数据无法解析，本次回答未完整生成，请重新生成。";
    private static final String INCOMPLETE = "AI 服务在发送完成标记前中断，请稍后重试。";
    private static final String OUTPUT_LIMIT = "本次回复达到模型输出上限，已生成内容保留，可缩小问题范围后继续。";

    @Test
    public void agreesWithWebOnTheFiveAuditFixtures() throws Exception {
        try (InputStream input = getClass().getResourceAsStream("/ai-stream-fixtures.json")) {
            assertNotNull(input);
            JSONArray fixtures = new JSONArray(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            assertEquals(5, fixtures.length());
            for (int index = 0; index < fixtures.length(); index++) {
                JSONObject fixture = fixtures.getJSONObject(index);
                try (RecordingPlugin plugin = new RecordingPlugin()) {
                    MemoryConnection connection = new MemoryConnection(fixture.getString("body"), "text/event-stream");
                    read(plugin, connection);
                    assertResult(
                        plugin,
                        fixture.getString("content"),
                        fixture.getInt("done"),
                        fixture.getString("errorMessage")
                    );
                    assertTrue(fixture.getString("name"), connection.inputClosed);
                }
            }
        }
    }

    @Test
    public void parsesMultilineEventsCrLfAndUtf8AcrossSingleByteReads() throws Exception {
        String body = ": heartbeat\r\n\r\nevent: message\r\nid: 7\r\n" +
            "data: {\"choices\":\r\ndata: [{\"delta\":{\"content\":\"完整回答\\n第二行 \\u4f60好\\\"\\\\\"}}]}\r\n\r\n" +
            "data: [DONE]";
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            MemoryConnection connection = new MemoryConnection(body, "text/event-stream; charset=utf-8");
            read(plugin, connection);
            assertResult(plugin, "完整回答\n第二行 你好\"\\", 1, "");
            assertTrue(connection.inputClosed);
        }
    }

    @Test
    public void rejectsMalformedJsonIncludingAndroidLenientExtensions() throws Exception {
        String[] malformed = {
            "{\"choices\":", "null", "[]", "42", "\"text\"",
            "{'choices':[]}", "{choices:[]}", "{\"choices\":[],}", "{\"choices\":[];}" ,
            "{\"choices\":[]} trailing", "{\"choices\":[]}{}", "{\"unused\":01}",
            "{\"unused\":NaN}", "{\"unused\":undefined}", "{\"unused\":/* comment */1}",
            "{\"unused\":\"bad\\q\"}", "{\"unused\":\"bad\\u12xz\"}", "{\"unused\":\"bad\ttext\"}",
            "{\"choices\":[{\"delta\":{\"content\":\"broken\ndata: string\"}}]}"
        };
        for (String payload : malformed) {
            try (RecordingPlugin plugin = new RecordingPlugin()) {
                read(plugin, new MemoryConnection(OPENING + "data: " + payload + "\n\n" + DONE, "text/event-stream"));
                assertResult(plugin, "半段正文", 0, MALFORMED);
            }
        }
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            read(plugin, new MemoryConnection(OPENING + "data: {\"choices\":", "text/event-stream"));
            assertResult(plugin, "半段正文", 0, MALFORMED);
        }
    }

    @Test
    public void rejectsInvalidJsonTokensBeforeContentInStreamAndExplicitJson() throws Exception {
        JSONObject fixtures = jsonTokenFixtures();
        JSONArray invalid = fixtures.getJSONArray("invalid");
        for (int index = 0; index < invalid.length(); index++) {
            String token = invalid.getString(index);
            for (String contentType : new String[]{"text/event-stream", "application/json"}) {
                try (RecordingPlugin plugin = new RecordingPlugin()) {
                    String payload = "{\"choices\":[{\"delta\":{\"content\":\"must not emit\"}}],\"unused\":" + token + "}";
                    String body = "text/event-stream".equals(contentType) ? "data: " + payload + "\n\n" + DONE : payload;
                    read(plugin, new MemoryConnection(body, contentType));
                    assertResult(plugin, "", 0, MALFORMED);
                } catch (AssertionError error) {
                    throw new AssertionError(contentType + " must reject token " + token, error);
                }
            }
        }
    }

    @Test
    public void acceptsValidJsonNumbersAndLiteralsInStreamAndExplicitJson() throws Exception {
        JSONObject fixtures = jsonTokenFixtures();
        JSONArray valid = fixtures.getJSONArray("valid");
        for (int index = 0; index < valid.length(); index++) {
            String token = valid.getString(index);
            for (String contentType : new String[]{"text/event-stream", "application/json"}) {
                try (RecordingPlugin plugin = new RecordingPlugin()) {
                    String payload = "{\"choices\":[{\"delta\":{\"content\":\"ok\"}}],\"unused\":{\"nested\":[" + token + "]}}";
                    String body = "text/event-stream".equals(contentType) ? "data: " + payload + "\n\n" + DONE : payload;
                    read(plugin, new MemoryConnection(body, contentType));
                    assertResult(plugin, "ok", 1, "");
                } catch (AssertionError error) {
                    throw new AssertionError(contentType + " must accept token " + token, error);
                }
            }
        }
    }

    private JSONObject jsonTokenFixtures() throws Exception {
        try (InputStream input = getClass().getResourceAsStream("/ai-json-token-fixtures.json")) {
            assertNotNull(input);
            return new JSONObject(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    @Test
    public void givesErrorsAndOutputLimitsPrecedenceOverContentAndLaterDone() throws Exception {
        String content = "\"choices\":[{\"delta\":{\"content\":\"must not emit\"}}]";
        String[] errors = {
            "{\"error\":{\"message\":\"上游停止\"}," + content + "}",
            "{\"error\":\"上游停止\"," + content + "}",
            "{\"error\":{}," + content + "}",
            "{\"error\":null," + content + "}"
        };
        for (int index = 0; index < errors.length; index++) {
            try (RecordingPlugin plugin = new RecordingPlugin()) {
                read(plugin, new MemoryConnection(OPENING + "data: " + errors[index] + "\n\n" + DONE, "text/event-stream"));
                assertResult(plugin, "半段正文", 0, index < 2 ? "上游停止" : "AI 服务返回了流式错误。");
            }
        }
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            String payload = "{\"error\":{\"message\":\"provider error\"},\"choices\":[{\"delta\":{\"content\":\"must not emit\"},\"finish_reason\":\"length\"}]}";
            read(plugin, new MemoryConnection(OPENING + "data: " + payload + "\n\n" + DONE, "text/event-stream"));
            assertResult(plugin, "半段正文", 0, OUTPUT_LIMIT);
        }
    }

    @Test
    public void stopFinishReasonWithoutDoneStillFailsAndDoneIsTerminal() throws Exception {
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            read(plugin, new MemoryConnection(OPENING + "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}", "text/event-stream"));
            assertResult(plugin, "半段正文", 0, INCOMPLETE);
        }
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            read(plugin, new MemoryConnection(OPENING + DONE + "data: {bad}\n\n" + DONE, "text/event-stream"));
            assertResult(plugin, "半段正文", 1, "");
        }
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            read(plugin, new MemoryConnection(DONE, "text/event-stream"));
            assertResult(plugin, "", 0, "AI 未返回任何内容，请重新生成。");
        }
    }

    @Test
    public void ignoresMetadataAndNonStringDeltaContentLikeWeb() throws Exception {
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            String body = ": heartbeat\n\nevent: message\nid: 2\nretry: 10\n\n" +
                "data:\n\n" +
                "data: {\"choices\":[{\"delta\":{\"role\":\"assistant\",\"content\":null}}]}\n\n" +
                "data: {\"choices\":[{\"delta\":{\"content\":123}}]}\n\n" +
                "data: {\"content\":\"not SSE delta\",\"choices\":[{\"message\":{\"content\":\"not SSE delta\"}}]}\n\n" +
                OPENING + DONE;
            read(plugin, new MemoryConnection(body, null));
            assertResult(plugin, "半段正文", 1, "");
        }
    }

    @Test
    public void keepsExplicitJsonCompatibilityWithoutInferringItFromStreamContent() throws Exception {
        String[] bodies = {
            "{\"choices\":[{\"message\":{\"content\":\"完整回答\"}}]}",
            "{\"choices\":[{\"delta\":{\"content\":\"完整回答\"}}]}",
            "{\"content\":\"完整回答\"}",
            "{\n  \"choices\": [{\"message\": {\"content\": \"完整回答\"}}]\n}"
        };
        for (String body : bodies) {
            for (String contentType : new String[]{"application/json; charset=utf-8", "Application/Vnd.Provider+Json"}) {
                try (RecordingPlugin plugin = new RecordingPlugin()) {
                    read(plugin, new MemoryConnection(body, contentType));
                    assertResult(plugin, "完整回答", 1, "");
                }
            }
        }
        for (String contentType : new String[]{null, "text/plain", "text/event-stream"}) {
            try (RecordingPlugin plugin = new RecordingPlugin()) {
                read(plugin, new MemoryConnection(bodies[0], contentType));
                assertResult(plugin, "", 0, INCOMPLETE);
            }
        }
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            read(plugin, new MemoryConnection(OPENING + DONE, "application/json"));
            assertResult(plugin, "", 0, MALFORMED);
        }
    }

    @Test
    public void jsonErrorsMalformedBodiesAndOversizeBodiesNeverComplete() throws Exception {
        String content = "\"content\":\"must not emit\"";
        String[][] cases = {
            {"{\"error\":{\"message\":\"上游停止\"}," + content + "}", "上游停止"},
            {"{\"choices\":[{\"message\":{\"content\":\"must not emit\"},\"finish_reason\":\"length\"}]}", OUTPUT_LIMIT},
            {"{\"content\":\"partial\"", MALFORMED},
            {"{\"content\":\"partial\"} garbage", MALFORMED},
            {"{}", "AI 未返回任何内容，请重新生成。"},
            {"{\"content\":null}", "AI 未返回任何内容，请重新生成。"},
            {"{\"content\":\"" + "a".repeat(128_001) + "\"}", "自定义 AI 返回的非流式响应过大，请缩小问题范围后重试。"}
        };
        for (String[] fixture : cases) {
            try (RecordingPlugin plugin = new RecordingPlugin()) {
                MemoryConnection connection = new MemoryConnection(fixture[0], "application/json");
                read(plugin, connection);
                assertResult(plugin, "", 0, fixture[1]);
                assertTrue(connection.inputClosed);
            }
        }
    }

    @Test
    public void cancellationSuppressesDoneAndErrorAndDisconnectsOnlyMatchingRequest() throws Exception {
        for (String tail : new String[]{DONE, "data: {broken}\n\n" + DONE, ""}) {
            try (RecordingPlugin plugin = new RecordingPlugin()) {
                MemoryConnection connection = new MemoryConnection(OPENING + tail, "text/event-stream");
                MemoryConnection other = new MemoryConnection("", "text/event-stream");
                connections(plugin).put(REQUEST_ID, connection);
                connections(plugin).put("other-request", other);
                plugin.afterChunk = () -> cancel(plugin, REQUEST_ID);
                read(plugin, connection);
                assertResult(plugin, "半段正文", 0, "");
                assertTrue(connection.disconnected);
                assertFalse(other.disconnected);
                assertTrue(connection.inputClosed);
                assertFalse(connections(plugin).containsKey(REQUEST_ID));
                assertTrue(connections(plugin).containsKey("other-request"));
            }
        }
        for (String contentType : new String[]{"application/json", "text/event-stream"}) {
            try (RecordingPlugin plugin = new RecordingPlugin()) {
                cancel(plugin, REQUEST_ID);
                read(plugin, new MemoryConnection(OPENING + DONE, contentType));
                assertResult(plugin, "", 0, "");
            }
        }
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            MemoryConnection connection = new MemoryConnection("{\"content\":\"完整回答\"}", "application/json");
            plugin.afterChunk = () -> cancel(plugin, REQUEST_ID);
            read(plugin, connection);
            assertResult(plugin, "完整回答", 0, "");
        }
    }

    @Test
    public void preservesHttpsValidationAndConnectionTimeouts() throws Exception {
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            Method endpoint = AndroidDirectAiPlugin.class.getDeclaredMethod("buildEndpoint", String.class, String.class);
            endpoint.setAccessible(true);
            assertEquals(
                "https://provider.example/v1/chat/completions",
                endpoint.invoke(plugin, "https://provider.example/v1/", "chat/completions").toString()
            );
            for (String base : new String[]{"http://provider.example/v1", "https://localhost/v1", "https://10.0.0.2/v1", "https://provider.example/v1?key=value"}) {
                InvocationTargetException error = assertThrows(
                    InvocationTargetException.class,
                    () -> endpoint.invoke(plugin, base, "chat/completions")
                );
                assertTrue(error.getCause() instanceof IllegalArgumentException);
            }
            Method open = AndroidDirectAiPlugin.class.getDeclaredMethod("openConnection", URL.class, String.class, String.class);
            open.setAccessible(true);
            HttpsURLConnection connection = (HttpsURLConnection) open.invoke(plugin, new URL("https://provider.example/v1"), "POST", "test-key");
            assertEquals(25_000, connection.getConnectTimeout());
            assertEquals(30_000, connection.getReadTimeout());
            assertFalse(connection.getInstanceFollowRedirects());
            assertEquals("POST", connection.getRequestMethod());
            connection.disconnect();
        }
    }

    @Test
    public void totalTimeoutAndSocketTimeoutRemainFailuresAndCloseTheResponse() throws Exception {
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            Method canRead = AndroidDirectAiPlugin.class.getDeclaredMethod("canReadResponse", String.class, long.class);
            canRead.setAccessible(true);
            assertEquals(false, canRead.invoke(plugin, REQUEST_ID, System.currentTimeMillis() - 1));
            assertResult(plugin, "", 0, "自定义 AI 响应时间过长，请稍后重试。");
        }
        try (RecordingPlugin plugin = new RecordingPlugin()) {
            MemoryConnection connection = new MemoryConnection(OPENING, "text/event-stream") {
                @Override
                protected void onEof() throws IOException {
                    throw new SocketTimeoutException("synthetic read timeout");
                }
            };
            assertThrows(SocketTimeoutException.class, () -> read(plugin, connection));
            assertResult(plugin, "半段正文", 0, "");
            assertTrue(connection.inputClosed);
        }
    }

    private static void assertResult(RecordingPlugin plugin, String content, int done, String error) {
        StringBuilder actualContent = new StringBuilder();
        List<String> errors = new ArrayList<>();
        int doneCount = 0;
        boolean terminal = false;
        for (JSObject event : plugin.events) {
            assertEquals(REQUEST_ID, event.optString("requestId"));
            assertFalse("No event may follow a terminal event", terminal);
            String type = event.optString("type");
            if ("chunk".equals(type)) {
                actualContent.append(event.optString("content"));
            } else if ("done".equals(type)) {
                doneCount++;
                terminal = true;
            } else {
                assertEquals("error", type);
                errors.add(event.optString("message"));
                terminal = true;
            }
        }
        assertEquals(content, actualContent.toString());
        assertEquals(done, doneCount);
        assertEquals(error.isEmpty() ? List.of() : List.of(error), errors);
    }

    private static void read(RecordingPlugin plugin, MemoryConnection connection) throws Exception {
        Method read = AndroidDirectAiPlugin.class.getDeclaredMethod("readChatResponse", String.class, HttpsURLConnection.class);
        read.setAccessible(true);
        try {
            read.invoke(plugin, REQUEST_ID, connection);
        } catch (InvocationTargetException error) {
            if (error.getCause() instanceof Exception) throw (Exception) error.getCause();
            throw error;
        }
    }

    @SuppressWarnings("unchecked")
    private static ConcurrentHashMap<String, HttpsURLConnection> connections(RecordingPlugin plugin) throws Exception {
        Field field = AndroidDirectAiPlugin.class.getDeclaredField("activeConnections");
        field.setAccessible(true);
        return (ConcurrentHashMap<String, HttpsURLConnection>) field.get(plugin);
    }

    private static void cancel(RecordingPlugin plugin, String requestId) {
        JSObject data = new JSObject();
        data.put("requestId", requestId);
        plugin.cancelStream(new PluginCall(null, "AndroidDirectAi", "test", "cancelStream", data) {
            @Override
            public void resolve() {}
        });
    }

    private static final class RecordingPlugin extends AndroidDirectAiPlugin implements AutoCloseable {
        final List<JSObject> events = new ArrayList<>();
        Runnable afterChunk;

        @Override
        protected void notifyListeners(String name, JSObject event) {
            assertEquals("streamEvent", name);
            events.add(event);
            if ("chunk".equals(event.optString("type")) && afterChunk != null) afterChunk.run();
        }

        @Override
        public void close() {
            handleOnDestroy();
        }
    }

    private static class MemoryConnection extends HttpsURLConnection {
        final byte[] body;
        final String contentType;
        boolean inputClosed;
        boolean disconnected;

        MemoryConnection(String body, String contentType) throws Exception {
            super(new URL("https://fixture.example/v1"));
            this.body = body.getBytes(StandardCharsets.UTF_8);
            this.contentType = contentType;
        }

        @Override
        public InputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new InputStream() {
                @Override
                public int read() throws IOException {
                    int value = input.read();
                    if (value == -1) onEof();
                    return value;
                }

                @Override
                public int read(byte[] buffer, int offset, int length) throws IOException {
                    // Exercise UTF-8 decoding and BufferedReader across arbitrary network boundaries.
                    int count = input.read(buffer, offset, Math.min(1, length));
                    if (count == -1) onEof();
                    return count;
                }

                @Override
                public void close() {
                    inputClosed = true;
                }
            };
        }

        protected void onEof() throws IOException {}

        @Override
        public String getContentType() { return contentType; }

        @Override
        public String getCipherSuite() { return "fixture"; }

        @Override
        public Certificate[] getLocalCertificates() { return new Certificate[0]; }

        @Override
        public Certificate[] getServerCertificates() { return new Certificate[0]; }

        @Override
        public void disconnect() { disconnected = true; }

        @Override
        public boolean usingProxy() { return false; }

        @Override
        public void connect() {}
    }
}
