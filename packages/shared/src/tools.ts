import type { ToolDefinition } from './types.ts';

/**
 * The YouTube creator catalogue.
 *
 * This is the single source of truth for what the studio does. Every tool here
 * produces documents a creator actually uses — a niche report, a script, an SEO
 * pack, an upload checklist — and the catalogue drives the UI, the API and the
 * docs (see `docs/TOOLS.md`).
 *
 * The order below is the order a new channel needs them in:
 * niche → channel → keywords → script → SEO → thumbnail brief → upload → grow.
 */

const AUDIENCE: ToolDefinition['fields'][number] = {
  key: 'audience',
  label: 'Audience',
  placeholder: 'e.g. beginner video editors in Bangladesh',
  hint: 'Who the video is for. One sentence is enough.',
};

const MARKET: ToolDefinition['fields'][number] = {
  key: 'market',
  label: 'Language / market',
  type: 'select',
  options: ['English', 'Bangla', 'Hindi', 'Urdu', 'Spanish', 'Arabic', 'Portuguese', 'Indonesian'],
  defaultValue: 'English',
};

const TONE: ToolDefinition['fields'][number] = {
  key: 'tone',
  label: 'Tone',
  type: 'select',
  options: ['Friendly teacher', 'Direct and no-fluff', 'Documentary', 'Funny', 'Motivational'],
  defaultValue: 'Friendly teacher',
};

