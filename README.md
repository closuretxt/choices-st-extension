# Choices | SillyTavern AI Action Suggestions

PERSONAL USE MADE FOR MYSELF

A sparkle button in the input bar. Click it and a separate, configurable LLM proposes action suggestions for your character based on the current context. Click a suggestion to add it to the input bar (it is **not** sent, and the menu stays open) — the menu refreshes with a new batch once you stop typing for a moment.

## Features

- **Separate LLM** — pick any SillyTavern connection profile for suggestions, independent of your main chat model.
- **Configurable options** — each enabled option is one suggestion with its own quirk. Defaults: *In Character, Funny, Smart, Disengage, End Scene*. Add, edit, remove and reorder your own.
- **Context aware** — the continue prompt supports `{{user}}`, `{{char}}`, `{{persona}}`, `{{scenario}}`, `{{charInfo}}`, `{{worldinfo}}`, `{{wi-outlets}}`, `{{imminentcontext}}`, `{{input}}`, `{{optionFocus}}` and `{{wordLimit}}`.
- **Context injection toggles** — World Info, WI Outlets, Character Info, Scenario and User Persona can each be disabled individually in the settings.
- **Input-first** — if you typed something in the input bar, the LLM's main job is to *expand* your draft. If the bar is empty, it assumes the path you most likely want.
- **Only generates while the menu is open.**

## Settings

| Setting | Description |
| --- | --- |
| Suggestion LLM | Connection profile used for the suggestions request |
| Legacy Connection Profile | Swaps to the profile for the request, then swaps back |
| Context Messages | How many recent chat messages are sent as `{{imminentcontext}}` |
| Word Limit (soft) | Guidance in the prompt only — not enforced in code |
| Regen Delay (ms) | Idle time after typing stops before the open menu regenerates |
| Continue Prompt | Fully editable system prompt with macro support |

### Context Injections (Settings)

Each of these can be disabled independently — disabled parts are removed from the prompt (their macro resolves to `(disabled)`):

| Toggle | Macro | Content |
| --- | --- | --- |
| World Info | `{{worldinfo}}` | Active World Info entries (before/after) |
| WI Outlets | `{{wi-outlets}}` | WI outlet entries as `<outlet>` blocks |
| Character Info | `{{charInfo}}` | Character name, description and personality |
| Scenario | `{{scenario}}` | The character's scenario field |
| User Persona | `{{persona}}` | Your persona description |

## Slash Commands

- `/choices` (alias `/choices-open`) — opens the menu and generates suggestions
- `/choices-close` — closes the menu
- `/choices-toggle` — toggles the menu

## Ai slop

This is vibecoded.

## Response format

The LLM is asked to separate each suggestion with a `;`, which the extension parses into the option list.