/* rag.js — Writers Digest craft knowledge base + lesson mini-agents.
 *
 * A small, hand-curated corpus of fiction-craft advice is embedded into the
 * vector index on first run (source/handle prefix 'kb:'). The pipeline agents
 * and the chat harness can then retrieve grounded, citable guidance instead of
 * hallucinating craft "rules". LESSONS defines a handful of single-lens
 * mini-agents that the agent pipeline can run over a freshly-finished paragraph.
 *
 * Exports:
 *   seedKB()                  — idempotent first-run index seed (.kb.json flag)
 *   retrieveAdvice(query, k)  — semantic search scoped to the 'kb:' corpus
 *   LESSONS                   — array of craft-lens mini-agent definitions
 * ====================================================================== */
import { indexContent, retrieve, loadJSON, saveJSON } from './core.js';

/* ---- the craft corpus ------------------------------------------------- *
 * Each entry: a stable id (used for both source and handle as 'kb:'+id),
 * a short title, and a self-contained passage of writing advice. Passages
 * are kept concrete and example-bearing so retrieval returns actionable text.
 * ---------------------------------------------------------------------- */
const KB = [
  { id: 'show-dont-tell', title: "Show, Don't Tell",
    text: `Show, don't tell: dramatize emotion through action, sensation, and behavior instead of naming it. "She was nervous" tells; "She kept smoothing the same crease in her skirt, eyes flicking to the door" shows. Telling states a conclusion the reader should be allowed to draw. Reserve telling for transitions, summary, and pacing control — but render the emotional beats that matter. Test: if you can delete the emotion-label sentence and the scene still lands, the showing was doing the work.` },

  { id: 'filter-words', title: 'Kill Filter Words',
    text: `Filter words distance the reader from the viewpoint character by routing perception through a verb of perceiving: saw, heard, felt, noticed, watched, realized, seemed, looked, wondered, thought, knew, decided. "She saw the rain begin to fall" filters; "The rain began to fall" puts the reader inside the moment. Cut filters in deep POV and let the perception be the prose itself. Keep them only when the act of perceiving is itself the point.` },

  { id: 'sensory-grounding', title: 'Sensory Grounding',
    text: `Ground scenes in specific, concrete sensory detail. Readers believe what they can see, hear, smell, taste, and touch. Beyond the dominant visual sense, reach for smell and sound — they evoke memory and atmosphere fast. Choose one or two sharp particulars over a catalogue: the tang of hot copper, a screen door's two-note slap. Specific nouns and verbs ground a scene more than adjectives do. Abstraction floats; sensation anchors.` },

  { id: 'dialogue-punch', title: 'Dialogue Punch',
    text: `Strong dialogue is compressed, oblique, and character-revealing — not transcription. People rarely answer the question they were asked; subtext carries the real exchange. Trust "said" as an invisible tag and cut adverbs ("she said angrily"); show the anger in the line or a beat of action. Give each character a distinct rhythm and diction. Read it aloud — if it sounds like a person under pressure, keep it; if it sounds like exposition, cut it.` },

  { id: 'said-bookism', title: 'Dialogue Tags & Said-Bookisms',
    text: `Said-bookisms are the exotic dialogue tags writers reach for to avoid "said": he expostulated, she ejaculated, he opined, she queried. They call attention to the prose and away from the conversation. "Said" and "asked" are nearly invisible; readers skim past them to the words that matter. Prefer an action beat to a fancy tag: '"Get out," she said. The door clicked shut behind her.' Use the beat to attribute and to characterize at once.` },

  { id: 'pacing', title: 'Pacing Watch',
    text: `Pacing is the felt speed of the prose. Short sentences, hard verbs, and white space accelerate; long subordinate clauses, reflection, and sensory layering slow things down. Match rhythm to content — quicken for action and tension, expand for emotion and aftermath. Watch for stretches where nothing changes (no new information, decision, or shift in feeling); cut or compress them. End scenes a beat early, on a turn, rather than letting them deflate.` },

  { id: 'scene-vs-summary', title: 'Scene vs Summary',
    text: `Scene renders moment-to-moment action in real time; summary compresses time and skips ahead. Dramatize what matters — turning points, conflict, decisions — in scene. Use summary to bridge gaps, cover routine, and control pace. A common failure is summarizing the emotional climax ("they argued for an hour") instead of dramatizing it, or dramatizing trivia ("she made coffee, step by step") that should be summarized. Spend your scene-budget where the stakes are.` },

  { id: 'active-voice', title: 'Active Voice',
    text: `Prefer the active voice: subject acts on object. "The window was broken by the storm" (passive) is weaker than "The storm broke the window." Passive constructions bury the agent, add weight, and drain momentum — watch for forms of "to be" plus a past participle ("was taken", "is held", "were seen"). Passive is legitimate when the actor is unknown or deliberately hidden, or when the object is the true subject of attention. Otherwise, name who does what.` },

  { id: 'character-motivation', title: 'Character Motivation',
    text: `Every character acts from desire and fear; motivation is the engine of plausible behavior. Readers forgive almost anything except the unmotivated — actions that exist only to serve the plot. Ask of each beat: what does this character want right now, and what are they willing to do to get it? Goal, conflict, and stakes should be legible scene by scene. Contradictory wants inside one character create the richest tension; let them collide on the page.` },

  { id: 'cliche-avoidance', title: 'Cliché Catcher',
    text: `Clichés are dead metaphors and stock phrasings the reader's eye slides over without seeing: heart pounding, blood ran cold, time stood still, a shiver down her spine, eyes like saucers, deafening silence, calm before the storm. They signal emotion without delivering it. Replace the cliché with a fresh, character-specific image, or with plain concrete statement. Beware too the situational cliché — the scene the reader has read a hundred times. Surprise is a form of respect.` },

  { id: 'pov-discipline', title: 'POV Discipline',
    text: `Point-of-view discipline means staying inside one consciousness per scene and never reporting what that character cannot know. Head-hopping — sliding into a second character's thoughts mid-scene — quietly breaks the reader's trust and flattens intimacy. In deep third or first person, every observation is colored by the viewpoint character's mood, history, and bias. If you must change heads, do it at a scene or chapter break, clearly. Consistency of distance matters as much as consistency of head.` },

  { id: 'sentence-variety', title: 'Sentence Variety',
    text: `Monotonous sentence structure dulls prose even when every sentence is correct. Vary length and shape: follow a long, winding sentence with a short, blunt one for emphasis. Avoid starting consecutive sentences with the same word or the same subject-verb pattern ("She did X. She did Y. She did Z."). Read for rhythm aloud. A run of identical -ing openers or "and then" chains is a signal to recast. Punctuation — the dash, the colon, the fragment — is a tool for music and emphasis.` },

  { id: 'adverbs', title: 'Adverbs & Modifiers',
    text: `Lean on strong verbs and nouns; treat -ly adverbs as a symptom. "Ran quickly" wants "sprinted"; "said loudly" wants "shouted" or a beat. Redundant adverbs ("whispered quietly", "shrugged indifferently") add words without meaning. Intensifiers — very, really, quite, suddenly, just, somewhat — usually weaken the very claim they prop up. Cut a draft's adverbs and intensifiers and most sentences get sharper. Keep the adverb only when it genuinely changes or complicates the verb.` },

  { id: 'opening-hooks', title: 'Openings & Hooks',
    text: `Openings must earn the next sentence. Start in motion, with a character wanting something, or with a concrete image that raises a question — not with weather, backstory, or a character waking up. Establish voice immediately; voice is what readers commit to before they care about plot. Avoid front-loading exposition; release context as the scene needs it. The first page is a promise about the kind of story this will be — make sure the promise is the one you intend to keep.` },

  { id: 'exposition-infodump', title: 'Exposition & Info-dumps',
    text: `Backstory and world detail are necessary, but the info-dump — paragraphs of explanation halting the present action — is where readers skim. Deliver exposition on a need-to-know basis, threaded through scene, conflict, and dialogue (without "as you know, Bob" lectures). A character explaining something they both already know is a red flag. Let setting and history surface through what a viewpoint character notices and reacts to. Curiosity, not completeness, keeps the reader turning pages.` },

  { id: 'tension-conflict', title: 'Tension & Conflict',
    text: `A scene without tension is a scene at risk of being cut. Tension comes from desire meeting obstacle, from unanswered questions, from what's withheld. Even quiet scenes need a current under them — competing wants, a secret, a deadline, dread. Don't resolve tension too early or too neatly; complicate before you relieve. Microtension at the sentence level — a hint of conflict, contradiction, or foreboding on every page — is what makes "nothing happens" scenes still feel alive.` },

  { id: 'specificity', title: 'Specificity & Concrete Detail',
    text: `Specificity is the soul of vivid prose. "A bird" is generic; "a magpie" is concrete; "a magpie worrying at a crushed snail on the curb" is a world. Concrete, particular nouns carry more conviction than abstractions and adjectives. The telling detail — one precise, slightly unexpected particular — does more than ten general ones. Specificity also signals authority: the reader trusts a narrator who notices exactly. Choose details that characterize the noticer as well as the noticed.` },

  { id: 'revision', title: 'Revision & Cutting',
    text: `Writing is rewriting. First drafts exist to be cut: most prose tightens by trimming a fifth without losing meaning. Hunt for throat-clearing openers ("There was", "It was at this point that"), redundant pairs ("each and every"), and sentences that restate the previous one. Cut the first and last lines of paragraphs and scenes and see if they were warm-up and wind-down. If a darling — a clever line you love — doesn't serve the scene, kill it. Clarity and momentum beat ornament.` },

  { id: 'theme-resonance', title: 'Theme & Resonance',
    text: `Theme is not a moral stapled on; it's the question the whole story argues with, surfacing through pattern, image, and choice. Don't state it — embody it. Recurring motifs (an object, a color, a phrase) accrue meaning by repetition in shifting contexts. The most resonant endings answer the story's dramatic question while reopening its thematic one. Trust the reader to feel what you've built; explaining the meaning is the surest way to deflate it.` },
];

