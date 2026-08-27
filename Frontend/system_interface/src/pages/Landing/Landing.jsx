import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Landing.module.css';
import { centralRequest } from '../../services/api';

/* Node positions for the hero mesh diagram. Coordinates are in a
   480x320 viewBox; deliberately irregular so it reads as a real
   graph cluster, not a perfect grid. (x, y, label, status) */
const NODES = [
  { x: 70,  y: 70,  label: 'lab-01', status: 'online'  },
  { x: 180, y: 50,  label: 'lab-04', status: 'online'  },
  { x: 290, y: 95,  label: 'lab-07', status: 'busy'    },
  { x: 400, y: 60,  label: 'lab-11', status: 'online'  },
  { x: 120, y: 180, label: 'lab-02', status: 'online'  },
  { x: 240, y: 200, label: 'lab-05', status: 'busy'    },
  { x: 360, y: 180, label: 'lab-09', status: 'online'  },
  { x: 90,  y: 270, label: 'lab-03', status: 'offline' },
  { x: 310, y: 280, label: 'lab-12', status: 'online'  },
];

/* Edges between nodes. `pulse` marks lines that animate a packet. */
const EDGES = [
  { a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 },
  { a: 0, b: 4 }, { a: 1, b: 4 }, { a: 1, b: 5, pulse: true },
  { a: 2, b: 5 }, { a: 3, b: 6 }, { a: 4, b: 5 },
  { a: 4, b: 7 }, { a: 5, b: 6, pulse: true }, { a: 5, b: 8 },
  { a: 6, b: 8 }, { a: 7, b: 4 },
];

const STATUS_COLOR = {
  online: 'var(--clr-success)',
  busy:   'var(--clr-warning)',
  offline: 'var(--clr-text-3)',
};

