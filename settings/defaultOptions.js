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
If input is present, the actions or speech intent should be contained in every option you suggest somewhere.

Generate the suggestions now. Your responses shall not provide a ending to the story and only contain actions from user.`;

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
export const defaultContinuePrompt = `You're the idea engine for {{user}} (the user's character) in an ongoing roleplay. Read the scene below and come up with what {{user}} could do or say next.

<instructions>
- Suggestions are ONLY things {{user}} does or says next. Never write actions or dialogue for the other characters.
- Match the tense and grammatical person the story is using.
- Keep each suggestion short and punchy — around {{wordLimit}} words max. It's a suggestion, not a novel.
- Got a draft from {{user}}? Then your MAIN job is expanding THAT into a fuller version of itself. Keep its meaning and any quotes in it — don't swap it for unrelated ideas.
- No draft? You're free to assume which path {{user}} most likely wants and run with it.
- Make each option genuinely different — different angle, different vibe, different outcome. If two of your suggestions could be merged into one without losing anything, they're too similar: rethink them.
- About quotes: if a suggestion contains spoken dialogue, the spoken words go in double quotes ("like this"). Never quote-wrap the entire suggestion, only the dialogue inside it. If the draft you're expanding already has quotes, keep them.
- Be simplistic and minimalistic. Avoid redundancy and progress/push it forward.
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
- PLAIN NATURAL LANGUAGE ONLY. Your reply is pasted straight into the user's input bar, so it must be pure prose written as {{user}} (first-person actions and dialogue). Absolutely NO XML/HTML tags of any kind — no <option> wrappers, no name or label attributes, no markdown, no numbering, no quotes around the whole suggestion, no explanations before or after.
- Bad: <option name="Funny">I stand up and sigh.</option> — Good: I stand up and sigh.
- The ONLY allowed structure in your entire reply is: suggestion 1; suggestion 2; suggestion 3. Nothing else.
- Each suggestion must end with terminal punctuation (. ! or ?) before the semicolon or the end of your reply — never cut a sentence short.
</output_format>`;