/* ---- seedKB: index the corpus once ----------------------------------- */
export async function seedKB() {
  const flag = await loadJSON('.kb.json', null);
  if (flag && flag.seeded) return; // already seeded
  for (const entry of KB) {
    const source = 'kb:' + entry.id;
    const handle = 'kb:' + entry.id;
    // Prefix the title so retrieved chunks carry their lens label.
    const content = `${entry.title}\n\n${entry.text}`;
    try { await indexContent(handle, source, content); }
    catch (e) { console.warn('seedKB: failed to index', entry.id, e); }
  }
  await saveJSON('.kb.json', { seeded: true, count: KB.length, at: Date.now() });
}

/* ---- retrieveAdvice: KB-scoped semantic search ----------------------- */
export async function retrieveAdvice(query, k = 4) {
  return retrieve(query, k, { source: 'kb:' });
}

/* ---- LESSONS: single-lens craft mini-agents -------------------------- *
 * Each lesson is a pipeline-ready agent definition. systemPrompt frames ONE
 * craft lens; the harness pairs it with the suggestion schema so a lesson can
 * emit {type:'replace'|'insert'|'note'} suggestions on a finished paragraph.
 * ---------------------------------------------------------------------- */
const SUGGESTION_CONTRACT = `Return suggestions only where this lens genuinely applies; if the paragraph is already strong on this dimension, return nothing. For a "replace", "original" MUST be an exact substring copied verbatim from the paragraph and "replacement" the improved text. For an "insert", give a sentence to optionally add after the paragraph. For a "note", give advisory feedback with no text change. Keep "reason" to one tight sentence. Preserve the author's voice — suggest, never rewrite wholesale.`;

