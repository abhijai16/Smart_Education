"""
Receiver_Server/worker.py
Code execution worker — runs submitted code in a sandboxed subprocess.
Supports Python, C++, Java, JavaScript.
Sends result callback to origin Django node.

The actual subprocess + sandbox plumbing lives in
api_management.services.sandbox.run_subprocess. This module keeps the
same public surface (run_code, evaluate_task, execute_task,
send_result_callback) so the rest of the codebase is untouched.
"""

import json
import logging
import os
import sys
import time
import traceback
import urllib.request
import urllib.error

from api_management.services.sandbox import (
    DEFAULT_TIME_LIMIT_MS,
    DEFAULT_MEMORY_LIMIT_MB,
    run_subprocess,
)

logger = logging.getLogger('receiver.worker')


def run_code(language: str, code: str, input_data: str,
             time_limit_ms: int = DEFAULT_TIME_LIMIT_MS,
             memory_limit_mb: int = DEFAULT_MEMORY_LIMIT_MB) -> dict:
    """Compile (if needed) and run one program against one stdin input.

    Returns a result dict with stdout, stderr, timing, memory, status,
    exit_code. Preserves the same shape as before — now powered by the
    shared sandbox module (cross-platform RLIMIT_* + env scrubbing).
    """
    return run_subprocess(
        language=language,
        code=code,
        input_data=input_data,
        time_limit_ms=time_limit_ms,
        memory_limit_mb=memory_limit_mb,
    )


def _priority(status: str) -> int:
    return {
        'compilation_error': 0, 'runtime_error': 1,
        'time_limit_exceeded': 2, 'memory_limit_exceeded': 3,
        'wrong_answer': 4, 'success': 5,
    }.get(status, 99)


def evaluate_task(task: dict) -> dict:
    """
    Run code against all test cases and aggregate results.
    Returns a payload suitable for POSTing to /result callback.
    """
    language = task.get('language', 'python')
    code = task.get('code', '')
    test_cases = []

    for case in task.get("test_cases", []):
        case["is_hidden"] = False
        test_cases.append(case)

    for case in task.get("hidden_test_cases", []):
        case["is_hidden"] = True
        test_cases.append(case)
    time_limit_ms = int(task.get('time_limit_ms') or DEFAULT_TIME_LIMIT_MS)
    memory_limit_mb = int(task.get('memory_limit_mb') or DEFAULT_MEMORY_LIMIT_MB)
    max_score = float(task.get('max_score') or 100)

    results = []
    statuses = []
    passed_count = 0
    earned_points = 0.0
    total_points = 0.0

    for i, case in enumerate(test_cases):
        result = run_code(language, code, str(case.get('input_data', '')),
                          time_limit_ms, memory_limit_mb)
        expected = str(case.get('expected_output', '')).replace('\r\n', '\n').strip()
        actual = result['stdout'].replace('\r\n', '\n').strip()
        passed = (
            result['status'] == 'success'
            and actual == expected
        )
        points = float(case.get('points') or 0)
        case_status = (
            result['status'] if result['status'] != 'success'
            else ('accepted' if passed else 'wrong_answer')
        )

        if passed:
            passed_count += 1
            earned_points += points
        total_points += points
        statuses.append(case_status)

        results.append({
            'test_case': case.get('id'),
            'test_case_order': case.get('order', i + 1),
            'is_hidden': bool(case.get('is_hidden', False)),
            'passed': passed,
            'status': case_status,
            'stdout': result['stdout'],
            'stderr': result['stderr'],
            'actual_output': actual,
            'exec_time_ms': result['exec_time_ms'],
            'memory_kb': round(result['memory_mb'] * 1024, 2),
        })

    if not statuses:
        final_status = 'failed'
    elif all(s == 'accepted' for s in statuses):
        final_status = 'accepted'
    elif any(s == 'compilation_error' for s in statuses):
        final_status = 'compilation_error'
    elif any(s == 'runtime_error' for s in statuses):
        final_status = 'runtime_error'
    elif any(s == 'time_limit_exceeded' for s in statuses):
        final_status = 'time_limit_exceeded'
    elif any(s == 'memory_limit_exceeded' for s in statuses):
        final_status = 'memory_limit_exceeded'
    elif any(s == 'wrong_answer' for s in statuses):
        final_status = 'wrong_answer'
    else:
        final_status = 'failed'

    score = round((earned_points / total_points * max_score) if total_points else 0, 2)
    total_execution_time = sum(
        tc['exec_time_ms']
        for tc in results
    )

    return {
        'task_id': task.get('task_id', ''),
        'roll_number': task.get('roll_number', ''),
        'question_id': task.get('question_id', ''),
        'language': language,
        'code': task.get('data', {}).get('code', ''),
        'status': final_status,
        'score': score,
        'passed_testcases': passed_count,
        'total_testcases': len(test_cases),
        'execution_time': round(total_execution_time / 1000, 3),
        'email': task.get('email', ''),
    }


def send_result_callback(task: dict, result: dict) -> bool:
    print("Callback result is called")
    from Services.Receiver_Server.runtime import runtime

    callback_ip = task.get("callback_ip")
    callback_port = task.get("callback_port", 8000)

    if not callback_ip:
        logger.warning("Callback IP missing")
        return False

    url = f"http://{callback_ip}:{callback_port}/api/task_result/"

    authorization = task.get("authorization", "")
    result["authorization"] = authorization
    payload = json.dumps(result).encode()

    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            success = 200 <= response.status < 300

        if success:
            logger.info(f"Result sent to {callback_ip}:{callback_port}")

        return success

    except urllib.error.HTTPError as e:
        logger.error(f"CALLBACK URL = {url}")
        logger.error(f"HTTP Error {e.code}: {e.reason}")
        return False

    except Exception as e:
        logger.error(f"CALLBACK URL = {url}")
        logger.error(f"EXCEPTION = {repr(e)}")
        traceback.print_exc()
        return False


def execute_task(task: dict) -> None:
    task_id = task.get('task_id', 'unknown')
    logger.info(f'Executing task {task_id} ({task.get("language")})')

    from Services.Receiver_Server.runtime import runtime

    runtime.worker_start()

    result = {
        'status': 'runtime_error',
        'passed_count': 0,
    }

    try:
        result = evaluate_task(task)
        send_result_callback(task, result)
    except Exception as e:
        logger.exception(f'Task {task_id} failed: {e}')
    finally:
        runtime.worker_done()
        runtime.complete_inflight()
        logger.info(
            f'Task {task_id} done: '
            f'{result.get("status")} '
            f'({result.get("passed_count", 0)}/'
            f'{len(task.get("test_cases", []))} passed)'
        )
