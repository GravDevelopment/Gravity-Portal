import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", os.getenv("FRONTEND_URL", "")])

SMTP_HOST     = "smtp.office365.com"
SMTP_PORT     = 587
SMTP_USER     = os.getenv("SMTP_USER", "development@gravitygh.co.za")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL    = SMTP_USER
TO_EMAIL      = "ewan@gravitygh.co.za"


@app.route("/api/rebook", methods=["POST"])
def rebook():
    data = request.get_json(force=True)

    from_name   = data.get("from_name", "Portal User")
    from_email  = data.get("from_email", "")
    from_phone  = data.get("from_phone", "—")
    candidate   = data.get("candidate_name", "—")
    candidate_id = data.get("candidate_id", "—")
    company     = data.get("candidate_company", "—")
    course      = data.get("course_name", "—")
    expiry      = data.get("course_expiry", "—")

    subject = f"Rebook Request – {candidate} – {course}"

    body = f"""Hi Ewan,

{from_name} wants to rebook the following candidate:

── Candidate ──────────────────────
Name:       {candidate}
ID Number:  {candidate_id}
Company:    {company}

── Course ─────────────────────────
Course:     {course}
Expiry:     {expiry}

── Contact ────────────────────────
Email:  {from_email}
Phone:  {from_phone}

Please arrange the rebooking at your earliest convenience.

Kind regards,
{from_name} (via Gravity Training Portal)
"""

    msg = MIMEMultipart()
    msg["From"]    = FROM_EMAIL
    msg["To"]      = TO_EMAIL
    msg["Subject"] = subject
    if from_email:
        msg["Reply-To"] = from_email
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.sendmail(FROM_EMAIL, TO_EMAIL, msg.as_string())
        return jsonify({"ok": True}), 200
    except Exception as e:
        app.logger.error("SMTP error: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=True)
