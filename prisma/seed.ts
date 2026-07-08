import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      data: JSON.stringify({
        defaultHashtags: ['shorts', 'viral', 'clips'],
        defaultCaptionStyle: 'bold',
        defaultPlatforms: ['youtube_shorts'],
        exportQuality: 'standard',
        autoGenerateClips: true,
        clipLengths: [30, 60],
      }),
    },
    update: {},
  });

  const presets = [
      {
        id: 'preset-classic',
        name: 'Classic',
        style: 'classic',
        fontSize: 42,
        fontColor: '#FFFFFF',
        bgColor: 'rgba(0,0,0,0.7)',
        position: 'bottom',
        animation: 'fade',
        config: JSON.stringify({ wordsPerLine: 8, showEmoji: false, boldKeywords: false }),
      },
      {
        id: 'preset-highlight',
        name: 'Highlight',
        style: 'highlight',
        fontSize: 52,
        fontColor: '#FFFFFF',
        position: 'center',
        animation: 'pop',
        config: JSON.stringify({ highlightColor: '#FFD700', wordsPerLine: 3, showEmoji: false, boldKeywords: true }),
      },
      {
        id: 'preset-bold',
        name: 'Bold Creator',
        style: 'bold',
        fontSize: 58,
        fontColor: '#FFFFFF',
        position: 'center',
        animation: 'pop',
        config: JSON.stringify({ strokeColor: '#000000', strokeWidth: 4, wordsPerLine: 4, showEmoji: true, boldKeywords: true }),
      },
      {
        id: 'preset-subtitle',
        name: 'Subtitle Bar',
        style: 'subtitle',
        fontSize: 36,
        fontColor: '#FFFFFF',
        bgColor: 'rgba(0,0,0,0.85)',
        position: 'bottom',
        animation: 'slide',
        config: JSON.stringify({ wordsPerLine: 10, showEmoji: false, boldKeywords: false }),
      },
      {
        id: 'preset-colorful',
        name: 'Colorful Social',
        style: 'colorful',
        fontSize: 48,
        fontColor: '#FF6B6B',
        position: 'center',
        animation: 'pop',
        config: JSON.stringify({ highlightColor: '#4ECDC4', strokeColor: '#000000', strokeWidth: 3, wordsPerLine: 3, showEmoji: true, boldKeywords: true }),
      },
      {
        id: 'preset-minimal',
        name: 'Minimal Documentary',
        style: 'minimal',
        fontSize: 32,
        fontColor: '#E0E0E0',
        position: 'bottom',
        animation: 'fade',
        config: JSON.stringify({ wordsPerLine: 12, showEmoji: false, boldKeywords: false }),
      },
  ];

  for (const preset of presets) {
    await prisma.captionPreset.upsert({
      where: { id: preset.id },
      create: preset,
      update: {},
    });
  }

  console.log('Seed complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