export const TOOLS: ToolDefinition[] = [
  {
    id: 'niche-finder',
    name: 'Niche Finder',
    category: 'strategy',
    status: 'stable',
    summary:
      'Pick a channel niche you can actually sustain: candidate niches, audience, competition, monetisation paths and the first videos to make.',
    icon: 'target',
    accent: '#7c5cff',
    stage: 'start',
    pipeline: ['interests', 'candidates', 'score', 'shortlist'],
    fields: [
      {
        key: 'prompt',
        label: 'What are you good at, or what could you talk about for hours?',
        type: 'textarea',
        placeholder:
          'e.g. editing videos on a phone, cooking for one, freelancing, football tactics',
        required: true,
      },
      AUDIENCE,
      MARKET,
    ],
    deliverables: ['niche-report.md', 'niches.csv'],
  },
  {
    id: 'channel-blueprint',
    name: 'Channel Blueprint',
    category: 'strategy',
    status: 'stable',
    summary:
      'Everything the channel needs on day one: name ideas, handle, About section, trailer script, playlists and the settings checklist.',
    icon: 'compass',
    accent: '#22c55e',
    stage: 'start',
    pipeline: ['naming', 'positioning', 'copy', 'settings'],
    fields: [
      {
        key: 'prompt',
        label: 'Channel niche',
        placeholder: 'e.g. phone video editing for beginners',
        required: true,
      },
      AUDIENCE,
      {
        key: 'channelName',
        label: 'Name idea (optional)',
        placeholder: 'leave empty and the blueprint suggests names',
      },
      MARKET,
    ],
    deliverables: ['channel-blueprint.md', 'channel-copy.json'],
  },
  {
    id: 'keyword-research',
    name: 'Keyword Research',
    category: 'seo',
    status: 'stable',
    summary:
      'Turn one topic into keyword clusters: primary, long-tail, question, comparison and Shorts keywords, with intent and competition.',
    icon: 'key',
    accent: '#f59e0b',
    stage: 'plan',
    pipeline: ['seed', 'expand', 'classify', 'cluster'],
    fields: [
      {
        key: 'prompt',
        label: 'Seed topic or keyword',
        placeholder: 'e.g. edit videos on android',
        required: true,
      },
      AUDIENCE,
      MARKET,
      {
        key: 'keywords',
        label: 'Keywords you already want (optional)',
        type: 'textarea',
        placeholder: 'comma separated',
      },
    ],
    deliverables: ['keywords.csv', 'keyword-plan.md'],
  },
  {
    id: 'video-script',
    name: 'Video Script',
    category: 'script',
    status: 'stable',
    summary:
      'A retention-first long-form script: hook, roadmap, sections with talking points and b-roll, mid CTA, outro — plus a shot list and captions.',
    icon: 'clapper',
    accent: '#3b82f6',
    stage: 'write',
    pipeline: ['hook', 'structure', 'sections', 'shot-list', 'captions'],
    fields: [
      {
        key: 'prompt',
        label: 'Video title or topic',
        placeholder: 'e.g. 5 editing tricks that save me 10 hours a week',
        required: true,
      },
      AUDIENCE,
      {
        key: 'length',
        label: 'Target length',
        type: 'select',
        options: ['3 minutes', '5 minutes', '8 minutes', '12 minutes', '18 minutes'],
        defaultValue: '8 minutes',
      },
      TONE,
      {
        key: 'notes',
        label: 'Anything to include or avoid (optional)',
        type: 'textarea',
        placeholder: 'e.g. mention my free checklist, no sponsors this time',
      },
    ],
    deliverables: ['script.md', 'shot-list.csv', 'captions.srt'],
  },
  {
    id: 'shorts-script',
    name: 'Shorts Script',
    category: 'script',
    status: 'stable',
    summary:
      'A 20–60 second vertical script with hook, three beats, on-screen text and a CTA, timed line by line for the edit.',
    icon: 'clapper',
    accent: '#a855f7',
    stage: 'write',
    pipeline: ['angle', 'hook', 'beats', 'timing'],
    fields: [
      {
        key: 'prompt',
        label: 'Shorts topic',
        placeholder: 'e.g. stop editing with 10 layers',
        required: true,
      },
      {
        key: 'length',
        label: 'Duration',
        type: 'select',
        options: ['20 seconds', '30 seconds', '45 seconds', '60 seconds'],
        defaultValue: '30 seconds',
      },
      TONE,
      AUDIENCE,
    ],
    deliverables: ['shorts-script.md', 'captions.srt'],
  },
  {
    id: 'youtube-seo',
    name: 'YouTube SEO Pack',
    category: 'seo',
    status: 'stable',
    summary:
      'Title options, a full description with chapters, tags, hashtags, pinned comment and end-screen copy — ready to paste into YouTube Studio.',
    icon: 'search',
    accent: '#ef4444',
    stage: 'publish',
    pipeline: ['keywords', 'titles', 'description', 'tags', 'chapters'],
    fields: [
      {
        key: 'prompt',
        label: 'Video title or topic',
        placeholder: 'e.g. how to edit faster',
        required: true,
      },
      {
        key: 'keywords',
        label: 'Target keywords (optional)',
        type: 'textarea',
        placeholder: 'comma separated — leave empty and they are derived',
      },
      AUDIENCE,
      MARKET,
    ],
    deliverables: ['seo-pack.md', 'metadata.json'],
  },
  {
    id: 'thumbnail-brief',
    name: 'Thumbnail Brief',
    category: 'production',
    status: 'stable',
    summary:
      'The brief a designer (or you) needs: three concepts, exact overlay text, face and colour direction, and an A/B test plan.',
    icon: 'checklist',
    accent: '#ff7a45',
    stage: 'publish',
    pipeline: ['promise', 'concepts', 'overlay-text', 'a-b-test'],
    fields: [
      {
        key: 'prompt',
        label: 'Video title',
        placeholder: 'e.g. I edited a video in 20 minutes',
        required: true,
      },
      AUDIENCE,
      {
        key: 'tone',
        label: 'Mood',
        type: 'select',
        options: ['Curious', 'Shocked', 'Calm and premium', 'Funny', 'Urgent'],
        defaultValue: 'Curious',
      },
    ],
    deliverables: ['thumbnail-brief.md', 'overlay-text.txt'],
  },
  {
    id: 'captions',
    name: 'Captions & Chapters',
    category: 'production',
    status: 'stable',
    summary:
      'Paste or write a script and get timed SRT/VTT captions plus YouTube-style chapters and a description-ready transcript.',
    icon: 'captions',
    accent: '#0ea5e9',
    stage: 'publish',
    pipeline: ['split', 'time', 'export'],
    fields: [
      {
        key: 'script',
        label: 'Script or transcript',
        type: 'textarea',
        placeholder: 'Paste the narration or the script you wrote',
        required: true,
      },
      {
        key: 'length',
        label: 'Seconds per caption line',
        type: 'select',
        options: ['2', '3', '4', '5'],
        defaultValue: '3',
      },
    ],
    deliverables: ['captions.srt', 'captions.vtt', 'chapters.md'],
  },
  {
    id: 'upload-checklist',
    name: 'Upload Checklist',
    category: 'production',
    status: 'stable',
    summary:
      'The exact publish run: Studio settings, metadata, cards, end screen, subtitles, then the first hour, first 24 hours and first week.',
    icon: 'checklist',
    accent: '#14b8a6',
    stage: 'publish',
    pipeline: ['pre-upload', 'studio', 'post-upload', 'first-week'],
    fields: [
      {
        key: 'prompt',
        label: 'Video title',
        placeholder: 'e.g. my first week editing on a phone',
        required: true,
      },
      AUDIENCE,
    ],
    deliverables: ['upload-checklist.md', 'checklist.json'],
  },
  {
    id: 'content-calendar',
    name: '30-Day Content Calendar',
    category: 'strategy',
    status: 'stable',
    summary:
      'A month of uploads mapped out: titles, series, keywords, shorts cut from each long video and the publish days.',
    icon: 'calendar',
    accent: '#8b5cf6',
    stage: 'plan',
    pipeline: ['pillars', 'schedule', 'titles', 'shorts'],
    fields: [
      {
        key: 'prompt',
        label: 'Niche',
        placeholder: 'e.g. cooking for one on a budget',
        required: true,
      },
      {
        key: 'length',
        label: 'Uploads per week',
        type: 'select',
        options: ['1', '2', '3'],
        defaultValue: '2',
      },
      AUDIENCE,
      MARKET,
    ],
    deliverables: ['calendar-30-days.csv', 'calendar-plan.md'],
  },
  {
    id: 'channel-roadmap',
    name: 'Channel Roadmap',
    category: 'strategy',
    status: 'stable',
    summary:
      'From zero to monetisation: what to do in week 1, month 1, month 3 and month 6, with the metrics that matter at each stage.',
    icon: 'growth',
    accent: '#64748b',
    stage: 'grow',
    pipeline: ['goal', 'phases', 'metrics', 'review'],
    fields: [
      {
        key: 'prompt',
        label: 'Goal',
        placeholder: 'e.g. 1,000 subscribers in 90 days',
        required: true,
      },
      { key: 'niche', label: 'Niche (optional)', placeholder: 'e.g. phone video editing' },
      {
        key: 'length',
        label: 'Time you can give per week',
        type: 'select',
        options: ['2 hours', '5 hours', '10 hours', '20+ hours'],
        defaultValue: '5 hours',
      },
    ],
    deliverables: ['roadmap.md'],
  },
  {
    id: 'article-writer',
    name: 'Blog & Community Post',
    category: 'text',
    status: 'stable',
    summary:
      'Turn a video into a blog post or community post, so the same idea earns search traffic and keeps the channel active.',
    icon: 'article',
    accent: '#10b981',
    stage: 'grow',
    pipeline: ['outline', 'draft', 'export'],
    fields: [
      {
        key: 'prompt',
        label: 'Topic',
        placeholder: 'e.g. why my videos got better when I cut the intro',
        required: true,
      },
      AUDIENCE,
      TONE,
    ],
    deliverables: ['article.md', 'article.html'],
  },
];

