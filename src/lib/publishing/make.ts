export async function triggerMakeWebhook(params: {
  webhookUrl: string;
  clipTitle: string;
  clipDescription: string;
  hashtags: string[];
  platform: string;
  filePath?: string;
  fileUrl?: string;
}): Promise<{ success: boolean }> {
  const response = await fetch(params.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'clip_ready',
      clip: {
        title: params.clipTitle,
        description: params.clipDescription,
        hashtags: params.hashtags,
        platform: params.platform,
        file_path: params.filePath,
        file_url: params.fileUrl,
      },
      timestamp: new Date().toISOString(),
    }),
  });

  return { success: response.ok };
}
