/**
 * Deterministic content generators.
 *
 * These power the tools that do not need a model provider: scripts, captions,
 * articles, plans and the timed beats every rendered clip is built from.
 * Everything is derived from the creator's own prompt — no invented facts, no
 * fake sources, no placeholder lorem ipsum.
 */

export interface Cue {
  start: number;
  end: number;
  text: string;
}

export interface Beat {
  label: string;
  text: string;
  start: number;
  end: number;
}

export interface ShortScript {
  title: string;
  hook: string;
  beats: Beat[];
  cta: string;
  captions: string[];
}

/** A stable pseudo-random pick so the same prompt always yields the same cut. */
function pick<T>(items: T[], seed: string): T {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100_000;
  }
  return items[hash % items.length];
}

export function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** Turn a prompt into a clean topic line. */
export function topicFrom(prompt: string, fallback = 'your next launch'): string {
  const cleaned = prompt
    .replace(/^(make|create|write|generate|produce|plan|build)\s+(me\s+)?(a|an|the)?\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/, '')
    .trim();
  if (!cleaned) return fallback;
  return cleaned.length > 90 ? `${cleaned.slice(0, 87)}…` : cleaned;
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

/** Split a sentence into caption-sized chunks (max ~7 words, like short form). */
export function chunkSentence(sentence: string, maxWords = 7): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += maxWords) {
    chunks.push(words.slice(index, index + maxWords).join(' '));
  }
  return chunks.length ? chunks : [''];
}

/**
 * Build a shootable short-form script: hook, three beats, CTA, each with real
 * timing so the renderer can put a caption on screen for every line.
 */
export function buildShortScript(topic: string, durationSeconds: number): ShortScript {
  const hooks = [
    `Stop scrolling — this is the honest version of ${topic}.`,
    `Nobody tells you this about ${topic}.`,
    `Here is what actually works when it comes to ${topic}.`,
    `If you are stuck on ${topic}, this is for you.`,
  ];
  const problems = [
    `Most people start with the tool. That is why it stalls.`,
    `The hard part is not the idea — it is the finishing.`,
    `Everyone wants the result and skips the boring middle.`,
  ];
  const insights = [
    `Start with the one outcome. Everything else is optional.`,
    `Pick the smallest version you can ship this week, then iterate out loud.`,
    `Constraint beats motivation: give it a deadline and a format.`,
  ];
  const proofs = [
    `One clear input, one clear output. That is the whole trick.`,
    `Show the before and after — that is the content.`,
    `Repeat the working format until it stops working.`,
  ];
  const ctas = [
    `Save this, then go make the first version today.`,
    `Follow for the part two — where we ship it for real.`,
    `Comment “start” and I will send the checklist.`,
  ];

  const hook = pick(hooks, topic);
  const body = [
    pick(problems, `${topic}1`),
    pick(insights, `${topic}2`),
    pick(proofs, `${topic}3`),
  ];
  const cta = pick(ctas, `${topic}4`);

  const total = Math.min(Math.max(durationSeconds, 3), 60);
  const lines = [hook, ...body, cta];
  const weights = [1.25, 1, 1, 1, 0.9];
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  const beats: Beat[] = [];
  let cursor = 0;
  lines.forEach((text, index) => {
    const span = (total * weights[index]) / weightSum;
    const start = cursor;
    const end = index === lines.length - 1 ? total : Math.round((cursor + span) * 100) / 100;
    beats.push({
      label: ['Hook', 'Problem', 'Insight', 'Proof', 'CTA'][index] ?? `Beat ${index + 1}`,
      text,
      start: Math.round(start * 100) / 100,
      end,
    });
    cursor = end;
  });

  const captions = beats.flatMap((beat) => chunkSentence(beat.text));

  return {
    title: titleCase(topic).slice(0, 80),
    hook,
    beats,
    cta,
    captions,
  };
}

/** Cues that follow the beats, one caption per beat (for burned-in video). */
export function cuesFromScript(script: ShortScript): Cue[] {
  return script.beats.map((beat) => ({
    start: beat.start,
    end: beat.end,
    text: beat.text,
  }));
}

