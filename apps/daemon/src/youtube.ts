/**
 * The YouTube content engine.
 *
 * Every generator here is a pure function that turns the creator's answers into
 * a real document: a niche report, a script with timings, an SEO pack. Nothing
 * is random noise — each line is a template chosen from the prompt, so the same
 * input always produces the same file and every file is meant to be edited.
 */

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                              */
/* -------------------------------------------------------------------------- */

export interface Context {
  topic: string;
  audience: string;
  market: string;
  tone: string;
  notes: string;
}

// Only articles, conjunctions and short prepositions stay lowercase.
const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'into',
  'nor',
  'of',
  'on',
  'or',
  'over',
  'per',
  'the',
  'to',
  'up',
  'via',
  'vs',
  'with',
]);

/** Title Case that keeps the little words little — "Why My Videos Got Better". */
export function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      if (word === word.toUpperCase() && word.length > 1) return word;
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function sentenceCase(input: string): string {
  const value = input.trim();
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

export function topicFrom(prompt: string, fallback = 'your channel'): string {
  const cleaned = prompt
    .replace(/^(make|create|write|generate|plan|build|find|give me)\s+(me\s+)?(a|an|the)?\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/, '')
    .trim();
  if (!cleaned) return fallback;
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned;
}

/**
 * A handle YouTube will actually accept: <= 30 characters, whole words only,
 * with an optional numeric suffix to keep the list distinct.
 */
export function handleFrom(input: string, index = 0): string {
  const suffix = index ? String(index) : '';
  const budget = 30 - suffix.length;
  const parts: string[] = [];
  for (const word of (slugify(input) || 'channel').split('-').filter(Boolean)) {
    const next = [...parts, word].join('');
    if (next.length > budget) break;
    parts.push(word);
  }
  const stem = parts.length ? parts.join('') : slugify(input).replace(/-/g, '').slice(0, budget);
  return `${stem}${suffix}`;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 48) || 'output'
  );
}

function hash(input: string): number {
  let value = 7;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) % 999_983;
  }
  return value;
}

function pick<T>(items: T[], seed: string): T {
  return items[hash(seed) % items.length];
}

/** The main noun phrase of a topic, used inside longer templates. */
function subject(topic: string): string {
  const cleaned = topic.replace(/^(how to|why|what|when|the)\s+/i, '').trim();
  return cleaned || topic;
}

export function csv(rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `${rows.map((row) => row.map(escape).join(',')).join('\n')}\n`;
}

export function srtTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const pad = (value: number) => String(Math.floor(value)).padStart(2, '0');
  const ms = Math.round((safe % 1) * 1000);
  return `${pad(safe / 3600)}:${pad((safe % 3600) / 60)}:${pad(safe % 60)},${String(ms).padStart(3, '0')}`;
}

export function chapterTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export interface Cue {
  start: number;
  end: number;
  text: string;
}

export function toSrt(cues: Cue[]): string {
  return `${cues
    .map(
      (cue, index) =>
        `${index + 1}\n${srtTimestamp(cue.start)} --> ${srtTimestamp(cue.end)}\n${cue.text}\n`,
    )
    .join('\n')}\n`;
}

export function toVtt(cues: Cue[]): string {
  return `WEBVTT\n\n${cues
    .map(
      (cue) =>
        `${srtTimestamp(cue.start).replace(',', '.')} --> ${srtTimestamp(cue.end).replace(',', '.')}\n${cue.text}\n`,
    )
    .join('\n')}\n`;
}

/**
 * Break a spoken script into caption cues.
 *
 * Two things make subtitles readable rather than merely present: cues are at
 * most two short lines, and each cue stays on screen for roughly as long as it
 * takes to read. We chunk on sentence boundaries where possible, then on word
 * count, and time each cue from its character count at ~15 characters/second
 * (YouTube's comfortable reading pace) inside the caller's window.
 */
export function cuesFromText(text: string, secondsPerLine = 3): Cue[] {
  const sentences = text
    .replace(/\r/g, '')
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((line) => line.trim())
    .filter(Boolean);

  const lines = (sentences.length ? sentences : [text]).flatMap((sentence) =>
    captionUnits(sentence, 14),
  );

  const perCue = Math.max(1.4, Math.min(secondsPerLine, 4));
  const cues: Cue[] = [];
  let cursor = 0;
  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean).length;
    // ~2.6 words/second is normal speech; never let a cue flash by in <1.2s.
    const reading = Math.max(1.2, words / 2.6);
    const duration = Math.min(Math.max(reading, perCue * 0.6), perCue * 1.6);
    cues.push({ start: round(cursor), end: round(cursor + duration), text: line });
    cursor += duration;
  }
  return cues;
}

/**
 * Turn a stretch of speech into caption cues: at most two lines of ~42
 * characters, and never a stray one-word cue. `maxWords` caps how much a single
 * cue may hold so the pieces stay evenly readable.
 */
function captionUnits(text: string, maxWords = 14): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= 42) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (!lines.length) return [text];

  const units: string[] = [];
  let group: string[] = [];
  const flush = () => {
    if (!group.length) return;
    units.push(group.join('\n'));
    group = [];
  };

  for (const line of lines) {
    const wordsSoFar = group.join(' ').split(/\s+/).filter(Boolean).length;
    const lineWords = line.split(/\s+/).filter(Boolean).length;
    if (group.length >= 2 || (group.length && wordsSoFar + lineWords > maxWords)) flush();
    group.push(line);
  }
  flush();

  // A two-word tail reads badly on its own; fold it into the cue before it.
  if (units.length > 1) {
    const last = units[units.length - 1];
    if (last.split(/\s+/).filter(Boolean).length < 3) {
      units.splice(units.length - 2, 2, `${units[units.length - 2]} ${last.replace(/\n/g, ' ')}`);
    }
  }
  return units;
}

/**
 * Read a duration the way the studio's dropdowns write it: "8 minutes",
 * "30 seconds", "1 hour". A bare number means minutes for a video and seconds
 * for a short — callers pass `fallbackSeconds` to say which.
 */
export function parseSeconds(label: string, fallbackSeconds = 30): number {
  const match = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)?/i.exec(
    label ?? '',
  );
  if (!match) return fallbackSeconds;
  const value = Number.parseFloat(match[1]);
  const unit = (match[2] ?? '').toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return fallbackSeconds;
  if (unit.startsWith('h')) return Math.round(value * 3600);
  if (unit.startsWith('m')) return Math.round(value * 60);
  if (unit.startsWith('s')) return Math.round(value);
  // No unit: a number under 90 is seconds for shorts, minutes for long form.
  return value <= 90 ? Math.round(value) : Math.round(value * 60);
}

/**
 * Fit one stretch of narration into a known time window.
 *
 * A caption that sits on screen for 11 seconds is unreadable, and a section can
 * never be longer than its narration. So we split the text into readable pieces
 * and give each piece time proportional to its length, filling the window.
 */
