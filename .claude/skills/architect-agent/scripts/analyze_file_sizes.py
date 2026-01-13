#!/usr/bin/env python3
"""
Analyze file sizes in a codebase and flag files exceeding thresholds.

Usage:
    python analyze_file_sizes.py <directory> [--json]
    
Output:
    Markdown report of files by size category, or JSON if --json flag provided.
"""

import os
import sys
import json
from pathlib import Path
from typing import NamedTuple

class FileInfo(NamedTuple):
    path: str
    lines: int
    file_type: str
    severity: str  # 'ok', 'warning', 'critical'

# Thresholds: (warning, critical)
THRESHOLDS = {
    'component': (200, 400),
    'utility': (100, 200),
    'test': (300, 500),
    'config': (50, 100),
    'default': (200, 400),
}

# File type detection patterns
TYPE_PATTERNS = {
    'test': ['test', 'spec', '__tests__'],
    'config': ['config', '.json', '.yaml', '.yml', '.toml', 'rc.'],
    'utility': ['util', 'helper', 'lib/', 'utils/', 'helpers/'],
}

IGNORE_DIRS = {
    'node_modules', '.git', 'dist', 'build', '__pycache__', 
    '.next', 'coverage', 'vendor', '.venv', 'venv'
}

CODE_EXTENSIONS = {
    '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java',
    '.rb', '.php', '.swift', '.kt', '.cs', '.c', '.cpp', '.h'
}

def detect_file_type(path: str) -> str:
    path_lower = path.lower()
    for file_type, patterns in TYPE_PATTERNS.items():
        if any(p in path_lower for p in patterns):
            return file_type
    return 'component'

def get_severity(lines: int, file_type: str) -> str:
    warning, critical = THRESHOLDS.get(file_type, THRESHOLDS['default'])
    if lines >= critical:
        return 'critical'
    elif lines >= warning:
        return 'warning'
    return 'ok'

def count_lines(file_path: Path) -> int:
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for _ in f)
    except Exception:
        return 0

def analyze_directory(directory: str) -> list[FileInfo]:
    results = []
    root_path = Path(directory)
    
    for file_path in root_path.rglob('*'):
        # Skip ignored directories
        if any(ignored in file_path.parts for ignored in IGNORE_DIRS):
            continue
        
        # Only analyze code files
        if file_path.suffix not in CODE_EXTENSIONS:
            continue
        
        if not file_path.is_file():
            continue
        
        lines = count_lines(file_path)
        rel_path = str(file_path.relative_to(root_path))
        file_type = detect_file_type(rel_path)
        severity = get_severity(lines, file_type)
        
        results.append(FileInfo(rel_path, lines, file_type, severity))
    
    return sorted(results, key=lambda x: -x.lines)

def format_markdown(results: list[FileInfo]) -> str:
    critical = [f for f in results if f.severity == 'critical']
    warning = [f for f in results if f.severity == 'warning']
    
    output = ["# File Size Analysis\n"]
    
    if critical:
        output.append("## 🔴 Critical (Needs Immediate Attention)\n")
        output.append("| File | Lines | Type |")
        output.append("|------|-------|------|")
        for f in critical:
            output.append(f"| `{f.path}` | {f.lines} | {f.file_type} |")
        output.append("")
    
    if warning:
        output.append("## 🟡 Warning (Should Address)\n")
        output.append("| File | Lines | Type |")
        output.append("|------|-------|------|")
        for f in warning:
            output.append(f"| `{f.path}` | {f.lines} | {f.file_type} |")
        output.append("")
    
    # Summary
    total = len(results)
    output.append("## Summary\n")
    output.append(f"- Total files analyzed: {total}")
    output.append(f"- Critical: {len(critical)}")
    output.append(f"- Warning: {len(warning)}")
    output.append(f"- OK: {total - len(critical) - len(warning)}")
    
    return "\n".join(output)

def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze_file_sizes.py <directory> [--json]")
        sys.exit(1)
    
    directory = sys.argv[1]
    output_json = '--json' in sys.argv
    
    if not os.path.isdir(directory):
        print(f"Error: {directory} is not a directory")
        sys.exit(1)
    
    results = analyze_directory(directory)
    
    if output_json:
        data = [f._asdict() for f in results if f.severity != 'ok']
        print(json.dumps(data, indent=2))
    else:
        print(format_markdown(results))

if __name__ == '__main__':
    main()
