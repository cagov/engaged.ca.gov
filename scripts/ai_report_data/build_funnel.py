#!/usr/bin/env python3
"""Build the participant-funnel data for /ai-impact/report/.

Not part of the site build. Run it when either export changes, then commit
the JSON it writes. Feeds both the "Who participated" animation and the
"The power of discussion" ring.

Usage:
  python3 build_funnel.py [respondents.csv] [attendees.csv]

Defaults point at the engaged_prototypes folder next to this repo. The raw
exports are NOT committed (they contain free-text answers); only this
aggregate JSON is. It holds counts plus one anonymous
{region, fieldOfWork} pair per attendee, grouped by session date.

Reads:
  respondents.csv  one row per survey respondent: REGION, FIELD_OF_WORK_ROLLUP,
                   AGE, AI_RESPONSE_LABEL, RACE_ETHNICITY_CATEGORY, GENDER_CATEGORY,
                   INVITED_PHASE_2
  attendees.csv    one row per discussion attendee: SESSION_DATE, REGION,
                   FIELD_OF_WORK_SORTITION_GROUPING, AGE, AI_RESPONSE_LABEL,
                   RACE_ETHNICITY_CATEGORY, GENDER_CATEGORY

Writes:
  ../../src/public/data/ai-report-participant-funnel.json
  Shape (consumed by src/js/ai-impact-report/funnel-layout.js):
    phase1Total, regions[{name, surveyCount, attendCount}],
    fieldOfWork[{...}], age[{...}], aiResponse[{...}],
    sessions[{date, attendees[{region, fieldOfWork, age, aiResponse}]}],
    invitedByRegion[{name, count}], invitedTotal
"""

import csv
import json
import os
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
PROTOTYPES = os.path.normpath(os.path.join(HERE, "..", "..", "..", "engaged_prototypes"))
DEFAULT_RESPONDENTS = os.path.join(PROTOTYPES, "survey respondent demographics and status 2026-09-04.csv")
DEFAULT_ATTENDEES = os.path.join(PROTOTYPES, "attendee demographics, 2026-08-18-1424.csv")
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "src", "public", "data", "ai-report-participant-funnel.json"))

NOT_STATED = "(not stated)"
NON_ANSWERS = {NOT_STATED, "I don't want to say"}


