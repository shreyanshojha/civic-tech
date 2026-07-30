import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { PROJECT_NAME, PROJECT_REPO_URL, PROJECT_REPO_URL_IS_PLACEHOLDER } from '@ftm/core';
import { PersistentDisclaimer } from './components/Framing';
import { GlobalSearch } from './components/GlobalSearch';
import { Loading } from './components/ui';

/**
 * HashRouter, deliberately.
 *
 * This app must work when opened straight off a disk with no server at all, and
 * on any static host without a rewrite rule. Hash routing is the only routing
 * that satisfies both. It is a small aesthetic cost for a real portability win,
 * and portability is the point: nobody should have to operate infrastructure to
 * run this.
 */

const HomePage = lazy(() => import('./pages/Home'));
const BillsPage = lazy(() => import('./pages/Bills'));
const BillDetailPage = lazy(() => import('./pages/BillDetail'));
const RepsPage = lazy(() => import('./pages/Reps'));
const RepDetailPage = lazy(() => import('./pages/RepDetail'));
const IndustriesPage = lazy(() => import('./pages/Industries'));
const IndustryDetailPage = lazy(() => import('./pages/IndustryDetail'));
const SpendingPage = lazy(() => import('./pages/Spending'));
const PatternsPage = lazy(() => import('./pages/Patterns'));
const PatternDetailPage = lazy(() => import('./pages/PatternDetail'));
const HowToReadPage = lazy(() => import('./pages/HowToRead'));
const MethodologyPage = lazy(() => import('./pages/Methodology'));
const LimitationsPage = lazy(() => import('./pages/Limitations'));
const AboutPage = lazy(() => import('./pages/About'));

/**
 * `About` is in the primary nav, not only in the footer.
 *
 * A reader deciding whether to believe any of this looks for who made it before
 * they look at a number, and a link buried in the footer of a long page is a
 * link they never reach. A skeptical reviewer of this site stopped at exactly
 * that point: no named human anywhere, and the page that would have said so was
 * three screens down.
 *
 * `How to read this` sits directly before `Method`, and the two are next to each
 * other on purpose: a reader who wants help is looking in that region of the
 * nav, and the pair reads as "what the numbers mean / how they are computed".
 * It is in the primary nav rather than the footer for the same reason `About`
 * is — a reader who cannot tell what the site is for gives up long before they
 * reach the bottom of a page, which is exactly the failure this page fixes.
 *
 * `Committees` sits with the other data views rather than with the explainers,
 * because it is a data view — the only one on this site whose unit is a group of
 * members instead of a single member or a single bill. That is also why it earns
 * a nav slot at all: a reader who cannot learn anything from one member's page
 * has nowhere else to go for a comparison that has a sample size.
 */
const NAV = [
  { to: '/bills', label: 'Bills' },
  { to: '/reps', label: 'Representatives' },
  { to: '/industries', label: 'Sectors' },
  { to: '/patterns', label: 'Committees' },
  { to: '/spending', label: 'Federal spending' },
  { to: '/how-to-read', label: 'How to read this' },
  { to: '/methodology', label: 'Method' },
  { to: '/about', label: 'About' },
];

/**
 * The header is sticky, and so is the disclaimer at the foot of the page. On a
 * 375×667 phone those two used to eat 288px — 43% of the viewport — because the
 * header stacked three rows: brand, nav, and a permanently-open search field.
 *
 * The fix is not to shrink the disclaimer (it is the point of the product) but
 * to stop the header from claiming space it does not need. Search collapses to
 * a button below `md`, and opens in place; the nav row scrolls with a fade so
 * it is obvious there is more of it. The sticky chrome is now one 52px row plus
 * a 38px nav row.
 */
