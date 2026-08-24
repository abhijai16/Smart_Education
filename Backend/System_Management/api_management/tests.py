"""
Tests for the api_management app.

These tests focus on the *unit boundaries* of the demo-critical paths
so that they can run without a live Central DB, worker peers, or React
frontend. They use Django's built-in TestCase and the default SQLite
test database.

What this covers:
  - LocalRunTests       — sandbox correctness (hello world, TLE, MLE,
                          wrong answer, unsupported language, env scrub)
  - SandboxImportTests  — guards the sandbox module refactor
  - PlagiarismPipelineTests — verifies the plagiarism dispatcher no-ops
                          when the Central DB is not yet discovered
  - HealthTests         — heartbeat and load endpoints respond

What this does NOT cover (would need integration setup):
  - submit_task full P2P round-trip (requires two worker nodes)
  - node_info mDNS discovery (requires a multicast-capable interface)
  - Central DB JWT login (separate app, well-covered by simplejwt)
"""

from unittest import mock

from django.test import TestCase

from api_management.services import sandbox
from api_management.services.handle_local_run import execute_code_locally
from api_management.services.plagiarism_pipeline import trigger_plagiarism_pipeline


# ── LocalRunTests ─────────────────────────────────────────────────────

class LocalRunTests(TestCase):
    """End-to-end through `execute_code_locally` so we exercise the
    public API the React frontend actually calls."""

    def _run(self, code, test_cases, language='python', time_limit_ms=2000):
        return execute_code_locally({
            'language': language,
            'code': code,
            'test_cases': test_cases,
            'time_limit_ms': time_limit_ms,
        })

    def test_python_hello_world_passes(self):
        result = self._run(
            'print("hello")',
            [{'input_data': '', 'expected_output': 'hello'}],
        )
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['passed_count'], 1)
        self.assertEqual(result['total_count'], 1)
        self.assertEqual(result['results'][0]['status'], 'accepted')

    def test_python_wrong_answer_when_output_mismatches(self):
        result = self._run(
            'print("hello")',
            [{'input_data': '', 'expected_output': 'goodbye'}],
        )
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['passed_count'], 0)
        self.assertEqual(result['results'][0]['status'], 'wrong_answer')

    def test_python_infinite_loop_killed_by_timeout(self):
        result = self._run(
            'while True: pass',
            [{'input_data': '', 'expected_output': ''}],
            time_limit_ms=500,
        )
        self.assertEqual(result['results'][0]['status'], 'time_limit_exceeded')

    def test_python_memory_bomb_killed_by_mle(self):
        # Allocating 512MB under a 128MB cap must fail with MemoryError;
        # the sandbox classifies that as memory_limit_exceeded.
        result = self._run(
            'x = bytearray(2**29); import time; time.sleep(60)',
            [{'input_data': '', 'expected_output': ''}],
            time_limit_ms=2000,
        )
        self.assertEqual(result['results'][0]['status'], 'memory_limit_exceeded')

    def test_unsupported_language_returns_error_status(self):
        result = self._run(
            '+',
            [{'input_data': '', 'expected_output': ''}],
            language='brainfuck',
        )
        # execute_code_locally falls through to the unsupported branch
        self.assertEqual(result['results'][0]['status'], 'unsupported_language')

    def test_env_vars_do_not_leak_into_child(self):
        # The parent process has SECRET_KEY set in settings; the child
        # process must NOT see it (sandbox builds a minimal env).
        code = (
            'import os, json\n'
            'print(json.dumps(sorted(os.environ.keys())))\n'
        )
        result = self._run(
            code,
            [{'input_data': '', 'expected_output': 'irrelevant'}],
        )
        env_keys = result['results'][0]['stdout']
        # These MUST NOT be present in the child env
        for forbidden in (
            'SECRET_KEY', 'GEMINI_API_KEY', 'EMAIL_HOST_PASSWORD',
            'DB_PASSWORD', 'DATABASE_URL',
        ):
            self.assertNotIn(forbidden, env_keys, f'{forbidden} leaked into child env')
        # These MUST be present (minimal env)
        for required in ('PATH', 'LANG', 'HOME', 'TMPDIR'):
            self.assertIn(required, env_keys, f'{required} missing from child env')


