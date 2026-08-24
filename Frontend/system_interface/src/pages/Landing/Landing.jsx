import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Landing.module.css';
import { centralRequest } from '../../services/api';
import Icon from '../../components/common/Icon';

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
    <div style={{ background: 'var(--clr-bg)', minHeight: '100vh' }}>
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className={styles.navbar}>
        <div className={styles.navLogo}>
          <div className={styles.navLogoIcon}><Icon name="bolt" size={14} /></div>
          <span className={styles.navLogoText}>Quorum</span>
        </div>
        <div className={styles.navActions}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/nodes')}>
            Nodes
          </button>
          <button
            className="btn btn-sm"
            onClick={handleExit}
            style={{ backgroundColor: 'rgba(224,108,117,0.10)', color: 'var(--clr-error)', border: '1px solid rgba(224,108,117,0.25)' }}
          >
            Exit System
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
            Sign In
            <Icon name="arrowRight" size={12} />
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className={`${styles.hero} aurora-bg`}>
        <div className="grain" aria-hidden />

        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Distributed Code Evaluation Platform
          </div>
          <h1 className={styles.heroTitle}>
            Built for code that<br />
            <span className={styles.gradientText}>runs at scale.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            A distributed, real-time code evaluation platform for modern education.
            Submit code, track execution across nodes, and get results instantly.
          </p>
          <div className={styles.heroActions}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
              Get Started
              <Icon name="arrowRight" size={14} />
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => navigate('/nodes')}>
              View Connected Nodes
            </button>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <Icon name="bolt" size={14} />
              <span><strong>4+</strong> Languages</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <Icon name="refresh" size={14} />
              <span><strong>Real-time</strong> Evaluation</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <Icon name="server" size={14} />
              <span><strong>Distributed</strong> Nodes</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Powerful features for modern education</h2>
        <p className={styles.sectionSubtitle}>
          Everything you need to run a distributed code evaluation system
        </p>
        <div className={styles.featuresGrid}>
          {[
            {
              icon: 'bolt',
              title: 'Distributed Evaluation',
              desc: 'Submit code and have it evaluated across multiple computing nodes for fast, parallel processing.',
            },
            {
              icon: 'server',
              title: 'Node Monitoring',
              desc: 'Real-time visibility into connected computing nodes — load, CPU, memory, and worker status at a glance.',
            },
            {
              icon: 'clock',
              title: 'Real-Time Processing',
              desc: 'Track submission status in real time — from queued to running to completed — with live updates.',
            },
          ].map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Icon name={f.icon} size={18} />
              </div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <p className={styles.sectionSubtitle}>Three simple steps to evaluate code at scale</p>
        <div className={styles.stepsRow}>
          {[
            { n: '1', title: 'Submit Code', desc: 'Students select a problem, write their solution, and submit to the system.' },
            { n: '2', title: 'Distribute Tasks', desc: 'The backend distributes the task across available computing nodes for parallel execution.' },
            { n: '3', title: 'Get Results', desc: 'Results are returned in real time with detailed feedback on test cases.' },
          ].map((s) => (
            <div key={s.n} className={styles.step}>
              <div className={styles.stepNumber}>{s.n}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className={styles.footer}>
        &copy; personal project 2026 Quorum
      </footer>
    </div>
  );
};

export default Landing;
