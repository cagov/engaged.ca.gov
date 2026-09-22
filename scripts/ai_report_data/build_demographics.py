#!/usr/bin/env python3
"""Build the demographics chart data for /ai-impact/report/.

Not part of the site build. Run it when the respondent export changes, then
commit the JSON it writes.

Usage:
  python3 build_demographics.py [respondents.csv] [targets.csv]

Defaults point at the engaged_prototypes folder next to this repo. The raw
respondent export contains free-text answers and is NOT committed; only the
aggregate JSON is.

Reads:
  respondents.csv  one row per survey respondent, with demographic columns
                   plus PARTICIPATED_IN_PHASE1 / INVITED_TO_PHASE2 / ATTENDED_PHASE2 flags
                   (2026-09-21 export; one row is a Phase 2 walk-in who never took the survey)
  targets.csv      QUESTION, ANSWER, TARGET_PCT (statewide share we aimed for)

Writes:
  ../../src/public/data/ai-report-demographics.json

Method:
  Phase 1 = rows with PARTICIPATED_IN_PHASE1 = TRUE (2,702). Phase 2 = those who also
  attended a discussion.
  For each dimension, shares are computed over respondents who gave a usable
  answer (blanks, "I don't want to say", "Non-response" are excluded and the
  excluded count is reported). "Points from target" = 100 * (share - target).
"""

import csv
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
PROTOTYPES = os.path.normpath(os.path.join(HERE, "..", "..", "..", "engaged_prototypes"))
DEFAULT_RESPONDENTS = os.path.join(PROTOTYPES, "ai_impact_participants_with_demo_data 2026-09-21.csv")
DEFAULT_TARGETS = os.path.join(PROTOTYPES, "chart_data.csv")
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "src", "public", "data", "ai-report-demographics.json"))

NON_ANSWERS = {"", "I don't want to say", "I don't want to say (only)", "Non-response"}

# id, respondent column, targets QUESTION, ordered categories (None = alphabetical
# from targets), and a function mapping a raw answer to a category (None = drop).
def clean_only(v):
    return v.replace(" (only)", "").strip()

def gender(v):
    v = clean_only(v)
    if v in ("Man", "Woman"):
        return v
    if v.startswith("Another gender identity") or v == "Multiple":
        return "Nonbinary / multi / other"
    return None

AI_LABELS = {"pos": "Positive", "mix": "Mixed", "neg": "Negative"}

def ai_label(v):
    # "neutral" has no target bucket; it is excluded and reported.
    return AI_LABELS.get(v.strip().lower())

DIMENSIONS = [
    {"id": "region", "column": "REGION", "question": "REGION", "order": None, "map": lambda v: v.strip()},
    {"id": "race", "column": "RACE_ETHNICITY_CATEGORY", "question": "RACE_ETHNICITY_CATEGORY", "order": None, "map": clean_only},
    # "Under 18" has no target bucket; it is excluded like a non-answer.
    {"id": "age", "column": "AGE", "question": "AGE", "order": ["18-24", "25-44", "45-64", "Over 65"],
     "map": lambda v: v.strip() if v.strip() in ("18-24", "25-44", "45-64", "Over 65") else None},
    {"id": "gender", "column": "GENDER_CATEGORY", "question": "GENDER_CATEGORY",
     "order": ["Woman", "Man", "Nonbinary / multi / other"], "map": gender},
    {"id": "field", "column": "FIELD_OF_WORK_ROLLUP", "question": "FIELD_OF_WORK", "order": None, "map": lambda v: v.strip()},
    {"id": "ai", "column": "AI_RESPONSE_LABEL", "question": "AI_RESPONSE_LABEL",
     "order": ["Positive", "Mixed", "Negative"], "map": ai_label},
]

# Long category names that need a shorter x-axis label. Full name stays in the tooltip/table.
# Region names are never shortened: they must match the legends elsewhere on the page (9/21).
SHORT_LABELS = {
    "American Indian or Alaska Native": "American Indian / Alaska Native",
    "Middle Eastern or North African": "Middle Eastern / North African",
    "Native Hawaiian or Pacific Islander": "Native Hawaiian / Pacific Islander",
    "Multiple": "Two or more races",
    "Arts, entertainment, or media": "Arts & media",
    "Goods producing and harvesting": "Goods producing",
    "Information technology": "Info tech",
    "Professional services": "Prof. services",
    "Retail or wholesale trade": "Retail & wholesale",
    "Unemployed, looking": "Unemployed",
}


