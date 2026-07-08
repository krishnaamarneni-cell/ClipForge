export async function publishToBuffer(params: {
  accessToken: string;
  text: string;
  mediaUrl?: string;
  scheduledAt?: string;
  profileIds?: string[];
}): Promise<{ id: string; status: string }> {
  const response = await fetch('https://api.bufferapp.com/1/updates/create.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      access_token: params.accessToken,
      text: params.text,
      ...(params.mediaUrl && { 'media[link]': params.mediaUrl }),
      ...(params.scheduledAt && { scheduled_at: params.scheduledAt }),
      ...(params.profileIds && { 'profile_ids[]': params.profileIds.join(',') }),
    }),
  });

  if (!response.ok) throw new Error(`Buffer API error: ${response.statusText}`);
  const data = await response.json();
  return { id: data.updates?.[0]?.id || '', status: data.success ? 'scheduled' : 'failed' };
}

export async function getBufferProfiles(accessToken: string) {
  const response = await fetch(
    `https://api.bufferapp.com/1/profiles.json?access_token=${accessToken}`
  );
  if (!response.ok) throw new Error('Failed to fetch Buffer profiles');
  return response.json();
}