def read(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def region(v):
    return v.strip() or NOT_STATED


def field(v):
    v = v.strip()
    if not v:
        return NOT_STATED
    if v == "Non-response":
        return "I don't want to say"
    return v


AGE_ORDER = ["18-24", "25-44", "45-64", "Over 65"]
AI_ORDER = ["Positive", "Mixed", "Negative", "Neutral"]
AI_LABELS = {"pos": "Positive", "mix": "Mixed", "neg": "Negative", "neutral": "Neutral"}


def age(v):
    v = v.strip()
    if not v:
        return NOT_STATED
    return v


def ai(v):
    v = v.strip().lower()
    if not v:
        return NOT_STATED
    return AI_LABELS.get(v, v.title())


GENDER_ORDER = ["Woman", "Man", "Nonbinary / multi / other"]


def clean_only(v):
    return v.replace(" (only)", "").strip()


def race(v):
    v = clean_only(v)
    return v or NOT_STATED


def gender(v):
    v = clean_only(v)
    if not v:
        return NOT_STATED
    if v in ("Man", "Woman", "I don't want to say"):
        return v
    # "Another gender identity (...)" and "Multiple" share one bucket.
    return "Nonbinary / multi / other"


def fixed_order(names, order):
    """Categories in a given order, then anything unexpected, then non-answers."""
    real = [n for n in order if n in names]
    extra = sorted(n for n in names if n not in order and n not in NON_ANSWERS)
    tail = [n for n in (NOT_STATED, "I don't want to say") if n in names]
    return real + extra + tail


def ordered(names, counts):
    """Substantive categories by survey count (desc), non-answers last."""
    real = sorted((n for n in names if n not in NON_ANSWERS), key=lambda n: (-counts[n], n))
    tail = [n for n in (NOT_STATED, "I don't want to say") if n in names]
    return real + tail


def build(respondents_path, attendees_path):
    respondents = read(respondents_path)
    attendees = read(attendees_path)

    survey_region = Counter(region(r["REGION"]) for r in respondents)
    survey_field = Counter(field(r["FIELD_OF_WORK_ROLLUP"]) for r in respondents)
    attend_region = Counter(region(a["REGION"]) for a in attendees)
    attend_field = Counter(field(a["FIELD_OF_WORK_SORTITION_GROUPING"]) for a in attendees)
    invited_region = Counter(region(r["REGION"]) for r in respondents if r["INVITED_PHASE_2"].strip().lower() == "yes")
    survey_age = Counter(age(r["AGE"]) for r in respondents)
    attend_age = Counter(age(a["AGE"]) for a in attendees)
    survey_ai = Counter(ai(r["AI_RESPONSE_LABEL"]) for r in respondents)
    attend_ai = Counter(ai(a["AI_RESPONSE_LABEL"]) for a in attendees)
    survey_race = Counter(race(r["RACE_ETHNICITY_CATEGORY"]) for r in respondents)
    attend_race = Counter(race(a["RACE_ETHNICITY_CATEGORY"]) for a in attendees)
    survey_gender = Counter(gender(r["GENDER_CATEGORY"]) for r in respondents)
    attend_gender = Counter(gender(a["GENDER_CATEGORY"]) for a in attendees)

    region_names = ordered(set(survey_region) | set(attend_region), survey_region)
    field_names = ordered(set(survey_field) | set(attend_field), survey_field)
    age_names = fixed_order(set(survey_age) | set(attend_age), AGE_ORDER)
    ai_names = fixed_order(set(survey_ai) | set(attend_ai), AI_ORDER)
    race_names = ordered(set(survey_race) | set(attend_race), survey_race)
    gender_names = fixed_order(set(survey_gender) | set(attend_gender), GENDER_ORDER)

    by_date = defaultdict(list)
    for a in attendees:
        by_date[a["SESSION_DATE"].strip()].append({
            "region": region(a["REGION"]),
            "fieldOfWork": field(a["FIELD_OF_WORK_SORTITION_GROUPING"]),
            "age": age(a["AGE"]),
            "aiResponse": ai(a["AI_RESPONSE_LABEL"]),
            "race": race(a["RACE_ETHNICITY_CATEGORY"]),
            "gender": gender(a["GENDER_CATEGORY"]),
        })
    sessions = [{"date": d, "attendees": by_date[d]} for d in sorted(by_date)]

    return {
        "meta": {
            "source": os.path.basename(respondents_path),
            "attendeeSource": os.path.basename(attendees_path),
            "note": "Aggregate counts plus one anonymous {region, fieldOfWork} pair per discussion attendee, grouped by session date. Built by scripts/ai_report_data/build_funnel.py.",
        },
        "phase1Total": len(respondents),
        "regions": [{"name": n, "surveyCount": survey_region[n], "attendCount": attend_region[n]} for n in region_names],
        "fieldOfWork": [{"name": n, "surveyCount": survey_field[n], "attendCount": attend_field[n]} for n in field_names],
        "age": [{"name": n, "surveyCount": survey_age[n], "attendCount": attend_age[n]} for n in age_names],
        "aiResponse": [{"name": n, "surveyCount": survey_ai[n], "attendCount": attend_ai[n]} for n in ai_names],
        "race": [{"name": n, "surveyCount": survey_race[n], "attendCount": attend_race[n]} for n in race_names],
        "gender": [{"name": n, "surveyCount": survey_gender[n], "attendCount": attend_gender[n]} for n in gender_names],
        "sessions": sessions,
        "invitedByRegion": [{"name": n, "count": invited_region[n]} for n in region_names],
        "invitedTotal": sum(invited_region.values()),
    }


def main():
    respondents_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_RESPONDENTS
    attendees_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_ATTENDEES
    data = build(respondents_path, attendees_path)
    with open(OUT, "w") as f:
        json.dump(data, f, indent=1)
    kept = sum(len(s["attendees"]) for s in data["sessions"])
    print(f"wrote {OUT}")
    print(f"  phase1 {data['phase1Total']}  invited {data['invitedTotal']}  attendees {kept}  sessions {len(data['sessions'])}")
    print("  sizes", [len(s["attendees"]) for s in data["sessions"]])
    print("  fields", [f["name"] for f in data["fieldOfWork"]])
    print("  age", [(f["name"], f["surveyCount"], f["attendCount"]) for f in data["age"]])
    print("  ai", [(f["name"], f["surveyCount"], f["attendCount"]) for f in data["aiResponse"]])
    print("  race", [(f["name"], f["surveyCount"], f["attendCount"]) for f in data["race"]])
    print("  gender", [(f["name"], f["surveyCount"], f["attendCount"]) for f in data["gender"]])


if __name__ == "__main__":
    main()
