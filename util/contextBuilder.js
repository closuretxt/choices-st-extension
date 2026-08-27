// Builds the context parts that feed the continue prompt macros.
// Custom macros are registered in ST's macro-system registry (same approach as
// Recast), so substituteParams resolves them natively wherever they appear.
import { extension_settings, getContext } from "../../../../extensions.js";
import { substituteParams } from "../../../../../script.js";
import { power_user } from "../../../../power-user.js";
import { getWorldInfoPrompt } from "../../../../world-info.js";
import { macros as macroSystem } from "../../../../macros/macro-system.js";
import { defaultInputPlaceholder } from "../settings/defaultOptions.js";
import { extensionName, logDebug } from "../index.js";

// Latest collected context, read by the registered macro handlers.
let macroState = {};

const _registeredMacros = new Set();

// Registers this extension's macros with ST's macro registry (idempotent).
export function registerChoicesMacros() {
    if (typeof macroSystem?.registry?.registerMacro !== "function") {
        logDebug("Choices: macro-system registry unavailable, falling back to manual substitution.");
        return false;
    }

    const register = (key, description, handler) => {
        if (_registeredMacros.has(key)) return;
        try {
            macroSystem.registry.registerMacro(key, {
                category: macroSystem.category?.MISC ?? "misc",
                description,
                handler,
            });
            _registeredMacros.add(key);
        } catch (e) {
            logDebug(`Choices: failed to register macro '${key}':`, e);
        }
    };

    register("worldinfo", "Active World Info entries (Choices).", () => macroState.worldinfo ?? "");
    register("wi-outlets", "World Info outlet entries as <outlet> blocks (Choices).", () => macroState.wiOutlets ?? "");
    register("imminentcontext", "The last N chat messages (Choices).", () => macroState.imminentContext ?? "");
    register("charInfo", "Character name, description and personality (Choices).", () => macroState.charInfo ?? "");
    register("input", "Current draft in the input bar, or the empty-placeholder (Choices).", () => macroState.inputDisplay ?? macroState.input ?? "");
    register("optionFocus", "Injected flavor quirks of the enabled options (Choices).", () => macroState.optionFocus ?? "");
    register("wordLimit", "Soft word limit per suggestion (Choices).", () => String(macroState.wordLimit ?? ""));

    // Lowercase aliases in case the registry lookup is case-sensitive
    register("charinfo", "Alias of {{charInfo}} (Choices).", () => macroState.charInfo ?? "");
    register("optionfocus", "Alias of {{optionFocus}} (Choices).", () => macroState.optionFocus ?? "");
    register("wordlimit", "Alias of {{wordLimit}} (Choices).", () => String(macroState.wordLimit ?? ""));

    logDebug("Choices macros registered:", [..._registeredMacros]);
    return true;
}

export function unregisterChoicesMacros() {
    for (const key of _registeredMacros) {
        try {
            macroSystem.registry.unregisterMacro(key);
        } catch {
            // Best-effort cleanup; registry may not contain the macro
        }
    }
    _registeredMacros.clear();
}

