"""
Medicine Lookup Service
-----------------------
Loads the Indian medicines CSV into memory at startup and provides
fast fuzzy matching to enrich Gemini-extracted medicine names with
standardized names, composition, and manufacturer info.
"""

import csv
import gzip
import io
import os
import logging
from difflib import SequenceMatcher, get_close_matches
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ── Data structures ──────────────────────────────────────────────

class MedicineRecord:
    __slots__ = ("name", "composition", "manufacturer", "uses", "therapeutic_class", "price")

    def __init__(self, name: str, composition: str, manufacturer: str, uses: str, therapeutic_class: str, price: str):
        self.name = name
        self.composition = composition
        self.manufacturer = manufacturer
        self.uses = uses
        self.therapeutic_class = therapeutic_class
        self.price = price

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "composition": self.composition,
            "manufacturer": self.manufacturer,
            "uses": self.uses,
            "therapeutic_class": self.therapeutic_class,
            "price": self.price,
        }


# ── Global index ─────────────────────────────────────────────────

_medicine_names: list[str] = []          # lowercase names for matching
_medicine_map: dict[str, MedicineRecord] = {}  # lowercase name -> record
_loaded = False


def _load_csv() -> None:
    """Load the medicines CSV (or .csv.gz) into memory (called once at import time)."""
    global _medicine_names, _medicine_map, _loaded
    if _loaded:
        return

    data_dir = Path(__file__).parent.parent / "data"
    gz_path = data_dir / "medicines.csv.gz"
    csv_path = data_dir / "medicines.csv"

    # Prefer gzipped for production (19MB vs 97MB)
    if gz_path.exists():
        logger.info(f"Loading medicine database from {gz_path} (gzipped)…")
        f = io.TextIOWrapper(gzip.open(gz_path, "rb"), encoding="utf-8", errors="replace")
    elif csv_path.exists():
        logger.info(f"Loading medicine database from {csv_path}…")
        f = open(csv_path, "r", encoding="utf-8", errors="replace")
    else:
        logger.warning(f"Medicine CSV not found in {data_dir}. Lookup disabled.")
        _loaded = True
        return

    count = 0
    try:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("name") or "").strip()
            if not name:
                continue
            lower = name.lower()
            if lower in _medicine_map:
                continue  # deduplicate

            comp1 = (row.get("short_composition1") or "").strip()
            comp2 = (row.get("short_composition2") or "").strip()
            composition = f"{comp1} + {comp2}".strip(" +") if comp2 else comp1

            record = MedicineRecord(
                name=name,
                composition=composition,
                manufacturer=(row.get("manufacturer_name") or "").strip(),
                uses=(row.get("use0") or "").strip(),
                therapeutic_class=(row.get("Therapeutic Class") or "").strip(),
                price=(row.get("price(₹)") or "").strip(),
            )
            _medicine_names.append(lower)
            _medicine_map[lower] = record
            count += 1
    except Exception as e:
        logger.error(f"Failed to load medicine CSV: {e}")
    finally:
        f.close()

    _loaded = True
    logger.info(f"✅ Loaded {count:,} unique medicines into memory.")


# Load at module import time
_load_csv()


# ── Lookup API ───────────────────────────────────────────────────

def lookup_medicine(query: str, threshold: float = 0.6) -> Optional[dict]:
    """
    Find the best matching medicine for a given name.

    Uses exact match first, then prefix match, then fuzzy match.
    Returns a dict with medicine details or None if no good match found.
    """
    if not _medicine_map or not query:
        return None

    q = query.strip().lower()

    # 1. Exact match
    if q in _medicine_map:
        return _medicine_map[q].to_dict()

    # 2. Prefix match (e.g., "Dolo" matches "Dolo 650 Tablet")
    prefix_matches = [n for n in _medicine_names if n.startswith(q)]
    if prefix_matches:
        best = min(prefix_matches, key=len)  # shortest match = most specific
        return _medicine_map[best].to_dict()

    # 3. Fuzzy match using difflib
    close = get_close_matches(q, _medicine_names, n=1, cutoff=threshold)
    if close:
        return _medicine_map[close[0]].to_dict()

    return None


def enrich_medications(medications: list[dict]) -> list[dict]:
    """
    Enrich a list of medication dicts (from Gemini extraction) with
    standardized info from the medicine database.

    Each medication dict should have at least a 'name' key.
    Returns the same list with added fields where matches are found.
    """
    if not _medicine_map:
        return medications

    enriched = []
    for med in medications:
        med_name = med.get("name", "")
        if not med_name:
            enriched.append(med)
            continue

        match = lookup_medicine(med_name)
        if match:
            med = {**med}  # shallow copy
            med["matched_name"] = match["name"]
            med["composition"] = match["composition"]
            med["manufacturer"] = match["manufacturer"]
            if match["uses"]:
                med["uses"] = match["uses"]
            if match["therapeutic_class"]:
                med["therapeutic_class"] = match["therapeutic_class"]
        enriched.append(med)

    return enriched
