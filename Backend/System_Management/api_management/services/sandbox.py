"""
api_management/services/sandbox.py

Cross-platform subprocess sandbox helpers for student code execution.

Exports:
- LANG_CONFIG: per-language compile/run command templates
- MINIMAL_ENV:  scrubbed environment passed to children (no SECRET_KEY, no API keys)
- render_cmd:   substitute {file}/{binary}/{dir} placeholders
- prepare_source: write the user code into a temp file, applying "LeetCode magic" for python/js
- run_subprocess: actually execute with timeout, memory polling, CPU limit, stdin cap
- apply_resource_limits: best-effort POSIX RLIMIT_* setup for the child process

The two callers (handle_local_run.py for the practice "Run" button, and
Receiver_Server/worker.py for the P2P submission path) used to duplicate
this logic. They now import from here so behavior stays consistent.
"""

from __future__ import annotations

import os
import sys
import time
import signal
import shutil
import tempfile
import logging
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)


# ── Language profiles ──────────────────────────────────────────────────
# {file} = source path, {binary} = compiled output path, {dir} = temp dir

LANG_CONFIG = {
    'python': {
        'extension': '.py',
        'compile': None,
        'run': [sys.executable, '{file}'],
    },
    'cpp': {
        'extension': '.cpp',
        'compile': ['g++', '-O2', '-std=c++17', '-o', '{binary}', '{file}', '-lm'],
        'run': ['{binary}'],
    },
    'java': {
        'extension': '.java',
        'compile': ['javac', '{file}'],
        'run': ['java', '-cp', '{dir}', 'Main'],
    },
    'javascript': {
        'extension': '.js',
        'compile': None,
        'run': ['node', '{file}'],
    },
    'c': {
        'extension': '.c',
        'compile': ['gcc', '-O2', '-o', '{binary}', '{file}', '-lm'],
        'run': ['{binary}'],
    },
}

DEFAULT_TIME_LIMIT_MS = 2000
DEFAULT_MEMORY_LIMIT_MB = 256
COMPILE_TIMEOUT = 10
DEFAULT_FILE_SIZE_MB = 64


# ── Minimal environment passed to children ─────────────────────────────
# Critical: NEVER inherit the parent process env. Student code must not see
# SECRET_KEY, GEMINI_API_KEY, EMAIL_HOST_PASSWORD, DB credentials, etc.
# Keep only what compilers and runtimes genuinely need.

def build_minimal_env(tmpdir: str, language: str) -> dict:
    env = {
        'PATH': os.environ.get('PATH', '/usr/local/bin:/usr/bin:/bin'),
        'LANG': 'C.UTF-8',
        'LC_ALL': 'C.UTF-8',
        'HOME': tmpdir,
        'TMPDIR': tmpdir,
        'TMP': tmpdir,
        'TEMP': tmpdir,
        # Required by some tooling
        'PYTHONDONTWRITEBYTECODE': '1',
        'PYTHONUNBUFFERED': '1',
    }
    # Language-specific additions (kept narrow on purpose)
    if language == 'java':
        # Honor an existing JAVA_HOME if the system already has one configured
        jh = os.environ.get('JAVA_HOME')
        if jh:
            env['JAVA_HOME'] = jh
        env['PATH'] = (
            (env['PATH'] + os.pathsep + os.path.join(jh, 'bin'))
            if jh else env['PATH']
        )
    if language == 'cpp' or language == 'c':
        # On Windows, compilers live alongside git's mingw or MSVC; if either
        # is on PATH in the parent, the child should see it too.
        pass
    return env


# ── Command templating ────────────────────────────────────────────────

def render_cmd(parts, source_path: str, binary_path: str, directory: str):
    return [
        p.replace('{file}', source_path)
         .replace('{binary}', binary_path)
         .replace('{dir}', directory)
        for p in parts
    ]


# ── Source preparation ────────────────────────────────────────────────

def prepare_source(language: str, code: str, directory: str) -> str:
    """Write user code into a temp file. Returns the source path.

    Applies the "LeetCode magic" auto-caller for python/javascript so that
    a `def solution()` style submission is invoked automatically and its
    return value is printed.
    """
    config = LANG_CONFIG.get(language)
    if config is None:
        raise ValueError(f'Unsupported language: {language}')

    # Auto-call `solution()` for Python/JS so students can `return` instead of `print`
    if language == 'python' and 'def solution' in code:
        auto_caller = (
            "\n\nif __name__ == '__main__':\n"
            "    res = solution()\n"
            "    if res is not None:\n"
            "        print(res)\n"
        )
        if not code.strip().endswith('solution()'):
            code += auto_caller

    elif language == 'javascript' and 'function solution' in code:
        auto_caller = (
            "\n\nconst __res = solution();\n"
            "if (__res !== undefined) { console.log(__res); }\n"
        )
        if 'solution();' not in code:
            code += auto_caller

    # Java must use the class name `Main` to match the run command below
    if language == 'java':
        code = code.replace('public class Solution', 'public class Main')
        path = os.path.join(directory, 'Main.java')
    else:
        path = os.path.join(directory, f'solution{config["extension"]}')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)

    return path


