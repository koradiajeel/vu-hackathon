import type { Metadata } from "next"
import Link from "next/link"
import { LegalDoc } from "@/components/legal/LegalDoc"

export const metadata: Metadata = {
  title: "Data subject requests (DSR / DSAR)",
  description: "How to exercise privacy rights for data processed by Capgent.",
}

const EFFECTIVE = "March 28, 2026"

const GITHUB_ISSUES = "https://github.com/piyushdhoka/Capgent/issues"

export default function DsrPage() {
  return (
    <LegalDoc title="Data subject requests (DSR / DSAR)" effectiveDate={EFFECTIVE}>
      <p>
        This page explains how to exercise privacy rights for personal data processed in connection with{" "}
        <strong>Capgent</strong> (web app, dashboard, and APIs described in the{" "}
        <a href="https://github.com/piyushdhoka/Capgent">project repository</a>). Capgent is operated by an
        independent developer; there is no dedicated enterprise support desk.
      </p>

      <h2>1. What is a DSR / DSAR?</h2>
      <p>
        A <strong>data subject request (DSR)</strong> is a request from an individual about their personal data.
        A <strong>data subject access request (DSAR)</strong> is a request to access (receive a copy of) that
        data. Depending on where you live (e.g. EEA, UK, California), you may also have rights to correction,
        deletion, restriction, objection, or portability.
      </p>

      <h2>2. What you can request</h2>
      <p>Examples of requests we can process when we can verify your identity:</p>
      <ul>
        <li>
          <strong>Access:</strong> A summary of categories of personal data we hold about you in connection
          with Capgent, and a copy where appropriate.
        </li>
        <li>
          <strong>Correction:</strong> Fixing inaccurate account or profile data you cannot fix in the UI.
        </li>
        <li>
          <strong>Deletion:</strong> Deleting your account and associated dashboard data where technically
          feasible and not required to be retained by law.
        </li>
        <li>
          <strong>Objection / restriction:</strong> Where applicable law allows, limiting certain processing.
        </li>
      </ul>
      <p>
        Some API-side data (e.g. ephemeral challenge state, aggregated logs) may not be tied to you in a
        identifiable way; we will explain that in our response where relevant.
      </p>

      <h2>3. How to submit a request</h2>
      <p>
        <strong>Preferred channel:</strong> Open a GitHub issue in the Capgent repository using the{" "}
        <a href={GITHUB_ISSUES}>Issues</a> tab. Title it clearly (e.g. &quot;Privacy / DSR request&quot;) and
        include:
      </p>
      <ul>
        <li>Your name and the email address associated with your Capgent account</li>
        <li>The type of request (access, deletion, correction, etc.)</li>
        <li>Any relevant details (e.g. approximate signup date) to help us locate your data</li>
      </ul>
      <p>
        <strong>Alternative:</strong> If you cannot use GitHub, contact via the professional channels linked
        from the site footer (e.g. LinkedIn) with the same information; responses may be slower.
      </p>

      <h2>4. Verification</h2>
      <p>
        To protect your privacy, we will take reasonable steps to verify that the request comes from you (or
        your authorized agent). This may include confirming control of your account email or additional
        checks for sensitive requests.
      </p>

      <h2>5. Timelines</h2>
      <p>
        We aim to respond within <strong>30 days</strong>. Complex requests may require an extension where
        permitted by law; we will notify you if that applies.
      </p>

      <h2>6. Appeals and complaints</h2>
      <p>
        If you disagree with our response, reply in the same thread (GitHub issue or email chain) explaining
        why. You may also lodge a complaint with your local data protection authority (e.g. a supervisory
        authority in the EEA/UK).
      </p>

      <h2>7. Authorized agents</h2>
      <p>
        If an agent submits a request on your behalf, we may require proof of authorization and may still
        need to verify your identity directly.
      </p>

      <h2>8. Related policies</h2>
      <ul>
        <li>
          <Link href="/legal/privacy">Privacy policy</Link> — what we collect and why
        </li>
        <li>
          <Link href="/legal/terms">Terms of service</Link> — rules for using the service
        </li>
      </ul>
    </LegalDoc>
  )
}
