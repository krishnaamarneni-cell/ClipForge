import { google } from 'googleapis';
import fs from 'fs';

const youtube = google.youtube('v3');

export async function getAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth credentials not configured');

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );
  return oauth2Client;
}

export function getAuthUrl(oauth2Client: InstanceType<typeof google.auth.OAuth2>) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
    ],
  });
}

export async function uploadToYouTube(params: {
  accessToken: string;
  refreshToken: string;
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  categoryId?: string;
  privacyStatus?: 'public' | 'private' | 'unlisted';
}): Promise<{ videoId: string; url: string }> {
  const oauth2Client = await getAuthClient();
  oauth2Client.setCredentials({
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
  });

  const response = await youtube.videos.insert({
    auth: oauth2Client,
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: params.title,
        description: params.description,
        tags: params.tags,
        categoryId: params.categoryId || '22', // People & Blogs
      },
      status: {
        privacyStatus: params.privacyStatus || 'private',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(params.filePath),
    },
  });

  const videoId = response.data.id!;
  return {
    videoId,
    url: `https://youtube.com/shorts/${videoId}`,
  };
}
