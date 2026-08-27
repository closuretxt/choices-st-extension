// Builds the context parts that feed the continue prompt macros.
import { extension_settings, getContext } from "../../../extensions.js";
import { substituteParams } from "../../../../script.js";
import { power_user } from "../../../power-user.js";
import { getWorldInfoPrompt } from "../../../world-info.js";
import { extensionName, logDebug } from "../index.js";

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

    // The injected quirks of each enabled option
    const focusLines = (enabledOptions || []).map((opt, i) => `${i + 1}. ${opt.label} — ${opt.focus}`);
    const optionFocus = focusLines.length > 0
        ? "Give each suggestion its own flavor, in this exact order:\n" + focusLines.join("\n")
        : "(no options configured)";

    return {
        worldinfo: worldInfo || "(none)",
        wiOutlets: wiOutlets || "(none)",
        imminentContext,
        persona,
        scenario,
        charInfo,
        userName,
        charName: char?.name || "Character",
        optionFocus,
        wordLimit: settings.wordLimit ?? 60,
        input: (inputText || "").trim(),
    };
}

// Replaces the custom macros of this extension, then lets ST resolve the standard ones
// ({{user}}, {{char}}, {{persona}}, {{scenario}}, etc).
export function applyChoicesMacros(template, parts) {
    let out = String(template ?? "");
    const replacements = {
        "{{worldinfo}}": parts.worldinfo,
        "{{wi-outlets}}": parts.wiOutlets,
        "{{imminentcontext}}": parts.imminentContext,
        "{{optionFocus}}": parts.optionFocus,
        "{{wordLimit}}": String(parts.wordLimit),
        "{{input}}": parts.input,
        // Gated by the extension toggles; replacing them here (before substituteParams)
        // is what makes the disable switches actually keep the content out of the prompt.
        "{{charInfo}}": parts.charInfo,
        "{{persona}}": parts.persona,
        "{{scenario}}": parts.scenario,
    };
    for (const [macro, value] of Object.entries(replacements)) {
        out = out.split(macro).join(value);
    }
    try {
        out = substituteParams(out);
    } catch (e) {
        logDebug("substituteParams failed, using raw template:", e);
    }
    return out;
}