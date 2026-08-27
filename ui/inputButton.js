// Sparkle button injected into the input bar, next to the send button.
export class InputButton {
    constructor() {
        this.onClick = null;
    }

    init(onClick) {
        this.onClick = onClick;

        if ($("#choices_input_button").length === 0) {
            const buttonHtml = `<div id="choices_input_button" class="fa-solid fa-wand-magic-sparkles interactable" title="Get action ideas" tabindex="0"></div>`;

            const rightForm = $("#rightSendForm");
            if (rightForm.length) {
                const stopButton = rightForm.find("#mes_stop");
                if (stopButton.length) {
                    stopButton.before(buttonHtml);
                } else {
                    rightForm.prepend(buttonHtml);
                }
            } else if ($("#send_but").length) {
                $("#send_but").before(buttonHtml);
            } else {
                $("#form_sheld").append(buttonHtml);
            }
        }

        $(document)
            .off("click", "#choices_input_button")
            .on("click", "#choices_input_button", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.onClick) this.onClick();
            });
    }

    setActive(isActive) {
        $("#choices_input_button").toggleClass("active", !!isActive);
    }
}

export const inputButton = new InputButton();