def read(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def yes(v):
    return v.strip().lower() in ("yes", "y", "true", "1")


def shares(rows, column, mapper):
    counts = Counter()
    excluded = 0
    for r in rows:
        raw = r[column]
        if raw.strip() in NON_ANSWERS:
            excluded += 1
            continue
        cat = mapper(raw)
        if cat is None:
            excluded += 1
            continue
        counts[cat] += 1
    n = sum(counts.values())
    return counts, n, excluded


def build(respondents_path, targets_path):
    rows = read(respondents_path)
    targets = read(targets_path)
    # The data team's count of survey participants is the PARTICIPATED_IN_PHASE1 filter.
    phase1 = [r for r in rows if yes(r["PARTICIPATED_IN_PHASE1"])]
    phase2 = [r for r in phase1 if yes(r["ATTENDED_PHASE2"])]
    invited = [r for r in phase1 if yes(r["INVITED_TO_PHASE2"])]

    out_dims = []
    for d in DIMENSIONS:
        trows = [t for t in targets if t["QUESTION"] == d["question"]]
        target_by = {}
        for t in trows:
            name = t["ANSWER"].replace(" (only)", "").strip()
            name = AI_LABELS.get(name, name)
            target_by[name] = float(t["TARGET_PCT"])
        order = d["order"] or sorted(target_by)
        missing = set(order) - set(target_by)
        assert not missing, f"{d['id']}: no target for {sorted(missing)}"

        c1, n1, x1 = shares(phase1, d["column"], d["map"])
        c2, n2, x2 = shares(phase2, d["column"], d["map"])
        unmapped = (set(c1) | set(c2)) - set(order)
        assert not unmapped, f"{d['id']}: answers with no target bucket: {sorted(unmapped)}"

        cats = []
        for name in order:
            p1 = c1[name] / n1 if n1 else 0.0
            p2 = c2[name] / n2 if n2 else 0.0
            tg = target_by[name]
            cats.append({
                "name": name,
                "short": SHORT_LABELS.get(name, name),
                "target": round(100 * tg, 1),
                "phase1": round(100 * p1, 1),
                "phase2": round(100 * p2, 1),
                "phase1Diff": round(100 * (p1 - tg), 1),
                "phase2Diff": round(100 * (p2 - tg), 1),
                "phase1Count": c1[name],
                "phase2Count": c2[name],
            })
        out_dims.append({
            "id": d["id"],
            "categories": cats,
            "phase1N": n1,
            "phase2N": n2,
            "phase1Excluded": x1,
            "phase2Excluded": x2,
        })

    return {
        "meta": {
            "source": os.path.basename(respondents_path),
            "targets": os.path.basename(targets_path),
            "note": "Aggregate shares only. Phase 1 = all survey respondents; Phase 2 = respondents who attended a discussion. Non-answers excluded per dimension.",
            "phase1Total": len(phase1),
            "invitedTotal": len(invited),
            "phase2Total": len(phase2),
        },
        "dimensions": out_dims,
    }


def main():
    respondents_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_RESPONDENTS
    targets_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_TARGETS
    data = build(respondents_path, targets_path)
    with open(OUT, "w") as f:
        json.dump(data, f, indent=1)
    print(f"wrote {OUT}")
    m = data["meta"]
    print(f"  phase1 {m['phase1Total']}  invited {m['invitedTotal']}  phase2 {m['phase2Total']}")
    for d in data["dimensions"]:
        span = max(abs(c["phase1Diff"]) for c in d["categories"]) , max(abs(c["phase2Diff"]) for c in d["categories"])
        print(f"  {d['id']:7s} {len(d['categories']):2d} cats  n1={d['phase1N']} (excl {d['phase1Excluded']})  n2={d['phase2N']} (excl {d['phase2Excluded']})  max|diff| p1={span[0]} p2={span[1]}")


if __name__ == "__main__":
    main()
