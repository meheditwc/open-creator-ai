import { TOOLS } from './tools.ts';
import type { ToolDefinition } from './types.ts';

export const AGENT_SYSTEM_PROMPT = `You are the Open Creator AI studio assistant.
You help creators turn an idea into finished video, image and audio content.

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
  'video-translation': [
    'translate',
    'dub',
    'subtitl',
    'language',
    'hindi',
    'spanish',
    'french',
    'portuguese',
    'japanese',
    'korean',
  ],
  'video-downloader': ['download', 'youtube', 'bilibili', 'tiktok', 'instagram', 'douyin', 'url'],
  'thumbnail-generator': ['thumbnail', 'cover', 'click', 'ctr', 'banner'],
  'image-generation': ['image', 'picture', 'illustration', 'poster', 'art', 'meme', 'photo'],
  'video-generation': ['generate video', 'clip', 'animation', 'b-roll', 'broll'],
  'article-writer': ['article', 'blog', 'post', 'newsletter', 'seo', 'readme'],
  'short-script': ['script', 'short', 'reels', 'hook', 'caption'],
  'stick-figure': ['stick figure', 'animation', 'storyboard', 'narration'],
  voiceover: ['voice', 'voiceover', 'tts', 'speech', 'narration', 'audio', 'dubbing'],
  'subtitle-studio': ['subtitle', 'srt', 'caption', 'transcribe'],
  'workflow-planner': ['plan', 'workflow', 'roadmap', 'steps', 'strategy', 'schedule'],
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
  download: 'Fetch the source media and its metadata.',
  resolve: 'Resolve the URL and pick the best quality source.',
  transcribe: 'Turn the audio into timed text segments.',
  translate: 'Translate each segment while keeping the timing.',
  dub: 'Synthesize the translated speech and mix it with the source.',
  render: 'Compose and encode the final file.',
  prompt: 'Write the generation prompt with the style and constraints.',
  generate: 'Run the model and collect the outputs.',
  rank: 'Score the variations and keep the strongest.',
  caption: 'Add captions that match the spoken audio.',
  research: 'Collect the facts and the references.',
  outline: 'Structure the article before writing.',
  draft: 'Write the full piece in the target voice.',
  export: 'Export to the format you need.',
  angle: 'Pick the angle and hook.',
  segments: 'Break the script into shootable beats.',
  polish: 'Tighten the wording and pacing.',
  script: 'Turn the idea into a timed narration script.',
  narration: 'Record the narration audio.',
  storyboard: 'Draw the shot list for every beat.',
  chunk: 'Split the text into speakable chunks.',
  synthesize: 'Generate the voice track.',
  align: 'Re-sync the audio with the visuals.',
  style: 'Apply the caption style preset.',
  decompose: 'Break the goal into concrete deliverables.',
  'map-tools': 'Attach the right studio tool to every step.',
  schedule: 'Order the steps and estimate the effort.',
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

  const requirements = tool.requires.length ? `\n\n**Needs:** ${tool.requires.join(', ')}` : '';

  return {
    reply: [
      `**${tool.name}** is the right tool for that.`,
      '',
      '**Inputs I need**',
      ...tool.inputs.map((input) => `- ${input}`),
      '',
      '**Pipeline**',
      steps,
      '',
      '**Output**',
      ...tool.outputs.map((output) => `- ${output}`),
      requirements,
      '',
      'Give me the source and I will start the first step.',
    ].join('\n'),
    suggestions: [
      `Start a ${tool.name} run`,
      `Show me the ${tool.name} inputs`,
      'Which other tools can reuse this output?',
    ],
  };
}
