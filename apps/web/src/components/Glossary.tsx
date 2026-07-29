/**
 * Inline glossary.
 *
 * `<Term k="cosponsor"/>` renders the word with a dotted underline; tapping it
 * opens the definition right there, in the sentence the reader is already in.
 *
 * Deliberately not a tooltip: `title=` and hover cards do not exist on a phone,
 * which is where most of this will be read. Deliberately not a modal either —
 * a definition is a footnote, not an interruption.
 *
 * The definition text comes from lib/glossary.ts. Nothing here writes its own.
 */

import { useState } from 'react';
import { GLOSSARY, type GlossaryKey } from '../lib/glossary';

export function Term({ k, children }: { k: GlossaryKey; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[k];
  return (
    <span className="term-wrap">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="term-btn tap-24"
      >
        {children ?? entry.label}
        <span aria-hidden className="term-mark">
          ?
        </span>
      </button>
      {open && (
        <span role="note" className="term-def">
          {entry.def}
        </span>
      )}
    </span>
  );
}
