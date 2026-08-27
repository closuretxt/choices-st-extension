import { extension_settings, getContext } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";
import { defaultOptions, defaultContinuePrompt, defaultInputPrompt } from "./defaultOptions.js";
import { extensionName } from "../index.js";

export const defaultSettings = {
    enabled: true,
    connection: "", // Connection profile used by the separate suggestion LLM ("" = current connection)
    legacy_api: false, // Swap to the target profile before the request and swap back after
    contextLength: 6, // Recent chat messages sent as {{imminentcontext}}
    wordLimit: 60, // Soft word limit injected in the prompt (guidance only, not enforced in code)
    regenDelay: 2000, // Idle time (ms) after typing stops before the open menu regenerates
    stream: true, // Stream the response and load options as they arrive
    send_as_roles: false, // Send context sections as distinct system messages instead of one prompt block
    debug_mode: false,
    injectWorldInfo: true, // {{worldinfo}} - active World Info entries
    injectWIOutlets: true, // {{wi-outlets}} - WI outlet entries
    includeCharInfo: true, // {{charInfo}} - character name, description and personality
    includeScenario: true, // {{scenario}} - character scenario
    includePersona: true, // {{persona}} - user persona description
    continuePrompt: defaultContinuePrompt,
    inputPrompt: defaultInputPrompt,
    options: defaultOptions,
};

// CONNECTION PROFILE HELPERS
function getConnectionProfiles() {
    const st = getContext();
    if (st?.extensionSettings?.disabledExtensions?.includes("connection-manager")) {
        return [];
    }
    return st?.extensionSettings?.connectionManager?.profiles || [];
}

export function populateConnectionDropdown() {
    const select = $("#choices_connection");
    if (select.length === 0) return;
    const current = extension_settings[extensionName].connection || "";
    select.empty();
    select.append(`<option value="" title="Use whatever connection is currently active">(Use current connection)</option>`);
    for (const profile of getConnectionProfiles()) {
        select.append(`<option value="${profile.id}">${profile.name}</option>`);
    }
    // Prefer the saved profile if it still exists
    const exists = getConnectionProfiles().some(p => p.id === current);
    select.val(exists ? current : "");
}

// OPTIONS EDITOR
export function renderOptionsEditor() {
    const list = $("#choices_option_list");
    if (list.length === 0) return;
    const template = $("#choices_option_template").html() || "";
    list.empty();

    const options = extension_settings[extensionName].options || [];
    options.forEach((opt, index) => {
        const row = $(template);
        row.find(".choice-opt-num").text(index + 1);
        row.find(".choice-opt-enabled").prop("checked", opt.enabled !== false);
        row.find(".choice-opt-focus").val(opt.focus);
        list.append(row);
    });
}

// LISTENERS
export function initSettingsListeners() {
    $("#choices_enabled, #choices_legacy_api, #choices_debug_mode, #choices_connection, #choices_stream, #choices_send_as_roles, #choices_inject_world_info, #choices_inject_wi_outlets, #choices_include_char_info, #choices_include_scenario, #choices_include_persona").on("change", saveSettings);
    $("#choices_context_length, #choices_word_limit, #choices_regen_delay, #choices_continue_prompt, #choices_input_prompt").on("input change", saveSettings);

    $("#choices_restore_input_prompt").on("click", () => {
        extension_settings[extensionName].inputPrompt = defaultInputPrompt;
        $("#choices_input_prompt").val(defaultInputPrompt);
        saveSettingsDebounced();
        if (typeof toastr !== "undefined") toastr.success("Input message restored.", "Choices");
    });

    $("#choices_restore_prompt").on("click", () => {
        extension_settings[extensionName].continuePrompt = defaultContinuePrompt;
        $("#choices_continue_prompt").val(defaultContinuePrompt);
        saveSettingsDebounced();
        if (typeof toastr !== "undefined") toastr.success("Continue prompt restored.", "Choices");
    });

    $("#choices_add_option").on("click", () => {
        const s = extension_settings[extensionName];
        s.options.push({
            enabled: true,
            focus: "",
        });
        // Render first, then save: saveSettings() reads the options back from
        // the editor rows, so the DOM must reflect the new state beforehand.
        renderOptionsEditor();
        saveSettings();
    });

    $("#choices_restore_options").on("click", () => {
        extension_settings[extensionName].options = JSON.parse(JSON.stringify(defaultOptions));
        renderOptionsEditor();
        saveSettings();
        if (typeof toastr !== "undefined") toastr.success("Default options restored.", "Choices");
    });

    $("#choices_option_list").on("click", ".choice-opt-remove", function () {
        // Options are plain array entries: their position is their identity.
        const index = $(this).closest(".choices-option-item").index();
        const options = extension_settings[extensionName].options || [];
        if (index >= 0 && index < options.length) {
            options.splice(index, 1);
        }
        renderOptionsEditor();
        saveSettings();
    });
}

