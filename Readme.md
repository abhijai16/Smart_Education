# Smart Education — ProctorX Assignment System

A proctored coding-exam platform for college CS labs. Three pieces run side-by-side:

- **Centralized Database Server** (`Centralized_Database/`, Django + PostgreSQL) — source of truth for users, tests, results, and plagiarism. Advertises itself on the LAN via mDNS.

- **Worker Node** (`Backend/System_Management/`, Django + SQLite) — runs on each student machine. Receives code submissions, executes them in a subprocess sandbox, distributes work to peer nodes using a Power-of-Two-Choices load-aware scheduler, caches problems/tests offline, and queues results for sync when the Central DB is down.

- **React Frontend** (`Frontend/system_interface/`) — Monaco editor, Monaco-based code runner, exam timer, dashboards for students and teachers.

A **Lockdown Daemon** (`lockdown_daemon.py`) drops outbound traffic on student machines during the exam window by polling the Central DB's schedule and installing `iptables` / Windows Firewall rules. An **Auto-updater** (`auto_updater.py`) does `git reset --hard origin/main && pip install && npm install` on every boot.

Plagiarism runs in two passes: a fast 5-gram SHA-256 / Jaccard comparison on submit, and a Gemini LLM semantic re-check on students who escaped the n-gram pass — fired by `central_db_daemon.py` after the lockdown window ends.


## Setup on any PC

1. **Clone the repo**

   ```bash
   git clone https://github.com/abhijai16/Smart_Education
   cd Smart_Education
   ```

2. **Install PostgreSQL and create the database**

   Ubuntu:

   ```bash
   sudo apt-get install -y postgresql
   sudo -u postgres psql -c "CREATE DATABASE assignment_system;"
   sudo -u postgres psql -c "CREATE USER youruser WITH PASSWORD 'yourpassword';"
   ```

   On Windows/macOS, install PostgreSQL via the official installer or `brew install postgresql`, then run the same two SQL statements in pgAdmin/psql.

3. **Configure `.env`**

   ```bash
   cp .env.example .env
   ```

   Fill in `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, a fresh `SECRET_KEY` (run `python -c "import secrets; print(secrets.token_urlsafe(50))"`), Gmail SMTP credentials (use a Gmail **App Password**), and optionally `GEMINI_API_KEY` for AI test-case generation and LLM plagiarism.

4. **Install Python dependencies**

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate            # Windows: .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

5. **Apply migrations and create a superuser**

   ```bash
   cd Centralized_Database
   python manage.py migrate
   python manage.py createsuperuser
   cd ..
   ```

   The superuser is auto-promoted to `role='teacher'` by the custom `User.save()`, so it can log in to the teacher UI immediately. Username (not email) is the login.

6. **Install frontend dependencies**

   ```bash
   cd Frontend/system_interface && npm install && cd ../..
   ```

7. **(Recommended) Install the lockdown daemon**

   - Linux: `sudo ./install_daemon.sh` — registers a systemd unit.
   - Windows (admin): `install_daemon.bat` — creates scheduled tasks.

   Or run `sudo ./setup.sh` / `setup.bat` (admin) to do steps 1–7 automatically and add a desktop shortcut.

---

## Running

Open three terminals from the repo root (with `.venv` activated on the first two).

**Terminal 1 — Centralized Database Server** (teacher's machine):

```bash
python cli.py --db_server --port 8000
```

This boots Django on `0.0.0.0:8000` and spawns `central_db_daemon.py` alongside it for the post-exam plagiarism + email pipeline.

**Terminal 2 — Worker Node + React frontend** (student or teacher machine):

```bash
python cli.py --assignment --port 8001
```

This writes `REACT_APP_NODE_PORT=8001` into the React `.env`, starts Django on `0.0.0.0:8001`, and starts `npm start` (React on **http://localhost:3000**).

For a **headless** worker (no React — typical on diskless lab machines):

```bash
python cli.py --worker_only --port 8001
```

Press **Ctrl+C** to shut down cleanly. To stop background processes later, run `python stop_servers.py` (kills ports 8000/3000) or `sudo ./stop_system.sh` / `stop_system.bat` (also stops the lockdown daemon).

**Browser:** open **http://localhost:3000**, sign in with the superuser, then add more users (students are added by roll number, which becomes both username and default password). Bulk-upload students via `.xlsx`/`.csv` matching `test_students.csv` (`Name, Roll Number, Department`).

---

## Windows-only setup (step by step)

This is the full path on a fresh Windows 10/11 PC, in order. The generic "Setup on any PC" section above is the cross-platform version; this one spells out every click.

1. Install Python 3.10

2. Install Node.js 18 LTS

3. Install PostgreSQL 15
   - After install, open **pgAdmin 4** (installed alongside) or run `psql` from the Start menu, then:

     ```sql
     CREATE DATABASE assignment_system;
     CREATE USER youruser WITH PASSWORD 'yourpassword';
     GRANT ALL PRIVILEGES ON DATABASE assignment_system TO youruser;
     ```

4. **Install Git for Windows**

5. **Clone the repo**

   ```powershell
   git clone https://github.com/abhijai16/Smart_Education
   cd Smart_Education
   ```

6. **Create `.env`** at the repo root (copy `.env.example` and edit):

   ```powershell
   copy .env.example .env
   notepad .env
   ```

   Fill in:
   - `SECRET_KEY` — generate with `python -c "import secrets; print(secrets.token_urlsafe(50))"`
   - `DB_NAME=assignment_system`, `DB_USER=youruser`, `DB_PASSWORD=yourpassword`, `DB_HOST=localhost`, `DB_PORT=5432`
   - `EMAIL_HOST_USER` + `EMAIL_HOST_PASSWORD` — Gmail + an **App Password** (Google Account → Security → 2-Step Verification → App passwords)
   - Optional `GEMINI_API_KEY` for AI test-case generation and LLM plagiarism

7. **Run the automated setup** (this does steps 7–10 from the generic list in one shot):

   - Right-click **`setup.bat`** → **Run as Administrator**.
   - It will: create `.venv`, install Python deps, run `npm install`, install the lockdown daemon as a Windows scheduled task, and drop a "Start Assignment System" shortcut on your Desktop.
   - If it complains about Python not found, restart PowerShell (or your PC) so the PATH update from step 1 takes effect, then retry.

   If you'd rather do it manually instead of using `setup.bat`:

   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   cd Centralized_Database
   python manage.py migrate
   python manage.py createsuperuser
   cd ..
   cd Frontend\system_interface
   npm install
   cd ..\..
   ```

