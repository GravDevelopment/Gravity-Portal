import { useMemo } from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import { useDataverse } from './useDataverse';
import { useUserProfile } from './useUserProfile';
import { useEffectivePermissions } from './useEffectivePermissions';
import { mapEnrollment } from './dataverseMapper';
import { mockTrainingRecords } from '../mock/trainingData';
import { ADMIN_EMAILS } from './msalConfig';
import { useMsal } from '@azure/msal-react';

const FIELDS = [
  'tct_enrollid',
  '_tct_student_value',
  'grav_learnerid',
  'grav_time1',
  'grav_time2',
  'tct_assessmentstatus',
  'grav_certificatenumber',
  'grav_revalidationdate',
  '_grav_course_value',
  '_tct_company_value',
  '_tct_booking_value',
].join(',');

const ENROLL_ODATA  = `$select=${FIELDS}`;
const BOOKING_ODATA = '$top=5000&$select=grav_bookingid,tct_venueselect';

export function useTrainingRecords() {
  const isAuthenticated = useIsAuthenticated();
  const { accounts } = useMsal();
  const { isGravity, companyId, loading: profileLoading } = useUserProfile();
  const { allowedCompanies, loading: permLoading } = useEffectivePermissions();

  const email   = (accounts[0]?.username ?? '').toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(email);

  const { data: enrollData, loading: enrollLoading, error: enrollError } =
    useDataverse(isAuthenticated ? 'tct_enrolls' : null, isAuthenticated ? ENROLL_ODATA : '');

  const { data: bookingData, loading: bookingLoading } =
    useDataverse(isAuthenticated ? 'grav_bookings' : null, isAuthenticated ? BOOKING_ODATA : '');

  const bookingMap = useMemo(() => {
    if (!bookingData) return {};
    const map = {};
    bookingData.forEach(b => {
      if (b.grav_bookingid) map[b.grav_bookingid] = b;
    });
    return map;
  }, [bookingData]);

  const records = useMemo(() => {
    if (!isAuthenticated) return mockTrainingRecords;
    if (!enrollData) return [];
    let mapped = enrollData.map((r, i) => mapEnrollment(r, i, bookingMap));

    // Non-Gravity users: restrict to their own company (CRM contact lookup)
    if (!isGravity && companyId) {
      mapped = mapped.filter(r => r.companyId === companyId);
    }

    // Gravity users with portal permissions: apply company filter (admins bypass)
    if (isGravity && !isAdmin && allowedCompanies.length > 0) {
      const lower = allowedCompanies.map(s => s.toLowerCase());
      mapped = mapped.filter(r => r.company && lower.includes(r.company.toLowerCase()));
    }

    return mapped;
  }, [isAuthenticated, enrollData, bookingMap, isGravity, companyId, isAdmin, allowedCompanies]);

  return {
    records,
    loading: isAuthenticated ? (enrollLoading || bookingLoading || profileLoading || permLoading) : false,
    error: enrollError,
  };
}
