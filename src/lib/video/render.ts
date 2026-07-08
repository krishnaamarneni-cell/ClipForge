import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import type { CaptionConfig, TranscriptSegment } from '@/types';

const execAsync = promisify(exec);

interface RenderOptions {
  sourceVideoPath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
  resolution: string;
  captionConfig: CaptionConfig;
  captionSegments: TranscriptSegment[];
  titleOverlay?: string;
  hookText?: string;
}

export async function renderClip(options: RenderOptions): Promise<string> {
  const {
    sourceVideoPath,
    outputPath,
    startTime,
    endTime,
    resolution,
    captionConfig,
    captionSegments,
    titleOverlay,
  } = options;

  const [width, height] = resolution.split('x').map(Number);
  const duration = endTime - startTime;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const assPath = await generateAssSubtitles(captionSegments, startTime, endTime, captionConfig, outputPath);

  const filters: string[] = [];

  // Crop to 9:16 (center crop from landscape)
  filters.push(`crop=ih*${width}/${height}:ih`);
  filters.push(`scale=${width}:${height}`);

  if (titleOverlay) {
    const escapedTitle = titleOverlay.replace(/'/g, "'\\''").replace(/:/g, '\\:');
    filters.push(
      `drawtext=text='${escapedTitle}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=200:enable='between(t,0,3)':fontfile=/Windows/Fonts/arial.ttf`
    );
  }

  if (assPath) {
    filters.push(`ass='${assPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'`);
  }

  const filterStr = filters.join(',');
  const cmd = [
    'ffmpeg',
    `-ss ${startTime}`,
    `-t ${duration}`,
    `-i "${sourceVideoPath}"`,
    `-vf "${filterStr}"`,
    '-c:v libx264 -preset medium -crf 23',
    '-c:a aac -b:a 128k',
    '-movflags +faststart',
    `-t ${duration}`,
    `"${outputPath}"`,
    '-y',
  ].join(' ');

  await execAsync(cmd, { timeout: 600000 });
  return outputPath;
}

async function generateAssSubtitles(
  segments: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
  config: CaptionConfig,
  basePath: string
): Promise<string> {
  const assPath = basePath.replace(/\.[^.]+$/, '.ass');

  const clipSegments = segments.filter(s => s.start >= clipStart && s.end <= clipEnd);
  if (clipSegments.length === 0) return '';

  const fontSize = config.fontSize;
  const fontColor = hexToAss(config.fontColor);
  const outlineColor = config.strokeColor ? hexToAss(config.strokeColor) : '&H00000000';
  const outline = config.strokeWidth || 0;

  let alignment = 2; // bottom center
  if (config.position === 'center') alignment = 5;
  if (config.position === 'top') alignment = 8;

  let marginV = 80;
  if (config.position === 'center') marginV = 0;
  if (config.position === 'top') marginV = 120;

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${config.fontFamily},${fontSize},${fontColor},&H000000FF,${outlineColor},&H80000000,1,0,0,0,100,100,0,0,1,${outline},0,${alignment},40,40,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');

  const events = clipSegments.map(seg => {
    const start = formatAssTime(seg.start - clipStart);
    const end = formatAssTime(seg.end - clipStart);
    let text = seg.text.trim();

    if (config.boldKeywords) {
      const words = text.split(' ');
      if (words.length > 2) {
        const keyIdx = Math.floor(words.length / 2);
        words[keyIdx] = `{\\b1\\c${hexToAss(config.highlightColor || '#FFD700')}}${words[keyIdx]}{\\b0\\c${fontColor}}`;
        text = words.join(' ');
      }
    }

    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  });

  await fs.writeFile(assPath, header + '\n' + events.join('\n'), 'utf8');
  return assPath;
}

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

function hexToAss(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '&H00FFFFFF';
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  return `&H00${b}${g}${r}`;
}

export async function generateThumbnail(
  videoPath: string,
  timestamp: number,
  outputPath: string
): Promise<string> {
  const cmd = `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -vf "crop=ih*9/16:ih,scale=1080:1920" "${outputPath}" -y`;
  await execAsync(cmd, { timeout: 30000 });
  return outputPath;
}
