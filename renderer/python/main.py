#!/usr/bin/env python3
"""
MuvidGen renderer CLI

Reads a project JSON description and renders a composed MP4 via ffmpeg.
MVP pipeline:
  1) Concatenate the listed video clips to a temporary H.264/YUV420p MP4 (video only)
  2) If an audio file is provided, mux it with the concatenated video (shortest wins)

Environment overrides:
  MUVIDGEN_FFMPEG  -> absolute path to ffmpeg binary (default: ffmpeg on PATH)

Usage:
  python renderer/python/main.py <path/to/project.json>
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any, Dict, List, Optional, Tuple


def eprint(*args: Any) -> None:
    print(*args, file=sys.stderr)


def load_project(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_project(p: Dict[str, Any]) -> None:
    if p.get("version") != "1.0":
        raise ValueError("Unsupported or missing project version; expected '1.0'.")
    if not isinstance(p.get("clips"), list):
        raise ValueError("Project missing 'clips' list.")


def which(cmd: str) -> Optional[str]:
    from shutil import which as _which
    return _which(cmd)


def ffmpeg_exe() -> str:
    exe = os.environ.get("MUVIDGEN_FFMPEG") or "ffmpeg"
    return exe


def ffprobe_exe() -> str:
    override = os.environ.get("MUVIDGEN_FFPROBE")
    if override:
        return override
    ff = ffmpeg_exe()
    # If ffmpeg path is absolute, try sibling ffprobe
    base = os.path.basename(ff).lower()
    if os.path.sep in ff or (os.path.altsep and os.path.altsep in ff):
        d = os.path.dirname(ff)
        candidate = os.path.join(d, 'ffprobe')
        if os.name == 'nt':
            candidate_exe = candidate + '.exe'
            if os.path.isfile(candidate_exe):
                return candidate_exe
        if os.path.isfile(candidate):
            return candidate
    return 'ffprobe'


def check_ffmpeg() -> bool:
    exe = ffmpeg_exe()
    if not which(exe):
        eprint("[renderer] ffmpeg not found on PATH; set MUVIDGEN_FFMPEG or bundle ffmpeg.")
        return False
    try:
        subprocess.run([exe, "-hide_banner", "-version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except Exception as exc:
        eprint(f"[renderer] ffmpeg check failed: {exc}")
        return False


def run_ffmpeg(args: List[str], with_progress: bool = True) -> int:
    cmd = [ffmpeg_exe()] + args
    print("[ffmpeg] ", " ".join(f'"{a}"' if " " in a else a for a in cmd))
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    except FileNotFoundError:
        eprint("[renderer] ffmpeg not found. Set MUVIDGEN_FFMPEG.")
        return 127
    assert proc.stdout is not None
    for line in proc.stdout:
        print(line.rstrip())
    return proc.wait()


def ensure_tmp_dir(base: str) -> str:
    d = os.path.join(base, "muvidgen")
    os.makedirs(d, exist_ok=True)
    return d


def write_concat_list(path_list: List[str], dest_file: str) -> None:
    # ffmpeg concat demuxer expects: file '<path>' per line; use -safe 0
    with open(dest_file, "w", encoding="utf-8") as f:
        for p in path_list:
            # Escape single quotes
            q = p.replace("'", "'\\''")
            f.write(f"file '{q}'\n")


def concat_videos_to_h264(work_dir: str, clips: List[str]) -> Tuple[int, str]:
    """Produces a temporary MP4 with H.264 video only. Returns (code, path)."""
    list_path = os.path.join(work_dir, "concat.txt")
    out_path = os.path.join(work_dir, "concat_video.mp4")
    write_concat_list(clips, list_path)
    args = [
        "-hide_banner",
        "-y",
        "-nostats",
        "-progress",
        "pipe:1",
        "-safe",
        "0",
        "-f",
        "concat",
        "-i",
        list_path,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        out_path,
    ]
    code = run_ffmpeg(args)
    return code, out_path


def mux_audio_video(temp_video: str, audio_path: Optional[str], output_path: str, layers: List[Dict[str, Any]]) -> int:
    has_audio = bool(audio_path)
    filter_complex, vlabel = build_layer_filters(layers, has_audio=has_audio)
    args = [
        "-hide_banner",
        "-y",
        "-nostats",
        "-progress",
        "pipe:1",
        "-i",
        temp_video,
    ]
    if has_audio:
        args += ["-i", audio_path]
    if filter_complex:
        args += ["-filter_complex", filter_complex, "-map", vlabel]
        if has_audio:
            args += ["-map", "1:a"]
    else:
        args += ["-map", "0:v"]
        if has_audio:
            args += ["-map", "1:a"]
    args += [
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
    ]
    if has_audio:
        args += [
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
        ]
    args.append(output_path)
    return run_ffmpeg(args)


def hex_to_rgb(color: str) -> str:
    if not color:
        return "0xFFFFFF"
    c = color.strip()
    if c.startswith("#"):
        c = c[1:]
    if len(c) == 3:
        c = "".join([ch * 2 for ch in c])
    if len(c) != 6:
        return "0xFFFFFF"
    return "0x" + c.upper()


def escape_text(txt: str) -> str:
    return txt.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def build_layer_filters(layers: List[Dict[str, Any]], has_audio: bool) -> Tuple[Optional[str], str]:
    """Return (filter_complex, video_label)"""
    if not layers:
        return None, "[0:v]"

    filter_parts: List[str] = []
    current_v = "[0:v]"

    spec_layers = [l for l in layers if l.get("type") == "spectrograph"]
    if spec_layers and has_audio:
        split = f"[1:a]asplit={len(spec_layers)}" + "".join([f"[as{idx}]" for idx in range(len(spec_layers))])
        filter_parts.append(split)

    spec_idx = 0
    for idx, layer in enumerate(layers):
        lid = idx + 1
        if layer.get("type") == "spectrograph":
            if not has_audio:
                continue
            mode = layer.get("mode") or "bar"
            x = float(layer.get("x", 0) or 0)
            y = float(layer.get("y", 0) or 0)
            spec_tag = f"[spec{idx}]"
            if mode == "line":
                filter_parts.append(f"[as{spec_idx}]showfreqs=mode=line:ascale=log:win_size=2048:size=640x200{spec_tag}")
            elif mode == "dots":
                filter_parts.append(f"[as{spec_idx}]showfreqs=mode=dot:ascale=log:win_size=2048:size=640x200{spec_tag}")
            elif mode == "solid":
                filter_parts.append(f"[as{spec_idx}]showspectrum=s=640x200:mode=combined:color=intensity:scale=log:win_func=hann{spec_tag}")
            else:
                filter_parts.append(f"[as{spec_idx}]showspectrum=s=640x200:mode=separate:color=intensity:scale=log:win_func=hann{spec_tag}")
            filter_parts.append(
                f"{current_v}{spec_tag}overlay=x=W*{x}:y=H*{y}:format=auto[v{lid}]"
            )
            current_v = f"[v{lid}]"
            spec_idx += 1
        elif layer.get("type") == "text":
            text = escape_text(layer.get("text") or "Text")
            color = hex_to_rgb(layer.get("color") or "#ffffff")
            font = escape_text(layer.get("font") or "Segoe UI")
            fontsize = int(layer.get("fontSize") or 12)
            x = float(layer.get("x", 0) or 0)
            y = float(layer.get("y", 0) or 0)
            outline_color = hex_to_rgb(layer.get("outlineColor") or "#000000")
            outline_width = max(0, int(layer.get("outlineWidth") or 0))
            shadow_color = hex_to_rgb(layer.get("shadowColor") or "#000000")
            shadow_distance = int(layer.get("shadowDistance") or 0)
            filter_parts.append(
                f"{current_v}drawtext=text='{text}':fontcolor={color}:fontsize={fontsize}:font='{font}':x=W*{x}:y=H*{y}:bordercolor={outline_color}:borderw={outline_width}:shadowcolor={shadow_color}@0.6:shadowx={shadow_distance}:shadowy={shadow_distance}[v{lid}]"
            )
            current_v = f"[v{lid}]"

    return ";".join(filter_parts), current_v or "[0:v]"


def ffprobe_duration_ms(path: str) -> Optional[int]:
    exe = ffprobe_exe()
    try:
        proc = subprocess.run([
            exe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            path,
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        s = proc.stdout.strip()
        if not s:
            return None
        sec = float(s)
        if not (sec >= 0):
            return None
        return int(sec * 1000)
    except Exception:
        return None


def main(argv: List[str]) -> int:
    if len(argv) != 2:
        eprint("Usage: python renderer/python/main.py <path/to/project.json>")
        return 2

    project_path = argv[1]
    if not os.path.isfile(project_path):
        eprint(f"[renderer] Project JSON not found: {project_path}")
        return 2

    try:
        project = load_project(project_path)
        validate_project(project)
    except Exception as exc:
        eprint(f"[renderer] Invalid project JSON: {exc}")
        return 2

    audio = (project.get("audio") or {}).get("path")
    clips = [c.get("path") for c in (project.get("clips") or []) if isinstance(c, dict) and c.get("path")]
    output = (project.get("output") or {}).get("path")
    layers = project.get("layers") or []

    print("[renderer] Loaded project")
    print(f"  audio: {audio or 'none'}")
    print(f"  clips: {len(clips)}")
    for idx, p in enumerate(clips):
        print(f"    - index={idx} path={p}")
    print(f"  output: {output or '(not specified)'}")
    print(f"  layers: {len(layers)}")

    if not clips:
        eprint("[renderer] No clips provided; nothing to render.")
        return 2
    if not output:
        # default next to project JSON
        root, _ = os.path.splitext(project_path)
        output = root + "_render.mp4"
        print(f"[renderer] No output specified; defaulting to {output}")

    if not check_ffmpeg():
        eprint("[renderer] ffmpeg not available; aborting.")
        return 2

    # Validate paths
    for p in clips:
        if not os.path.isfile(p):
            eprint(f"[renderer] Missing clip: {p}")
            return 2
    if audio and not os.path.isfile(audio):
        eprint(f"[renderer] Missing audio file: {audio}")
        return 2

    # Estimate total duration from clips
    total_ms = 0
    for p in clips:
        d = ffprobe_duration_ms(p)
        if d is not None:
            total_ms += d
    if total_ms > 0:
        print(f"total_duration_ms={total_ms}")

    work_dir = ensure_tmp_dir(os.path.join(os.path.dirname(project_path), ".muvidgen"))
    code, tmp_video = concat_videos_to_h264(work_dir, clips)
    if code != 0:
        eprint(f"[renderer] Concat stage failed with code {code}")
        return code

    if audio or layers:
        code = mux_audio_video(tmp_video, audio, output, layers)
        if code != 0:
            eprint(f"[renderer] Mux stage failed with code {code}")
            return code
    else:
        # No audio/layers: move temp video to output
        try:
            if os.path.abspath(tmp_video) != os.path.abspath(output):
                os.replace(tmp_video, output)
        except Exception as exc:
            eprint(f"[renderer] Failed to move temp video to output: {exc}")
            return 1

    print("[renderer] Render complete:", output)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
