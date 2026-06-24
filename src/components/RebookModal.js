import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { mailScopes } from '../auth/msalConfig';
import './RebookModal.css';

const COUNTRY_CODES = [
  { code: '+27',  label: '🇿🇦 +27'  },
  { code: '+1',   label: '🇺🇸 +1'   },
  { code: '+44',  label: '🇬🇧 +44'  },
  { code: '+61',  label: '🇦🇺 +61'  },
  { code: '+49',  label: '🇩🇪 +49'  },
  { code: '+33',  label: '🇫🇷 +33'  },
  { code: '+971', label: '🇦🇪 +971' },
  { code: '+254', label: '🇰🇪 +254' },
  { code: '+234', label: '🇳🇬 +234' },
  { code: '+263', label: '🇿🇼 +263' },
  { code: '+267', label: '🇧🇼 +267' },
  { code: '+260', label: '🇿🇲 +260' },
];

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA');
}

export default function RebookModal({ record, userName, userEmail, onClose }) {
  const { instance, accounts } = useMsal();
  const [email, setEmail]     = useState(userEmail ?? '');
  const [countryCode, setCC]  = useState('+27');
  const [phone, setPhone]     = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  if (!record) return null;

  const course     = record.course        ?? '—';
  const candidate  = record.candidateName ?? '—';
  const idNumber   = record.idNumber      ?? '—';
  const company    = record.company       ?? '—';
  const expiry     = fmt(record.expiryDate);
  const fullPhone  = phone ? `${countryCode} ${phone}` : '—';

  async function handleSend() {
    setError('');
    setSending(true);
    try {
      let accessToken;
      try {
        ({ accessToken } = await instance.acquireTokenSilent({
          scopes:  mailScopes,
          account: accounts[0],
        }));
      } catch {
        ({ accessToken } = await instance.acquireTokenPopup({
          scopes:  mailScopes,
          account: accounts[0],
        }));
      }

      const body = `Hi Ewan,

${userName || 'A portal user'} wants to rebook the following candidate:

── Candidate ──────────────────────
Name:       ${candidate}
ID Number:  ${idNumber}
Company:    ${company}

── Course ─────────────────────────
Course:     ${course}
Expiry:     ${expiry}

── Contact ────────────────────────
Email:  ${email || '—'}
Phone:  ${fullPhone}

Please arrange the rebooking at your earliest convenience.

Kind regards,
${userName || 'Portal User'}`;

      const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: `Rebook Request – ${candidate} – ${course}`,
            body:    { contentType: 'Text', content: body },
            toRecipients: [{ emailAddress: { address: 'development@gravitygh.co.za' } }],
            replyTo:      [{ emailAddress: { address: email } }],
          },
          saveToSentItems: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }

      setSent(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(`Failed to send: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  const canSend = email.trim().length > 0 && !sending && !sent;

  return (
    <div className="rebook-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rebook-modal">
        <h2>Rebook Candidate</h2>

        <div className="rebook-info-block">
          <div className="rebook-info-row">
            <span className="rebook-info-label">Candidate</span>
            <span className="rebook-info-value">{candidate}</span>
          </div>
          <div className="rebook-info-row">
            <span className="rebook-info-label">ID Number</span>
            <span className="rebook-info-value">{idNumber}</span>
          </div>
          <div className="rebook-info-row">
            <span className="rebook-info-label">Company</span>
            <span className="rebook-info-value">{company}</span>
          </div>
        </div>

        <div className="rebook-info-block">
          <div className="rebook-info-row">
            <span className="rebook-info-label">Course</span>
            <span className="rebook-info-value">{course}</span>
          </div>
          <div className="rebook-info-row">
            <span className="rebook-info-label">Expiry Date</span>
            <span className="rebook-info-value">{expiry}</span>
          </div>
        </div>

        <div className="rebook-fields">
          <div className="rebook-field">
            <label>Your Email Address *</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={sending || sent}
            />
          </div>
          <div className="rebook-field">
            <label>Your Phone Number</label>
            <div className="rebook-phone-row">
              <select
                className="rebook-country-select"
                value={countryCode}
                onChange={e => setCC(e.target.value)}
                disabled={sending || sent}
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input
                type="tel"
                placeholder="82 123 4567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={sending || sent}
              />
            </div>
          </div>
        </div>

        {error && <p className="rebook-error">{error}</p>}
        {sent  && <p className="rebook-success">✓ Rebook request sent to Ewan!</p>}

        <div className="rebook-actions">
          <button className="rebook-btn rebook-btn--cancel" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="rebook-btn rebook-btn--send" onClick={handleSend} disabled={!canSend}>
            {sending ? 'Sending…' : 'Send Rebook Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