const Landing = () => {
  const navigate = useNavigate();

  const handleExit = async () => {
    if (window.confirm("Are you sure you want to shut down the Assignment System? This will stop all background servers.")) {
      try {
        await centralRequest.post('/api/stop_servers/');
        alert("System is shutting down. You can now close this window.");
      } catch (err) {
        alert("System is shutting down or has already been stopped.");
      }
    }
  };

  return (
    <div className={styles.page}>
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className={styles.navbar}>
        <div className={styles.navLogo}>
          <div className={styles.navLogoIcon}>
            <img src="/logo192.png" alt="Quorum logo" />
          </div>
          <img src="/logo.png" alt="Quorum" className={styles.navLogoText} />
        </div>
        <div className={styles.navActions}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/nodes')}>
            Nodes
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleExit}>
            Exit System
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
            Sign In
          </button>
        </div>
      </nav>

      {/* ── Hero (two-column) ──────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <h1 className={styles.heroTitle}>
            Every lab machine<br />is a node.
          </h1>

          <p className={styles.heroSubtitle}>
            Quorum turns the computers already in your lab into worker nodes.
            When a student submits code, it runs on whichever machines are
            online in the room. Results come back in real time — no cloud,
            no queue, no waiting.
          </p>

          <div className={styles.heroActions}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
              Open Console
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => navigate('/nodes')}>
              View Connected Nodes
            </button>
          </div>
        </div>

        <div className={styles.heroRight} aria-hidden>
          <svg
            className={styles.mesh}
            viewBox="0 0 480 320"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Node mesh diagram showing connected lab machines"
          >
            {/* Edges */}
            {EDGES.map((e, i) => {
              const a = NODES[e.a], b = NODES[e.b];
              return (
                <line
                  key={`edge-${i}`}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  className={e.pulse ? styles.meshEdgePulse : styles.meshEdge}
                />
              );
            })}

            {/* Nodes */}
            {NODES.map((n, i) => (
              <g key={`node-${i}`} className={styles.meshNode}>
                <circle
                  cx={n.x} cy={n.y} r={5}
                  fill={STATUS_COLOR[n.status]}
                  className={`${styles.meshDot} ${
                    n.status === 'busy' ? styles.meshDotBusy : ''
                  } ${n.status === 'online' ? styles.meshDotLive : ''}`}
                />
                <text
                  x={n.x} y={n.y + 22}
                  textAnchor="middle"
                  className={styles.meshLabel}
                >
                  {n.label}
                </text>
              </g>
            ))}

            {/* Legend */}
            <g className={styles.meshLegend}>
              <circle cx="20" cy="305" r="3.5" fill="var(--clr-success)" />
              <text x="30" y="309" className={styles.meshLegendText}>online</text>
              <circle cx="95" cy="305" r="3.5" fill="var(--clr-warning)" />
              <text x="105" y="309" className={styles.meshLegendText}>busy</text>
              <circle cx="155" cy="305" r="3.5" fill="var(--clr-text-3)" />
              <text x="165" y="309" className={styles.meshLegendText}>offline</text>
            </g>
          </svg>
        </div>
      </section>

      {/* ── Features (spec-sheet panel) ────────────────────────── */}
      <section className={styles.features}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>// SPEC</span>
          <h2 className={styles.sectionTitle}>What Quorum does</h2>
        </div>

        <div className={styles.specPanel}>
          <div className={styles.specRow}>
            <div className={styles.specLabel}>EVALUATION</div>
            <div className={styles.specBody}>
              A submission is compiled and run on whichever nodes are idle
              in the lab. The results stream back as soon as the slowest
              worker finishes — there is no central sandbox and no batch job.
            </div>
          </div>

          <div className={styles.specRow}>
            <div className={styles.specLabel}>MONITORING</div>
            <div className={styles.specBody}>
              Each node reports its CPU, memory, and current task over
              mDNS. The console shows load, queue depth, and which
              machine is running which submission.
            </div>
          </div>

          <div className={styles.specRow}>
            <div className={styles.specLabel}>PROCESSING</div>
            <div className={styles.specBody}>
              Test cases run in parallel. A submission's status moves
              from <span className={styles.mono}>queued</span> to{' '}
              <span className={styles.mono}>running</span> to{' '}
              <span className={styles.mono}>scored</span> with live updates —
              no polling, no manual refresh.
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works (horizontal dataflow strip) ───────────── */}
      <section className={styles.howItWorks}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>// PIPELINE</span>
          <h2 className={styles.sectionTitle}>From keystroke to score</h2>
        </div>

        <div className={styles.dataflow}>
          <div className={styles.flowStep}>
            <span className={styles.flowTag}>STEP 01</span>
            <h3 className={styles.flowTitle}>Submit</h3>
            <p className={styles.flowDesc}>
              A student writes a solution in the in-browser IDE and hits
              run. The submission is queued locally.
            </p>
          </div>

          <span className={styles.flowConnector} aria-hidden />

          <div className={styles.flowStep}>
            <span className={styles.flowTag}>STEP 02</span>
            <h3 className={styles.flowTitle}>Distribute</h3>
            <p className={styles.flowDesc}>
              The backend picks the idle nodes in the room and pushes
              the test cases to each one in parallel.
            </p>
          </div>

          <span className={styles.flowConnector} aria-hidden />

          <div className={styles.flowStep}>
            <span className={styles.flowTag}>STEP 03</span>
            <h3 className={styles.flowTitle}>Score</h3>
            <p className={styles.flowDesc}>
              Each node returns its verdict as it finishes. The console
              folds them into a single result with per-case detail.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogoRow}>
              <div className={styles.footerLogoIcon}>
                <img src="/logo192.png" alt="Quorum logo" />
              </div>
              <img src="/logo.png" alt="Quorum" className={styles.footerLogoText} />
            </div>
            <p className={styles.footerTagline}>
              Build, Run and Grade.
            </p>
          </div>

          <div className={styles.footerCols}>
            <div className={styles.footerCol}>
              <div className={styles.footerColHead}>Project</div>
              <a className={styles.footerLink} href="/nodes">Node Connections</a>
              <a className={styles.footerLink} href="/login">Sign In</a>
              <a className={styles.footerLink} href="#features">What Quorum does</a>
              <a className={styles.footerLink} href="#pipeline">Pipeline</a>
            </div>

            <div className={styles.footerCol}>
              <div className={styles.footerColHead}>Resources</div>
              <a className={styles.footerLink} href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a>
              <a className={styles.footerLink} href="#" onClick={(e) => e.preventDefault()}>Documentation</a>
              <a className={styles.footerLink} href="#" onClick={(e) => e.preventDefault()}>Changelog</a>
              <a className={styles.footerLink} href="#" onClick={(e) => e.preventDefault()}>Support</a>
            </div>

            <div className={styles.footerCol}>
              <div className={styles.footerColHead}>Social</div>
              <div className={styles.footerSocials}>
                <a className={styles.socialIcon} href="https://github.com/" target="_blank" rel="noreferrer" aria-label="GitHub">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 .5C5.7.5.6 5.6.6 11.9c0 5 3.3 9.3 7.8 10.8.6.1.8-.2.8-.6v-2.2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2.9-.3 1.9-.4 2.9-.4s2 .1 2.9.4c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.8C23.4 5.6 18.3.5 12 .5z"/></svg>
                </a>
                <a className={styles.socialIcon} href="#" onClick={(e) => e.preventDefault()} aria-label="X / Twitter">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2H21l-6.52 7.45L22 22h-6.828l-4.79-6.26L4.8 22H2l7-7.99L2 2h6.914l4.33 5.74L18.244 2zm-1.196 18h1.518L7.05 4H5.43l11.618 16z"/></svg>
                </a>
                <a className={styles.socialIcon} href="#" onClick={(e) => e.preventDefault()} aria-label="LinkedIn">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.13 1.45-2.13 2.93v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z"/></svg>
                </a>
                <a className={styles.socialIcon} href="#" onClick={(e) => e.preventDefault()} aria-label="Email">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
                </a>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span className={styles.footerMono}>$ quorum --version</span>
            <span className={styles.footerCopy}>© 2026 Quorum · All rights reserved</span>
            <a className={styles.footerLinkInline} href="#" onClick={(e) => e.preventDefault()}>Manage Cookie Preferences</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
