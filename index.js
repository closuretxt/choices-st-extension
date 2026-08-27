// IMPORTS
import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, generateRaw, substituteParams, eventSource, event_types } from "../../../../script.js";
import { power_user } from "../../../power-user.js";
import { getWorldInfoPrompt } from "../../../world-info.js";
// Settings
import { loadSettings, saveSettings, defaultSettings, initSettingsListeners } from "./settings/settingsManager.js";
export { loadSettings, saveSettings, defaultSettings };

// Generator
import { generateChoices } from "./util/generator.js";
// UI
import { inputButton } from "./ui/inputButton.js";
import { choicesPopup } from "./ui/choicesPopup.js";
// Slash Commands
import { initSlashCommands } from "./util/slashCommands.js";

// Setup
export const extensionName = "Choices";
const extensionFolderPath = `scripts/extensions/third-party/choices-st-extension`;

// Base functions
// Utility to get ST variables
function getST() {
    return getContext();
}

// Debug function ofc
export function logDebug(...args) {
    if (extension_settings[extensionName]?.debug_mode) {
        console.log("[Choices Debug]", ...args);
    }
}

// Requests a fresh set of choices from the suggestion LLM.
// IMPORTANT: only generates while the popup menu is open.
export function requestChoices() {
    if (!choicesPopup.isOpen) {
        logDebug("requestChoices skipped: popup menu is not open.");
        return;
    }
    choicesPopup.requestNew();
}

// Startup
jQuery(() => {
    loadSettings();
    initSettingsListeners();

    // Sparkle button in the input bar toggles the popup
    inputButton.init(() => choicesPopup.toggle());

    // Popup asks the generator for a fresh batch of suggestions
    choicesPopup.init(() => generateChoices());

    initSlashCommands();

    // If the menu is open and the story moves, refresh suggestions after the idle delay.
    // Generation never happens while the menu is closed.
    if (eventSource && event_types) {
        const onStoryChange = () => {
            if (choicesPopup.isOpen) {
                choicesPopup.scheduleRegen(extension_settings[extensionName].regenDelay ?? 2000);
            }
        };
        eventSource.on(event_types.MESSAGE_RECEIVED, onStoryChange);
        eventSource.on(event_types.MESSAGE_SENT, onStoryChange);
    }

    logDebug("Choices initialized.");
});