// Default suggestion options.
// Each enabled option becomes ONE suggestion, flavored by its "focus" quirk.
// The label is the editable one-liner shown in the settings page.
export const defaultOptions = [
    {
        id: "opt_in_character",
        label: "In Character",
        enabled: true,
        focus: "As in character as possible, trying not to overcomplicate things.",
    },
    {
        id: "opt_funny",
        label: "Funny",
        enabled: true,
        focus: "Funny.",
    },
    {
        id: "opt_smart",
        label: "Smart",
        enabled: true,
        focus: "Smart and clever.",
    },
    {
        id: "opt_disengage",
        label: "Disengage",
        enabled: true,
        focus: "Disengaging, walking off.",
    },
    {
        id: "opt_end_scene",
        label: "End Scene",
        enabled: true,
        focus: "Engaging and trying to end the current scene.",
    },
];

// The continue prompt: what is sent to the suggestion LLM so it understands its job.
// Available macros:
//   {{user}} {{char}}             -> standard ST macros (resolved via substituteParams)
//   {{persona}}          -> user persona description (can be disabled in settings)
//   {{charInfo}}         -> character name, description and personality (can be disabled in settings)
//   {{scenario}}         -> character scenario (can be disabled in settings)
//   {{worldinfo}}        -> active World Info entries (can be disabled in settings)
//   {{wi-outlets}}       -> WI outlet entries as <outlet> blocks (can be disabled in settings)
//   {{imminentcontext}}  -> the last N chat messages
//   {{input}}            -> the current draft in the input bar (may be empty)
//   {{optionFocus}}      -> the injected list of enabled option quirks
//   {{wordLimit}}        -> soft word limit per suggestion (guidance only, not enforced in code)
export const defaultContinuePrompt = `You are a suggestion engine for an interactive roleplay. Your ONLY job is to propose possible next actions for {{user}} (the user's character) based on the story so far.

<world_info>
{{worldinfo}}
</world_info>

{{wi-outlets}}

Persona of {{user}}:
{{persona}}

Character:
{{charInfo}}

Scenario:
{{scenario}}

<recent_story>
{{imminentcontext}}
</recent_story>

Rules:
- Every suggestion must be something {{user}} does or says next, never what other characters do.
- Match the tense and grammatical person used in the recent story.
- Keep each suggestion short and punchy: aim for around {{wordLimit}} words or fewer.
- If a draft typed by {{user}} is provided, your MAIN job is to EXPAND that draft into fuller versions of itself. Do not replace it with unrelated ideas.
- If no draft is provided, you are allowed to assume which path {{user}} most likely wants to take.

{{optionFocus}}

Output format (STRICT):
- Return exactly one suggestion for each flavor listed above, in order.
- Separate the suggestions with a single semicolon character (;).
- Do NOT number them. Do NOT wrap them in quotes. No explanations, notes or commentary.`;