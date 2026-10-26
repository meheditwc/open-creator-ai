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
  niche: 'Lock the niche, the promise and the person you serve.',
  naming: 'Pick a name that is spellable, searchable and not taken.',
  branding: 'Write the tagline, about copy and banner text.',
  identity: 'Set the colours, fonts and thumbnail style.',
  launch: 'Define what the first three uploads must prove.',
  seed: 'Start from one clear topic, not a keyword dump.',
  expand: 'Grow into related phrases people actually type.',
  cluster: 'Group keywords into video-sized clusters.',
  titles: 'Turn clusters into titles that earn the click.',
  pillars: 'Choose three to four repeatable content pillars.',
  cadence: 'Set an upload rhythm you can keep for 90 days.',
  slots: 'Fill 30 days of slots with real working titles.',
  hook: 'Write the first five seconds before anything else.',
  structure: 'Lay out sections with timestamps.',
  body: 'Write what is actually said, beat by beat.',
  cta: 'Place one mid-roll and one end call to action.',
  beats: 'Break the idea into 3-second beats.',
  overlay: 'Write the on-screen text word for word.',
  metadata: 'Write the title, description, tags and chapters.',
  chapters: 'Mark the chapters so viewers can jump around.',
  tags: 'Keep tags honest and specific.',
  concept: 'Choose one idea worth a stranger clicking.',
  layout: 'Describe the composition, subject and text placement.',
  overlaytext: 'Cap the overlay at five words.',
  readability: 'Check it survives a phone-sized thumbnail.',
  segment: 'Split the script into caption-sized segments.',
  timestamp: 'Time each cue so the reading speed stays natural.',
  export: 'Export both SRT and VTT.',
  preflight: 'Check audio, video, captions and rights.',
  metadatafill: 'Fill every metadata field before the upload.',
  publish: 'Publish, then set the end screen and cards.',
  audit: 'Look at the first 24 hours of data.',
  milestones: 'Set 30, 90 and 180 day milestones.',
  systems: 'Build the repeatable systems: batching, analytics, review.',
  monetise: 'List the income paths available at your size.',
  outline: 'Structure the article before writing.',
  draft: 'Write the full piece in your voice.',
  embed: 'Add the video embed and internal links.',
  exportarticle: 'Export to Markdown and HTML.',
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