export const LESSONS = [
  { id: 'show-dont-tell', name: "Show, Don't Tell",
    description: 'Flags named emotions and abstract summary that could be dramatized through action and sensation.',
    systemPrompt: `You are a fiction craft editor applying a single lens: SHOW, DON'T TELL. Find places where the prose names or summarizes an emotion or judgment ("she was furious", "it was terrifying", "he felt guilty") that the moment deserves to dramatize through action, body language, sensation, or behavior. Offer a concrete shown version as a "replace". Ignore deliberate summary used for pacing. ${SUGGESTION_CONTRACT}` },

  { id: 'filter-words', name: 'Kill Filter Words',
    description: 'Catches perception filters (saw, heard, felt, noticed, realized, seemed) that distance deep POV.',
    systemPrompt: `You are a fiction craft editor applying a single lens: KILL FILTER WORDS. Find perception filters that route the reader's experience through a verb of perceiving — saw, heard, felt, noticed, watched, realized, seemed, looked, wondered, thought, knew, decided — when removing the filter would deepen POV. Offer a "replace" that drops the filter and renders the perception directly. Keep filters only when the act of perceiving is itself the point. ${SUGGESTION_CONTRACT}` },

  { id: 'sensory-grounding', name: 'Sensory Grounding',
    description: 'Spots under-grounded, abstract passages that need concrete sensory detail.',
    systemPrompt: `You are a fiction craft editor applying a single lens: SENSORY GROUNDING. Find abstract or visually-only passages that would land harder with specific, concrete sensory detail — especially sound, smell, touch, and taste. Prefer one or two sharp particulars over a catalogue. Where a precise detail is missing, offer it as an "insert"; where vague wording can be sharpened, offer a "replace" with concrete nouns and verbs. ${SUGGESTION_CONTRACT}` },

  { id: 'dialogue-punch', name: 'Dialogue Punch',
    description: 'Tightens dialogue: cuts said-bookisms and tag adverbs, sharpens flat or on-the-nose lines.',
    systemPrompt: `You are a fiction craft editor applying a single lens: DIALOGUE PUNCH. Examine dialogue and its tags. Flag exotic said-bookisms (expostulated, queried, opined) and adverb-laden tags ("she said angrily") — offer a "replace" using "said"/"asked" or an action beat that conveys the same charge. Flag on-the-nose, expository, or rhythmically flat lines and offer a tighter, more oblique version. If there is no dialogue, return nothing. ${SUGGESTION_CONTRACT}` },

  { id: 'pacing', name: 'Pacing Watch',
    description: 'Watches rhythm: flags stalled stretches, monotonous sentence shapes, and mismatched tempo.',
    systemPrompt: `You are a fiction craft editor applying a single lens: PACING WATCH. Assess the felt speed and rhythm of the paragraph. Flag stretches where nothing changes (no new information, decision, or shift in feeling), monotonous runs of same-length or same-opener sentences, and tempo that mismatches content (long clauses smothering action, or clipped fragments rushing an emotional beat). Offer a "replace" that varies sentence length, or a "note" suggesting compression or expansion. ${SUGGESTION_CONTRACT}` },

  { id: 'cliche-catcher', name: 'Cliché Catcher',
    description: 'Detects dead metaphors, stock phrasings, filler intensifiers, and worn situational beats.',
    systemPrompt: `You are a fiction craft editor applying a single lens: CLICHÉ CATCHER. Find dead metaphors and stock phrasings the reader's eye slides past — heart pounding, blood ran cold, time stood still, deafening silence, eyes like saucers, calm before the storm — and weak intensifiers (very, really, suddenly, just). Offer a "replace" with a fresh, character-specific image or plain concrete statement. You may flag a worn situational beat as a "note". ${SUGGESTION_CONTRACT}` },
];
