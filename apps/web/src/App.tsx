import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { PROJECT_NAME } from '@ftm/core';
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
const MethodologyPage = lazy(() => import('./pages/Methodology'));
const LimitationsPage = lazy(() => import('./pages/Limitations'));
const AboutPage = lazy(() => import('./pages/About'));

const NAV = [
  { to: '/bills', label: 'Bills' },
  { to: '/reps', label: 'Representatives' },
  { to: '/industries', label: 'Sectors' },
  { to: '/spending', label: 'Federal spending' },
  { to: '/methodology', label: 'Method' },
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
            <div className="label mb-1.5">This project</div>
            <ul className="space-y-1">
              <li><Link className="link" to="/about">What this is</Link></li>
              <li><Link className="link" to="/methodology">How the numbers work</Link></li>
              <li><Link className="link" to="/limitations">What it cannot do</Link></li>
            </ul>
          </div>
          <div>
            <div className="label mb-1.5">Primary sources</div>
            <ul className="space-y-1">
              <li><a className="link" href="https://www.fec.gov/data/" target="_blank" rel="noreferrer">FEC campaign finance</a></li>
              <li><a className="link" href="https://www.congress.gov/" target="_blank" rel="noreferrer">Congress.gov</a></li>
              <li><a className="link" href="https://www.usaspending.gov/" target="_blank" rel="noreferrer">USASpending.gov</a></li>
            </ul>
          </div>
          <div>
            <div className="label mb-1.5">Open source</div>
            <p className="leading-relaxed">
              MIT licensed. A personal open-source project, not a company and not a commercial
              product. Runs entirely on your own machine with your own API keys.
            </p>
          </div>
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

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <div className="flex min-h-dvh flex-col">
        {/* Keyboard users should not have to tab through the whole nav on every
            route change. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:border focus:border-edge focus:bg-paper-raised focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main" className="flex-1 pb-[var(--disclaimer-space)]">
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
    </HashRouter>
  );
}
