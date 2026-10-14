import { safeSvg } from '@/lib/specs';

/** Renders SignCore detail-drawing markup (shapes on a 100 x 100 grid, no <svg> wrapper). */
export default function Svg({ markup, title }: { markup: string | null; title: string }) {
  return (
    <div className="svgbox" role="img" aria-label={title}
      dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif">${safeSvg(markup)}</svg>` }} />
  );
}
