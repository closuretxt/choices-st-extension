// Sends the suggestion request to the configured (separate) LLM and parses the response.
import { extension_settings, getContext } from "../../../../extensions.js";
import { generateRaw } from "../../../../../script.js";
import { defaultInputPrompt } from "../settings/defaultOptions.js";
import { extensionName, logDebug } from "../index.js";
import { swapProfile } from "./profileSwapper.js";
import { applyChoicesMacros, collectContextParts } from "./contextBuilder.js";

// Incremented whenever a newer request supersedes the current one (menu closed, new regen, etc).
let _requestId = 0;

export function cancelPendingChoices() {
    _requestId++;
}

// Main entry: builds the prompts, asks the LLM, returns an array of suggestion strings.
// inputText is optional; when omitted it is read from the input bar draft.
// onChunk (optional) is called with the parsed suggestion list on every stream chunk.
export async function generateChoices(inputText = null, onChunk = null) {
    const st = getContext();
    const settings = extension_settings[extensionName];

    if (inputText === null || inputText === undefined) {
        inputText = String($("#send_textarea").val() ?? "");
    }
    inputText = String(inputText);

    const enabledOptions = (settings.options || []).filter(o => o.enabled !== false);
    if (enabledOptions.length === 0) {
        throw new Error("No enabled options configured. Add or enable options in the extension settings.");
    }

    const myId = ++_requestId;

    const parts = await collectContextParts(inputText, enabledOptions);
    const systemPrompt = applyChoicesMacros(settings.continuePrompt, parts);

    // The user message is a customizable template (settings -> Continue Prompt drawer).
    // {{input}} resolves to the draft, or the placeholder when the input bar is empty.
    const inputPromptTemplate = settings.inputPrompt || defaultInputPrompt;
    const userPrompt = applyChoicesMacros(inputPromptTemplate, parts);

    const messages = buildMessages(settings, systemPrompt, userPrompt, parts);
    logDebug("Choices messages:", messages);

    let result;
    try {
        const streaming = settings.stream !== false && typeof onChunk === "function";
        const handleChunk = streaming
            ? (fullText) => {
                // Superseded mid-stream (menu closed / regenerated): stop pushing updates.
                if (myId !== _requestId) return;
                if (typeof onChunk === "function") onChunk(parseChoicesResponse(fullText));
            }
            : null;
        result = await sendRequest(st, settings, messages, handleChunk);
    } catch (e) {
        console.error("Choices: suggestion request failed:", e);
        throw e;
    }

    logDebug("Choices raw response:", result);

    // A newer request superseded this one (menu closed / regenerated). Discard silently.
    if (myId !== _requestId) {
        logDebug("Choices: discarding stale suggestion response.");
        return [];
    }

    const parsed = parseChoicesResponse(result);
    logDebug("Choices parsed suggestions:", parsed);
    return parsed;
}

// Builds the request's message list.
// "Send as Roles" OFF: one system message (the whole continue prompt) + one user message.
// "Send as Roles" ON:  the <context> block is lifted out of the system prompt and each
//                      section inside it is sent as its OWN system message, so the API
//                      sees the scene context as distinct role messages. The draft
//                      remains the user message. Falls back to the normal 2-message
//                      layout when the prompt has no <context> block.
function buildMessages(settings, systemPrompt, userPrompt, parts = {}) {
    const normal = () => [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
    ];

    if (settings.send_as_roles !== true) return normal();

    const match = systemPrompt.match(/<context>\s*([\s\S]*?)<\/context>/);
    if (!match || !match[1].trim()) {
        logDebug("Choices: Send as Roles enabled but no <context> block found, using standard layout.");
        return normal();
    }

    // When real history messages are available, the <recent_story> text block is
    // replaced by proper alternating user/assistant messages below.
    const hasHistory = Array.isArray(parts.historyMessages) && parts.historyMessages.length > 0;

    const before = systemPrompt.slice(0, match.index).trim();
    const after = systemPrompt.slice(match.index + match[0].length).trim();

    const messages = [];
    if (before) messages.push({ role: "system", content: before });

    const sectionRe = /<([a-zA-Z_]+)(?:\s[^>]*)?>\s*([\s\S]*?)\s*<\/\1>/g;
    let m;
    while ((m = sectionRe.exec(match[1])) !== null) {
        if (hasHistory && m[1].toLowerCase() === "recent_story") continue; // sent as role messages instead
        const content = m[2].trim();
        if (!content || content === "(disabled)") continue; // don't send empty/disabled sections
        messages.push({ role: "system", content: `<${m[1]}>\n${content}\n</${m[1]}>` });
    }

    if (after) messages.push({ role: "system", content: after });

    // The story as an actual conversation: user lines as "user", character
    // lines as "assistant", narration/system notes as "system".
    if (hasHistory) {
        for (const h of parts.historyMessages) {
            const content = String(h.mes ?? "").trim();
            if (!content) continue;
            messages.push({ role: h.role, content });
        }
    }

    messages.push({ role: "user", content: userPrompt });
    return messages;
}