# ── SandboxImportTests ────────────────────────────────────────────────

class SandboxImportTests(TestCase):
    """Guards the Phase A refactor: the sandbox module exists, exposes
    the expected names, and apply_resource_limits is a no-op on Windows
    (or applies RLIMIT_* on POSIX without raising)."""

    def test_sandbox_module_exports_required_names(self):
        for name in ('LANG_CONFIG', 'run_subprocess', 'build_minimal_env',
                     'apply_resource_limits', 'prepare_source'):
            self.assertTrue(
                hasattr(sandbox, name),
                f'sandbox module missing export: {name}',
            )

    def test_lang_config_has_expected_languages(self):
        for lang in ('python', 'cpp', 'java', 'javascript', 'c'):
            self.assertIn(lang, sandbox.LANG_CONFIG)

    def test_apply_resource_limits_does_not_raise(self):
        # POSIX applies RLIMIT_*; Windows is a no-op. Either way, no exception.
        try:
            sandbox.apply_resource_limits(
                memory_mb=128, cpu_seconds=5, file_size_mb=16,
            )
        except Exception as exc:
            self.fail(f'apply_resource_limits raised: {exc!r}')

    def test_build_minimal_env_excludes_secrets(self):
        env = sandbox.build_minimal_env(tmpdir='/tmp/foo', language='python')
        for forbidden in ('SECRET_KEY', 'GEMINI_API_KEY', 'EMAIL_HOST_PASSWORD'):
            self.assertNotIn(forbidden, env)
        # Required keys present
        for required in ('PATH', 'LANG', 'HOME', 'TMPDIR'):
            self.assertIn(required, env)


# ── PlagiarismPipelineTests ──────────────────────────────────────────

class PlagiarismPipelineTests(TestCase):
    """The plagiarism dispatcher is fire-and-forget. When the Central
    DB has not been discovered yet, it must silently no-op (no exception,
    no network call)."""

    def test_silently_no_op_when_db_not_discovered(self):
        # Patch the sender runtime to report no DB
        with mock.patch(
            'api_management.services.plagiarism_pipeline.sender_runtime'
        ) as fake_runtime:
            fake_runtime.database_server = None
            # Also patch urlopen to ensure it is NEVER called
            with mock.patch(
                'api_management.services.plagiarism_pipeline.urllib.request.urlopen'
            ) as fake_urlopen:
                # Must not raise even though no DB is configured
                trigger_plagiarism_pipeline(
                    roll_number='21CS001',
                    question_id='42',
                    language='python',
                    code='print("hi")',
                )
                fake_urlopen.assert_not_called()

    def test_does_not_raise_on_network_error(self):
        # If the DB is discovered but the HTTP call fails, the daemon
        # thread MUST swallow the exception (pipeline never crashes node).
        fake_db = {'ip': '127.0.0.1', 'port': 8000}
        with mock.patch(
            'api_management.services.plagiarism_pipeline.sender_runtime'
        ) as fake_runtime:
            fake_runtime.database_server = fake_db
            with mock.patch(
                'api_management.services.plagiarism_pipeline.urllib.request.urlopen',
                side_effect=Exception('boom'),
            ):
                # Must not raise
                trigger_plagiarism_pipeline(
                    roll_number='21CS001',
                    question_id='42',
                    language='python',
                    code='print("hi")',
                )


# ── HealthTests ──────────────────────────────────────────────────────

class HealthTests(TestCase):
    """Smoke tests for the no-DB-needed endpoints."""

    def test_heartbeat_returns_ok(self):
        response = self.client.post('/api/heartbeat/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_get_load_returns_score(self):
        response = self.client.get('/api/get-load/')
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body.get('status'), 'success')
        self.assertIn('current_load_score', body)
        # Score is a float in (0, 100]
        self.assertIsInstance(body['current_load_score'], (int, float))
        self.assertGreater(body['current_load_score'], 0)
        self.assertLessEqual(body['current_load_score'], 100)

    def test_node_info_returns_gateway_metadata(self):
        response = self.client.get('/api/node_info/')
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn('gateway', body)
        gw = body['gateway']
        self.assertIn('node_id', gw)
        self.assertIn('ip', gw)
        self.assertIn('port', gw)
