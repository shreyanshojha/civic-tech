/**
 * The share-card button and its preview.
 *
 * ---------------------------------------------------------------------------
 * There is no account, no sign-in, no rate limit and no server behind this. The
 * card is drawn on an offscreen canvas in the reader's own browser from data
 * that is already on the page, and the PNG never leaves the machine unless the
 * reader themselves shares it. Nobody — including whoever is hosting this build
 * — learns that a card was made.
 *
 * All the drawing lives in ../lib/sharecard.ts, which has no React in it, so
 * the card can be unit-tested and reused (a CLI, a static OG-image step) without
 * dragging a component tree along. This file is the chrome around it.
 *
 * The one rule this component must not lose: the disclaimer is in the pixels,
 * not in the markup around them. See lib/sharecard.ts.
 * ---------------------------------------------------------------------------
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DISCLAIMER_CARD,
  PROJECT_REPO_URL,
  PROJECT_REPO_URL_IS_PLACEHOLDER,
  PROJECT_REPO_URL_WARNING,
} from '@ftm/core';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  canCopyImages,
  canvasToPngBlob,
  copyCanvasToClipboard,
  downloadBlob,
  renderShareCard,
  shareCardAlt,
  shareCardFilename,
  type ShareCardFinding,
} from '../lib/sharecard';

export type { ShareCardFinding };

export function ShareCardButton({
  finding,
  variant = 'button',
}: {
  finding: ShareCardFinding;
  variant?: 'button' | 'link';
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Send focus back where it came from rather than dropping it on <body>.
    triggerRef.current?.focus();
  }, []);

  const className =
    variant === 'link'
      ? 'tap-24 inline-block text-xs text-ink-4 underline decoration-ink-5 underline-offset-2 hover:text-accent'
      : 'btn px-2.5 py-1 text-xs';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Make a shareable image
      </button>
      {open && <ShareCardDialog finding={finding} onClose={close} />}
    </>
  );
}

type Status = { kind: 'idle' | 'busy' | 'done' | 'error'; message: string };

function ShareCardDialog({ finding, onClose }: { finding: ShareCardFinding; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });

  const copyable = useMemo(canCopyImages, []);
  const alt = useMemo(() => shareCardAlt(finding), [finding]);

  // Draw once per finding. The canvas is kept around so Download and Copy do
  // not have to re-render it, and it is never attached to the document.
  useEffect(() => {
    try {
      const canvas = renderShareCard(finding);
      canvasRef.current = canvas;
      setPreview(canvas.toDataURL('image/png'));
      setError(null);
    } catch (e) {
      canvasRef.current = null;
      setPreview(null);
      setError(e instanceof Error ? e.message : 'The card could not be drawn in this browser.');
    }
  }, [finding]);

  // Escape closes. Nothing else about the page's focus behaviour is altered —
  // no scroll lock, no focus stealing beyond the initial move onto the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const onDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus({ kind: 'busy', message: 'Encoding the image…' });
    try {
      const blob = await canvasToPngBlob(canvas);
      downloadBlob(blob, shareCardFilename(finding));
      setStatus({ kind: 'done', message: 'Saved to your downloads.' });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'The image could not be saved.' });
    }
  };

  const onCopy = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus({ kind: 'busy', message: 'Copying…' });
    try {
      await copyCanvasToClipboard(canvas);
      setStatus({ kind: 'done', message: 'Image copied to your clipboard.' });
    } catch (e) {
      setStatus({
        kind: 'error',
        message:
          e instanceof Error && e.message
            ? `${e.message} Use Download PNG instead.`
            : 'Your browser would not let us copy the image. Use Download PNG instead.',
      });
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-[rgba(6,8,10,0.62)] p-4 backdrop-blur-[2px] sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sharecard-title"
        aria-describedby="sharecard-desc"
        tabIndex={-1}
        className="card w-full max-w-3xl border-edge p-4 shadow-none sm:p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="sharecard-title" className="text-md font-semibold text-ink-0">
              Shareable image
            </h2>
            <p id="sharecard-desc" className="mt-0.5 text-xs leading-snug text-ink-3">
              {CARD_WIDTH}×{CARD_HEIGHT} PNG, drawn in your browser. Nothing is uploaded and no
              account is needed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn px-2 py-1 text-xs"
          >
            Close
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded border border-edge bg-ink-7">
          {error ? (
            <p className="p-6 text-sm text-ink-2">{error}</p>
          ) : preview ? (
            <img
              src={preview}
              alt={alt}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              className="block h-auto w-full"
            />
          ) : (
            <div className="p-4"><div className="skeleton aspect-[1200/630] w-full" /><p className="mt-2 text-xs text-ink-3" role="status">Drawing the card…</p></div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDownload}
            disabled={!preview}
            className="btn border-accent bg-accent-soft font-medium text-accent"
          >
            Download PNG
          </button>
          {copyable && (
            <button
              type="button"
              onClick={onCopy}
              disabled={!preview}
              className="btn"
            >
              Copy image
            </button>
          )}
          <span
            role="status"
            aria-live="polite"
            className={`text-xs ${status.kind === 'error' ? 'text-caveat' : 'text-ink-3'}`}
          >
            {status.message}
          </span>
        </div>

        <p className="mt-4 border-l-2 border-accent-line pl-2.5 text-xs leading-relaxed text-ink-3">
          The image carries its own framing: “{DISCLAIMER_CARD}” is painted into the picture, along
          with the member’s role on the bill, the total their share is measured against, and how the
          bill’s sectors were classified — so the qualifiers travel with the screenshot instead of
          being left behind on this page.
          {!PROJECT_REPO_URL_IS_PLACEHOLDER && (
            <>
              {' '}The card is watermarked <span className="mono">{PROJECT_REPO_URL}</span> so a
              recipient can get back to the method.
            </>
          )}
        </p>

        {/* Amber is reserved for "this data has a gap or a limit you need to know
            about" (see DESIGN.md §1). An unset source URL is exactly that: the
            image cannot lead anyone back to the caveats, which is the whole
            reason the watermark exists. `audit-repo.mjs` fails while this is
            true, so it cannot reach a published build unnoticed. */}
        {PROJECT_REPO_URL_IS_PLACEHOLDER && (
          <div className="caveat mt-3 px-3 py-2" role="note">
            <p>
              <strong className="font-semibold">
                Set <span className="mono">PROJECT_REPO_URL</span> before publishing.
              </strong>{' '}
              {PROJECT_REPO_URL_WARNING} Until it is set the watermark reads “
              <span className="mono">{PROJECT_REPO_URL}</span>” rather than linking anywhere, which
              is honest but not useful. It lives in{' '}
              <span className="mono">packages/core/src/disclaimer.ts</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShareCardButton;
