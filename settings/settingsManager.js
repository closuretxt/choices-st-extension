import { extension_settings, getContext } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";
import { defaultOptions, defaultContinuePrompt } from "./defaultOptions.js";
import { extensionName } from "../index.js";

export const defaultSettings = {
    enabled: true,
    connection: "", // Connection profile used by the separate suggestion LLM ("" = current connection)
    legacy_api: false, // Swap to the target profile before the request and swap back after
    contextLength: 6, // Recent chat messages sent as {{imminentcontext}}
    wordLimit: 60, // Soft word limit injected in the prompt (guidance only, not enforced in code)
    regenDelay: 2000, // Idle time (ms) after typing stops before the open menu regenerates
    debug_mode: false,
    injectWorldInfo: true, // {{worldinfo}} - active World Info entries
    injectWIOutlets: true, // {{wi-outlets}} - WI outlet entries
    includeCharInfo: true, // {{charInfo}} - character name, description and personality
    includeScenario: true, // {{scenario}} - character scenario
    includePersona: true, // {{persona}} - user persona description
    continuePrompt: defaultContinuePrompt,
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
    options.forEach((opt) => {
        const row = $(template);
        row.find(".choice-opt-enabled").prop("checked", opt.enabled !== false);
        row.find(".choice-opt-label").val(opt.label);
        row.find(".choice-opt-focus").val(opt.focus);
        row.attr("data-opt-id", opt.id);
        list.append(row);
    });
}

// LISTENERS
export function initSettingsListeners() {
    $("#choices_enabled, #choices_legacy_api, #choices_debug_mode, #choices_connection, #choices_inject_world_info, #choices_inject_wi_outlets, #choices_include_char_info, #choices_include_scenario, #choices_include_persona").on("change", saveSettings);
    $("#choices_context_length, #choices_word_limit, #choices_regen_delay, #choices_continue_prompt").on("input change", saveSettings);

    $("#choices_restore_prompt").on("click", () => {
        extension_settings[extensionName].continuePrompt = defaultContinuePrompt;
        $("#choices_continue_prompt").val(defaultContinuePrompt);
        saveSettingsDebounced();
        if (typeof toastr !== "undefined") toastr.success("Continue prompt restored.", "Choices");
    });

    $("#choices_add_option").on("click", () => {
        const s = extension_settings[extensionName];
        s.options.push({
            id: `opt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            label: "New Option",
            enabled: true,
            focus: "",
        });
        saveSettings();
        renderOptionsEditor();
    });

    $("#choices_restore_options").on("click", () => {
        extension_settings[extensionName].options = JSON.parse(JSON.stringify(defaultOptions));
        saveSettings();
        renderOptionsEditor();
        if (typeof toastr !== "undefined") toastr.success("Default options restored.", "Choices");
    });

    $("#choices_option_list").on("click", ".choice-opt-remove", function () {
        const id = $(this).closest(".choices-option-item").attr("data-opt-id");
        extension_settings[extensionName].options = (extension_settings[extensionName].options || []).filter(o => o.id !== id);
        saveSettings();
        renderOptionsEditor();
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

    // UI
    $("#choices_enabled").prop("checked", s.enabled);
    $("#choices_legacy_api").prop("checked", s.legacy_api);
    $("#choices_debug_mode").prop("checked", s.debug_mode);
    $("#choices_inject_world_info").prop("checked", s.injectWorldInfo);
    $("#choices_inject_wi_outlets").prop("checked", s.injectWIOutlets);
    $("#choices_include_char_info").prop("checked", s.includeCharInfo);
    $("#choices_include_scenario").prop("checked", s.includeScenario);
    $("#choices_include_persona").prop("checked", s.includePersona);
    $("#choices_context_length").val(s.contextLength ?? 6);
    $("#choices_word_limit").val(s.wordLimit ?? 60);
    $("#choices_regen_delay").val(s.regenDelay ?? 2000);
    $("#choices_continue_prompt").val(s.continuePrompt ?? defaultContinuePrompt);

    populateConnectionDropdown();
    renderOptionsEditor();
}

export function saveSettings() {
    const s = extension_settings[extensionName];

    s.enabled = $("#choices_enabled").prop("checked");
    s.legacy_api = $("#choices_legacy_api").prop("checked");
    s.debug_mode = $("#choices_debug_mode").prop("checked");
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

    // Options are read back from the editor rows
    const options = [];
    $("#choices_option_list .choices-option-item").each(function () {
        options.push({
            id: $(this).attr("data-opt-id") || `opt_${Date.now().toString(36)}`,
            label: $(this).find(".choice-opt-label").val() || "Option",
            enabled: $(this).find(".choice-opt-enabled").prop("checked"),
            focus: $(this).find(".choice-opt-focus").val() || "",
        });
    });
    s.options = options;

    saveSettingsDebounced();
}