export const TOOLS_BY_ID: Record<string, ToolDefinition> = Object.fromEntries(
  TOOLS.map((tool) => [tool.id, tool]),
);

export function getTool(id: string): ToolDefinition | undefined {
  return TOOLS_BY_ID[id];
}

export const CATEGORY_LABELS: Record<ToolDefinition['category'], string> = {
  strategy: 'Strategy',
  script: 'Scripts',
  seo: 'SEO',
  production: 'Production',
  text: 'Text',
};

export const STAGE_LABELS: Record<ToolDefinition['stage'], string> = {
  start: 'Start the channel',
  plan: 'Plan',
  write: 'Write',
  publish: 'Publish',
  grow: 'Grow',
};

/** The journey shown on the dashboard, in order. */
export const JOURNEY: { stage: ToolDefinition['stage']; title: string; detail: string }[] = [
  {
    stage: 'start',
    title: 'Create the channel',
    detail:
      'Pick a niche, then build the channel with a name, About section, trailer and playlists.',
  },
  {
    stage: 'plan',
    title: 'Plan what to publish',
    detail: 'Research keywords and lay out a month of uploads before you film anything.',
  },
  {
    stage: 'write',
    title: 'Write the videos',
    detail: 'Retention-first long-form scripts and Shorts scripts, timed for the edit.',
  },
  {
    stage: 'publish',
    title: 'Publish it right',
    detail: 'SEO pack, thumbnail brief, captions and the upload checklist you run every time.',
  },
  {
    stage: 'grow',
    title: 'Grow the channel',
    detail: 'A roadmap to monetisation, plus blog posts that keep earning search traffic.',
  },
];
