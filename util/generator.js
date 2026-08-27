// Sends the suggestion request to the configured (separate) LLM and parses the response.
import { extension_settings, getContext } from "../../../extensions.js";
import { generateRaw } from "../../../../script.js";
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
export async function generateChoices(inputText = null) {
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

    // The draft in the input bar is the main focus: expand it, or assume the path if empty.
    const draftBlock = inputText.trim()
        ? inputText.trim()
        : "(empty - assume what the user most likely wants to do next)";
    const userPrompt = `<input_bar_draft>\n${draftBlock}\n</input_bar_draft>\n\nGenerate the suggestions now.`;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
    ];

    logDebug("Choices system prompt:", systemPrompt);
    logDebug("Choices user prompt:", userPrompt);

    let result;
    try {
        result = await sendRequest(st, settings, messages);
    } catch (e) {
        console.error("Choices: suggestion request failed:", e);
        throw e;
    }

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
async function sendRequest(st, settings, messages) {
    const profiles = st?.extensionSettings?.connectionManager?.profiles || [];
    const profile = profiles.find(p => p.id === settings.connection) || profiles.find(p => p.name === settings.connection);
    const profileId = profile ? profile.id : "";

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
            return await requestViaConnectionManager("", messages);
        } finally {
            if (swapped && selectedName) {
                await swapProfile(selectedName, targetName);
            }
        }
    }

    if (st.ConnectionManagerRequestService?.sendRequest) {
        return await requestViaConnectionManager(profileId, messages);
    }

    // No connection manager available: fall back to a raw generation on the current API.
    logDebug("ConnectionManagerRequestService unavailable, falling back to generateRaw.");
    return await requestViaGenerateRaw(messages);
}

async function requestViaConnectionManager(profileId, messages) {
    const st = getContext();
    if (!st.ConnectionManagerRequestService?.sendRequest) {
        throw new Error("ConnectionManagerRequestService.sendRequest is unavailable.");
    }

    const createGenerator = await st.ConnectionManagerRequestService.sendRequest(
        profileId,
        messages,
        undefined,
        { stream: false }
    );

    if (typeof createGenerator === "function") {
        let result = "";
        for await (const chunk of createGenerator()) {
            if (chunk && chunk.text !== undefined) {
                result = chunk.text;
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