// Collects everything the prompt macros can reference.
export async function collectContextParts(inputText, enabledOptions) {
    const st = getContext();
    const settings = extension_settings[extensionName];
    const char = st.characters?.[st.characterId];
    const userName = st.name1 || "User";

    // Injection toggles (each context part can be disabled in the extension settings)
    const injectWorldInfo = settings.injectWorldInfo !== false;
    const injectWIOutlets = settings.injectWIOutlets !== false;
    const includeCharInfo = settings.includeCharInfo !== false;
    const includeScenario = settings.includeScenario !== false;
    const includePersona = settings.includePersona !== false;

    // World Info + outlets (same pattern as the reference pipeline)
    let worldInfo = injectWorldInfo ? "" : "(disabled)";
    let wiOutlets = injectWIOutlets ? "" : "(disabled)";
    if ((injectWorldInfo || injectWIOutlets) && typeof getWorldInfoPrompt === "function") {
        try {
            const chatStrings = st.chat.slice().reverse().map(m => m.mes);
            const wi = await getWorldInfoPrompt(chatStrings, 100000, true);
            if (wi && typeof wi === "object") {
                if (injectWorldInfo) {
                    worldInfo = ((wi.worldInfoBefore || "") + "\n" + (wi.worldInfoAfter || "")).trim();
                }
                const outletBlocks = [];
                for (const [name, contents] of Object.entries(wi.outletEntries || {})) {
                    const text = Array.isArray(contents) ? contents.join("\n") : String(contents);
                    outletBlocks.push(`<outlet name="${name}">\n${text}\n</outlet>`);
                }
                if (injectWIOutlets) {
                    wiOutlets = outletBlocks.join("\n\n");
                }
            }
        } catch (e) {
            console.warn("Choices: failed to collect World Info:", e);
        }
    }

    // Imminent context: the last N chat messages
    const count = Math.max(0, settings.contextLength ?? 6);
    const history = count > 0 ? st.chat.slice(-count) : [];
    const imminentContext = history
        .map(m => {
            const name = m.name || (m.is_user ? userName : char?.name) || "Unknown";
            return `${name}: ${m.mes}`;
        })
        .join("\n\n")
        .trim() || "(the story just started)";

    // The same history as chat-API messages, for the "Send as Roles" mode:
    // user messages -> "user", character messages -> "assistant", narration/system -> "system".
    const historyMessages = history.map(m => ({
        role: m.is_system ? "system" : (m.is_user ? "user" : "assistant"),
        name: m.name || (m.is_user ? userName : char?.name) || "Unknown",
        mes: String(m.mes ?? ""),
    }));

    // Persona (gated by the User Persona toggle)
    let persona = "";
    if (includePersona) {
        try {
            persona = substituteParams("{{persona}}") || "";
            if (persona.includes("{{persona}}")) persona = ""; // macro unresolved
        } catch {
            persona = "";
        }
        if (!persona && power_user?.persona_description) persona = power_user.persona_description;
        if (!persona) persona = "(no persona description set)";
    } else {
        persona = "(disabled)";
    }

    // Character info (name + description + personality), gated by the Character Info toggle
    let charInfo = "(disabled)";
    if (includeCharInfo) {
        const charParts = [];
        if (char?.name) charParts.push(`Name: ${char.name}`);
        if (char?.description) charParts.push(String(char.description).trim());
        if (char?.personality) charParts.push(`Personality: ${String(char.personality).trim()}`);
        charInfo = charParts.join("\n") || "(no character info set)";
    }

    const scenario = includeScenario
        ? ((char?.scenario || "").trim() || "(no scenario set)")
        : "(disabled)";

    // The injected quirks of each enabled option, one per <option> tag
    const focusLines = (enabledOptions || []).map((opt) => `<option name="${opt.label}">${opt.focus}</option>`);
    const optionFocus = focusLines.length > 0
        ? "Give each suggestion its own flavor, one per <option> tag, in this exact order:\n" + focusLines.join("\n")
        : "(no options configured)";

    return {
        worldinfo: worldInfo || "(none)",
        wiOutlets: wiOutlets || "(none)",
        imminentContext,
        historyMessages,
        persona,
        scenario,
        charInfo,
        userName,
        charName: char?.name || "Character",
        optionFocus,
        wordLimit: settings.wordLimit ?? 60,
        input: (inputText || "").trim(),
        inputDisplay: (inputText || "").trim() || defaultInputPlaceholder,
    };
}

// Updates the macro state, applies the gated toggles, then lets ST's macro
// system (via substituteParams) resolve everything — standard macros like
// {{user}}/{{char}} AND this extension's registered macros, exactly like Recast.
export function applyChoicesMacros(template, parts) {
    macroState = parts || {};
    let out = String(template ?? "");

    // {{persona}} and {{scenario}} are STANDARD ST macros, so they cannot be
    // registered in the registry. Replacing them first (with the gated values)
    // is what makes the disable switches actually keep the content out.
    const gated = {
        "{{persona}}": parts.persona ?? "",
        "{{scenario}}": parts.scenario ?? "",
    };
    for (const [macro, value] of Object.entries(gated)) {
        out = out.split(macro).join(value);
    }

    try {
        out = substituteParams(out);
    } catch (e) {
        logDebug("substituteParams failed, using raw template:", e);
    }

    // Fallback for setups where the macro-system registry is unavailable:
    // manually resolve the extension's macros that substituteParams left untouched.
    if (typeof macroSystem?.registry?.registerMacro !== "function") {
        const manual = {
            "{{worldinfo}}": parts.worldinfo ?? "",
            "{{wi-outlets}}": parts.wiOutlets ?? "",
            "{{imminentcontext}}": parts.imminentContext ?? "",
            "{{charInfo}}": parts.charInfo ?? "",
            "{{input}}": parts.inputDisplay ?? "",
            "{{optionFocus}}": parts.optionFocus ?? "",
            "{{wordLimit}}": String(parts.wordLimit ?? ""),
        };
        for (const [macro, value] of Object.entries(manual)) {
            out = out.split(macro).join(value);
        }
    }
    return out;
}