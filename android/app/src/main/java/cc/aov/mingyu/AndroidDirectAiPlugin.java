package cc.aov.mingyu;

import android.util.JsonReader;
import android.util.JsonToken;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.StringReader;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

import javax.net.ssl.HttpsURLConnection;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "AndroidDirectAi")
public class AndroidDirectAiPlugin extends Plugin {
    private static final String STREAM_EVENT = "streamEvent";
    private static final int CONNECT_TIMEOUT_MS = 25_000;
    private static final int READ_TIMEOUT_MS = 30_000;
    private static final long TOTAL_TIMEOUT_MS = 95_000L;
    private static final int MAX_MESSAGES = 30;
    private static final int MAX_PROMPT_LENGTH = 50_000;
    private static final int MAX_ERROR_BODY_LENGTH = 128_000;
    private static final Pattern JSON_NUMBER = Pattern.compile("-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?");
    private static final String SYSTEM_PROMPT_SINGLE = "请完成用户当前指定的资料准备或解读任务。解读结合已有盘面、所附方法与传统资料，具体回应问题。";
    private static final String SYSTEM_PROMPT_CHAT = "第一条消息保留本次盘面资料。请结合所附方法、补充资料和对话完成用户当前指定的任务，沿用主体与时间范围。";

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Set<String> activeRequests = ConcurrentHashMap.newKeySet();
    private final Set<String> cancelledRequests = ConcurrentHashMap.newKeySet();
    private final ConcurrentHashMap<String, HttpsURLConnection> activeConnections = new ConcurrentHashMap<>();

    @PluginMethod
    public void streamChat(PluginCall call) {
        String requestId = trim(call.getString("requestId"));
        String apiKey = trim(call.getString("apiKey"));
        String model = trim(call.getString("model"));
        String rawBaseUrl = trim(call.getString("baseUrl"));
        JSArray rawMessages = call.getArray("messages");

        if (requestId.isEmpty() || apiKey.isEmpty() || model.isEmpty() || rawMessages == null) {
            call.reject("请先填写自定义 AI 的接口、密钥和模型。");
            return;
        }
        if (!activeRequests.add(requestId)) {
            call.reject("该请求已在处理中。");
            return;
        }

        final URL endpoint;
        final JSONArray messages;
        try {
            endpoint = buildEndpoint(rawBaseUrl, "chat/completions");
            messages = buildMessages(rawMessages);
        } catch (IllegalArgumentException | JSONException error) {
            activeRequests.remove(requestId);
            call.reject(error.getMessage());
            return;
        }

        executor.execute(() -> performStream(requestId, endpoint, apiKey, model, messages));
        call.resolve();
    }

    @PluginMethod
    public void cancelStream(PluginCall call) {
        String requestId = trim(call.getString("requestId"));
        if (!requestId.isEmpty()) {
            cancelledRequests.add(requestId);
            HttpsURLConnection connection = activeConnections.remove(requestId);
            if (connection != null) connection.disconnect();
        }
        call.resolve();
    }

    @PluginMethod
    public void fetchModels(PluginCall call) {
        String apiKey = trim(call.getString("apiKey"));
        String rawBaseUrl = trim(call.getString("baseUrl"));
        if (apiKey.isEmpty() || rawBaseUrl.isEmpty()) {
            call.reject("请先填写自定义 AI 的接口和密钥。");
            return;
        }

        final URL endpoint;
        try {
            endpoint = buildEndpoint(rawBaseUrl, "models");
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage());
            return;
        }

