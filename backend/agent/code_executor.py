from __future__ import annotations

import subprocess
import sys
import tempfile
import os

_SUPPORTED_LOCAL = {"python", "javascript", "bash"}


def _run_python(code: str) -> dict:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        tmp = f.name
    try:
        result = subprocess.run(
            [sys.executable, tmp],
            capture_output=True, text=True, timeout=15,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "success": result.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Execution timed out after 15 seconds.", "success": False}
    except Exception as exc:
        return {"stdout": "", "stderr": f"Executor error: {exc}", "success": False}
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def _run_node(code: str) -> dict:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as f:
        f.write(code)
        tmp = f.name
    try:
        result = subprocess.run(
            ["node", tmp],
            capture_output=True, text=True, timeout=15,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "success": result.returncode == 0,
        }
    except FileNotFoundError:
        return {"stdout": "", "stderr": "node not found — install Node.js to run JavaScript.", "success": False}
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Execution timed out after 15 seconds.", "success": False}
    except Exception as exc:
        return {"stdout": "", "stderr": f"Executor error: {exc}", "success": False}
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def execute_code(language: str, code: str) -> dict:
    lang = language.lower()
    if lang == "python":
        return _run_python(code)
    elif lang in ("javascript", "js"):
        return _run_node(code)
    else:
        # For unsupported languages, skip execution gracefully
        return {
            "stdout": "",
            "stderr": f"Local execution not supported for {language}. Code was generated but not run.",
            "success": False,
        }