// LOAD / SAVE
export async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    const s = extension_settings[extensionName];

    // Fill in any missing keys from defaults (deep copy for objects)
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (s[key] === undefined) {
            s[key] = typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
        }
    }

    // Migration: unmodified old prompts get upgraded to the current default;
    // customized ones only get the dialogue-quote rule patched in if missing.
    const OLD_PROMPT_MARKER = "You are a suggestion engine for an interactive roleplay.";
    if (typeof s.continuePrompt === "string" && s.continuePrompt.length > 0) {
        if (s.continuePrompt.includes(OLD_PROMPT_MARKER)) {
            s.continuePrompt = defaultContinuePrompt;
        } else if (!s.continuePrompt.includes("wrapped in double quotes") && !s.continuePrompt.includes("About quotes:")) {
            s.continuePrompt = s.continuePrompt.replace(
                "Do NOT wrap them in quotes.",
                'If a suggestion contains spoken dialogue, the spoken part MUST be wrapped in double quotes ("like this"). Never wrap the entire suggestion in quotes, only the spoken words inside it. Do NOT wrap whole suggestions in quotes.'
            );
        }
    }

    // No backwards compatibility: old option objects (with id/label fields)
    // don't match the { enabled, focus } shape, so they get reset to defaults.
    const optionsAreValid = Array.isArray(s.options) && s.options.every(
        o => o && typeof o === "object" && typeof o.focus === "string" && !("label" in o) && !("id" in o)
    );
    if (!optionsAreValid) {
        s.options = JSON.parse(JSON.stringify(defaultOptions));
    }

    // UI
    $("#choices_enabled").prop("checked", s.enabled);
    $("#choices_legacy_api").prop("checked", s.legacy_api);
    $("#choices_debug_mode").prop("checked", s.debug_mode);
    $("#choices_stream").prop("checked", s.stream);
    $("#choices_send_as_roles").prop("checked", s.send_as_roles);
    $("#choices_inject_world_info").prop("checked", s.injectWorldInfo);
    $("#choices_inject_wi_outlets").prop("checked", s.injectWIOutlets);
    $("#choices_include_char_info").prop("checked", s.includeCharInfo);
    $("#choices_include_scenario").prop("checked", s.includeScenario);
    $("#choices_include_persona").prop("checked", s.includePersona);
    $("#choices_context_length").val(s.contextLength ?? 6);
    $("#choices_word_limit").val(s.wordLimit ?? 60);
    $("#choices_regen_delay").val(s.regenDelay ?? 2000);
    $("#choices_continue_prompt").val(s.continuePrompt ?? defaultContinuePrompt);
    $("#choices_input_prompt").val(s.inputPrompt ?? defaultInputPrompt);

    populateConnectionDropdown();
    renderOptionsEditor();
}

export function saveSettings() {
    const s = extension_settings[extensionName];

    s.enabled = $("#choices_enabled").prop("checked");
    s.legacy_api = $("#choices_legacy_api").prop("checked");
    s.debug_mode = $("#choices_debug_mode").prop("checked");
    s.stream = $("#choices_stream").prop("checked");
    s.send_as_roles = $("#choices_send_as_roles").prop("checked");
    s.injectWorldInfo = $("#choices_inject_world_info").prop("checked");
    s.injectWIOutlets = $("#choices_inject_wi_outlets").prop("checked");
    s.includeCharInfo = $("#choices_include_char_info").prop("checked");
    s.includeScenario = $("#choices_include_scenario").prop("checked");
    s.includePersona = $("#choices_include_persona").prop("checked");
    s.connection = $("#choices_connection").val() || "";
    s.contextLength = parseInt($("#choices_context_length").val(), 10) || 0;
    s.wordLimit = parseInt($("#choices_word_limit").val(), 10) || 0;
    s.regenDelay = parseInt($("#choices_regen_delay").val(), 10);
    if (isNaN(s.regenDelay) || s.regenDelay < 0) s.regenDelay = 2000;
    s.continuePrompt = $("#choices_continue_prompt").val() ?? s.continuePrompt;
    s.inputPrompt = $("#choices_input_prompt").val() ?? s.inputPrompt;

    // Options are read back from the editor rows (position = number, no id/label)
    const options = [];
    $("#choices_option_list .choices-option-item").each(function () {
        options.push({
            enabled: $(this).find(".choice-opt-enabled").prop("checked"),
            focus: $(this).find(".choice-opt-focus").val() || "",
        });
    });
    s.options = options;

    saveSettingsDebounced();
}
