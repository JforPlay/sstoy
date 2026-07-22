"""Map discs (DiscIP.json) -> Wwise state -> .wem audio files, and copy them into public/soundtracks.

Pipeline:
  DiscIP.VoFile ("outfit_XXXX")
    -> Wwise state ID (FNV-1 32-bit hash, verified via Wwise_IDs.h where available)
    -> .wem IDs from wwiser-generated .txtp files
    -> physical files in <game install>/Persistent_Store/SoundBanks/Media/

Prerequisite: run wwiser against the Music_*.bnk files first, e.g.
  python wwiser.py bnks/Music_*.bnk bnks/Init.bnk -g -gu

Configure external paths via environment variables (falls back to defaults below):
  STELLASORA_INSTALL  game install root (default: C:\\YostarGames\\StellaSora_KR)
  WWISER_TXTP_DIR     wwiser txtp output directory (default: SoundBanks/txtp)
"""
import json
import os
import re
import shutil
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent
DISCIP = REPO / "public" / "data" / "DiscIP.json"
OUT = REPO / "public" / "data" / "disc_bgm_map.json"
SOUNDTRACKS_DIR = REPO / "public" / "soundtracks"

GAME_INSTALL = Path(os.environ.get("STELLASORA_INSTALL", r"C:\YostarGames\StellaSora_KR"))
WWISE_IDS = GAME_INSTALL / "StellaSora_Data" / "StreamingAssets" / "Audio" / "GeneratedSoundBanks" / "Wwise_IDs.h"
MEDIA_DIR = GAME_INSTALL / "Persistent_Store" / "SoundBanks" / "Media"
TXTP_DIR = Path(os.environ.get("WWISER_TXTP_DIR", GAME_INSTALL / "Persistent_Store" / "SoundBanks" / "txtp"))

OUTFIT_STATE_GROUP = 1640212992


def fnv1_32(name: str) -> int:
    h = 2166136261
    for c in name.lower().encode():
        h = ((h * 16777619) & 0xFFFFFFFF) ^ c
    return h


def load_wwise_ids():
    m = {}
    if not WWISE_IDS.exists():
        return m
    rx = re.compile(r"static const AkUniqueID (OUTFIT_\d+) = (\d+)U;")
    for line in WWISE_IDS.read_text(encoding="utf-8").splitlines():
        g = rx.search(line)
        if g:
            m[g.group(1).lower()] = int(g.group(2))
    return m


def load_txtp_map():
    """state_id -> list of .wem IDs (from the 'primary' variant txtp)."""
    rx_name = re.compile(rf"\({OUTFIT_STATE_GROUP}=(\d+)\)\.txtp$")
    rx_wem = re.compile(r"wem/(\d+)\.wem")
    mapping = {}
    for f in TXTP_DIR.glob("Music_Outfit*.txtp"):
        m = rx_name.search(f.name)
        if not m:
            continue
        sid = int(m.group(1))
        if sid in mapping:
            continue
        wems = []
        for line in f.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.lstrip().startswith("#"):
                continue
            w = rx_wem.search(line)
            if w:
                wems.append(int(w.group(1)))
        mapping[sid] = wems
    return mapping


def copy_wems(wem_ids):
    """Copy WEM files; skip IDs already available as WEM or converted OGG."""
    SOUNDTRACKS_DIR.mkdir(parents=True, exist_ok=True)
    copied = skipped = missing = 0
    for wid in wem_ids:
        src = MEDIA_DIR / f"{wid}.wem"
        if (SOUNDTRACKS_DIR / f"{wid}.ogg").exists() or (SOUNDTRACKS_DIR / f"{wid}.wem").exists():
            skipped += 1
            continue
        if not src.exists():
            missing += 1
            continue
        shutil.copy2(src, SOUNDTRACKS_DIR / f"{wid}.wem")
        copied += 1
    return copied, skipped, missing


def main():
    known = load_wwise_ids()
    txtp = load_txtp_map()
    if not txtp:
        raise SystemExit(
            f"No Music_Outfit TXT P files found in {TXTP_DIR}. "
            "Run wwiser against Music_*.bnk and Init.bnk first."
        )
    disc_data = json.loads(DISCIP.read_text(encoding="utf-8"))

    result = {}
    all_wems = set()
    counts = {"mapped": 0, "state_no_audio": 0}
    for disc_id, cfg in disc_data.items():
        vofile = cfg.get("VoFile", "").strip()
        if not vofile:
            continue
        known_sid = known.get(vofile.lower())
        sid = known_sid or fnv1_32(vofile)
        wems = txtp.get(sid, [])
        files_exist = [w for w in wems if (MEDIA_DIR / f"{w}.wem").exists()]
        all_wems.update(files_exist)
        result[disc_id] = {
            "VoFile": vofile, "StateId": sid, "StateIdInHeader": known_sid is not None,
            "Wems": wems, "WemsExist": files_exist,
            "VoLoop1": cfg.get("VoLoop1"), "VoBegin2": cfg.get("VoBegin2"),
            "VoLoop2": cfg.get("VoLoop2"), "VoName1": cfg.get("VoName1"),
            "VoName2": cfg.get("VoName2"), "CharId": cfg.get("CharId"),
        }
        counts["mapped" if wems else "state_no_audio"] += 1

    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(result)} entries -> {OUT}")
    print(f"Mapped: {counts['mapped']}  |  State defined but no audio: {counts['state_no_audio']}")
    copied, skipped, missing = copy_wems(sorted(all_wems))
    print(f"Soundtracks copy -> {SOUNDTRACKS_DIR}")
    print(f"copied={copied}  skipped={skipped}  missing={missing}  total_wems={len(all_wems)}")


if __name__ == "__main__":
    main()