# ── POSIX resource limits (best-effort) ───────────────────────────────

def apply_resource_limits(memory_mb: int, cpu_seconds: int, file_size_mb: int) -> None:
    """Apply RLIMIT_* on POSIX. No-op on Windows.

    MUST be called in a child process between fork() and exec(), so we
    accept a preexec_fn-friendly function (no args). Limits raised cannot
    be lowered by the child — only inherited or capped by the parent.
    """
    if sys.platform == 'win32':
        return
    try:
        import resource
    except ImportError:
        return

    try:
        # Address-space cap. The kernel enforces this; the process is SIGKILLed
        # on overflow. Catches unbounded `bytearray()` / list-of-strings growth.
        resource.setrlimit(
            resource.RLIMIT_AS,
            (memory_mb * 1024 * 1024, memory_mb * 1024 * 1024),
        )
    except (ValueError, OSError) as exc:
        logger.debug('RLIMIT_AS not applied: %s', exc)

    try:
        # Soft CPU cap. When the child exceeds this, SIGXCPU is delivered.
        # The hard limit is one second higher so the child gets a chance to
        # clean up; if it doesn't, SIGKILL follows.
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
    except (ValueError, OSError) as exc:
        logger.debug('RLIMIT_CPU not applied: %s', exc)

    try:
        # Max file write size. Blocks accidental `dd` / `> huge.log` writes.
        resource.setrlimit(
            resource.RLIMIT_FSIZE,
            (file_size_mb * 1024 * 1024, file_size_mb * 1024 * 1024),
        )
    except (ValueError, OSError) as exc:
        logger.debug('RLIMIT_FSIZE not applied: %s', exc)


# ── Memory polling thread (Windows + fallback) ────────────────────────

def _memory_mb(pid: int) -> float:
    try:
        import psutil
        return psutil.Process(pid).memory_info().rss / (1024 * 1024)
    except Exception:
        return 0.0


def _kill_if_over_memory(proc: subprocess.Popen, memory_mb: int, poll_interval: float = 0.05) -> bool:
    """Returns True if the process was killed for exceeding memory."""
    try:
        import psutil  # noqa: F401
    except ImportError:
        # Without psutil we can't measure RSS cross-platform; fall back to OS limits only
        return False

    while proc.poll() is None:
        if _memory_mb(proc.pid) > memory_mb:
            try:
                proc.kill()
            except Exception:
                pass
            return True
        time.sleep(poll_interval)
    return False


# ── High-level: compile + run ─────────────────────────────────────────

