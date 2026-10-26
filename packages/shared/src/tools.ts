import type { ToolDefinition } from './types.ts';

/**
 * The creator tool catalogue.
 *
 * This is the single source of truth for what the studio can do. The web app
 * renders it, the daemon uses it to validate run requests, and the README
 * generator (see `docs/TOOLS.md`) documents it.
 */
export const TOOLS: ToolDefinition[] = [
  {
    id: 'video-translation',
    name: 'Video Translation',
    category: 'video',
    status: 'beta',
    summary:
      'Transcribe a source video, translate the subtitles, dub the voice track and export a new video.',
    icon: 'translate',
    accent: '#7c5cff',
    inputs: ['Video file or URL', 'Source language (auto-detect)', 'Target language'],
    outputs: ['Translated video', 'SRT subtitles', 'Dubbed audio track'],
    pipeline: ['download', 'transcribe', 'translate', 'dub', 'render'],
    requires: ['ffmpeg', 'whisper', 'text + TTS provider'],
    engine: 'provider',
  },
  {
    id: 'video-downloader',
    name: 'Video Downloader',
    category: 'video',
    status: 'beta',
    summary:
      'Pull source material from YouTube, Bilibili, TikTok, Instagram, Douyin and 100+ other platforms.',
    icon: 'download',
    accent: '#00b3a4',
    inputs: ['Video URL'],
    outputs: ['Source video file', 'Metadata JSON'],
    pipeline: ['resolve', 'download'],
    requires: ['yt-dlp'],
    engine: 'external',
  },
  {
    id: 'thumbnail-generator',
    name: 'Thumbnail Generator',
    category: 'image',
    status: 'stable',
    summary:
      'Produce several click-worthy thumbnail variations from a title, a frame or a reference image.',
    icon: 'image',
    accent: '#ff7a45',
    inputs: ['Title', 'Optional reference image', 'Target aspect ratio'],
    outputs: ['3–6 thumbnail PNGs', 'Prompt log'],
    pipeline: ['prompt', 'generate', 'rank'],
    requires: ['ffmpeg'],
    engine: 'local',
  },
  {
    id: 'image-generation',
    name: 'Image Generation',
    category: 'image',
    status: 'stable',
    summary:
      'Create illustrations, covers and b-roll stills from a prompt, with optional reference control.',
    icon: 'image',
    accent: '#ff5c8a',
    inputs: ['Prompt', 'Optional reference image', 'Aspect ratio'],
    outputs: ['Generated image', 'Prompt log'],
    pipeline: ['prompt', 'generate'],
    requires: ['ffmpeg'],
    engine: 'local',
  },
  {
    id: 'video-generation',
    name: 'Video Generation',
    category: 'video',
    status: 'stable',
    summary: 'Generate short clips from text or a still image, then trim and caption them.',
    icon: 'film',
    accent: '#3b82f6',
    inputs: ['Prompt or image', 'Duration', 'Aspect ratio'],
    outputs: ['Video clip', 'Optional subtitle file'],
    pipeline: ['prompt', 'generate', 'caption'],
    requires: ['ffmpeg'],
    engine: 'local',
  },
  {
    id: 'article-writer',
    name: 'Article Writer',
    category: 'text',
    status: 'stable',
    summary: 'Turn a topic, a link or a video into a structured, editable long-form article.',
    icon: 'article',
    accent: '#22c55e',
    inputs: ['Topic, links or video', 'Audience', 'Target length'],
    outputs: ['Markdown', 'HTML', 'PDF'],
    pipeline: ['research', 'outline', 'draft', 'export'],
    requires: [],
    engine: 'local',
  },
  {
    id: 'short-script',
    name: 'Short Video Script',
    category: 'text',
    status: 'stable',
    summary:
      'Write a shoot-ready, segmented script with hooks, beats and shot directions for short form.',
    icon: 'clapper',
    accent: '#f59e0b',
    inputs: ['Topic', 'Platform', 'Audience', 'Duration'],
    outputs: ['Segmented script', 'Shot list', 'Caption ideas'],
    pipeline: ['angle', 'segments', 'polish'],
    requires: ['ffmpeg'],
    engine: 'local',
  },
  {
    id: 'stick-figure',
    name: 'Stick Figure Animation',
    category: 'video',
    status: 'stable',
    summary:
      'Turn a script or a YouTube link into narration, voiceover, storyboard, subtitles and video.',
    icon: 'figure',
    accent: '#a855f7',
    inputs: ['Script or URL', 'Voice style', 'Aspect ratio'],
    outputs: ['Narration audio', 'Subtitles', 'Animated video'],
    pipeline: ['script', 'narration', 'storyboard', 'render'],
    requires: ['ffmpeg'],
    engine: 'local',
  },
  {
    id: 'voiceover',
    name: 'Voiceover & Dubbing',
    category: 'audio',
    status: 'beta',
    summary: 'Generate expressive voice-overs and dub existing videos in another language.',
    icon: 'mic',
    accent: '#ec4899',
    inputs: ['Text or subtitles', 'Voice', 'Emotion', 'Speed'],
    outputs: ['Audio track', 'Aligned subtitles'],
    pipeline: ['chunk', 'synthesize', 'align'],
    requires: ['text + TTS provider', 'ffmpeg'],
    engine: 'provider',
  },
  {
    id: 'subtitle-studio',
    name: 'Subtitle Studio',
    category: 'utility',
    status: 'stable',
    summary:
      'Transcribe, translate, burn in or re-time subtitles with bilingual and short-form presets.',
    icon: 'captions',
    accent: '#0ea5e9',
    inputs: ['Media file or URL', 'Languages', 'Style preset'],
    outputs: ['SRT / VTT', 'Burned-in video', 'Bilingual track'],
    pipeline: ['transcribe', 'translate', 'style', 'render'],
    requires: ['ffmpeg'],
    engine: 'local',
  },
  {
    id: 'workflow-planner',
    name: 'Workflow Planner',
    category: 'utility',
    status: 'stable',
    summary:
      'Describe an outcome and get a sequenced, tool-aware plan you can execute step by step.',
    icon: 'compass',
    accent: '#64748b',
    inputs: ['Goal', 'Constraints', 'Deadline'],
    outputs: ['Step-by-step plan', 'Tool checklist'],
    pipeline: ['decompose', 'map-tools', 'schedule'],
    requires: [],
    engine: 'local',
  },
];

export const TOOLS_BY_ID: Record<string, ToolDefinition> = Object.fromEntries(
  TOOLS.map((tool) => [tool.id, tool]),
);

export function getTool(id: string): ToolDefinition | undefined {
  return TOOLS_BY_ID[id];
}

export const CATEGORY_LABELS: Record<ToolDefinition['category'], string> = {
  video: 'Video',
  image: 'Image',
  audio: 'Audio',
  text: 'Text',
  utility: 'Utility',
};
