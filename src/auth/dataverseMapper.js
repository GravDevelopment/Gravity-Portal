const STATUS_MAP = {
  1: 'Completed',
  2: 'Failed',
  3: 'Pending',
  4: 'Pending',
};

function toDateStr(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch { return null; }
}

function mapStatus(raw, label) {
  if (label) {
    const l = label.toLowerCase().trim();
    if (['competent', 'completed', 'pass', 'passed'].includes(l)) return 'Completed';
    if (['not yet competent', 'nyc', 'failed', 'fail', 'did not finish'].includes(l)) return 'Failed';
  }
  if (raw == null) return 'Pending';
  if (typeof raw === 'number') return STATUS_MAP[raw] ?? 'Pending';
  const s = String(raw).toLowerCase().trim();
  if (['competent', 'completed', 'pass', 'passed', 'c', 'te', 'ate', 'te-gravity'].includes(s)) return 'Completed';
  if (['not yet competent', 'nyc', 'failed', 'fail', 'did not finish'].includes(s)) return 'Failed';
  return 'Pending';
}

export function mapEnrollment(raw, index, bookingMap = {}) {
  const booking = bookingMap[raw._tct_booking_value] ?? null;

  const candidateName = raw['_tct_student_value@OData.Community.Display.V1.FormattedValue'] ?? '';

  return {
    id:              raw.tct_enrollid ?? `dv-${index}`,
    candidateName,
    _search:         candidateName.toLowerCase(),
    idNumber:        raw.grav_learnerid ?? '',
    course:          raw['_grav_course_value@OData.Community.Display.V1.FormattedValue'] ?? '',
    companyId:       raw._tct_company_value ?? null,
    company:         raw['_tct_company_value@OData.Community.Display.V1.FormattedValue'] ?? null,
    trainingDate:    toDateStr(raw.grav_time1),
    endDate:         toDateStr(raw.grav_time2),
    status:          mapStatus(raw.tct_assessmentstatus, raw['tct_assessmentstatus@OData.Community.Display.V1.FormattedValue']),
    certificateNumber: raw.grav_certificatenumber ?? null,
    expiryDate:      toDateStr(raw.grav_revalidationdate),
    venue:           booking?.['tct_venueselect@OData.Community.Display.V1.FormattedValue'] ?? null,
    submittedDate:   toDateStr(raw.grav_time1),
  };
}
