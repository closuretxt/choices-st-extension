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
export const defaultContinuePrompt = `You're the idea engine for {{user}} (the user's character) in an ongoing roleplay. Read the scene below and come up with what {{user}} could do or say next.

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

The gist:
- Suggestions are ONLY things {{user}} does or says next. Never write actions or dialogue for the other characters.
- Match the tense and grammatical person the story is using.
- Keep each suggestion short and punchy — around {{wordLimit}} words max. It's a suggestion, not a novel.
- Got a draft from {{user}}? Then your MAIN job is expanding THAT into a fuller version of itself. Keep its meaning and any quotes in it — don't swap it for unrelated ideas.
- No draft? You're free to assume which path {{user}} most likely wants and run with it.

{{optionFocus}}

Make each option genuinely different — different angle, different vibe, different outcome. If two of your suggestions could be merged into one without losing anything, they're too similar: rethink them.

About quotes: if a suggestion contains spoken dialogue, the spoken words go in double quotes ("like this"). Never quote-wrap the entire suggestion, only the dialogue inside it. If the draft you're expanding already has quotes, keep them.

How to answer (strict):
- Exactly one suggestion per flavor, in the order listed above.
- Separate them with a single semicolon character (;).
- No numbering, no explanations, no extra text of any kind.
- Be simplistic and minimalistic.`;