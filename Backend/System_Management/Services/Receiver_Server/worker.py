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
import re
import requests

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


def _llm_judge_submission(language: str, code: str, test_cases: list) -> dict:
    """
    Ask Gemini to judge the code against test_cases instead of actually
    executing it. Returns {'results': [...], 'report': str} aligned
    index-for-index with the input test_cases list.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {
            'results': [{'passed': False, 'actual_output': '', 'status': 'runtime_error'} for _ in test_cases],
            'report': 'GEMINI_API_KEY not configured on this machine — could not run AI judge.'
        }

    cases_payload = [
        {'input': str(c.get('input_data', '')), 'expected_output': str(c.get('expected_output', ''))}
        for c in test_cases
    ]

    prompt = f"""You are acting as a strict automated code judge and reviewer.
You will be given source code in {language} and a list of test cases (stdin input + expected stdout output).
For each test case, mentally simulate running the code with that input and determine:
- what the program would print to stdout
- whether that output exactly matches the expected output
- a status: one of "accepted", "wrong_answer", "runtime_error", "compilation_error", "time_limit_exceeded"

Then write an overall report (4-8 sentences) reviewing the code for a teacher: correctness, edge case handling, time/space complexity, code quality/readability, and any bugs you noticed.

Code ({language}):
-----
{code}
-----

Test cases (JSON array, same order must be preserved in your response):
{json.dumps(cases_payload)}

Return ONLY valid JSON in this exact format:
{{
  "results": [
    {{"actual_output": "...", "passed": true, "status": "accepted"}}
  ],
  "report": "..."
}}
The "results" array MUST have exactly {len(cases_payload)} items, in the same order as the input test cases."""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }

    models_to_try = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]
    response = None
    last_error = ""

    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=115)
            if resp.ok:
                response = resp
                break
            last_error = f"{resp.status_code} - {resp.text[:300]}"
        except Exception as e:
            last_error = str(e)

    if not response:
        return {
            'results': [{'passed': False, 'actual_output': '', 'status': 'runtime_error'} for _ in test_cases],
            'report': f'AI judge failed to respond: {last_error}'
        }

    try:
        result_data = response.json()
        text_content = result_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        cleaned = re.sub(r'^```(?:json)?\s*', '', text_content.strip())
        cleaned = re.sub(r'\s*```$', '', cleaned).strip()
        parsed = json.loads(cleaned)
        results = parsed.get("results", [])
        report = parsed.get("report", "")

        while len(results) < len(test_cases):
            results.append({'passed': False, 'actual_output': '', 'status': 'wrong_answer'})
        results = results[:len(test_cases)]

        return {'results': results, 'report': report}
    except Exception as e:
        return {
            'results': [{'passed': False, 'actual_output': '', 'status': 'runtime_error'} for _ in test_cases],
            'report': f'Could not parse AI judge response: {e}'
        }


def evaluate_task(task: dict) -> dict:
    """
    Judge code using the Gemini LLM instead of actually executing it, and
    aggregate results into the same shape the rest of the system expects.
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

    max_score = float(task.get('max_score') or 100)

    judged = _llm_judge_submission(language, code, test_cases)
    llm_results = judged['results']
    report = judged['report']

    results = []
    statuses = []
    passed_count = 0
    earned_points = 0.0
    total_points = 0.0

    for i, case in enumerate(test_cases):
        llm_case = llm_results[i] if i < len(llm_results) else {}
        passed = bool(llm_case.get('passed', False))
        case_status = llm_case.get('status', 'accepted' if passed else 'wrong_answer')
        actual = str(llm_case.get('actual_output', ''))

        points = float(case.get('points') or 0)
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
            'stdout': actual,
            'stderr': '',
            'actual_output': actual,
            'exec_time_ms': 0,
            'memory_kb': 0,
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
        'execution_time': 0,
        'email': task.get('email', ''),
        'ai_report': report,
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
