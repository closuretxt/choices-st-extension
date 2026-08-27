// The floating suggestions panel above the input bar.
// Generation ONLY happens while the menu is open.
import { extension_settings } from "../../../../extensions.js";
import { extensionName, logDebug } from "../index.js";

export class ChoicesPopup {
    constructor() {
        this.isOpen = false;
        this.isGenerating = false;
        this._regenTimer = null;
        this._lastGeneratedInput = null; // input snapshot the current suggestions were based on
        this._programmaticSet = false; // guards against our own textarea inserts triggering regen
        this._requestId = 0;
        this._requestFn = null; // provided by index.js
    }

    get settings() {
        return extension_settings[extensionName] || {};
    }

    init(requestFn) {
        this._requestFn = requestFn;

        if ($("#choices_popup").length === 0) {
            $("body").append(this._buildDom());
        }

        $("#choices_popup_close").on("click", () => this.close());
        $("#choices_popup_regen").on("click", () => {
            this._lastGeneratedInput = null; // force a fresh batch
            this.scheduleRegen(0);
        });

        // Watch the input bar for user typing (regen happens after the idle delay)
        $("#send_textarea")
            .off("input.choicesOverride")
            .on("input.choicesOverride", () => this._onUserInput());

        // Close when clicking outside the popup or the toggle button
        $(document).off("pointerdown.choicesClose").on("pointerdown.choicesClose", (e) => {
            if (!this.isOpen) return;
            if ($(e.target).closest("#choices_popup, #choices_input_button").length) return;
            this.close();
        });

        $(document).off("keydown.choicesClose").on("keydown.choicesClose", (e) => {
            if (e.key === "Escape" && this.isOpen) this.close();
        });
    }

    _buildDom() {
        return `
        <div id="choices_popup" style="display:none;">
            <div id="choices_popup_header">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span id="choices_popup_title">AI action suggestions</span>
                <button id="choices_popup_regen" class="menu_button interactable fa-solid fa-rotate" title="Regenerate suggestions" tabindex="0"></button>
                <button id="choices_popup_close" class="menu_button interactable fa-solid fa-xmark" title="Close" tabindex="0"></button>
            </div>
            <div id="choices_popup_list"></div>
        </div>`;
    }

    open() {
        if (this.settings.enabled === false) {
            if (typeof toastr !== "undefined") toastr.warning("Choices is disabled in the extension settings.", "Choices");
            return;
        }
        this.isOpen = true;
        this._position();
        $("#choices_popup").stop(true).fadeIn(150);
        $("#choices_input_button").toggleClass("active", true);
        logDebug("Choices popup opened.");
        // Opening the menu always makes a fresh request based on the current context
        this._lastGeneratedInput = null;
        this.scheduleRegen(0);
    }

    close() {
        this.isOpen = false;
        clearTimeout(this._regenTimer);
        this._regenTimer = null;
        this._requestId++; // invalidate any in-flight request
        this.isGenerating = false;
        $("#choices_popup").stop(true).fadeOut(150);
        $("#choices_input_button").toggleClass("active", false);
        logDebug("Choices popup closed.");
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    _position() {
        const $form = $("#form_sheld");
        if ($form.length === 0) return;
        const formTop = $form.offset().top;
        const bottom = Math.max(window.innerHeight - formTop + 10, 10);
        $("#choices_popup").css("bottom", `${bottom}px`);
    }

    _onUserInput() {
        if (this._programmaticSet) return; // never regen from our own inserts
        if (!this.isOpen) return; // ONLY generate while the menu is open
        this.scheduleRegen(this.settings.regenDelay ?? 2000);
    }

    // (Re)generates after `delay` ms. The timer restarts on every keystroke.
    scheduleRegen(delay) {
        if (!this.isOpen) return; // menu closed = never generate
        clearTimeout(this._regenTimer);
        if (delay <= 0) {
            this.requestNew();
            return;
        }
        this._regenTimer = setTimeout(() => this.requestNew(), delay);
    }

    requestNew() {
        if (!this.isOpen) return;
        if (typeof this._requestFn !== "function") return;

        const input = String($("#send_textarea").val() ?? "").trim();
        if (input === this._lastGeneratedInput) return; // nothing changed, keep current suggestions

        this._lastGeneratedInput = input;
        this.showLoading();
        const myId = ++this._requestId;
        this.isGenerating = true;

        Promise.resolve()
            .then(() => this._requestFn())
            .then((results) => {
                if (myId !== this._requestId || !this.isOpen) return; // stale or closed: discard, never trigger regen
                this.renderOptions(results);
            })
            .catch((err) => {
                console.error("Choices: failed to generate suggestions", err);
                if (myId !== this._requestId || !this.isOpen) return;
                this.renderOptions([]);
                if (typeof toastr !== "undefined") toastr.error(err?.message || String(err), "Choices");
            })
            .finally(() => {
                if (myId === this._requestId) this.isGenerating = false;
            });
    }

    showLoading() {
        $("#choices_popup_list").empty().append(
            `<div class="choices-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Thinking...</div>`
        );
    }

    renderOptions(results) {
        const list = $("#choices_popup_list").empty();
        if (!results || results.length === 0) {
            list.append(`<div class="choices-empty">No suggestions returned.</div>`);
            return;
        }
        results.forEach((text) => {
            const item = $(`<div class="choices-option"></div>`);
            item.append($(`<div class="choices-option-text"></div>`).text(text));
            item.append($(`<i class="fa-solid fa-chevron-right choices-option-go" title="Add to input"></i>`));
            item.on("click", () => this.applyOption(text));
            list.append(item);
        });
    }

    // Adds the suggestion to the input bar WITHOUT sending, and WITHOUT closing the menu.
    applyOption(text) {
        const ta = $("#send_textarea");
        const current = String(ta.val() ?? "");
        const trimmed = current.trimEnd();
        const needsSpace = trimmed.length > 0 && !/\s$/.test(trimmed);
        const newValue = trimmed + (needsSpace ? " " : "") + text;

        // Programmatic insert: must not be mistaken for user typing (no instant regen loop)
        this._programmaticSet = true;
        ta.val(newValue).trigger("input");
        this._programmaticSet = false;
        ta.trigger("focus");

        // After the insert, regenerate a fresh batch once the input has been idle for ~2s
        this._lastGeneratedInput = null;
        this.scheduleRegen(this.settings.regenDelay ?? 2000);
    }
}