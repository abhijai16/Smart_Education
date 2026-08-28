import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTestById, getAllTests } from '../../services/testService';
import Icon from '../common/Icon';
import styles from './Sidebar.module.css';

const TEACHER_NAV = [
  { to: '/teacher',          icon: 'dashboard',    label: 'Dashboard',           exact: true },
  { to: '/teacher/tests',    icon: 'assignments',  label: 'Tests' },
  { to: '/teacher/create-test', icon: 'submissions', label: 'Create Test' },
  { to: '/teacher/results',  icon: 'analytics',    label: 'Student Results' },
  { to: '/teacher/flagged',  icon: 'eye',          label: 'Flagged Submissions' },
  { to: '/teacher/analytics', icon: 'analytics',   label: 'Analytics' },
  { to: '/teacher/nodes',    icon: 'server',       label: 'Node Connections' },
  { to: '/teacher/add-user', icon: 'assignments',  label: 'Add User' },
  { to: '/teacher/code-review', icon: 'submissions', label: 'Code Review' },
];

const STUDENT_NAV = [
  { to: '/student',         icon: 'dashboard',   label: 'Dashboard',        exact: true },
  { to: '/student/tests',   icon: 'assignments', label: 'Test Questions' },
  { to: '/student/tasks',   icon: 'submissions', label: 'Task Status' },
  { to: '/student/results', icon: 'analytics',   label: 'My Results' },
  { to: '/student/nodes',   icon: 'server',      label: 'Node Connections' },
];

const Sidebar = ({ role, isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = role === 'teacher' ? TEACHER_NAV : STUDENT_NAV;
  const examActive = localStorage.getItem('exam_active') === 'true';
  const [activeTest, setActiveTest] = useState(null);

  useEffect(() => {
    if (role === 'student' && examActive) {
      const testId = localStorage.getItem('exam_test_id');
      if (testId) {
        getTestById(testId)
          .then((test) => {
            if (test) setActiveTest(test);
          })
          .catch((err) => console.error("Failed to fetch test for sidebar", err));
      } else {
        getAllTests()
          .then((tests) => {
            if (tests && tests.length > 0) setActiveTest(tests[0]);
          })
          .catch((err) => console.error("Failed to fetch test for sidebar", err));
      }
    }
  }, [role, examActive]);

  const handleLogout = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (examActive) {
      if (!window.confirm("A test is currently active. Logging out will auto-submit your test and current code. Do you wish to proceed?")) {
        return;
      }

      window.dispatchEvent(new Event('exam-force-submit'));
      await new Promise(r => setTimeout(r, 1000));

      try {
        const testId = localStorage.getItem('exam_test_id');
        if (testId) {
          const { submitTest } = await import('../../services/testService');
          await submitTest(testId);
        }
      } catch (err) {
        console.error("Failed to auto-submit test during logout:", err);
      }

      localStorage.removeItem('exam_active');
      localStorage.removeItem('exam_duration');
      localStorage.removeItem('exam_end_time');
      localStorage.removeItem('exam_test_id');
    }
    logout();
    navigate('/login');
  };

  return (
    <>
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <img src="/logo192.png" alt="Quorum logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div className={styles.brandName}>ProctorX</div>
            <div className={styles.brandSub}>Eval Platform</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSection}>
            {role === 'teacher' ? 'Teacher' : 'Student'}
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
              onClick={() => {
                if (window.innerWidth < 900) onClose?.();
              }}
            >
              <span className={styles.navIcon}><Icon name={item.icon} size={15} /></span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          {role === 'student' && examActive && (
            <div style={{ marginTop: '20px' }}>
              <div className={styles.navSection} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={styles.liveDot} />
                Live Test
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: 'calc(100% - 16px)', margin: '0 8px 12px', display: 'inline-flex', justifyContent: 'center', gap: 6 }}
                onClick={() => {
                  navigate('/student/tests');
                  if (window.innerWidth < 900) onClose?.();
                }}
              >
                Go to Test
                <Icon name="arrowRight" size={12} />
              </button>
              {activeTest?.questions && activeTest.questions.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '0 8px' }}>
                  {activeTest.questions.map((q, idx) => (
                    <NavLink
                      key={q.id}
                      to={`/student/tests/question/${q.id}`}
                      className={({ isActive }) =>
                        isActive
                          ? `${styles.questionBubble} ${styles.questionBubbleActive}`
                          : styles.questionBubble
                      }
                      onClick={() => {
                        if (window.innerWidth < 900) onClose?.();
                      }}
                    >
                      Q{idx + 1}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className={styles.footer}>
          <div className={styles.userCard}>
            <div className={styles.userAvatar}>
              {(user?.username || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className={styles.userName}>{user?.username || 'User'}</div>
              <div className={styles.userRole}>{user?.role || 'unknown'}</div>
            </div>
          </div>
          <button className={`btn btn-ghost ${styles.logoutBtn}`} onClick={handleLogout}>
            <Icon name="signIn" size={13} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