/** Long-form article: intro, four sections and a close. */
export function buildArticle(topic: string): { title: string; markdown: string } {
  const title = titleCase(topic).slice(0, 90);
  const sections = [
    {
      heading: 'Why this is harder than it looks',
      body: [
        `Most people treat ${topic} as a single task. It is really three: decide, produce, publish.`,
        `Each one fails differently, which is why a single clever idea rarely survives contact with a deadline.`,
      ],
      bullets: [
        'Deciding without a format is procrastination with extra steps.',
        'Producing without a constraint produces bloat.',
        'Publishing without a feedback loop teaches you nothing.',
      ],
    },
    {
      heading: 'The smallest version worth shipping',
      body: [
        `Pick one outcome for ${topic} and one format to deliver it in.`,
        `Set a timer that is shorter than feels comfortable, then ship the version you can finish inside it.`,
      ],
      bullets: [
        'One audience, stated in one sentence.',
        'One deliverable, with a length limit.',
        'One deadline inside the next seven days.',
      ],
    },
    {
      heading: 'What to measure',
      body: [
        `Vanity numbers lie. For ${topic}, measure whether the thing you made changed a decision, a habit or a conversation.`,
      ],
      bullets: [
        'Did someone act on it?',
        'Could you reuse a piece of it?',
        'Would you make it again with the same constraints?',
      ],
    },
    {
      heading: 'A repeatable workflow',
      body: [
        'Write the promise in one line, outline the beats, draft quickly, then edit for removal only.',
        'Keep the draft and the published version side by side so the next one starts from evidence instead of a blank page.',
      ],
      bullets: [
        'Plan: one sentence promise + four beats.',
        'Draft: 25 minutes, no editing.',
        'Edit: cut 20% of the words.',
        'Ship: publish and note what to change next time.',
      ],
    },
  ];

  const markdown = [
    `# ${title}`,
    '',
    `> A working draft on ${topic}, generated in the Open Creator AI studio from your prompt.`,
    '',
    `## Introduction`,
    '',
    `Here is the honest version: ${topic} becomes manageable the moment you stop treating it as one big thing. This piece breaks it into decisions, work and feedback — the parts you can actually control.`,
    '',
    ...sections.flatMap((section) => [
      `## ${section.heading}`,
      '',
      ...section.body,
      '',
      ...section.bullets.map((bullet) => `- ${bullet}`),
      '',
    ]),
    `## Close`,
    '',
    `Pick the smallest version, give it a deadline and a format, then ship it where someone can respond. That is the whole loop.`,
    '',
    `---`,
    '',
    `_Draft generated locally — edit it in your own voice before publishing._`,
    '',
  ].join('\n');

  return { title, markdown };
}

/** A tool-aware plan for the Workflow Planner. */
export function buildPlan(
  goal: string,
  tools: { id: string; name: string }[],
): { title: string; markdown: string } {
  const title = `Plan — ${titleCase(goal).slice(0, 80)}`;
  const steps = [
    [
      'Define the outcome',
      'Write the one sentence that describes the finished piece and who it is for.',
    ],
    ['Pick the format', 'Choose length, platform and aspect ratio before any production starts.'],
    ['Gather inputs', 'Collect the source material, references and any brand assets up front.'],
    ['Produce the first pass', 'Run the smallest pipeline that produces something reviewable.'],
    ['Review and cut', 'Remove 20% of the material. If nothing can be cut, the scope was wrong.'],
    ['Publish and log', 'Ship it, then note what to change on the next run.'],
  ];

  const markdown = [
    `# ${title}`,
    '',
    `**Goal:** ${goal}`,
    '',
    '## Sequence',
    '',
    ...steps.flatMap(([heading, detail], index) => [`${index + 1}. **${heading}** — ${detail}`]),
    '',
    '## Tools you can run right now',
    '',
    ...tools.map((tool) => `- **${tool.name}** (\`${tool.id}\`)`),
    '',
    '## Definition of done',
    '',
    `- The piece exists as a file, not a plan.`,
    `- Someone other than you has seen it.`,
    `- The next run has one concrete change listed.`,
    '',
  ].join('\n');

  return { title, markdown };
}

function pad(value: number): string {
  return String(Math.floor(value)).padStart(2, '0');
}

export function srtTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const ms = Math.round((safe % 1) * 1000);
  return `${pad(safe / 3600)}:${pad((safe % 3600) / 60)}:${pad(safe % 60)},${String(ms).padStart(3, '0')}`;
}

export function vttTimestamp(seconds: number): string {
  return srtTimestamp(seconds).replace(',', '.');
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
    .map((cue) => `${vttTimestamp(cue.start)} --> ${vttTimestamp(cue.end)}\n${cue.text}\n`)
    .join('\n')}\n`;
}

/** Split a paragraph into evenly timed caption cues. */
export function cuesFromText(text: string, secondsPerCue = 3, maxWords = 8): Cue[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const source = sentences.length ? sentences : [text];
  const cues: Cue[] = [];
  let cursor = 0;
  for (const sentence of source) {
    for (const chunk of chunkSentence(sentence, maxWords)) {
      cues.push({ start: cursor, end: cursor + secondsPerCue, text: chunk });
      cursor += secondsPerCue;
    }
  }
  return cues;
}