def run_subprocess(
    language: str,
    code: str,
    input_data: str,
    time_limit_ms: int = DEFAULT_TIME_LIMIT_MS,
    memory_limit_mb: int = DEFAULT_MEMORY_LIMIT_MB,
    file_size_mb: int = DEFAULT_FILE_SIZE_MB,
) -> dict:
    """
    Compile (if needed) and run one program against one stdin input.

    Returns a dict with keys:
        status, stdout, stderr, exec_time_ms, memory_mb, exit_code

    `status` is one of:
        'success' | 'compilation_error' | 'runtime_error' |
        'time_limit_exceeded' | 'memory_limit_exceeded' | 'unsupported_language'
    """
    config = LANG_CONFIG.get(language)
    if not config:
        return {
            'status': 'unsupported_language',
            'stderr': f'Unsupported: {language}',
            'stdout': '', 'exec_time_ms': 0, 'memory_mb': 0, 'exit_code': -1,
        }

    timeout_s = min(max(time_limit_ms / 1000, 0.5), 30)
    cpu_seconds = int(timeout_s) + 1
    tmpdir = tempfile.mkdtemp(prefix='sandbox_')

    try:
        source = prepare_source(language, code, tmpdir)
        binary = os.path.join(
            tmpdir, 'solution' + ('.exe' if sys.platform == 'win32' else '')
        )

        # ── Compilation ─────────────────────────────────────────
        if config['compile']:
            cmd = render_cmd(config['compile'], source, binary, tmpdir)
            try:
                comp_res = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=COMPILE_TIMEOUT,
                    cwd=tmpdir,
                    env=build_minimal_env(tmpdir, language),
                )
                if comp_res.returncode != 0:
                    return {
                        'status': 'compilation_error',
                        'stderr': comp_res.stderr or comp_res.stdout,
                        'stdout': '', 'exec_time_ms': 0,
                        'memory_mb': 0, 'exit_code': comp_res.returncode,
                    }
            except subprocess.TimeoutExpired:
                return {
                    'status': 'compilation_error',
                    'stderr': 'Compilation timed out.',
                    'stdout': '', 'exec_time_ms': 0,
                    'memory_mb': 0, 'exit_code': -1,
                }
            except FileNotFoundError:
                return {
                    'status': 'compilation_error',
                    'stderr': f'Compiler not found for {language}.',
                    'stdout': '', 'exec_time_ms': 0,
                    'memory_mb': 0, 'exit_code': -1,
                }

        # ── Execution ───────────────────────────────────────────
        cmd = render_cmd(config['run'], source, binary, tmpdir)
        start = time.perf_counter()
        try:
            # Cap stdin so a malicious user can't pipe 10GB into our process
            capped_input = str(input_data)[: file_size_mb * 1024 * 1024]

            # On POSIX, apply RLIMIT_* inside the child before exec.
            # On Windows, preexec_fn is not supported, so we rely on psutil polling.
            popen_kwargs = dict(
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=tmpdir,
                text=True,
                env=build_minimal_env(tmpdir, language),
            )
            if sys.platform != 'win32':
                popen_kwargs['preexec_fn'] = lambda: apply_resource_limits(
                    memory_limit_mb, cpu_seconds, file_size_mb,
                )

            proc = subprocess.Popen(cmd, **popen_kwargs)

            # On Windows / when RLIMIT_* is unavailable, poll memory and kill
            # the child if it overruns. This is best-effort — there is a
            # 50ms polling window where it can briefly exceed the cap.
            if sys.platform == 'win32':
                # Run memory poll in a background thread; signal via flag
                from threading import Thread
                killed_oom = {'flag': False}
                def poll():
                    if _kill_if_over_memory(proc, memory_limit_mb):
                        killed_oom['flag'] = True
                Thread(target=poll, daemon=True).start()
            else:
                killed_oom = {'flag': False}

            try:
                stdout, stderr = proc.communicate(
                    input=capped_input, timeout=timeout_s,
                )
                exit_code = proc.returncode
                peak_mem = _memory_mb(proc.pid)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate()
                return {
                    'status': 'time_limit_exceeded',
                    'stderr': 'Time Limit Exceeded.',
                    'stdout': '',
                    'exec_time_ms': round(timeout_s * 1000, 2),
                    'memory_mb': 0, 'exit_code': -1,
                }
        except FileNotFoundError:
            return {
                'status': 'runtime_error',
                'stderr': f'Runtime not found for {language}.',
                'stdout': '', 'exec_time_ms': 0,
                'memory_mb': 0, 'exit_code': -1,
            }

        elapsed_ms = (time.perf_counter() - start) * 1000

        # Order matters: MLE wins over TLE wins over runtime error
        # Detect MLE in three ways:
        #   1. The Windows memory-poller killed the child
        #   2. peak_mem (post-mortem RSS) exceeds the cap
        #   3. POSIX RLIMIT_AS killed the child (SIGKILL with no peak sample) —
        #      Python turns this into MemoryError on stderr in many cases,
        #      but the exit code alone isn't reliable, so we also peek at stderr.
        mle_in_stderr = (
            'MemoryError' in (stderr or '')
            or 'Cannot allocate memory' in (stderr or '')
        )
        if (
            killed_oom.get('flag')
            or peak_mem > memory_limit_mb
            or (exit_code == -signal.SIGKILL and sys.platform != 'win32')
            or mle_in_stderr
        ):
            status = 'memory_limit_exceeded'
        elif exit_code != 0:
            status = 'runtime_error'
        elif elapsed_ms > time_limit_ms:
            status = 'time_limit_exceeded'
        else:
            status = 'success'

        return {
            'status': status,
            'stdout': (stdout or '').strip(),
            'stderr': (stderr or '').strip(),
            'exec_time_ms': round(elapsed_ms, 2),
            'memory_mb': round(peak_mem, 2),
            'exit_code': exit_code,
        }

    except Exception as e:
        logger.exception('Sandbox execution error: %s', e)
        return {
            'status': 'runtime_error',
            'stderr': str(e),
            'stdout': '', 'exec_time_ms': 0,
            'memory_mb': 0, 'exit_code': -1,
        }
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