function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Navigating away from a route should not leave the search sheet hanging open.
  useEffect(() => setSearchOpen(false), [pathname]);
  useEffect(() => {
    if (searchOpen) panelRef.current?.querySelector('input')?.focus();
  }, [searchOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur no-print">
      <div className="mx-auto max-w-content px-4">
        <div className="flex h-[3.25rem] items-center gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded bg-accent text-paper-raised">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M4 20V9h4v11H4Zm6 0V4h4v16h-4Zm6 0v-7h4v7h-4Z" opacity=".9" />
              </svg>
            </span>
            <span className="text-md font-semibold tracking-tight text-ink-0">{PROJECT_NAME}</span>
          </Link>
          <div className="ml-auto hidden max-w-md flex-1 md:block">
            <GlobalSearch />
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            aria-expanded={searchOpen}
            aria-controls="mobile-search"
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded border border-edge px-2 text-xs text-ink-2 md:hidden"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5 14 14" strokeLinecap="round" />
            </svg>
            Search
          </button>
        </div>
        <nav className="scroll-x -mb-px flex gap-1" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `whitespace-nowrap border-b-2 px-2.5 py-1.5 text-sm transition-colors ${
                  isActive ? 'border-accent font-semibold text-ink-0' : 'border-transparent text-ink-3 hover:text-ink-1'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
      {searchOpen && (
        <div id="mobile-search" ref={panelRef} className="border-t border-line px-4 py-2 md:hidden">
          <GlobalSearch compact />
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-paper-raised no-print">
      <h2 className="sr-only">Site information and sources</h2>
      <div className="mx-auto max-w-content px-4 py-8 text-sm text-ink-3">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <h3 className="label mb-1.5">This project</h3>
            <ul className="space-y-1">
              <li><Link className="link" to="/about">What this is</Link></li>
              <li><Link className="link" to="/how-to-read">How to read this site</Link></li>
              <li><Link className="link" to="/methodology">How the numbers work</Link></li>
              <li><Link className="link" to="/limitations">What it cannot do</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="label mb-1.5">Primary sources</h3>
            <ul className="space-y-1">
              <li><a className="link" href="https://www.fec.gov/data/" target="_blank" rel="noreferrer">FEC campaign finance</a></li>
              <li><a className="link" href="https://www.congress.gov/" target="_blank" rel="noreferrer">Congress.gov</a></li>
              <li><a className="link" href="https://www.usaspending.gov/" target="_blank" rel="noreferrer">USASpending.gov</a></li>
            </ul>
          </div>
          {/* A heading that says "Open source" over a block containing no link
              to any source is worse than saying nothing: a reader looking for
              the code finds a claim and no way to check it, and reasonably
              concludes the claim is decoration. While no repository address is
              set, this column says exactly that in plain words and drops the
              heading that promises a link. */}
          {PROJECT_REPO_URL_IS_PLACEHOLDER ? (
            <div>
              <h3 className="label mb-1.5">Licence and source</h3>
              <p className="leading-relaxed">
                MIT licensed. This is an unpublished build: no public source address has been set
                for it yet, so there is no repository to link to from here. It is a personal
                open-source project, not a company and not a commercial product, and it runs
                entirely on your own machine with your own API keys.
              </p>
              <p className="mt-1.5 leading-relaxed">
                <Link className="link" to="/about">Who maintains this, and how to report a problem</Link>
              </p>
            </div>
          ) : (
            <div>
              <h3 className="label mb-1.5">Open source</h3>
              <p className="leading-relaxed">
                MIT licensed. A personal open-source project, not a company and not a commercial
                product. Runs entirely on your own machine with your own API keys.
              </p>
              <p className="mt-1.5">
                <a className="link" href={`https://${PROJECT_REPO_URL}`} target="_blank" rel="noreferrer noopener">
                  {PROJECT_REPO_URL}
                </a>
              </p>
              <p className="mt-1.5 leading-relaxed">
                <Link className="link" to="/about">Who maintains this, and how to report a problem</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  if (typeof window !== 'undefined') {
    queueMicrotask(() => window.scrollTo({ top: 0 }));
  }
  return <span key={pathname} hidden />;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-content px-4 py-16">
      <h1 className="text-lg font-semibold text-ink-0">Page not found</h1>
      <p className="mt-2 text-base text-ink-3">
        <Link className="link" to="/">Back to the start</Link>
      </p>
    </div>
  );
}

/**
 * Says out loud that the page changed.
 *
 * ---------------------------------------------------------------------------
 * A route change in this app used to be completely silent. `document.title`
 * was set once in index.html and never again, so every one of the eleven routes
 * announced itself as the same string — in the tab, in the window switcher, in
 * a bookmark, and in the browser history. And because the router swaps the
 * contents of <main> without a document load, a screen reader was told nothing
 * at all: focus stayed on the link that had just been activated, which by then
 * pointed at a page that was no longer on screen.
 *
 * Three things happen on every navigation:
 *   1. document.title becomes the subject of the page ("Robert B. Aderholt —
 *      Follow the Money"), taken from the page's own h1 so it can never drift
 *      from what is rendered;
 *   2. focus moves to that h1, which is given tabindex="-1" so it can receive
 *      focus without becoming a tab stop;
 *   3. the same subject is announced through a visually-hidden role="status".
 *
 * The h1 usually is not in the DOM yet when the route changes — the page is a
 * lazy chunk and most pages then wait on a JSON file — so this observes <main>
 * until one appears rather than reading it once and giving up. Focus is moved
 * only for a real navigation, never on first load, where stealing focus from
 * the top of the document would be its own bug.
 *
 * The stale-h1 guard is not defensive coding, it is a bug this had. While a
 * lazy route chunk is still downloading, React keeps the PREVIOUS page's
 * markup on screen — so an effect that reads `main.querySelector('h1')` the
 * moment the pathname changes reads the h1 of the page the reader just left,
 * sets the tab title to it, and stops looking. Measured: every route announced
 * the title of the route before it. So an h1 only counts once it is either a
 * different DOM node or carries different text from the one already announced.
 * ---------------------------------------------------------------------------
 */
