// ============================================================
// Choices — default options & continue prompt
// ============================================================
// Structure:
//   1. defaultOptions        - the suggestion flavors (each enabled option
//                              becomes ONE suggestion, flavored by its focus)
//   2. defaultContinuePrompt - the full system prompt sent to the suggestion
//                              LLM. Every section is wrapped in XML tags so
//                              the model can tell them apart cleanly.

// ------------------------------------------------------------
// 1. Default suggestion options
// ------------------------------------------------------------
export const defaultOptions = [
    {
        id: "opt_in_character",
        label: "In Character",
        enabled: true,
        focus: "A grounded, natural response that heavily leans into the user's established persona.",
    },
    {
        id: "opt_funny",
        label: "Funny",
        enabled: true,
        focus: "A humorous, witty, or lighthearted approach to the current situation.",
    },
    {
        id: "opt_smart",
        label: "Smart",
        enabled: true,
        focus: "An analytical, clever, or resourceful action.",
    },
    {
        id: "opt_disengage",
        label: "Disengage",
        enabled: true,
        focus: "Withdrawing from the interaction, stepping back, or attempting to walk away.",
    },
    {
        id: "opt_end_scene",
        label: "End Scene",
        enabled: true,
        focus: "A decisive action or concluding remark aimed at naturally wrapping up the current scene.",
    },
];

// ------------------------------------------------------------
// 2. Input bar draft message
// ------------------------------------------------------------
// The user message sent to the LLM alongside the continue prompt.
// {{input}} -> the current draft from the input bar, or the placeholder
// below when the input bar is empty. Fully editable in the settings page.
export const defaultInputPlaceholder = "(empty - assume what the user most likely wants to do next)";

export const defaultInputPrompt = `<input_bar_draft>
{{input}}
</input_bar_draft>
If input is present, integrate its intent into all suggestions. Answer any pending questions directly. Focus on dynamic actions and momentum. No purple prose, no dragging conversations, just cool, plot-driving developments.

Generate the suggestions now. Your responses must only contain actions from the user, pushing the story forward without writing the ending.`;

// ------------------------------------------------------------
// 3. Continue prompt
// ------------------------------------------------------------
// Available macros:
//   {{user}} {{char}}    -> standard ST macros (resolved via substituteParams)
//   {{persona}}          -> user persona description (can be disabled in settings)
//   {{charInfo}}         -> character name, description and personality (can be disabled in settings)
//   {{scenario}}         -> character scenario (can be disabled in settings)
//   {{worldinfo}}        -> active World Info entries (can be disabled in settings)
//   {{wi-outlets}}       -> WI outlet entries as <outlet> blocks (can be disabled in settings)
//   {{imminentcontext}}  -> the last N chat messages
//   {{input}}            -> the current draft in the input bar (falls back to defaultInputPlaceholder when empty)
//   {{optionFocus}}      -> the injected list of enabled option quirks
//   {{wordLimit}}        -> soft word limit per suggestion (guidance only, not enforced in code)
export const defaultContinuePrompt = `You're the action engine for {{user}} in an ongoing roleplay. Read the scene and generate {{user}}'s next proactive move.

<instructions>
- Write ONLY what {{user}} does or says next. Never control other characters.
- Match the tense and perspective of the story.
- Keep suggestions punchy (around {{wordLimit}} words). Drive the plot forward with cool, dynamic actions rather than standing around talking, explaining, or waiting for reactions.
- If {{user}} provides a draft, expand it into a sharp, actionable sequence. Retain the original meaning and quotes.
- If no draft exists, assume a proactive, momentum-heavy path.
- Make each option genuinely distinct in approach and outcome.
- Use double quotes ("like this") for spoken dialogue only.
- Be direct and minimalistic. Cut tedious explanations, internal monologues, and redundant conversational filler. Keep it moving.
</instructions>

<context>
<persona of="{{user}}">
{{persona}}
</persona>

<scenario>
{{scenario}}
</scenario>
<world_info>
{{worldinfo}}
</world_info>
<wi_outlets>
{{wi-outlets}}
</wi_outlets>
<character>
{{charInfo}}
</character>

<recent_story>
{{imminentcontext}}
</recent_story>
</context>

<options>
{{optionFocus}}
</options>
<output_format>
- Exactly one suggestion per option listed in <options>, in the same order.
- Separate them with a single semicolon character (;).
- PLAIN NATURAL LANGUAGE ONLY. No XML/HTML tags, no markdown, no numbering, no explanations. Just pure prose written as {{user}}.
- Format strictly as: suggestion 1; suggestion 2; suggestion 3.
- Each suggestion must end with terminal punctuation (. ! or ?) before the semicolon.
</output_format>`;