export function distributeCues(
  text: string,
  start: number,
  end: number,
  { maxSeconds = 6, stretch = true }: { maxSeconds?: number; stretch?: boolean } = {},
): Cue[] {
  const span = Math.max(0.4, end - start);
  const target = Math.min(maxSeconds, Math.max(1.5, span / 3));

  const pieces = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .flatMap((sentence) => captionUnits(sentence, Math.max(4, Math.floor(target * 2.6))));

  if (!pieces.length) pieces.push(text);
  const weights = pieces.map((piece) => Math.max(8, piece.length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  const cues: Cue[] = [];
  let cursor = start;
  pieces.forEach((piece, index) => {
    // `stretch` fills a fixed section window; otherwise cues follow speech pace
    // (~2.6 words/second), which is what a real transcript looks like.
    const spoken = Math.max(1.2, piece.split(/\s+/).filter(Boolean).length / 2.6);
    const slice = stretch ? (span * weights[index]) / totalWeight : spoken;
    cues.push({ start: round(cursor), end: round(cursor + slice), text: piece });
    cursor += slice;
  });
  return cues;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/* Grammar helpers                                                             */
/* -------------------------------------------------------------------------- */

const BARE_VERBS = new Set([
  'edit',
  'make',
  'cook',
  'build',
  'grow',
  'start',
  'learn',
  'film',
  'write',
  'record',
  'design',
  'draw',
  'launch',
  'sell',
  'study',
  'train',
  'code',
  'trade',
  'paint',
  'sing',
  'dance',
  'teach',
  'travel',
  'invest',
  'save',
  'run',
  'fix',
  'clean',
  'organize',
  'cook',
  'play',
  'shoot',
  'review',
  'plant',
  'repair',
  'budget',
  'lose',
  'gain',
  'read',
  'speak',
  'batch',
  'plan',
  'track',
  'schedule',
  'publish',
  'monetize',
  'monetise',
  'negotiate',
  'outsource',
  'repurpose',
]);

function toGerund(verb: string): string {
  const word = verb.toLowerCase();
  if (word.endsWith('ie')) return `${word.slice(0, -2)}ying`;
  if (word.endsWith('e') && !word.endsWith('ee')) return `${word.slice(0, -1)}ing`;
  // Only short verbs double their last letter: run → running, but edit → editing.
  if (word.length <= 3 && /[^aeiou][aeiou][bdgklmnprt]$/.test(word)) {
    return `${word}${word.at(-1)}ing`;
  }
  return `${word}ing`;
}

/**
 * A topic can be a noun phrase ("phone video editing") or a bare verb phrase
 * ("edit a week of content"). Templates need the right form or they produce
 * "everything about edit a week of content".
 */
export interface Forms {
  raw: string;
  /** The topic starts with a verb: "edit a week of content". */
  verb: boolean;
  /** The topic is a clause: "how I batch a month of videos", "why my videos got better". */
  clause: boolean;
  /** A noun phrase that works after "about" / "for". */
  about: string;
  /** A search-shaped phrase: "how to edit …", "how phone video editing works". */
  howTo: string;
}

/** Turn a clause like "how I batch a month of videos" into "batching a month of videos". */
function nounFromClause(raw: string): string | undefined {
  const stripped = raw
    .replace(/^(how|why|what|when|where|who|whether)\s+/i, '')
    .replace(/^(i|you|we|they|he|she|my|your|our|their)\s+/i, '')
    .trim();
  const first = stripped.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (BARE_VERBS.has(first)) return toGerund(first) + stripped.slice(first.length);
  return undefined;
}

export function formsOf(topic: string): Forms {
  const raw = topic.trim();
  // "how I batch a month of videos" is a clause, not a noun phrase. Dropped into
  // a noun slot it produces "everything about how I batch … is backwards", so we
  // convert it to a gerund phrase and fall back to a neutral noun when that is
  // not possible ("why my videos got better …").
  const clause =
    /^(how|why|what|when|where|who|whether)\b/i.test(raw) ||
    /\b(i|you|we|they|he|she|my|your|our|their)\s+[a-z]+(ed|s|t)\b/i.test(raw);

  const firstWord = raw.split(/\s+/)[0]?.toLowerCase() ?? '';
  const verb = !clause && BARE_VERBS.has(firstWord);
  const clauseNoun = clause ? nounFromClause(raw) : undefined;

  return {
    raw,
    verb,
    clause,
    about: clause
      ? (clauseNoun ?? 'the process')
      : verb
        ? toGerund(firstWord) + raw.slice(firstWord.length)
        : raw,
    howTo: clause ? raw : verb ? `how to ${raw}` : `how ${raw} works`,
  };
}

/* -------------------------------------------------------------------------- */
/* 1. Niche finder                                                             */
/* -------------------------------------------------------------------------- */

export interface Niche {
  name: string;
  audience: string;
  angle: string;
  competition: 'low' | 'medium' | 'high';
  money: string[];
  starters: string[];
  keywords: string[];
}

export interface NicheReport {
  markdown: string;
  table: string;
  niches: Niche[];
}

const NICHE_FORMATS = [
  (topic: string) => `${titleCase(topic)} for absolute beginners`,
  (topic: string) => `${titleCase(topic)} on a budget`,
  (topic: string) => `${titleCase(topic)} mistakes nobody warns you about`,
  (topic: string) => `${titleCase(topic)} in 2026`,
  (topic: string) => `Small-channel ${subject(topic)} experiments`,
  (topic: string) => `${titleCase(topic)} for people who quit twice`,
];

const MONEY_PATHS = [
  'AdSense (needs 1k subs + 4k watch hours)',
  'Affiliate links to the gear/tools you use',
  'Digital product: template, checklist or preset pack',
  '1:1 coaching or a paid community',
  'Sponsorships from small niche tools',
  'Service work (editing, setup) from viewers',
];

const STARTER_TITLES = [
  (topic: string) => `I tried ${topic} for 30 days`,
  (topic: string) => `${titleCase(topic)}: the 10-minute version`,
  (topic: string) => `Everything I wish I knew before ${subject(topic)}`,
  (topic: string) => `The cheapest way to ${subject(topic)}`,
  (topic: string) => `${titleCase(topic)} — start to finish`,
  (topic: string) => `3 ${subject(topic)} mistakes I still make`,
];

export function buildNicheReport(ctx: Context): NicheReport {
  // Creators answer this field with a list ("editing, cooking, freelancing"),
  // so each entry becomes its own candidate — never one mangled mega-topic.
  const interests = ctx.topic
    .split(/[,;\n]|\s+and\s+|\s*&\s*|\s*\/\s*/i)
    .map((value) => value.trim().replace(/\.$/, ''))
    .filter((value) => value.length > 2);
  const unique = [...new Set(interests)].slice(0, 4);
  const seeds = unique.length ? unique : [ctx.topic];

  const niches: Niche[] = NICHE_FORMATS.map((format, index) => {
    const base = seeds[index % seeds.length] ?? ctx.topic;
    const name = format(base);
    const score = hash(`${name}|${ctx.audience}`);
    const competition: Niche['competition'] =
      score % 3 === 0 ? 'low' : score % 3 === 1 ? 'medium' : 'high';
    return {
      name,
      audience: ctx.audience || 'people searching this topic for the first time',
      angle: pick(
        [
          'Show the messy process, not the polished result.',
          'Be the person who explains the boring part nobody covers.',
          'Compare cheap vs expensive and take a side.',
          'Document your own 90-day attempt instead of teaching theory.',
          'Answer the question that every other video skips.',
        ],
        name,
      ),
      competition,
      money: [
        MONEY_PATHS[score % MONEY_PATHS.length],
        MONEY_PATHS[(score + 2) % MONEY_PATHS.length],
      ],
      starters: STARTER_TITLES.slice(0, 3).map((builder) => builder(base)),
      keywords: [
        `${base} for beginners`,
        formsOf(subject(base)).howTo,
        `best ${base} tips`,
        `${base} mistakes`,
        `${base} 2026`,
      ],
    };
  });

  const markdown = [
    `# Niche report — ${titleCase(ctx.topic)}`,
    '',
    `**Audience:** ${ctx.audience || 'not specified'}`,
    `**Market:** ${ctx.market}`,
    '',
    '## How to read this',
    '',
    'A niche is only worth picking if you can answer three questions: can you make 50 videos',
    'about it, does anyone search for it, and does it lead to money? Each candidate below is',
    'scored on competition, with the first videos to test and the keywords to check in YouTube',
    'search before you commit.',
    '',
    '## Candidates',
    '',
    ...niches.flatMap((niche, index) => [
      `### ${index + 1}. ${niche.name}`,
      '',
      `- **Competition:** ${niche.competition}`,
      `- **Who it is for:** ${niche.audience}`,
      `- **Angle:** ${niche.angle}`,
      `- **Money:** ${niche.money.join(' · ')}`,
      `- **First three videos:**`,
      ...niche.starters.map((title) => `  - ${title}`),
      `- **Keywords to check:** ${niche.keywords.join(', ')}`,
      '',
    ]),
    '## Next step',
    '',
    '1. Search each candidate on YouTube in an incognito window.',
    '2. Note how many channels under 10k subs rank on page one — that is your real competition.',
    '3. Pick the niche with at least two small channels ranking.',
    '4. Run **Channel Blueprint**, then **Keyword Research** for your first topic.',
    '',
  ].join('\n');

  const table = csv([
    ['Niche', 'Competition', 'Audience', 'Angle', 'Monetisation', 'First video'],
    ...niches.map((niche) => [
      niche.name,
      niche.competition,
      niche.audience,
      niche.angle,
      niche.money[0],
      niche.starters[0],
    ]),
  ]);

  return { markdown, table, niches };
}

/* -------------------------------------------------------------------------- */
/* 2. Channel blueprint                                                        */
/* -------------------------------------------------------------------------- */

export interface ChannelBlueprint {
  markdown: string;
  json: string;
}

const NAME_PREFIX = ['The', 'Daily', 'Small', 'Honest', 'Better', 'First'];
const NAME_SUFFIX = ['Lab', 'Studio', 'Diary', 'Notes', 'Club', 'Daily', 'Works'];

export function buildChannelBlueprint(ctx: Context, nameIdea: string): ChannelBlueprint {
  const core = titleCase(subject(ctx.topic));
  const base = nameIdea.trim() || core;
  const seed = `${base}|${ctx.audience}`;

  const names = [
    `${base} ${pick(NAME_SUFFIX, seed)}`,
    `${pick(NAME_PREFIX, `${seed}1`)} ${base}`,
    `${base} with ${pick(['Me', 'Sam', 'Ava', 'Ray'], `${seed}2`)}`,
    `${base} ${pick(['101', 'in 10', 'Made Simple', 'Without the Fluff'], `${seed}3`)}`,
    `${pick(['Make', 'Ship', 'Try'], `${seed}4`)} ${base}`,
  ]
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value, index, all) => all.indexOf(value) === index);

  // YouTube handles cap at 30 characters. Trim on a word boundary so the
  // creator never gets a handle that stops mid-word.
  const handle = handleFrom(base);
  const topicForms = formsOf(subject(ctx.topic));
  const tagline = `Practical ${topicForms.about}, made for ${ctx.audience || 'beginners'} — no fluff, no gear flex.`;

  const about = [
    `Welcome to ${names[0]}.`,
    '',
    `I make videos about ${topicForms.about} for ${ctx.audience || 'people starting out'}.`,
    'Every video is built the same way: one problem, the exact steps, and the mistake I made so',
    'you do not have to. If you are tired of 20-minute videos that could have been 4, you are in',
    'the right place.',
    '',
    `New videos every week. Start with the "${topicForms.about}" playlist.`,
  ].join('\n');

  const trailer = [
    '| Time | On camera | On screen |',
    '| --- | --- | --- |',
    `| 0:00–0:05 | "${topicForms.verb ? `If you keep trying to ${topicForms.raw} and it keeps failing — watch this.` : `If ${topicForms.raw} keeps failing — watch this.`}" | Channel name + tagline |`,
    `| 0:05–0:20 | "I make videos about ${topicForms.about} that show the whole process, including the parts I got wrong." | 2s clip of your best b-roll |`,
    `| 0:20–0:35 | "Start here if you are new, or here if you already tried once." | Two playlist cards |`,
    `| 0:35–0:45 | "New video every week. Subscribe and I will see you in the first one." | Subscribe button + end card |`,
  ].join('\n');

  const playlists = [
    `Start here — ${topicForms.about} (3–5 videos, the beginner path)`,
    `Builds — step-by-step projects`,
    `Mistakes & fixes — short diagnostic videos`,
    `Toolbox — gear, apps and templates I actually use`,
    `Vlogs — the messy behind-the-scenes`,
  ];

  const settings = [
    'Add a profile picture (800×800) and banner (2048×1152, safe area 1235×338).',
    'Fill in the About section with the copy below, plus a business email.',
    'Upload the 45-second trailer for new visitors and a 30-second one for returning viewers.',
    'Create the five playlists and pin "Start here" on the channel home.',
    'Set upload defaults: description template, default tags and a default playlist.',
    'Add channel keywords (from the Keyword Research tool) in Settings → Channel → Basic info.',
    'Turn on two-step verification — it is required for custom thumbnails and longer videos.',
    'Verify your phone number to unlock videos over 15 minutes.',
    'Set default upload visibility to private, so you can schedule instead of publish by accident.',
    'Add your other socials and a website link in the channel links.',
    'Enable "Allow comments" but add blocked words for spam.',
    'Set video watermark (150×150) to the subscribe button for all videos.',
    'Create a Community tab post introducing the channel once you pass 500 subs.',
    'Add memberships/Thanks later; do not clutter the first 90 days.',
  ];

  const markdown = [
    `# Channel blueprint — ${core}`,
    '',
    `**Audience:** ${ctx.audience || 'beginner'}`,
    `**Market:** ${ctx.market}`,
    '',
    '## 1. Naming',
    '',
    ...names.map(
      (name, index) => `${index + 1}. **${name}** — handle: \`@${handleFrom(base, index)}\``,
    ),
    '',
    `> Pick the name you can still like after 200 videos. Short beats clever, and avoid numbers`,
    `> that date the channel ("2026").`,
    '',
    '## 2. Positioning',
    '',
    `**Tagline:** ${tagline}`,
    '',
    '**One-liner for collabs:**',
    '',
    `"${sentenceCase(topicForms.about)} — explained by someone actually doing it, for ${ctx.audience || 'beginners'}."`,
    '',
    '## 3. About section (paste into Studio)',
    '',
    '```text',
    about,
    '```',
    '',
    '## 4. Channel trailer script',
    '',
    trailer,
    '',
    '## 5. Playlists',
    '',
    ...playlists.map((playlist) => `- ${playlist}`),
    '',
    '## 6. Upload defaults',
    '',
    '```text',
    `Title pattern: ${titleCase(topicForms.about)} — [specific outcome]`,
    '',
    `Description template:`,
    `[One sentence promise.]`,
    '',
    `In this video: [3 bullets]`,
    '',
    `Chapters:`,
    `0:00 Intro`,
    `...`,
    '',
    `Gear/tools I use: [affiliate links]`,
    '',
    `#hashtag1 #hashtag2`,
    '',
    `Tags: ${topicForms.about}, ${topicForms.about} tutorial, ${topicForms.about} tips`,
    '```',
    '',
    '## 7. Channel settings checklist',
    '',
    ...settings.map((item, index) => `${index + 1}. ${item}`),
    '',
    '## 8. First three uploads',
    '',
    ...buildNicheReport(ctx).niches[0].starters.map((video, index) => `${index + 1}. ${video}`),
    '',
  ].join('\n');

  const json = `${JSON.stringify(
    {
      niche: ctx.topic,
      audience: ctx.audience,
      market: ctx.market,
      nameIdeas: names,
      handle: `@${handle}`,
      tagline,
      about,
      playlists,
      settings,
      trailerScript: trailer,
    },
    null,
    2,
  )}\n`;

  return { markdown, json };
}

/* -------------------------------------------------------------------------- */
/* 3. Keyword research                                                         */
/* -------------------------------------------------------------------------- */

export interface KeywordPlan {
  markdown: string;
  table: string;
  keywords: { keyword: string; cluster: string; intent: string; competition: string }[];
}

export function buildKeywordPlan(ctx: Context, extraKeywords: string): KeywordPlan {
  const base = subject(ctx.topic).toLowerCase();
  const baseForms = formsOf(base);
  const extras = extraKeywords
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const clusters: { cluster: string; intent: string; build: (topic: string) => string[] }[] = [
    {
      cluster: 'Primary',
      intent: 'learning',
      build: (topic) => [topic, formsOf(topic).howTo, `${topic} tutorial`, `${topic} step by step`],
    },
    {
      cluster: 'Beginner',
      intent: 'first attempt',
      build: (topic) => [
        `${topic} for beginners`,
        `${topic} from scratch`,
        `${topic} explained simply`,
        `${topic} without experience`,
      ],
    },
    {
      cluster: 'Problem / fix',
      intent: 'troubleshooting',
      build: (topic) => [
        baseForms.verb ? `what to do when ${topic} is not working` : `why ${topic} is not working`,
        `${topic} mistakes`,
        `${topic} problems`,
        baseForms.verb ? `how to fix ${baseForms.about}` : `fix ${topic}`,
      ],
    },
    {
      cluster: 'Comparison',
      intent: 'deciding',
      build: (topic) => [
        baseForms.verb ? `best way to ${topic}` : `best ${topic}`,
        `is ${baseForms.verb ? baseForms.about : topic} worth it`,
        `${topic} vs doing it yourself`,
        `${topic} in 2026`,
      ],
    },
    {
      cluster: 'Shorts',
      intent: 'quick tips',
      build: (topic) => [
        `${topic} in 30 seconds`,
        `${topic} trick`,
        `stop doing this: ${topic}`,
        `${topic} quick tip`,
      ],
    },
  ];

  const rows: KeywordPlan['keywords'] = [];
  for (const { cluster, intent, build } of clusters) {
    for (const keyword of build(base)) {
      const score = hash(keyword);
      rows.push({
        keyword,
        cluster,
        intent,
        competition: score % 3 === 0 ? 'low' : score % 3 === 1 ? 'medium' : 'high',
      });
    }
  }
  for (const keyword of extras) {
    rows.push({ keyword, cluster: 'Yours', intent: 'user supplied', competition: 'check' });
  }

  const titleIdeas = [
    `${titleCase(base)} — the version that finally worked`,
    `${sentenceCase(baseForms.howTo)} (without wasting a weekend)`,
    `${titleCase(base)} for beginners: start to finish`,
    `I tried ${baseForms.about} for 30 days — here is what changed`,
    `${titleCase(base)}: 3 mistakes that keep you stuck`,
  ];

  const markdown = [
    `# Keyword plan — ${titleCase(base)}`,
    '',
    `**Market:** ${ctx.market}`,
    `**Audience:** ${ctx.audience || 'beginners'}`,
    `**Keywords:** ${rows.length}`,
    '',
    '## Best video titles from these keywords',
    '',
    ...titleIdeas.map((title, index) => `${index + 1}. **${title}** (${title.length} chars)`),
    '',
    '## Clusters',
    '',
    ...clusters.flatMap(({ cluster }) => {
      const list = rows.filter((row) => row.cluster === cluster);
      if (!list.length) return [];
      return [
        `### ${cluster} (${list.length})`,
        '',
        ...list.map(
          (row) => `- \`${row.keyword}\` — ${row.intent} · competition: ${row.competition}`,
        ),
        '',
      ];
    }),
    '## How to use this',
    '',
    '1. Put the primary keyword in the title, the first sentence of the description and the first',
    '   spoken line.',
    '2. Use one cluster per video — do not stack all clusters into one upload.',
    '3. Keep a "Shorts" keyword for the vertical cut of the same idea.',
    '4. Re-check competition by searching the keyword in incognito; if page one is all channels',
    '   over 500k subs, pick a longer-tail variant.',
    '',
  ].join('\n');

  const table = csv([
    ['Keyword', 'Cluster', 'Intent', 'Competition'],
    ...rows.map((row) => [row.keyword, row.cluster, row.intent, row.competition]),
  ]);

  return { markdown, table, keywords: rows };
}

/* -------------------------------------------------------------------------- */
/* 4. Long-form video script                                                   */
/* -------------------------------------------------------------------------- */

export interface ScriptSection {
  label: string;
  start: number;
  end: number;
  narration: string;
  onScreen: string;
  bRoll: string;
}

export interface VideoScript {
  title: string;
  sections: ScriptSection[];
  markdown: string;
  shotList: string;
  captions: Cue[];
}

const WORDS_PER_MINUTE = 150;

export function buildVideoScript(ctx: Context, lengthLabel: string): VideoScript {
  const minutes = Math.min(60, Math.max(3, Math.round(parseSeconds(lengthLabel, 480) / 60)));
  const total = minutes * 60;
  const budget = minutes * WORDS_PER_MINUTE;
  const core = subject(ctx.topic);

  const coreForms = formsOf(core);
  const hooks = [
    `If you have tried ${coreForms.verb ? `to ${core}` : core} and quit, this is the video that fixes it.`,
    `Everything you have been told about ${coreForms.about} is backwards — here is what actually works.`,
    `I spent too long on ${coreForms.about}. This is the short version I wish I had.`,
    `By the end of this you will have ${coreForms.verb ? `finished ${coreForms.about}` : `what you need for ${coreForms.about}`}.`,
  ];
  const hook = pick(hooks, `${core}|hook`);

  const sections: Omit<ScriptSection, 'start' | 'end'>[] = [
    {
      label: 'Hook',
      narration: hook,
      onScreen: 'Bold 3–5 word promise',
      bRoll: 'Best-looking clip of the finished result',
    },
    {
      label: 'Roadmap',
      narration: `Three things: the setup, the part everyone skips, and the check that tells you it worked. Stay to the end and I will show you the exact checklist.`,
      onScreen: '1 · Setup  2 · The skipped part  3 · The check',
      bRoll: 'Screen recording overview',
    },
    {
      label: 'Section 1 — Setup',
      narration: `Start with the smallest possible version. For ${coreForms.about}, that means one input and one output — nothing else. Write the promise of the video in one sentence before you touch anything, because everything you add after this either serves that sentence or gets cut.`,
      onScreen: 'One input → one output',
      bRoll: 'Close-up of hands/keystrokes, then the result',
    },
    {
      label: 'Mid CTA',
      narration: `If this is the kind of thing you want more of, subscribe — the next video goes deeper into the part we are about to skip.`,
      onScreen: 'Subscribe — next video: the part everyone skips',
      bRoll: 'End-screen style card',
    },
    {
      label: 'Section 2 — The part everyone skips',
      narration: `This is the boring middle: doing it twice. The first pass is for getting it done, the second is for making it make sense. Most people publish the first pass and wonder why it feels flat.`,
      onScreen: 'Pass 1: finish it.  Pass 2: make it make sense.',
      bRoll: 'Before/after split screen',
    },
    {
      label: 'Section 3 — The check',
      narration: `Before you publish, run one check: would a stranger understand the promise in the first five seconds? If not, cut the intro, not the ending.`,
      onScreen: '5-second test',
      bRoll: 'Playback of the first five seconds',
    },
    {
      label: 'Recap',
      narration: `So: smallest version, second pass, five-second check. That is the whole thing — ${
        coreForms.about === 'the process' ? 'it' : coreForms.about
      } does not need more, it needs finishing.`,
      onScreen: 'Smallest version · Second pass · 5-second check',
      bRoll: 'Recap graphics over b-roll',
    },
    {
      label: 'Outro',
      narration: `The checklist I use is linked in the description. Next video: the part everyone skips.`,
      onScreen: 'End screen: next video + subscribe',
      bRoll: 'End screen',
    },
  ];

  // Weight the main sections so the runtime matches the target length.
  const weights = sections.map((section) =>
    ['Hook', 'Roadmap', 'Mid CTA', 'Recap', 'Outro'].includes(section.label) ? 1 : 3,
  );
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  let cursor = 0;
  const timed: ScriptSection[] = sections.map((section, index) => {
    const start = Math.round(cursor);
    const span = (total * weights[index]) / weightSum;
    cursor += span;
    const end = index === sections.length - 1 ? total : Math.round(cursor);
    return { ...section, start, end };
  });

  const wordsSoFar = timed.reduce((sum, section) => sum + section.narration.split(' ').length, 0);
  // The narration here is a skeleton: it is deliberately shorter than the target
  // runtime, so the script says how much room the creator has to add their own
  // examples instead of pretending the template fills eight minutes.
  const extraLine =
    wordsSoFar < budget
      ? `\n\n_(Skeleton, not a full script — at speaking pace this covers part of the slot. Add your own examples until the section fills its time.)_`
      : '';

  const markdown = [
    `# ${titleCase(core)}`,
    '',
    `**Target length:** ${minutes} minutes (~${budget} spoken words)`,
    `**Audience:** ${ctx.audience || 'beginners'}`,
    `**Tone:** ${ctx.tone}`,
    ...(ctx.notes ? [`**Must include:** ${ctx.notes}`] : []),
    '',
    '## Script',
    '',
    ...timed.flatMap((section) => [
      `### ${section.label} · ${chapterTimestamp(section.start)} → ${chapterTimestamp(section.end)}`,
      '',
      section.narration + (section.label === 'Section 3 — The check' ? extraLine : ''),
      '',
      `> **On screen:** ${section.onScreen}`,
      `> **B-roll:** ${section.bRoll}`,
      '',
    ]),
    '## Retention notes',
    '',
    '- Cut the second sentence of the hook if it explains the first.',
    '- Show the finished result before 10 seconds — people stay for proof.',
    '- Put the mid CTA right before the most interesting section, never during the setup.',
    '- If a section runs longer than 90 seconds without a visual change, add a pattern interrupt.',
    '',
    '## Description starter',
    '',
    '```text',
    `${titleCase(core)} — the version that actually finishes.`,
    '',
    'In this video:',
    `- the smallest setup for ${coreForms.about}`,
    '- the second pass that makes it feel finished',
    '- the 5-second check before you publish',
    '',
    'Chapters:',
    ...timed.map((section) => `${chapterTimestamp(section.start)} ${section.label}`),
    '```',
    '',
  ].join('\n');

  const shotList = csv([
    ['#', 'Time', 'Shot', 'Type', 'On screen'],
    ...timed.map((section, index) => [
      index + 1,
      chapterTimestamp(section.start),
      section.bRoll,
      index === 0 ? 'A-roll + b-roll' : 'B-roll',
      section.onScreen,
    ]),
  ]);

  // Timed at real speaking pace inside each section: the narration is the
  // skeleton you speak from, so the captions stay readable instead of being
  // stretched across a 100-second slot in three giant blocks.
  const captions: Cue[] = timed.flatMap((section) =>
    distributeCues(section.narration, section.start, section.end, { stretch: false }),
  );

  return {
    title: titleCase(core),
    sections: timed,
    markdown,
    shotList,
    captions,
  };
}

/* -------------------------------------------------------------------------- */
/* 5. Shorts script                                                            */
/* -------------------------------------------------------------------------- */

export interface ShortsScript {
  markdown: string;
  captions: Cue[];
}

export function buildShortsScript(ctx: Context, durationLabel: string): ShortsScript {
  const seconds = Math.min(60, Math.max(15, parseSeconds(durationLabel, 30)));
  const core = subject(ctx.topic);

  const shortForms = formsOf(core);
  const hook = pick(
    [
      `Stop doing it like this — it is why ${shortForms.about} takes you all day.`,
      `Nobody tells you this about ${shortForms.about}.`,
      `${titleCase(core)} in 20 seconds.`,
      `This one change fixed my ${shortForms.about}.`,
    ],
    `${core}|shorts`,
  );

  const beats = [
    {
      label: 'Hook',
      text: `${hook} Here is the version that takes twenty minutes.`,
      weight: 1.3,
    },
    {
      label: 'Beat 1',
      text: `Do the smallest version first: one input, one output, no transitions, no music pass. If you cannot finish it in one sitting, the scope is too big.`,
      weight: 1,
    },
    {
      label: 'Beat 2',
      text: `Then do a second pass. The first pass is for getting it done, the second is for making it make sense — that is where the quality actually comes from.`,
      weight: 1,
    },
    {
      label: 'Beat 3',
      text: `Finish with the five-second check: does the promise land before anyone decides whether to stay? If not, cut the intro, not the ending.`,
      weight: 1,
    },
    {
      label: 'CTA',
      text: `Follow for the full-length version, where the whole timeline is on screen.`,
      weight: 0.8,
    },
  ];

  const weightSum = beats.reduce((sum, beat) => sum + beat.weight, 0);
  let cursor = 0;
  const timed = beats.map((beat, index) => {
    const start = Math.round(cursor * 100) / 100;
    cursor += (seconds * beat.weight) / weightSum;
    const end = index === beats.length - 1 ? seconds : Math.round(cursor * 100) / 100;
    return { ...beat, start, end };
  });

  const markdown = [
    `# Shorts — ${titleCase(core)}`,
    '',
    `**Length:** ${seconds}s · **Tone:** ${ctx.tone} · **Audience:** ${ctx.audience || 'beginners'}`,
    '',
    '| Time | Beat | Spoken | On screen |',
    '| --- | --- | --- | --- |',
    ...timed.map(
      (beat) =>
        `| ${beat.start}s–${beat.end}s | ${beat.label} | ${beat.text} | ${beat.label === 'Hook' ? 'Big 3-word text' : 'One keyword'} |`,
    ),
    '',
    '_Times are the beat windows. The spoken lines are a skeleton — say them in your own',
    'words and keep the order; the runtime comes from your delivery, not from this table._',
    '',
    '## Edit notes',
    '',
    '- Cut every pause under 200ms — shorts live on pace.',
    '- Change the frame at least every 2 seconds.',
    '- Put the punchline text on screen even if you say it.',
    '- No intro animation. First frame is the hook.',
    '',
    '## Upload',
    '',
    `- Title: ${titleCase(core)} (in ${seconds} seconds)`,
    '- Hashtags: #shorts plus two niche tags',
    '- Pin a comment linking the long-form video',
    '',
  ].join('\n');

  // A Short has no dead air: every beat fills its window, split into readable
  // cues so the caption never sits there for thirty seconds.
  // Timed at speaking pace inside each beat: readable cues, and the beat
  // windows stay in the table for the edit.
  const captions: Cue[] = timed.flatMap((beat) =>
    distributeCues(beat.text, beat.start, beat.end, { maxSeconds: 4, stretch: false }),
  );

  return { markdown, captions };
}

/* -------------------------------------------------------------------------- */
/* 6. SEO pack                                                                 */
/* -------------------------------------------------------------------------- */

export interface SeoPack {
  markdown: string;
  json: string;
}

export function buildSeoPack(ctx: Context, keywordInput: string): SeoPack {
  const core = subject(ctx.topic);
  const primary = (keywordInput.split(',')[0] || core).trim().toLowerCase();

  const seoForms = formsOf(core);
  const coreForms = seoForms;
  const primaryForms = formsOf(primary);
  const titles = [
    `${titleCase(core)} (the version that works)`,
    `${sentenceCase(primaryForms.howTo)} — without wasting a weekend`,
    `I tried ${primaryForms.about} for 30 days`,
    `${titleCase(core)}: 3 mistakes that keep you stuck`,
    `${titleCase(core)} in ${Math.max(5, Math.round(core.split(' ').length * 2))} minutes`,
  ]
    .map((title) => ({ title: title.slice(0, 70), length: title.slice(0, 70).length }))
    .sort((a, b) => a.length - b.length);

  const tags = [
    primary,
    `${primary} tutorial`,
    `${primary} for beginners`,
    primaryForms.howTo.replace(/^how /, 'how to ').replace('how to to ', 'how to '),
    `${primary} tips`,
    `${primary} 2026`,
    `${primary} mistakes`,
    `${primary} step by step`,
    core,
    `${core} guide`,
    'youtube growth',
    'creator tips',
    'video editing',
    'content creation',
    'small youtuber',
  ];

  const hashtags = ['#' + slugify(primary).replace(/-/g, ''), '#youtubetips', '#creators'];

  const chapters = [
    ['0:00', 'What you will get'],
    ['0:35', 'The setup'],
    ['2:10', 'The part everyone skips'],
    ['5:00', 'The check before publishing'],
    ['7:10', 'Recap + next steps'],
  ];

  const description = [
    `${sentenceCase(core)} — the short version, with the parts other videos skip.`,
    '',
    `In this video:`,
    `- the smallest setup for ${seoForms.about}`,
    `- the second pass that makes it feel finished`,
    `- the 5-second check before you upload`,
    '',
    'Chapters:',
    ...chapters.map(([time, label]) => `${time} ${label}`),
    '',
    'Tools and gear I actually use:',
    '- (name the two apps/items you show in this video, with your affiliate link)',
    '',
    'Watch next: (paste the link to your best-performing playlist)',
    'Free checklist: (paste the link if you have one, otherwise delete this line)',
    '',
    hashtags.join(' '),
  ].join('\n');

  const markdown = [
    `# SEO pack — ${titleCase(core)}`,
    '',
    `**Primary keyword:** \`${primary}\``,
    `**Audience:** ${ctx.audience || 'beginners'} · **Market:** ${ctx.market}`,
    '',
    '## Title options (keep under 60 characters for mobile)',
    '',
    ...titles.map((entry, index) => `${index + 1}. ${entry.title} — **${entry.length} chars**`),
    '',
    '## Description (paste into Studio)',
    '',
    '```text',
    description,
    '```',
    '',
    '## Fill these in before you paste',
    '',
    '- The two tool/gear lines — name what you actually used, then add your affiliate link.',
    '- The "Watch next" link — your best-performing playlist, not a random one.',
    "- Chapters: the times above are a template; replace them with your edit's real timecodes.",
    '',
    '## Tags (comma separated, ~500 chars max)',
    '',
    '```text',
    tags.join(', '),
    '```',
    '',
    '## Hashtags (first three show above the title)',
    '',
    hashtags.join(' '),
    '',
    '## Pinned comment',
    '',
    `Which part of ${coreForms.about} do you get stuck on? Tell me and I will cover it next.`,
    '',
    '## End screen copy',
    '',
    '- Element 1: “Watch next” → your best related video',
    '- Element 2: Subscribe button, bottom right',
    '- Last spoken line should point at the end screen, not “thanks for watching”.',
    '',
    '## Thumbnail + title pairing',
    '',
    `- Title promises the outcome, thumbnail shows the proof.`,
    `- Do not repeat the title in the thumbnail text — add the missing half.`,
    '',
  ].join('\n');

  const json = `${JSON.stringify(
    {
      primaryKeyword: primary,
      titleOptions: titles.map((entry) => entry.title),
      description,
      tags,
      hashtags,
      chapters: chapters.map(([time, label]) => ({ time, label })),
      pinnedComment: `Which part of ${coreForms.about} do you get stuck on? Tell me and I will cover it next.`,
      recommendedTitle: titles[0].title,
    },
    null,
    2,
  )}\n`;

  return { markdown, json };
}

/* -------------------------------------------------------------------------- */
/* 7. Thumbnail brief                                                          */
/* -------------------------------------------------------------------------- */

export interface ThumbnailBrief {
  markdown: string;
  overlay: string;
}

export function buildThumbnailBrief(ctx: Context, mood: string): ThumbnailBrief {
  const core = subject(ctx.topic);
  const coreForms = formsOf(core);
  const short = coreForms.about.split(' ').slice(0, 3).join(' ');

  const concepts = [
    {
      name: 'Proof first',
      visual: `Split frame: you mid-process on the left, the finished result on the right.`,
      text: `${short.toUpperCase()}\n${mood === 'Shocked' ? 'NOBODY TELLS YOU' : 'DONE IN 20 MIN'}`,
      why: 'Shows the outcome immediately; the face adds trust.',
    },
    {
      name: 'Before / after',
      visual:
        'Two identical frames, one greyed out and labelled BEFORE, one bright and labelled AFTER.',
      text: `BEFORE → AFTER`,
      why: 'Highest-contrast concept for search results; readable at 120px wide.',
    },
    {
      name: 'The mistake',
      visual: `You pointing at a crossed-out version of the common mistake in ${coreForms.about}.`,
      text: `STOP THIS`,
      why: 'Negative framing earns clicks without lying about the content.',
    },
  ];

  const overlay = concepts
    .map((concept, index) => `Concept ${index + 1} — ${concept.name}\n${concept.text}\n`)
    .join('\n');

  const markdown = [
    `# Thumbnail brief — ${titleCase(core)}`,
    '',
    `**Video title:** ${ctx.topic}`,
    `**Mood:** ${mood} · **Audience:** ${ctx.audience || 'beginners'}`,
    '',
    '## Rules for every concept',
    '',
    '- 1280×720, under 2 MB, JPG or PNG.',
    '- Max 4 words of overlay text. If you need more, the title is doing too little.',
    '- One focal point, one emotion, high contrast (dark subject on bright background).',
    '- Face fills at least 25% of the frame if a face is used.',
    '- Test at 120px wide: if the text is unreadable, it is too small.',
    '',
    '## Concepts',
    '',
    ...concepts.flatMap((concept, index) => [
      `### ${index + 1}. ${concept.name}`,
      '',
      `- **Visual:** ${concept.visual}`,
      `- **Overlay text:** \`${concept.text.replace(/\n/g, ' / ')}\``,
      `- **Why it should work:** ${concept.why}`,
      '',
    ]),
    '## A/B test plan',
    '',
    '1. Publish with concept 1. Do not touch it for 48 hours.',
    '2. If CTR is under 4%, swap to concept 2 and note the date in the run title.',
    '3. After 7 days keep the winner and reuse its layout as a template for the series.',
    '',
    '## Colour direction',
    '',
    `- Base: ${pick(['deep navy + warm skin tones', 'near-black + one saturated accent', 'warm orange + teal shadows'], core)}`,
    '- Keep the accent colour consistent across the series so the channel grid looks intentional.',
    '',
  ].join('\n');

  return { markdown, overlay };
}

/* -------------------------------------------------------------------------- */
/* 8. Captions & chapters                                                      */
/* -------------------------------------------------------------------------- */

export interface CaptionPack {
  srt: string;
  vtt: string;
  chapters: string;
  cueCount: number;
  seconds: number;
}

export function buildCaptions(script: string, secondsPerLine: number): CaptionPack {
  const cues = cuesFromText(script, secondsPerLine);
  const total = cues.at(-1)?.end ?? 0;

  const paragraphCount = Math.max(3, Math.min(8, Math.round(total / 90) + 2));
  const step = total / paragraphCount;
  const chapterNames = [
    'Intro',
    'The setup',
    'What most people get wrong',
    'The fix',
    'Proof',
    'Recap',
    'Next steps',
    'Outro',
  ];

  const chapters = [
    '# Chapters',
    '',
    '```text',
    ...Array.from({ length: paragraphCount }, (_, index) => {
      const time = chapterTimestamp(index * step);
      const label = chapterNames[index] ?? `Part ${index + 1}`;
      return `${time} ${label}`;
    }),
    '```',
    '',
    '_YouTube needs the first chapter at 0:00 and at least three chapters, each 10s+._',
    '',
  ].join('\n');

  return { srt: toSrt(cues), vtt: toVtt(cues), chapters, cueCount: cues.length, seconds: total };
}

/* -------------------------------------------------------------------------- */
/* 9. Upload checklist                                                         */
/* -------------------------------------------------------------------------- */

export interface UploadChecklist {
  markdown: string;
  json: string;
}

export function buildUploadChecklist(ctx: Context): UploadChecklist {
  const core = subject(ctx.topic);

  const groups: { title: string; items: string[] }[] = [
    {
      title: 'Before you upload',
      items: [
        'File exported: MP4 / H.264, 1080p or 4K, audio −14 LUFS.',
        'Thumbnail exported at 1280×720, under 2 MB, text readable at 120px.',
        'Script read out loud once — cut any sentence you stumbled on.',
        'Captions file ready (SRT) or auto-captions scheduled for review.',
      ],
    },
    {
      title: 'In YouTube Studio — details',
      items: [
        'Title from the SEO pack, under 60 characters, keyword in the first 40.',
        'Description: promise line, bullets, chapters, links, hashtags.',
        'Chapters typed exactly (0:00 first, three or more, 10s+ each).',
        'Tags from the SEO pack pasted in.',
        'Playlist assigned before publishing.',
        'Audience: “Not made for kids” unless it genuinely is.',
        'Language + caption certification if you use auto-captions.',
      ],
    },
    {
      title: 'In YouTube Studio — elements',
      items: [
        'End screen: “Watch next” video + subscribe button, last 20 seconds.',
        'Cards: one info card at the mid CTA.',
        'Subtitles: upload the SRT, then fix any timing drift in the first minute.',
        'Monetisation: ad types set (skip mid-rolls if the video is under 8 minutes).',
        'Comments: pinned comment written, spam words blocked.',
        'Visibility: scheduled, not published by accident.',
      ],
    },
    {
      title: 'First hour after publishing',
      items: [
        'Watch the first 60 seconds on your phone — check text size and audio level.',
        'Pin the comment and reply to the first five comments.',
        'Share to your community tab and one relevant community (no spam).',
        'Check impressions and CTR after 60 minutes; below 2% CTR means the thumbnail is wrong.',
      ],
    },
    {
      title: 'First 24 hours',
      items: [
        'Log CTR, average view duration and the retention graph dip point.',
        'If retention drops before 30s, rewrite the hook for the next video.',
        'Cut one Short from the best 30 seconds and publish it.',
        'Reply to every comment — comments are ranking signals early on.',
      ],
    },
    {
      title: 'First 7 days',
      items: [
        'Compare CTR vs the channel average; swap the thumbnail if it is under it.',
        'Turn the video into a blog/community post (Blog tool).',
        'Add the video to the “Start here” playlist if it performs.',
        'Note what you would change in the next upload — one line, not a list.',
      ],
    },
  ];

  const markdown = [
    `# Upload checklist — ${titleCase(core)}`,
    '',
    `**Audience:** ${ctx.audience || 'beginners'}`,
    '',
    'Run this every single upload. It is deliberately short: if a step does not change the',
    'outcome, it does not belong here.',
    '',
    ...groups.flatMap((group) => [
      `## ${group.title}`,
      '',
      ...group.items.map((item) => `- [ ] ${item}`),
      '',
    ]),
  ].join('\n');

  const json = `${JSON.stringify({ video: ctx.topic, audience: ctx.audience, groups }, null, 2)}\n`;

  return { markdown, json };
}

/* -------------------------------------------------------------------------- */
/* 10. Content calendar                                                        */
/* -------------------------------------------------------------------------- */

export interface ContentCalendar {
  markdown: string;
  table: string;
}

export function buildCalendar(ctx: Context, perWeekInput: number | string): ContentCalendar {
  const core = subject(ctx.topic);
  const forms = formsOf(core);
  const parsed = Number.parseInt(String(perWeekInput), 10);
  const slots = Math.max(1, Math.min(Number.isFinite(parsed) ? parsed : 2, 3));
  const total = slots * 4;

  // Each pillar carries several angles, so a month of uploads never repeats a
  // title. `verb` templates only fire for verb topics ("editing a week of…"),
  // `noun` templates only for noun topics ("phone video editing").
  const templates: { pillar: string; keyword: string; title: string }[] = [
    {
      pillar: 'Teach',
      keyword: `${forms.about} for beginners`,
      title: forms.verb ? `How to ${core} — step by step` : `${titleCase(core)} — start to finish`,
    },
    {
      pillar: 'Teach',
      keyword: `${forms.about} step by step`,
      title: forms.verb
        ? `The first 10 minutes of ${forms.about}`
        : `Your first 10 minutes of ${core}`,
    },
    {
      pillar: 'Prove',
      keyword: `${forms.about} results`,
      title: `I tried ${forms.verb ? forms.about : core} for 30 days — here is what changed`,
    },
    {
      pillar: 'Prove',
      keyword: `${forms.about} before after`,
      title: `Before vs after: one month of ${forms.about}`,
    },
    {
      pillar: 'Story',
      keyword: `${forms.about} journey`,
      title: `Why I almost quit ${forms.about}`,
    },
    {
      pillar: 'Story',
      keyword: `${forms.about} mistakes I made`,
      title: `Everything I got wrong about ${forms.about} (so you do not have to)`,
    },
    {
      pillar: 'Compare',
      keyword: `best ${forms.about} tools`,
      title: `Cheap vs expensive: ${forms.verb ? `how I ${core}` : core}`,
    },
    {
      pillar: 'Compare',
      keyword: `${forms.about} alternatives`,
      title: `I tested ${forms.verb ? 'three ways to ' + core : 'three approaches to ' + core}`,
    },
    {
      pillar: 'Mistake',
      keyword: `${forms.about} mistakes`,
      title: `${titleCase(core)}: 3 mistakes that keep you stuck`,
    },
    {
      pillar: 'Mistake',
      keyword: `${forms.about} problems`,
      title: `The ${forms.verb ? core.split(' ').slice(0, 4).join(' ') : core} mistake everyone makes`,
    },
    {
      pillar: 'Challenge',
      keyword: `${forms.about} challenge`,
      title: `${titleCase(core)} in one hour — no shortcuts`,
    },
    {
      pillar: 'Challenge',
      keyword: `${forms.about} in a week`,
      title: `I gave myself 7 days to ${forms.verb ? core : `master ${core}`}`,
    },
  ];

  const rows: string[][] = [];
  const start = new Date();
  // First upload lands on the next Monday.
  const offset = (8 - start.getDay()) % 7 || 7;
  start.setDate(start.getDate() + offset);

  for (let index = 0; index < total; index += 1) {
    const week = Math.floor(index / slots);
    const slot = index % slots;
    const date = new Date(start);
    date.setDate(start.getDate() + week * 7 + slot * Math.floor(7 / slots));
    const template = templates[index % templates.length];
    rows.push([
      date.toISOString().slice(0, 10),
      template.pillar,
      template.title,
      template.keyword,
      `Short: ${template.title.split(/[:—]/)[0].trim()} (30s cut)`,
      index === 0 ? 'yes' : 'no',
    ]);
  }

  const markdown = [
    `# 30-day content calendar — ${titleCase(core)}`,
    '',
    `**Uploads:** ${slots} per week · **Market:** ${ctx.market} · **Audience:** ${ctx.audience || 'beginners'}`,
    '',
    '## The four rules behind this plan',
    '',
    '1. Every upload belongs to a pillar, so the channel does not drift.',
    '2. Each long video produces one Short — same idea, different format.',
    '3. The first upload is the “Start here” video; pin it.',
    '4. One finished video beats two abandoned ones. Move a date before you move the quality bar.',
    '',
    '## Pillars',
    '',
    '- **Teach** — answer a question someone typed into search. The growth engine.',
    '- **Prove** — show a result, with the messy middle included. Builds trust.',
    '- **Story** — why you started, what went wrong. Builds the subscription.',
    '- **Compare** — cheap vs expensive, tool vs tool. High click-through.',
    '- **Mistake** — name the trap your audience is in. Short, high-retention.',
    '- **Challenge** — a constraint and a deadline. Easy to film, easy to follow.',
    '',
    '## Schedule',
    '',
    '| Date | Pillar | Title | Keyword | Short | First? |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (row) => `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]} |`,
    ),
    '',
    '## Before each upload',
    '',
    'Run the title through **YouTube SEO Pack**, then **Video Script**, then the **Upload',
    'Checklist**. Change any title you do not believe in — the date matters more than the words.',
    '',
  ].join('\n');

  const table = csv([['Date', 'Pillar', 'Title', 'Keyword', 'Short', 'Start here'], ...rows]);

  return { markdown, table };
}

