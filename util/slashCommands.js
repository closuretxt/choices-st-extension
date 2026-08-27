// Slash Commands
// /choices        (alias /choices-open)   - opens the menu and generates suggestions
// /choices-close                          - closes the menu
// /choices-toggle                         - toggles the menu
import { getContext } from "../../../../extensions.js";
import { choicesPopup } from "../ui/choicesPopup.js";

export function initSlashCommands() {
    const ctx = getContext();
    const SlashCommandParser = ctx.SlashCommandParser;
    const SlashCommand = ctx.SlashCommand;

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: "choices",
        aliases: ["choices-open"],
        helpString: "Opens the Choices menu and generates action suggestions from the current context. Suggestions are only generated while the menu is open.",
        callback: () => {
            choicesPopup.open();
            return "";
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: "choices-close",
        helpString: "Closes the Choices menu and cancels any pending suggestion request.",
        callback: () => {
            choicesPopup.close();
            return "";
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: "choices-toggle",
        helpString: "Toggles the Choices menu open or closed.",
        callback: () => {
            choicesPopup.toggle();
            return "";
        },
    }));
}