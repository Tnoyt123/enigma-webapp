#!/usr/bin/env python3
"""Builds the web sound files in public/sounds from the source recording in assets/sounds.

The recording (stereo, 96 kHz, 24-bit) holds one key press: the key going down at ~0.14 s and
coming back up at ~0.29 s. Each half becomes a short mono 48 kHz 16-bit WAV with a gentle fade,
small enough (~13 KB) to load instantly and playable in every browser. Standard library only.
"""
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/sounds/mech-button-1.wav"
OUT = ROOT / "public/sounds"

CUTS = {  # name: (start s, length s, peak level after normalising)
    # The release is much quieter in the recording; it stays softer than the press but audible.
    "key-down": (0.130, 0.140, 0.9),
    "key-up": (0.275, 0.140, 0.5),
}
FADE_IN, FADE_OUT = 0.002, 0.030


def read_mono(path: Path) -> tuple[list[float], int]:
    with wave.open(str(path)) as w:
        channels, width, rate = w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = w.readframes(w.getnframes())
    assert width == 3, "expects 24-bit audio"
    frame = width * channels
    samples = []
    for i in range(0, len(raw), frame):
        chans = [
            int.from_bytes(raw[i + c * 3 : i + c * 3 + 3], "little", signed=True)
            for c in range(channels)
        ]
        samples.append(sum(chans) / channels / 2**23)
    return samples, rate


def main() -> None:
    samples, rate = read_mono(SOURCE)
    # Halve the rate (96 → 48 kHz), averaging pairs as a simple low-pass.
    samples = [(samples[i] + samples[i + 1]) / 2 for i in range(0, len(samples) - 1, 2)]
    rate //= 2
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (start, length, peak) in CUTS.items():
        clip = samples[int(start * rate) : int((start + length) * rate)]
        n_in, n_out = int(FADE_IN * rate), int(FADE_OUT * rate)
        for i in range(len(clip)):
            clip[i] *= min(1.0, i / n_in, (len(clip) - i) / n_out)
        scale = peak / max(abs(s) for s in clip)
        clip = [s * scale for s in clip]
        path = OUT / f"{name}.wav"
        with wave.open(str(path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(
                b"".join(struct.pack("<h", max(-32768, min(32767, round(s * 32767)))) for s in clip)
            )
        print(f"{name}.wav: {len(clip) / rate:.3f} s, {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