/* -------------------------------------------------------------------------- */
/* 11. Channel roadmap                                                         */
/* -------------------------------------------------------------------------- */

export function buildRoadmap(ctx: Context, timePerWeek: string, niche: string): string {
  const goal = ctx.topic;
  // The niche is its own field now: `notes` is free-form "include/avoid" text.
  const subjectLine = niche.trim() || 'the niche you picked';

  const phases = [
    {
      title: 'Week 1 — set the stage',
      body: [
        'Publish nothing yet. Pick the niche, write the channel copy, build 5 playlists.',
        'Write three scripts before filming anything so you can see the pattern.',
      ],
      metrics: ['3 scripts written', 'channel fully set up', '0 uploads'],
    },
    {
      title: 'Month 1 — publish 4–8 videos',
      body: [
        'One upload a week minimum. Each upload gets one Short cut from it.',
        'Ignore subscriber count. Track two numbers only: CTR and average view duration.',
      ],
      metrics: ['CTR above 3%', 'AVD above 40% of length', '4–8 uploads'],
    },
    {
      title: 'Month 2–3 — double down on what works',
      body: [
        'Find the two videos with the best retention and make sequels to them.',
        'Rewrite your worst thumbnail. Add chapters to every old video.',
        'Post on the community tab twice a week.',
      ],
      metrics: ['10k+ impressions/month', '2 videos above channel average', '100–300 subs'],
    },
    {
      title: 'Month 4–6 — towards monetisation',
      body: [
        'Keep the schedule, raise the quality bar on the top-performing series only.',
        'Add one long-form “pillar” video per month that can rank in search for years.',
        'Start the blog repurpose for the best two videos.',
      ],
      metrics: ['4,000 watch hours / 10M Shorts views', '1,000 subs', 'stable upload rhythm'],
    },
  ];

  return [
    `# Channel roadmap — ${goal}`,
    '',
    `**Niche:** ${subjectLine}`,
    `**Time available:** ${timePerWeek} per week`,
    `**Audience:** ${ctx.audience || 'beginners'}`,
    '',
    '## What this plan assumes',
    '',
    'You are one person, you publish from a phone or a laptop, and you would rather ship',
    'something imperfect weekly than something perfect quarterly. If any of that is wrong,',
    'halve the upload count instead of skipping weeks.',
    '',
    ...phases.flatMap((phase) => [
      `## ${phase.title}`,
      '',
      ...phase.body.map((line) => `- ${line}`),
      '',
      `**Metrics that matter:** ${phase.metrics.join(' · ')}`,
      '',
    ]),
    '## Weekly loop',
    '',
    '1. Monday — pick the topic (Keyword Research).',
    '2. Tuesday — script it (Video Script).',
    '3. Wednesday — record, edit the first pass.',
    '4. Thursday — second pass, captions, SEO pack, thumbnail brief.',
    '5. Friday — upload checklist, publish, one Short.',
    '6. Saturday — reply to every comment, log CTR + AVD.',
    '',
    '## The one rule',
    '',
    'If a week goes wrong, publish the Short instead of nothing. The algorithm forgives a small',
    'upload; it does not forgive silence.',
    '',
  ].join('\n');
}

