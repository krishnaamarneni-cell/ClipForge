import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';

export async function ensureStorageDir(projectId: string): Promise<string> {
  const dir = path.join(STORAGE_PATH, projectId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function downloadYouTube(
  url: string,
  projectId: string
): Promise<{ filePath: string; title: string; duration: number; thumbnail: string }> {
  const dir = await ensureStorageDir(projectId);
  const outputPath = path.join(dir, 'source.%(ext)s');

  const infoCmd = `"${YT_DLP_PATH}" --dump-json --no-download "${url}"`;
  const { stdout } = await execAsync(infoCmd, { maxBuffer: 10 * 1024 * 1024 });
  const info = JSON.parse(stdout);

  const downloadCmd = `"${YT_DLP_PATH}" -f "bestvideo[height<=1080]+bestaudio/best[height<=1080]" --merge-output-format mp4 -o "${outputPath}" "${url}"`;
  await execAsync(downloadCmd, { timeout: 600000 });

  const files = await fs.readdir(dir);
  const videoFile = files.find(f => f.startsWith('source.'));
  const filePath = path.join(dir, videoFile || 'source.mp4');

  return {
    filePath,
    title: info.title || 'Untitled',
    duration: info.duration || 0,
    thumbnail: info.thumbnail || `https://img.youtube.com/vi/${info.id}/maxresdefault.jpg`,
  };
}

export async function getVideoInfo(filePath: string): Promise<{ duration: number; width: number; height: number }> {
  const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
  const { stdout } = await execAsync(cmd);
  const probe = JSON.parse(stdout);

  const videoStream = probe.streams?.find((s: Record<string, string>) => s.codec_type === 'video');
  return {
    duration: parseFloat(probe.format?.duration || '0'),
    width: parseInt(videoStream?.width || '1920'),
    height: parseInt(videoStream?.height || '1080'),
  };
}

export async function extractAudio(videoPath: string, outputDir: string): Promise<string> {
  const audioPath = path.join(outputDir, 'audio.wav');
  const cmd = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y`;
  await execAsync(cmd, { timeout: 300000 });
  return audioPath;
}
