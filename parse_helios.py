import pandas as pd
import json
from pathlib import Path

EXCEL_PATH = Path("public/Helios Learners Report - 2022 to 2026.xlsx")

# All known passing/failing codes → normalised status
STATUS_MAP = {
    "competent":        "Competent",
    "not yet competent":"Not Yet Competent",
    "nyc":              "Not Yet Competent",
    "did not finish":   "Not Yet Competent",
    "c":                "Competent",
    # Malawi abbreviation codes – treated as Competent passes
    "te":               "Competent",
    "ate":              "Competent",
    "te - gravity":     "Competent",
    "te-gravity":       "Competent",
}

# Values in the status column that indicate a corrupt/header row
GARBAGE_STATUSES = {
    "assessment status", "start date", "start date ", "end date",
    "practical venue", "practical venue  ", "revalidation date",
    "malawi", "course", "student", "id number", "company",
    "secondary company", "course name",
}

def to_date_str(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        ts = pd.Timestamp(val)
        return ts.strftime("%Y-%m-%d")
    except Exception:
        return None

def normalise_status(raw):
    if raw is None:
        return "Unknown"
    key = str(raw).strip().lower()
    return STATUS_MAP.get(key, str(raw).strip().title() if raw else "Unknown")

def is_garbage_row(course, first_name, raw_status):
    if not course or str(course).lower() in ("nan", "none", "course name", "course", "student"):
        return True
    if not first_name:
        return True
    if str(raw_status).strip().lower() in GARBAGE_STATUSES:
        return True
    return False

def parse_sheet_standard(df, region):
    """Schema: [start_date, end_date, course, company, first, last, status, venue, reval]"""
    records = []
    for _, row in df.iterrows():
        vals = row.values
        if len(vals) < 7:
            continue
        course      = str(vals[2]).strip() if not pd.isna(vals[2]) else None
        first_name  = str(vals[4]).strip() if not pd.isna(vals[4]) else ""
        last_name   = str(vals[5]).strip() if not pd.isna(vals[5]) else ""
        raw_status  = str(vals[6]).strip() if not pd.isna(vals[6]) else ""

        if is_garbage_row(course, first_name, raw_status):
            continue

        records.append({
            "region":          region,
            "candidateName":   f"{first_name} {last_name}".strip(),
            "company":         str(vals[3]).strip() if not pd.isna(vals[3]) else None,
            "course":          course,
            "trainingDate":    to_date_str(vals[0]),
            "endDate":         to_date_str(vals[1]),
            "status":          normalise_status(raw_status),
            "venue":           str(vals[7]).strip() if len(vals) > 7 and not pd.isna(vals[7]) else None,
            "revalidationDate":to_date_str(vals[8]) if len(vals) > 8 else None,
            "certificateNumber": None,
        })
    return records

def parse_madagascar_section2(df_section, region):
    """Schema: [course, cert_no, full_name, id_no, company, sec_company, start_date, end_date, venue, status, reval]"""
    records = []
    for _, row in df_section.iterrows():
        vals = row.values
        if len(vals) < 10:
            continue
        course     = str(vals[0]).strip() if not pd.isna(vals[0]) else None
        full_name  = str(vals[2]).strip() if not pd.isna(vals[2]) else ""
        raw_status = str(vals[9]).strip() if not pd.isna(vals[9]) else ""

        if is_garbage_row(course, full_name, raw_status):
            continue

        records.append({
            "region":           region,
            "candidateName":    full_name,
            "company":          str(vals[4]).strip() if not pd.isna(vals[4]) else None,
            "course":           course,
            "trainingDate":     to_date_str(vals[6]),
            "endDate":          to_date_str(vals[7]),
            "status":           normalise_status(raw_status),
            "venue":            str(vals[8]).strip() if not pd.isna(vals[8]) else None,
            "revalidationDate": to_date_str(vals[10]) if len(vals) > 10 else None,
            "certificateNumber":str(vals[1]).strip() if not pd.isna(vals[1]) else None,
        })
    return records

def parse_malawi(df, region):
    """Schema: [code, date, course, company, name, id, trainer, status, reval]"""
    records = []
    for _, row in df.iterrows():
        vals = row.values
        if len(vals) < 8:
            continue
        course     = str(vals[2]).strip() if not pd.isna(vals[2]) else None
        first_name = str(vals[4]).strip() if not pd.isna(vals[4]) else ""
        raw_status = str(vals[7]).strip() if not pd.isna(vals[7]) else ""

        if is_garbage_row(course, first_name, raw_status):
            continue

        records.append({
            "region":           region,
            "candidateName":    first_name,
            "company":          str(vals[3]).strip() if not pd.isna(vals[3]) else None,
            "course":           course,
            "trainingDate":     to_date_str(vals[1]),
            "endDate":          to_date_str(vals[1]),
            "status":           normalise_status(raw_status),
            "venue":            str(vals[3]).strip() if not pd.isna(vals[3]) else None,
            "revalidationDate": to_date_str(vals[8]) if len(vals) > 8 else None,
            "certificateNumber": None,
        })
    return records

all_records = []
xl = pd.ExcelFile(EXCEL_PATH)

for sheet in xl.sheet_names:
    if sheet.lower() == "hiddensheet":
        continue

    df = xl.parse(sheet, header=None)
    df = df.dropna(how="all").reset_index(drop=True)

    # Find first data row (col 0 is a parseable date)
    start_row = 0
    for idx, row in df.iterrows():
        val = row.iloc[0]
        if pd.isna(val):
            continue
        try:
            pd.Timestamp(val)
            start_row = idx
            break
        except Exception:
            start_row = idx + 1

    data_df = df.iloc[start_row:].reset_index(drop=True)

    if sheet == "Malawi":
        recs = parse_malawi(data_df, sheet)
    elif sheet == "Madagascar":
        # Section 2 starts when col 0 = "Course" (the section header row)
        section1_rows = []
        section2_rows = []
        in_section2 = False
        for i, row in data_df.iterrows():
            val = row.iloc[0]
            if pd.isna(val):
                continue
            # Detect the explicit "Course" header that begins section 2
            if str(val).strip().lower() == "course":
                in_section2 = True
                section2_rows.append(row)  # will be filtered as garbage
                continue
            if in_section2:
                section2_rows.append(row)
            else:
                section1_rows.append(row)  # includes sub-headers, filtered later

        s1 = pd.DataFrame(section1_rows).reset_index(drop=True) if section1_rows else pd.DataFrame()
        s2 = pd.DataFrame(section2_rows).reset_index(drop=True) if section2_rows else pd.DataFrame()

        recs = []
        if not s1.empty:
            recs += parse_sheet_standard(s1, sheet)
        if not s2.empty:
            recs += parse_madagascar_section2(s2, sheet)
    else:
        recs = parse_sheet_standard(data_df, sheet)

    all_records.extend(recs)

# Add IDs + submittedDate
for i, r in enumerate(all_records):
    r["id"] = f"hl-{i+1:04d}"
    r["submittedDate"] = r["trainingDate"]

# Map to app display statuses
STATUS_DISPLAY = {
    "Competent":        "Completed",
    "Not Yet Competent":"Failed",
    "Unknown":          "Pending",
}
for r in all_records:
    r["displayStatus"] = STATUS_DISPLAY.get(r["status"], r["status"])

# Stats summary
from collections import Counter
print("Status distribution:", Counter(r["displayStatus"] for r in all_records))
print("Region distribution:", Counter(r["region"] for r in all_records))
print("Total records:", len(all_records))

# Write JS file
lines = ["// Auto-generated from Helios Learners Report - 2022 to 2026.xlsx\n"]
lines.append("export const mockClient = {\n  id: 'client-helios',\n  name: 'Helios Towers',\n};\n\n")
lines.append("export const heliosRecords = ")
lines.append(json.dumps(all_records, indent=2, ensure_ascii=False))
lines.append(";\n\n")

lines.append("export const mockTrainingRecords = heliosRecords.map(r => ({\n")
lines.append("  id: r.id,\n  candidateName: r.candidateName,\n  idNumber: r.certificateNumber || '',\n")
lines.append("  course: r.course,\n  submittedDate: r.submittedDate,\n  trainingDate: r.trainingDate,\n  endDate: r.endDate,\n")
lines.append("  status: r.displayStatus,\n  certificateNumber: r.certificateNumber,\n")
lines.append("  expiryDate: r.revalidationDate,\n  region: r.region,\n  venue: r.venue,\n  company: r.company,\n}));\n\n")

lines.append("export const STATUS_COLOURS = {\n")
lines.append("  Completed:   { bg: '#dcfce7', text: '#166534' },\n")
lines.append("  'In Progress': { bg: '#fef9c3', text: '#854d0e' },\n")
lines.append("  Failed:      { bg: '#fee2e2', text: '#991b1b' },\n")
lines.append("  Pending:     { bg: '#f3f4f6', text: '#374151' },\n};\n")

out = Path("src/mock/trainingData.js")
out.write_text("".join(lines), encoding="utf-8")
print(f"Written {len(all_records)} records to {out}")
