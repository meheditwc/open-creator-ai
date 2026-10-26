import { TOOLS } from './tools.ts';
import type { ToolDefinition } from './types.ts';

export const AGENT_SYSTEM_PROMPT = `You are the Open Creator AI studio assistant.
You help creators run a YouTube channel end to end: pick a niche, set the channel up, research keywords, write scripts, publish with SEO, and grow.

Rules:
- Answer with a short, concrete plan: goal, steps, tools, and the first action.
- Prefer the studio tools that exist (${TOOLS.map((tool) => tool.id).join(', ')}).
- Ask at most one clarifying question, and only when it changes the plan.
- Use markdown. Keep it under 220 words unless the user asks for detail.
- Never invent file paths, API keys or finished assets.`;

interface Intent {
  tool?: ToolDefinition;
  score: number;
}

const KEYWORDS: Record<string, string[]> = {
  'niche-finder': ['niche', 'topic', 'idea', 'what should i make', 'choose', 'pick a channel'],
  'channel-blueprint': [
    'channel name',
    'banner',
    'about section',
    'branding',
    'setup',
    'start a channel',
  ],
  'keyword-research': ['keyword', 'search volume', 'ranking', 'tag', 'competition'],
  'content-calendar': ['calendar', 'schedule', 'plan my uploads', 'consistency', 'batch'],
  'video-script': ['script', 'hook', 'long form', 'voiceover', 'intro', 'outro'],
  'shorts-script': ['short', 'reels', 'shorts', 'tiktok clip'],
  'youtube-seo': ['seo', 'title', 'description', 'metadata', 'ctr', 'ranking'],
  'thumbnail-brief': ['thumbnail', 'cover', 'overlay text'],
  captions: ['caption', 'srt', 'subtitle', 'transcribe', 'vtt'],
  'upload-checklist': ['upload', 'publish', 'checklist', 'before posting'],
  'channel-roadmap': ['grow', 'subscribers', 'roadmap', 'monetis', 'monetiz', 'analytics'],
  'article-writer': ['article', 'blog', 'post', 'newsletter', 'repurpose'],
};

function detectIntent(message: string): Intent {
  const haystack = message.toLowerCase();
  let best: Intent = { score: 0 };

  for (const [toolId, keywords] of Object.entries(KEYWORDS)) {
    const score = keywords.reduce((total, keyword) => {
      if (!haystack.includes(keyword)) return total;
      return total + (keyword.includes(' ') ? 2 : 1);
    }, 0);
    if (score > best.score) {
      const tool = TOOLS.find((candidate) => candidate.id === toolId);
      if (tool) best = { tool, score };
    }
  }

  return best;
}

const STEP_DETAILS: Record<string, string> = {
  interests: 'List what you can talk about for hours, then group it.',
  candidates: 'Turn each interest into a concrete channel angle.',
  score: 'Score demand, competition and how long you can sustain it.',
  shortlist: 'Keep the two or three angles worth testing first.',
  naming: 'Pick a name that is spellable, searchable and not taken.',
  positioning: 'Write the one sentence the channel promises.',
  copy: 'Draft the About section, tagline and trailer script.',
  settings: 'Set the studio defaults and playlists once, not every upload.',
  seed: 'Start from one clear topic, not a keyword dump.',
  expand: 'Grow into the related phrases people actually type.',
  classify: 'Tag each keyword by intent and competition.',
  cluster: 'Group keywords into video-sized clusters.',
  pillars: 'Choose three or four repeatable content pillars.',
  schedule: 'Place the uploads on real dates you can keep.',
  titles: 'Turn each slot into a working title.',
  shorts: 'Plan the vertical cut of each long video.',
  hook: 'Write the first five seconds before anything else.',
  structure: 'Lay out sections with timestamps.',
  sections: 'Write what is actually said, beat by beat.',
  'shot-list': 'List the shots so you can film without guessing.',
  captions: 'Time the words into caption-sized cues.',
  angle: 'Pick the angle and the one promise.',
  beats: 'Break the idea into 3-second beats.',
  timing: 'Time every beat for a 20–60 second runtime.',
  keywords: 'Pick the phrase this video should rank for.',
  description: 'Write the description, chapters and links.',
  tags: 'Keep tags honest and specific.',
  chapters: 'Mark the chapters so viewers can jump around.',
  promise: 'Decide the one thing the thumbnail promises.',
  concepts: 'Sketch three concepts, each a different promise.',
  'overlay-text': 'Cap the overlay at five words.',
  'a-b-test': 'Plan the test and the swap threshold.',
  split: 'Split the script into caption-sized segments.',
  time: 'Time each cue so the reading speed stays natural.',
  export: 'Export both SRT and VTT.',
  'pre-upload': 'Check audio, video, captions and rights.',
  studio: 'Fill every metadata field before the upload.',
  'post-upload': 'Publish, then set the end screen and cards.',
  'first-week': 'Read the first 24 hours and the first week.',
  goal: 'Set a goal with a number and a date.',
  phases: 'Split the next six months into honest phases.',
  metrics: 'Name the two metrics that decide the next move.',
  review: 'Schedule the weekly review that keeps it alive.',
  outline: 'Structure the article before writing.',
  draft: 'Write the full piece in your voice.',
};

function describeStep(step: string, tool: ToolDefinition): string {
  return STEP_DETAILS[step] ?? `Run the ${step} stage for ${tool.name}.`;
}

/**
 * The offline planner.
 *
 * It runs in the daemon when no LLM provider is configured, and in the browser
 * when the daemon is unreachable — so the studio always answers with something
 * useful instead of an error.
 */
export function localAgentReply(message: string): { reply: string; suggestions: string[] } {
  const trimmed = message.trim();
  const intent = detectIntent(trimmed);
  const tool = intent.tool;

  if (!tool) {
    return {
      reply: [
        `I can help turn **"${trimmed.slice(0, 120)}"** into finished content.`,
        '',
        'A good starting point is to pick the outcome you want:',
        '',
        ...TOOLS.filter((candidate) => candidate.status !== 'planned')
          .slice(0, 5)
          .map((candidate) => `- **${candidate.name}** — ${candidate.summary}`),
        '',
        'Tell me the source material (a link, a file, or just a topic) and the target format, and I will lay out the steps.',
      ].join('\n'),
      suggestions: [
        'Translate this video into Spanish with a dubbed voice track',
        'Write a 60-second short script about this topic',
        'Plan a thumbnail + short video launch for my article',
      ],
    };
  }

  const steps = tool.pipeline
    .map((step, index) => `${index + 1}. **${step}** — ${describeStep(step, tool)}`)
    .join('\n');

  return {
    reply: [
      `**${tool.name}** is the right tool for that — it sits in the *${tool.stage}* stage of the channel workflow.`,
      '',
      '**What I need from you**',
      ...tool.fields.map((field) => `- ${field.label}${field.required ? ' *(required)*' : ''}`),
      '',
      '**How it runs**',
      steps,
      '',
      '**Files you get**',
      ...tool.deliverables.map((file) => `- \`${file}\``),
      '',
      'Open the tool, fill the fields and press generate — everything is written locally, no API key needed.',
    ].join('\n'),
    suggestions: [
      `Start a ${tool.name} run`,
      `Show me the ${tool.name} inputs`,
      'Which other tools can reuse this output?',
    ],
  };
}
