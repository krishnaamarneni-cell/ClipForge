'use client';

import { cn } from '@/lib/utils';
import type { CaptionStyle } from '@/types';
import { CAPTION_STYLES } from '@/types';

interface CaptionPreviewProps {
  text: string;
  style: CaptionStyle;
  position: 'top' | 'center' | 'bottom';
  animation: string;
  isCompact?: boolean;
}

function splitHighlight(text: string): { before: string; highlight: string; after: string } {
  const words = text.split(' ');
  if (words.length <= 1) return { before: '', highlight: text, after: '' };
  const idx = Math.min(1, words.length - 1);
  return {
    before: words.slice(0, idx).join(' '),
    highlight: words[idx],
    after: words.slice(idx + 1).join(' '),
  };
}

function ClassicCaption({ text, isCompact }: { text: string; isCompact?: boolean }) {
  return (
    <div className={cn(
      'w-full px-3 py-2 bg-black/70 text-center',
      isCompact ? 'text-[10px]' : 'text-sm sm:text-base',
    )}>
      <span className="text-white font-medium leading-snug">{text}</span>
    </div>
  );
}

function HighlightCaption({ text, isCompact }: { text: string; isCompact?: boolean }) {
  const { before, highlight, after } = splitHighlight(text);
  return (
    <div className="text-center px-2">
      <span className={cn(
        'font-bold leading-tight',
        isCompact ? 'text-xs' : 'text-lg sm:text-xl',
      )}>
        {before && <span className="text-white">{before} </span>}
        <span className="text-[#FFD700]">{highlight}</span>
        {after && <span className="text-white"> {after}</span>}
      </span>
    </div>
  );
}

function BoldCaption({ text, isCompact }: { text: string; isCompact?: boolean }) {
  const { before, highlight, after } = splitHighlight(text);
  return (
    <div className="text-center px-2">
      <span
        className={cn(
          'font-extrabold uppercase leading-tight',
          isCompact ? 'text-xs' : 'text-xl sm:text-2xl',
        )}
        style={{
          color: '#FFFFFF',
          WebkitTextStroke: isCompact ? '1px #000' : '2px #000',
          paintOrder: 'stroke fill',
        }}
      >
        {before && <span>{before} </span>}
        <span className="scale-110 inline-block text-[#FFD700]">{highlight}</span>
        {after && <span> {after}</span>}
      </span>
    </div>
  );
}

function SubtitleCaption({ text, isCompact }: { text: string; isCompact?: boolean }) {
  return (
    <div className={cn(
      'w-full px-4 py-1.5 bg-black/85 text-center',
      isCompact ? 'text-[9px]' : 'text-xs sm:text-sm',
    )}>
      <span className="text-white/90 font-normal leading-relaxed">{text}</span>
    </div>
  );
}

function ColorfulCaption({ text, isCompact }: { text: string; isCompact?: boolean }) {
  const words = text.split(' ');
  return (
    <div className="text-center px-2">
      <span
        className={cn(
          'font-bold leading-tight',
          isCompact ? 'text-xs' : 'text-lg sm:text-xl',
        )}
        style={{
          WebkitTextStroke: isCompact ? '0.5px #000' : '1.5px #000',
          paintOrder: 'stroke fill',
        }}
      >
        {words.map((word, i) => (
          <span key={i} style={{ color: i % 2 === 0 ? '#FF6B6B' : '#4ECDC4' }}>
            {word}{i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    </div>
  );
}

function MinimalCaption({ text, isCompact }: { text: string; isCompact?: boolean }) {
  return (
    <div className={cn(
      'text-center px-4',
      isCompact ? 'text-[9px]' : 'text-xs sm:text-sm',
    )}>
      <span className="text-[#E0E0E0]/80 font-light">{text}</span>
    </div>
  );
}

const STYLE_COMPONENTS: Record<CaptionStyle, React.FC<{ text: string; isCompact?: boolean }>> = {
  classic: ClassicCaption,
  highlight: HighlightCaption,
  bold: BoldCaption,
  subtitle: SubtitleCaption,
  colorful: ColorfulCaption,
  minimal: MinimalCaption,
};

export default function CaptionPreview({ text, style, position, animation, isCompact }: CaptionPreviewProps) {
  const Component = STYLE_COMPONENTS[style];
  const config = CAPTION_STYLES[style];

  const positionClass = {
    top: 'top-4',
    center: 'top-1/2 -translate-y-1/2',
    bottom: 'bottom-4',
  }[position || config.position];

  const animationClass = {
    fade: 'animate-fade-in',
    pop: 'animate-slide-up',
    typewriter: 'animate-fade-in',
    slide: 'animate-slide-up',
    none: '',
  }[animation || config.animation] || '';

  if (isCompact) {
    return (
      <div className={cn('absolute inset-x-0 flex justify-center', positionClass, animationClass)}>
        <Component text={text} isCompact />
      </div>
    );
  }

  return (
    <div className={cn('caption-preview', positionClass, animationClass)}>
      <Component text={text} />
    </div>
  );
}