function RouteAnnouncer({ mainRef }: { mainRef: React.RefObject<HTMLElement> }) {
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');
  const isFirstRoute = useRef(true);
  /** The h1 the current title came from: both the node and its text. */
  const announced = useRef<{ node: Element | null; subject: string }>({ node: null, subject: '' });

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const shouldFocus = !isFirstRoute.current;
    isFirstRoute.current = false;

    const apply = (force: boolean): boolean => {
      const h1 = main.querySelector('h1');
      const subject = (h1?.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!h1 || !subject) return false;
      // Still the h1 we announced last time, unchanged? Then the new page has
      // not rendered yet and this is the outgoing page's heading.
      const stale = h1 === announced.current.node && subject === announced.current.subject;
      if (stale && !force) return false;

      announced.current = { node: h1, subject };
      document.title = `${subject} — ${PROJECT_NAME}`;
      setMessage(`${subject}. ${PROJECT_NAME}.`);
      if (shouldFocus) {
        h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: true });
      }
      return true;
    };

    if (apply(false)) return;

    const observer = new MutationObserver(() => {
      if (apply(false)) observer.disconnect();
    });
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    // A page that never produces its own h1 would otherwise leave the previous
    // route's title in the tab, which is worse than a generic one.
    const giveUp = window.setTimeout(() => {
      observer.disconnect();
      if (!apply(true)) document.title = PROJECT_NAME;
    }, 8000);

    return () => {
      observer.disconnect();
      window.clearTimeout(giveUp);
    };
  }, [pathname, mainRef]);

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}

function Shell() {
  const mainRef = useRef<HTMLElement>(null);

  /**
   * The skip link is a button, not an anchor, and that is a bug fix rather
   * than a preference.
   *
   * Under HashRouter the whole route lives in `location.hash`. `<a href="#main">`
   * therefore did not jump to an element — it REPLACED the route with `#main`,
   * which matches nothing, so the router rendered "Page not found" and the page
   * the reader was on disappeared. It is the first tab stop on every page, so
   * the one control on this site built specifically for keyboard users was the
   * fastest way for a keyboard user to destroy the page they were reading.
   *
   * Focusing <main> directly does the job an in-page anchor is supposed to do,
   * and does not touch the URL at all. `tabindex="-1"` is set at the moment of
   * use so that <main> is focusable programmatically without becoming a tab
   * stop for everybody else.
   */
  const skipToMain = () => {
    const main = mainRef.current;
    if (!main) return;
    main.setAttribute('tabindex', '-1');
    main.focus();
    main.scrollIntoView({ block: 'start' });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Keyboard users should not have to tab through the whole nav on every
          route change. */}
      <button
        type="button"
        onClick={skipToMain}
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:border focus:border-edge focus:bg-paper-raised focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to main content
      </button>
      <RouteAnnouncer mainRef={mainRef} />
      <Header />
      <main id="main" ref={mainRef} className="flex-1 pb-[var(--disclaimer-space)]">
        <Suspense fallback={<div className="mx-auto max-w-content px-4"><Loading what="page" /></div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/bills" element={<BillsPage />} />
            <Route path="/bills/:id" element={<BillDetailPage />} />
            <Route path="/reps" element={<RepsPage />} />
            <Route path="/reps/:bioguideId" element={<RepDetailPage />} />
            <Route path="/industries" element={<IndustriesPage />} />
            <Route path="/industries/:id" element={<IndustryDetailPage />} />
            <Route path="/spending" element={<SpendingPage />} />
            <Route path="/patterns" element={<PatternsPage />} />
            <Route path="/patterns/:id" element={<PatternDetailPage />} />
            <Route path="/how-to-read" element={<HowToReadPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            <Route path="/limitations" element={<LimitationsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <PersistentDisclaimer />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Shell />
    </HashRouter>
  );
}
