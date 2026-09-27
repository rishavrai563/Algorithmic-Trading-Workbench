"""
LEAN Engine Runner (Orchestrator)
Bridges Streamlit UI to the LEAN backtesting engine via Docker.

Responsibilities:
1. Write strategy parameters into the LEAN config.json
2. Execute LEAN via Docker container
3. Locate and return the results file path
"""

import json
import subprocess
import os
import glob
import time
from pathlib import Path
from dataclasses import dataclass
from typing import Optional


# Paths
WORKSPACE_DIR = Path(__file__).parent / "lean_workspace"
CONFIG_PATH = WORKSPACE_DIR / "config.json"
ALGORITHM_DIR = WORKSPACE_DIR / "RSIStrategy"
ALGORITHM_FILE = ALGORITHM_DIR / "main.py"
DATA_DIR = WORKSPACE_DIR / "data"
RESULTS_DIR = WORKSPACE_DIR / "results"

# Docker image for LEAN
LEAN_DOCKER_IMAGE = "quantconnect/lean:latest"


@dataclass
class StrategyConfig:
    """Represents a strategy configuration from the Streamlit UI."""
    strategy_name: str = "RSI Mean Reversion"
    asset: str = "NIFTY 50"
    timeframe: str = "Daily"
    start_date: str = "2022-01-01"
    end_date: str = "2023-01-01"
    rsi_period: int = 10
    oversold: int = 35
    overbought: int = 65


def write_config(config: StrategyConfig) -> Path:
    """
    Write strategy parameters into the LEAN config.json file.

    Args:
        config: The strategy configuration from Streamlit UI.

    Returns:
        Path to the updated config.json file.
    """
    with open(CONFIG_PATH, "r") as f:
        lean_config = json.load(f)

    # Update parameters section
    lean_config["parameters"] = {
        "start-date": config.start_date,
        "end-date": config.end_date,
        "rsi-period": str(config.rsi_period),
        "oversold": str(config.oversold),
        "overbought": str(config.overbought),
    }

    with open(CONFIG_PATH, "w") as f:
        json.dump(lean_config, f, indent=2)

    return CONFIG_PATH


def run_backtest(config: StrategyConfig) -> dict:
    """
    Execute the LEAN backtest via Docker.

    Steps:
    1. Write parameters to config.json
    2. Run Docker container with mounted volumes
    3. Parse and return results

    Args:
        config: The strategy configuration.

    Returns:
        dict with keys: success, results_path, stdout, stderr, results_data
    """
    # Step 1: Write config
    write_config(config)

    # Ensure results directory exists
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # Clean previous results
    for f in RESULTS_DIR.glob("*"):
        if f.is_file():
            f.unlink()

    # Step 2: Build Docker command
    # Convert Windows paths to Docker-compatible format
    config_path_docker = str(CONFIG_PATH).replace("\\", "/")
    algorithm_path_docker = str(ALGORITHM_FILE).replace("\\", "/")
    data_path_docker = str(DATA_DIR).replace("\\", "/")
    results_path_docker = str(RESULTS_DIR).replace("\\", "/")

    docker_cmd = [
        "docker", "run", "--rm",
        "-v", f"{config_path_docker}:/Lean/Launcher/bin/Debug/config.json",
        "-v", f"{algorithm_path_docker}:/Lean/Algorithm.Python/main.py",
        "-v", f"{data_path_docker}/custom:/Lean/Data/custom",
        "-v", f"{results_path_docker}:/Results",
        LEAN_DOCKER_IMAGE,
    ]

    result = {
        "success": False,
        "results_path": None,
        "stdout": "",
        "stderr": "",
        "results_data": None,
    }

    try:
        # Step 3: Run Docker
        # Note: LEAN processes this daily data fast but hangs on Python thread shutdown.
        # We use a smart polling mechanism to instantly kill it when it posts results,
        # with a 5-minute fallback timeout for large backtests.
        proc = subprocess.Popen(
            docker_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=str(WORKSPACE_DIR),
        )

        start_time = time.time()
        timeout = 300  # 5 minute safety timeout
        output_lines = []

        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
                
            if line:
                output_lines.append(line)
                # Listen for the exact signal that LEAN is finished
                if "Analysis Completed and Results Posted" in line:
                    # Give it a fraction of a second to ensure file handles are closed
                    time.sleep(0.5)
                    proc.kill()
                    break
                    
            if time.time() - start_time > timeout:
                proc.kill()
                output_lines.append("\nWarning: Backtest timed out after 5 minutes (expected thread shutdown hang). Recovering results...")
                break

        result["stdout"] = "".join(output_lines)
        result["stderr"] = ""  # Combined into stdout

        # Step 4: Find results file
        results_files = list(RESULTS_DIR.glob("*.json"))
        if not results_files:
            results_files = list(RESULTS_DIR.rglob("*.json"))
            results_files = list(RESULTS_DIR.rglob("*.json"))

        if results_files:
            results_file = max(results_files, key=lambda f: f.stat().st_size)
            result["results_path"] = str(results_file)

            with open(results_file, "r") as f:
                result["results_data"] = json.load(f)

            result["success"] = True
        else:
            result["success"] = False
    except Exception as e:
        result["stderr"] = f"Error running backtest: {str(e)}"

    return result


def get_docker_status() -> dict:
    """Check if Docker is available and LEAN image exists."""
    status = {"docker_available": False, "lean_image_exists": False}

    try:
        proc = subprocess.run(
            ["docker", "info"],
            capture_output=True, text=True, timeout=10
        )
        status["docker_available"] = (proc.returncode == 0)
    except Exception:
        pass

    if status["docker_available"]:
        try:
            proc = subprocess.run(
                ["docker", "images", "-q", LEAN_DOCKER_IMAGE],
                capture_output=True, text=True, timeout=10
            )
            status["lean_image_exists"] = bool(proc.stdout.strip())
        except Exception:
            pass

    return status


if __name__ == "__main__":
    # Quick test
    print("Docker status:", get_docker_status())

    config = StrategyConfig()
    print(f"\nRunning backtest with config:")
    print(f"  Strategy: {config.strategy_name}")
    print(f"  Asset: {config.asset}")
    print(f"  Period: {config.start_date} to {config.end_date}")
    print(f"  RSI: period={config.rsi_period}, oversold={config.oversold}, overbought={config.overbought}")

    result = run_backtest(config)
    print(f"\nSuccess: {result['success']}")
    if result['results_path']:
        print(f"Results: {result['results_path']}")
    if result['stderr']:
        print(f"Errors: {result['stderr'][:500]}")