// ROUTING: connection profile first, legacy swap if enabled, generateRaw as last fallback.
// onChunk (optional) receives the accumulated response text on every stream chunk.
async function sendRequest(st, settings, messages, onChunk = null) {
    const profiles = st?.extensionSettings?.connectionManager?.profiles || [];
    const profile = profiles.find(p => p.id === settings.connection) || profiles.find(p => p.name === settings.connection);
    // Empty or missing selection falls back to the currently active profile
    // (mirrors Recast's resolveConnectionProfile behavior - sending an empty
    // profile id to sendRequest fails on most setups).
    const selectedProfileId = st?.extensionSettings?.connectionManager?.selectedProfile || "";
    const profileId = profile ? profile.id : selectedProfileId;
    logDebug(`Choices: using connection profile '${profile ? profile.name : "<current>"}' (id: ${profileId || "none"}), stream=${!!onChunk}`);

    // Legacy API: swap to the target profile, use the current connection, then swap back.
    if (settings.legacy_api && profile) {
        const selectedName = st?.extensionSettings?.connectionManager?.selectedProfileName || null;
        const targetName = profile.name;
        let swapped = false;
        try {
            if (targetName && targetName !== selectedName) {
                swapped = await swapProfile(targetName, selectedName);
            }
            if (!swapped) {
                logDebug("Legacy mode: profile swap did not succeed, using the current connection.");
            }
            return await requestViaConnectionManager("", messages, onChunk);
        } finally {
            if (swapped && selectedName) {
                await swapProfile(selectedName, targetName);
            }
        }
    }

    if (st.ConnectionManagerRequestService?.sendRequest) {
        return await requestViaConnectionManager(profileId, messages, onChunk);
    }

    // No connection manager available: fall back to a raw generation on the current API (no streaming).
    logDebug("ConnectionManagerRequestService unavailable, falling back to generateRaw.");
    return await requestViaGenerateRaw(messages);
}

async function requestViaConnectionManager(profileId, messages, onChunk = null) {
    const st = getContext();
    if (!st.ConnectionManagerRequestService?.sendRequest) {
        throw new Error("ConnectionManagerRequestService.sendRequest is unavailable.");
    }

    const createGenerator = await st.ConnectionManagerRequestService.sendRequest(
        profileId,
        messages,
        undefined,
        { stream: !!onChunk }
    );

    if (typeof createGenerator === "function") {
        let result = "";
        for await (const chunk of createGenerator()) {
            // Extract the text from whatever shape the service emits
            const piece = typeof chunk === "string"
                ? chunk
                : (chunk?.text ?? chunk?.token ?? chunk?.content ?? "");
            if (!piece) continue;

            // Services either send cumulative text or deltas - handle both
            result = piece.startsWith(result) ? piece : result + piece;
            logDebug("Choices stream chunk:", chunk, "->", result);
            if (onChunk) onChunk(result);
        }
        return result;
    }

    if (createGenerator && typeof createGenerator === "object") {
        return createGenerator.content || createGenerator.text || "";
    }

    return String(createGenerator ?? "");
}

async function requestViaGenerateRaw(messages) {
    const system = messages.find(m => m.role === "system")?.content || "";
    const user = messages.filter(m => m.role !== "system").map(m => m.content).join("\n\n");
    return await generateRaw(user, {}, false, system);
}

// The LLM is instructed to put each suggestion on its own line - split on
// line breaks (single or double, whatever the model uses), trim, drop empties.
// Semicolons are kept as a fallback separator for models that ignore the
// line-break instruction and reply in the old "; separated" format.
// Some models like to wrap each suggestion in XML/HTML tags anyway (e.g.
// <option name="Funny">...</option>) despite instructions - strip those wrappers
// before parsing so the user never sees raw tags in the menu.
export function parseChoicesResponse(text) {
    if (!text) return [];
    const cleaned = String(text)
        // Remove any tag-style wrappers around suggestions, e.g. <option name="X">, </option>, <suggestion>, </s>
        .replace(/<\/?(?:option|suggestion|choice|s|li|p|item)[^>]*>/gi, "");

    let segments = cleaned
        // One suggestion per line: single newlines, double newlines, \r\n - all fine.
        .split(/\r?\n[\r\n]*/);

    // Fallback: if the model ignored line breaks and used semicolons instead,
    // we'd only have one big segment - split that on ";".
    if (segments.length <= 1 && cleaned.includes(";")) {
        segments = cleaned.split(";");
    }

    return segments
        .map(s => s
            // Also peel off any leftover leading/trailing tags on a segment
            .replace(/^\s*(?:<[a-zA-Z][^>]*>)+\s*/, "")
            .replace(/\s*(?:<\/[a-zA-Z][^>]*>)+\s*$/, "")
            .trim()
            .replace(/^[-*\d.)\]]+\s*/, "")
            .trim())
        .map(s => PUNCTUATION_RE.test(s) ? s : `${s}.`)
        .filter(s => s.length > 0);
}

// Matches a suggestion that already ends with terminal punctuation, allowing a
// closing quote/bracket right after it (e.g. ...start!" or ...meal.).
const PUNCTUATION_RE = /[.!?…]["'”’)\]]*\s*$/;