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

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
    ];

    logDebug("Choices system prompt:", systemPrompt);
    logDebug("Choices user prompt:", userPrompt);

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
            if (chunk && chunk.text !== undefined) {
                result = chunk.text;
                if (onChunk) onChunk(result);
            }
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

// The LLM is instructed to separate suggestions with a ";" - split, trim, drop empties.
export function parseChoicesResponse(text) {
    if (!text) return [];
    return String(text)
        .split(";")
        .map(s => s.trim().replace(/^[-*\d.)\]]+\s*/, "").trim())
        .filter(s => s.length > 0);
}