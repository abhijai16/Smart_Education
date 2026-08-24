import logging

from api_management.services.sandbox import (
    LANG_CONFIG,
    DEFAULT_TIME_LIMIT_MS,
    DEFAULT_MEMORY_LIMIT_MB,
    run_subprocess,
)

logger = logging.getLogger(__name__)


def run_local_code(language: str, code: str, input_data: str, time_limit_ms: int) -> dict:
    """
    Compile and run a single test case. Returns stdout, stderr, and status.

    Thin wrapper around sandbox.run_subprocess preserved for backwards
    compatibility — keeps the local-run endpoint (`LocalRunView`) unchanged.
    """
    result = run_subprocess(
        language=language,
        code=code,
        input_data=input_data,
        time_limit_ms=time_limit_ms,
        memory_limit_mb=DEFAULT_MEMORY_LIMIT_MB,
    )
    # Normalize to the shape LocalRunView consumers expect
    return {
        'status': result['status'],
        'stdout': result['stdout'],
        'stderr': result['stderr'],
    }


def execute_code_locally(payload: dict) -> dict:
    """
    Main entry point for LocalRunView. Iterates through visible test cases.
    """
    language = payload.get('language', 'python')
    code = payload.get('code', '')
    test_cases = payload.get('test_cases', [])
    time_limit_ms = int(payload.get('time_limit_ms', DEFAULT_TIME_LIMIT_MS))

    results = []
    passed_count = 0

    for i, case in enumerate(test_cases):
        input_data = str(case.get('input_data', ''))
        expected = str(case.get('expected_output', '')).replace('\r\n', '\n').strip()

        # Run the code via the shared sandbox
        exec_result = run_local_code(language, code, input_data, time_limit_ms)
        actual = exec_result['stdout'].replace('\r\n', '\n').strip()

        # Determine if test passed
        passed = (exec_result['status'] == 'success' and actual == expected)

        case_status = exec_result['status']
        if case_status == 'success':
            case_status = 'accepted' if passed else 'wrong_answer'

        if passed:
            passed_count += 1

        results.append({
            'test_case_order': i + 1,
            'passed': passed,
            'status': case_status,
            'stdout': exec_result['stdout'],
            'stderr': exec_result['stderr'],
            'expected_output': expected,
            'actual_output': actual,
        })

    return {
        'status': 'completed',
        'passed_count': passed_count,
        'total_count': len(test_cases),
        'results': results,
    }