8. **Install the lockdown daemon** (only needed on student machines; teacher PCs can skip):

   ```powershell
   # Right-click → Run as Administrator
   install_daemon.bat
   ```

   This creates two scheduled tasks — `ExamLockdownDaemon` (runs on system start) and `AssignmentSystemUpdater` (runs on logon). Verify with `schtasks /query /tn ExamLockdownDaemon`. To undo: `stop_daemon.bat` (as Administrator).

9. **Start the system.** Two options:

   - **Easy way (single machine demo):** double-click the **"Start Assignment System"** shortcut on the Desktop. A small splash window appears, runs the auto-updater, then opens the browser at `http://localhost:3000`.

   - **Manual way (lab / multi-machine):** open two PowerShell windows from the repo root with `.venv` activated:
     ```powershell
     # Window 1 — Centralized Database Server (teacher's PC)
     python cli.py --db_server --port 8000

     # Window 2 — Worker Node + React (student or teacher PC)
     python cli.py --assignment --port 8001
     ```
     React runs on `http://localhost:3000`, the Worker Node on `http://localhost:8001`, the Central DB on `http://localhost:8000`.

10. **Log in.** Open `http://localhost:3000`, click **Sign In**, log in with the Django **username** (not email) and password you set in `createsuperuser`. This account has `role='teacher'` automatically.

11. **Add users.** From the teacher dashboard: **Add User** to create more teachers / students (a student's roll number becomes both username and default password), or **Bulk Upload** a `.xlsx`/`.csv` with columns `Name, Roll Number, Department` (see `test_students.csv` for the exact format).

12. **Run an exam.** Create a test, add questions with visible + hidden test cases (or use the AI test-case generator), toggle it live, then post a `LockdownSchedule` with start/end times. On every student machine, the lockdown daemon will block outbound traffic during that window automatically.

13. **Stop everything when done.**

   ```powershell
   # Stops ports 8000 / 3000
   python stop_servers.py

   # Or, right-click → Run as Administrator:
   stop_system.bat        # also stops the lockdown daemon + scheduled task
   ```