        executor.execute(() -> performFetchModels(call, endpoint, apiKey));
    }

    @Override
    protected void handleOnDestroy() {
        for (HttpsURLConnection connection : activeConnections.values()) {
            connection.disconnect();
        }
        activeConnections.clear();
        cancelledRequests.addAll(activeRequests);
        activeRequests.clear();
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private void performStream(
        String requestId,
        URL endpoint,
        String apiKey,
        String model,
        JSONArray messages
    ) {
        HttpsURLConnection connection = null;
        try {
            if (cancelledRequests.contains(requestId)) return;
            connection = openConnection(endpoint, "POST", apiKey);
            activeConnections.put(requestId, connection);
            if (cancelledRequests.contains(requestId)) return;

            JSONObject body = new JSONObject();
            body.put("model", model);
            body.put("stream", true);
            body.put("max_tokens", 8192);
            body.put("temperature", 0.7);
            body.put("messages", messages);
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(bytes);
            }

            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                emitError(requestId, readUpstreamError(connection, status));
                return;
            }

            readChatResponse(requestId, connection);
        } catch (SocketTimeoutException error) {
            emitError(requestId, "自定义 AI 响应超时，请稍后重试。");
        } catch (JSONException error) {
            emitError(requestId, "自定义 AI 请求内容无法编码。");
        } catch (IOException error) {
            emitError(requestId, "无法连接自定义 AI，请检查接口地址和网络。");
        } catch (RuntimeException error) {
            emitError(requestId, "自定义 AI 请求失败，请稍后重试。");
        } finally {
            activeConnections.remove(requestId);
            activeRequests.remove(requestId);
            cancelledRequests.remove(requestId);
            if (connection != null) connection.disconnect();
        }
    }

    private void performFetchModels(PluginCall call, URL endpoint, String apiKey) {
        HttpsURLConnection connection = null;
        try {
            connection = openConnection(endpoint, "GET", apiKey);
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                call.reject(readUpstreamError(connection, status));
                return;
            }

            String body = readText(connection.getInputStream(), MAX_ERROR_BODY_LENGTH);
            JSONObject payload = new JSONObject(body);
            JSONArray data = payload.optJSONArray("data");
            JSArray models = new JSArray();
            Set<String> seen = ConcurrentHashMap.newKeySet();
            if (data != null) {
                for (int index = 0; index < data.length(); index++) {
                    JSONObject item = data.optJSONObject(index);
                    String id = item == null ? "" : trim(item.optString("id"));
                    if (!id.isEmpty() && seen.add(id)) models.put(id);
                }
            }
            JSObject result = new JSObject();
            result.put("models", models);
            call.resolve(result);
        } catch (SocketTimeoutException error) {
            call.reject("获取模型超时，请稍后重试。");
        } catch (JSONException error) {
            call.reject("服务商返回的模型列表格式不正确。");
        } catch (IOException error) {
            call.reject("无法连接自定义 AI，请检查接口地址和网络。");
        } catch (RuntimeException error) {
            call.reject("获取模型失败，请稍后重试。");
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void readChatResponse(String requestId, HttpsURLConnection connection) throws IOException {
        long deadline = System.currentTimeMillis() + TOTAL_TIMEOUT_MS;
        try (
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8)
            )
        ) {
            // Only an explicitly JSON response may complete without an SSE [DONE] marker.
            if (isJsonResponse(connection.getContentType())) {
                StringBuilder body = new StringBuilder();
                char[] buffer = new char[4096];
                int read;
                while ((read = reader.read(buffer)) != -1) {
                    if (!canReadResponse(requestId, deadline)) return;
                    if (body.length() + read > MAX_ERROR_BODY_LENGTH) {
                        emitError(requestId, "自定义 AI 返回的非流式响应过大，请缩小问题范围后重试。");
                        return;
                    }
                    body.append(buffer, 0, read);
                }
                if (!canReadResponse(requestId, deadline)) return;
                try {
                    JSONObject payload = parseChatPayload(body.toString());
                    String upstreamError = extractErrorMessage(payload);
                    if (!upstreamError.isEmpty()) {
                        emitError(requestId, upstreamError);
                        return;
                    }
                    String content = extractContent(payload);
                    if (content.isEmpty()) {
                        emitError(requestId, "AI 未返回任何内容，请重新生成。");
                        return;
                    }
                    emitChunk(requestId, content);
                    emitDone(requestId);
                } catch (JSONException error) {
                    emitError(requestId, "AI 服务流数据无法解析，本次回答未完整生成，请重新生成。");
                }
                return;
            }

            ChatStreamParser parser = new ChatStreamParser(requestId);
            String line;
            while ((line = reader.readLine()) != null) {
                if (!canReadResponse(requestId, deadline)) return;
                if (!parser.acceptLine(line)) return;
            }
            if (canReadResponse(requestId, deadline)) parser.finish();
        }
    }

    private boolean canReadResponse(String requestId, long deadline) {
        if (cancelledRequests.contains(requestId)) return false;
        if (System.currentTimeMillis() > deadline) {
            emitError(requestId, "自定义 AI 响应时间过长，请稍后重试。");
            return false;
        }
        return true;
    }

    private boolean isJsonResponse(String contentType) {
        if (contentType == null) return false;
        String mediaType = contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        return "application/json".equals(mediaType) ||
            (mediaType.startsWith("application/") && mediaType.endsWith("+json"));
    }

    private final class ChatStreamParser {
        private final String requestId;
        private final StringBuilder eventData = new StringBuilder();
        private boolean receivedContent;
        private boolean settled;

        ChatStreamParser(String requestId) {
            this.requestId = requestId;
        }

        boolean acceptLine(String line) {
            if (line.isEmpty()) return dispatchEvent();
            if (line.startsWith("data:")) {
                eventData.append(line.substring(5).trim()).append('\n');
            }
            return true;
        }

        void finish() {
            // Match the Web proxy's EOF flush, including a final [DONE] without a blank line.
            if (dispatchEvent()) fail("AI 服务在发送完成标记前中断，请稍后重试。");
        }

        private boolean dispatchEvent() {
            if (settled) return false;
            String data = eventData.toString().trim();
            eventData.setLength(0);
            if (data.isEmpty()) return true;
            if ("[DONE]".equals(data)) {
                settled = true;
                if (receivedContent) {
                    emitDone(requestId);
                } else {
                    emitError(requestId, "AI 未返回任何内容，请重新生成。");
                }
                return false;
            }
            try {
                JSONObject payload = parseChatPayload(data);
                String upstreamError = extractErrorMessage(payload);
                if (!upstreamError.isEmpty()) return fail(upstreamError);
                Object rawChoices = payload.opt("choices");
                JSONArray choices = rawChoices instanceof JSONArray ? (JSONArray) rawChoices : null;
                JSONObject choice = choices == null ? null : choices.optJSONObject(0);
                JSONObject delta = choice == null ? null : choice.optJSONObject("delta");
                String content = stringValue(delta, "content");
                if (!content.isEmpty()) {
                    receivedContent = true;
                    emitChunk(requestId, content);
                }
                return true;
            } catch (JSONException error) {
                return fail("AI 服务流数据无法解析，本次回答未完整生成，请重新生成。");
            }
        }

        private boolean fail(String message) {
            settled = true;
            emitError(requestId, message);
            return false;
        }
    }

    private HttpsURLConnection openConnection(URL endpoint, String method, String apiKey) throws IOException {
        HttpsURLConnection connection = (HttpsURLConnection) endpoint.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Authorization", "Bearer " + apiKey);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json, text/event-stream");
        connection.setUseCaches(false);
        return connection;
    }

    private JSONArray buildMessages(JSArray rawMessages) throws JSONException {
        if (rawMessages.length() < 1 || rawMessages.length() > MAX_MESSAGES) {
            throw new IllegalArgumentException("一次最多发送 30 条消息，请拆分为多次请求。");
        }

        JSONArray messages = new JSONArray();
        int totalLength = 0;
        for (int index = 0; index < rawMessages.length(); index++) {
            JSONObject raw = rawMessages.optJSONObject(index);
            String role = raw == null ? "" : trim(raw.optString("role"));
            String content = raw == null ? "" : trim(raw.optString("content"));
            if (!("user".equals(role) || "assistant".equals(role)) || content.isEmpty()) {
                throw new IllegalArgumentException("消息内容格式不正确。");
            }
            totalLength += content.length();
            if (totalLength > MAX_PROMPT_LENGTH) {
                throw new IllegalArgumentException("提示词不能超过 50000 字符。");
            }
            JSONObject item = new JSONObject();
            item.put("role", role);
            item.put("content", content);
            messages.put(item);
        }

        JSONObject system = new JSONObject();
        system.put("role", "system");
        system.put("content", rawMessages.length() > 1 ? SYSTEM_PROMPT_CHAT : SYSTEM_PROMPT_SINGLE);
        JSONArray completed = new JSONArray();
        completed.put(system);
        for (int index = 0; index < messages.length(); index++) completed.put(messages.get(index));
        return completed;
    }

    private URL buildEndpoint(String rawBaseUrl, String suffix) {
        try {
            URL baseUrl = new URL(rawBaseUrl);
            String protocol = baseUrl.getProtocol();
            String host = normalizeHost(baseUrl.getHost());
            if (
                !"https".equalsIgnoreCase(protocol) ||
                baseUrl.getUserInfo() != null ||
                baseUrl.getQuery() != null ||
                baseUrl.getRef() != null ||
                isUnsafeHost(host)
            ) {
                throw new IllegalArgumentException(
                    "自定义 AI 接口地址必须使用 HTTPS 公网地址，不能指向本机或内网。"
                );
            }
            String normalized = baseUrl.toExternalForm().replaceAll("/+$", "");
            URL endpoint = new URL(normalized + "/" + suffix);
            if (!"https".equalsIgnoreCase(endpoint.getProtocol())) {
                throw new IllegalArgumentException("自定义 AI 接口地址必须使用 HTTPS。");
            }
            return endpoint;
        } catch (IOException error) {
            throw new IllegalArgumentException("自定义 AI 接口地址必须是合法的 HTTPS 公网地址。");
        }
    }

    private boolean isUnsafeHost(String host) {
        if (host.isEmpty() || !host.contains(".")) return true;
        if (
            "localhost".equals(host) ||
            "metadata".equals(host) ||
            "metadata.google.internal".equals(host) ||
            host.endsWith(".localhost") ||
            host.endsWith(".internal") ||
            host.contains(":")
        ) {
            return true;
        }

        String[] parts = host.split("\\.");
        if (parts.length != 4) return false;
        int[] values = new int[4];
        for (int index = 0; index < parts.length; index++) {
            try {
                values[index] = Integer.parseInt(parts[index]);
            } catch (NumberFormatException error) {
                return false;
            }
            if (values[index] < 0 || values[index] > 255) return true;
        }
        int first = values[0];
        int second = values[1];
        return (
            first == 0 ||
            first == 10 ||
            first == 127 ||
            (first == 100 && second >= 64 && second <= 127) ||
            (first == 169 && second == 254) ||
            (first == 172 && second >= 16 && second <= 31) ||
            (first == 192 && second == 168) ||
            first >= 224
        );
    }

    private JSONObject parseChatPayload(String rawJson) throws JSONException {
        // JSONObject/JSONTokener accept JavaScript extensions and trailing garbage on Android.
        // Validate the complete JSON document before using its familiar field accessors.
        validateJsonTokens(rawJson);
        try (JsonReader reader = new JsonReader(new StringReader(rawJson))) {
            reader.setLenient(false);
            if (reader.peek() != JsonToken.BEGIN_OBJECT) throw new JSONException("Expected JSON object");
            reader.skipValue();
            if (reader.peek() != JsonToken.END_DOCUMENT) throw new JSONException("Trailing JSON data");
        } catch (IOException error) {
            throw new JSONException("Invalid JSON response");
        }
        return new JSONObject(rawJson);
    }

    private void validateJsonTokens(String text) throws JSONException {
        // Even non-lenient Android JsonReader accepts uppercase literals, 1., and loose strings.
        // Check lexical tokens here; JsonReader remains responsible for the document structure.
        boolean inString = false;
        for (int index = 0; index < text.length(); index++) {
            char value = text.charAt(index);
            if (value == '"') {
                inString = !inString;
            } else if (inString && value < 0x20) {
                throw new JSONException("Unescaped JSON control character");
            } else if (inString && value == '\\') {
                if (++index >= text.length()) throw new JSONException("Incomplete JSON escape");
                char escaped = text.charAt(index);
                if (escaped == 'u') {
                    for (int digit = 0; digit < 4; digit++) {
                        if (++index >= text.length() ||
                            "0123456789abcdefABCDEF".indexOf(text.charAt(index)) < 0) {
                            throw new JSONException("Invalid JSON unicode escape");
                        }
                    }
                } else if ("\"\\/bfnrt".indexOf(escaped) < 0) {
                    throw new JSONException("Invalid JSON escape");
                }
            } else if (!inString && !isJsonDelimiter(value)) {
                int start = index;
                while (index < text.length() && !isJsonDelimiter(text.charAt(index))) index++;
                String token = text.substring(start, index--);
                if (!"true".equals(token) && !"false".equals(token) && !"null".equals(token) &&
                    !JSON_NUMBER.matcher(token).matches()) {
                    throw new JSONException("Invalid JSON token");
                }
            }
        }
        if (inString) throw new JSONException("Unterminated JSON string");
    }

    private boolean isJsonDelimiter(char value) {
        return value == ' ' || value == '\t' || value == '\r' || value == '\n' ||
            value == '{' || value == '}' || value == '[' || value == ']' || value == ':' || value == ',';
    }

    private String stringValue(JSONObject object, String key) {
        Object value = object == null ? null : object.opt(key);
        return value instanceof String ? (String) value : "";
    }

    private String extractContent(JSONObject payload) {
        JSONArray choices = payload.optJSONArray("choices");
        JSONObject choice = choices == null ? null : choices.optJSONObject(0);
        JSONObject delta = choice == null ? null : choice.optJSONObject("delta");
        String content = stringValue(delta, "content");
        if (!content.isEmpty()) return content;
        JSONObject message = choice == null ? null : choice.optJSONObject("message");
        content = stringValue(message, "content");
        return content.isEmpty() ? stringValue(payload, "content") : content;
    }

    private String extractErrorMessage(JSONObject payload) {
        JSONArray choices = payload.optJSONArray("choices");
        JSONObject choice = choices == null ? null : choices.optJSONObject(0);
        if ("length".equals(stringValue(choice, "finish_reason"))) {
            return "本次回复达到模型输出上限，已生成内容保留，可缩小问题范围后继续。";
        }
        if (!payload.has("error")) return "";
        Object error = payload.opt("error");
        String message = error instanceof JSONObject
            ? stringValue((JSONObject) error, "message")
            : error instanceof String ? (String) error : stringValue(payload, "message");
        message = truncate(message);
        return message.isEmpty() ? "AI 服务返回了流式错误。" : message;
    }

    private String extractErrorMessage(String rawJson) {
        try {
            return extractErrorMessage(new JSONObject(rawJson));
        } catch (JSONException error) {
            return "";
        }
    }

    private String readUpstreamError(HttpsURLConnection connection, int status) throws IOException {
        InputStream stream = connection.getErrorStream();
        String body = stream == null ? "" : readText(stream, MAX_ERROR_BODY_LENGTH);
        String message = extractErrorMessage(body);
        return message.isEmpty() ? "自定义 AI 请求失败（" + status + "）。" : message + "（" + status + "）";
    }

    private String readText(InputStream stream, int maxLength) throws IOException {
        StringBuilder result = new StringBuilder();
        char[] buffer = new char[4096];
        try (InputStreamReader reader = new InputStreamReader(stream, StandardCharsets.UTF_8)) {
            int read;
            while ((read = reader.read(buffer)) >= 0 && result.length() < maxLength) {
                result.append(buffer, 0, Math.min(read, maxLength - result.length()));
            }
        }
        return result.toString();
    }

    private void emitChunk(String requestId, String content) {
        if (cancelledRequests.contains(requestId)) return;
        JSObject event = baseEvent(requestId, "chunk");
        event.put("content", content);
        notifyListeners(STREAM_EVENT, event);
    }

    private void emitDone(String requestId) {
        if (cancelledRequests.contains(requestId)) return;
        notifyListeners(STREAM_EVENT, baseEvent(requestId, "done"));
    }

    private void emitError(String requestId, String message) {
        if (cancelledRequests.contains(requestId)) return;
        JSObject event = baseEvent(requestId, "error");
        event.put("message", truncate(message));
        notifyListeners(STREAM_EVENT, event);
    }

    private JSObject baseEvent(String requestId, String type) {
        JSObject event = new JSObject();
        event.put("requestId", requestId);
        event.put("type", type);
        return event;
    }

    private String normalizeHost(String value) {
        return trim(value).toLowerCase(Locale.ROOT).replaceAll("\\.$", "");
    }

    private String truncate(String value) {
        String text = trim(value);
        return text.length() > 500 ? text.substring(0, 500) : text;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