/* -------------------------------------------------------------------------- */
/* 12. Blog / community post                                                   */
/* -------------------------------------------------------------------------- */

export interface Article {
  markdown: string;
  html: string;
  title: string;
}

export function buildArticle(ctx: Context): Article {
  const title = titleCase(ctx.topic).slice(0, 90);
  const core = subject(ctx.topic);
  const coreForms = formsOf(core);

  // Every sentence has to read correctly whatever the topic is — including a
  // full clause like "why my videos got better when I cut the intro".
  const sections: { heading: string; paragraphs: string[]; bullets?: string[] }[] = [
    {
      heading: 'The short version',
      paragraphs: [
        'Here is the whole thing written down — including the parts I got wrong the first time.',
        'The process is three steps: decide the promise in one sentence, make the smallest version that keeps that promise, then run one check before you publish. Most of the time people skip step two and then wonder why step three keeps failing.',
      ],
      bullets: [
        'Promise first — one sentence, one audience.',
        'Smallest version — one input, one output.',
        'One check — would a stranger get it in five seconds?',
      ],
    },
    {
      heading: 'Where most people get stuck',
      paragraphs: [
        'The stuck point is almost never the tool. It is the second pass — the part where you throw away a third of what you made. That is the work, and it is the part tutorials skip.',
        'If you are doing this alone and on a budget, the fix is not more gear. It is a smaller scope and a closer read of your own draft.',
      ],
      bullets: [
        'Publishing the first pass and wondering why it feels flat.',
        'Adding more instead of cutting more.',
        'Waiting for better gear instead of finishing the next one.',
      ],
    },
    {
      heading: 'The workflow I use',
      paragraphs: [
        'Write the promise, outline the beats, film in one sitting, then edit for removal only. Everything that does not serve the promise gets cut, no matter how long it took to make.',
      ],
      bullets: [
        'Plan: one sentence + four beats.',
        'Record: one sitting, no retakes unless the audio breaks.',
        'Edit: cut 20% of the runtime.',
        'Publish: SEO pack + checklist, then reply to comments for an hour.',
      ],
    },
  ];

  const markdown = [
    `# ${title}`,
    '',
    '> The written version of the video, for people who would rather read.',
    '',
    ...sections.flatMap((section) => [
      `## ${section.heading}`,
      '',
      ...section.paragraphs.flatMap((paragraph) => [paragraph, '']),
      ...(section.bullets ?? []).map((bullet) => `- ${bullet}`),
      '',
    ]),
    '## Watch instead',
    '',
    `The full walkthrough is on the channel — search "${coreForms.about}".`,
    '',
    '---',
    '',
    `_Written for ${ctx.audience || 'creators'} · edit this in your own voice before publishing._`,
    '',
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (value: string) =>
    escape(value)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>');

  const html = [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escape(title)}</title>`,
    '<style>body{max-width:44rem;margin:3rem auto;padding:0 1.2rem;font:16px/1.7 system-ui,sans-serif;color:#16161d}h1{line-height:1.2}h2{margin-top:2.2rem}blockquote{border-left:3px solid #7c5cff;margin:1.5rem 0;padding-left:1rem;color:#555}</style>',
    '</head><body>',
    `<h1>${escape(title)}</h1>`,
    '<blockquote>The written version of the video, for people who would rather read.</blockquote>',
    ...sections.flatMap((section) => [
      `<h2>${escape(section.heading)}</h2>`,
      ...section.paragraphs.map((paragraph) => `<p>${inline(paragraph)}</p>`),
      ...(section.bullets?.length
        ? [`<ul>${section.bullets.map((bullet) => `<li>${inline(bullet)}</li>`).join('')}</ul>`]
        : []),
    ]),
    '<h2>Watch instead</h2>',
    `<p>The full walkthrough is on the channel — search "${inline(coreForms.about)}".</p>`,
    `<p><em>Written for ${inline(ctx.audience || 'creators')} · edit this in your own voice before publishing.</em></p>`,
    '</body></html>',
  ].join('\n');

  return { markdown, html, title };
}
