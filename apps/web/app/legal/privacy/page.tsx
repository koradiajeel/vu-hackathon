import type { Metadata } from "next"
import Link from "next/link"
import { LegalDoc } from "@/components/legal/LegalDoc"

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Capgent collects, uses, and protects personal data.",
}

const EFFECTIVE = "March 28, 2026"

export default function PrivacyPolicyPage() {
  return (
    <LegalDoc title="Privacy policy" effectiveDate={EFFECTIVE}>
      <p>
        This policy describes how <strong>Capgent</strong> (the service available at{" "}
        <a href="https://capgent.vercel.app">capgent.vercel.app</a> and related APIs) handles personal
        information. The service is operated by an independent developer (
        <strong>Piyush Dhoka</strong>). Capgent is <strong>not</strong> a registered company; it is an
        open-source / indie project.
      </p>

      <h2>1. Who is responsible?</h2>
      <p>
        For the purposes of this policy, the <strong>data controller</strong> for personal data processed
        through the Capgent websites and APIs described in this repository is the project operator. For
        privacy requests, use the contact methods in{" "}
        <Link href="/legal/dsr">Data subject requests (DSR / DSAR)</Link>.
      </p>

      <h2>2. What we collect</h2>
      <h3>2.1 Account and dashboard data</h3>
      <p>If you create an account, we may process:</p>
      <ul>
        <li>Email address and (if provided) display name</li>
        <li>Authentication data (e.g. password hashes; we do not store plaintext passwords)</li>
        <li>Email verification status and related timestamps</li>
        <li>Project names, API key metadata (identifiers, labels, creation dates), and similar dashboard content</li>
      </ul>

      <h3>2.2 Service and API usage</h3>
      <ul>
        <li>
          <strong>Challenges and verification:</strong> Technical data required to issue and validate challenges
          (e.g. nonces, payloads, agent name/version strings you send).
        </li>
        <li>
          <strong>Guestbook and benchmarks:</strong> Content you submit (e.g. guestbook messages, benchmark
          reports) and associated metadata.
        </li>
        <li>
          <strong>Logs and security:</strong> Hosting providers may process IP addresses, request metadata,
          and error logs as part of operating the service.
        </li>
      </ul>

      <h3>2.3 Cookies and local storage</h3>
      <p>
        We use cookies (or similar technologies) for session sign-in, theme preferences, and proof/identity
        tokens where the product flow requires them (e.g. playground → protected demo). You can control
        cookies through your browser settings.
      </p>

      <h2>3. Why we use your data (purposes)</h2>
      <ul>
        <li>To provide, secure, and improve the Capgent web app and API</li>
        <li>To authenticate users, manage projects/API keys, and enforce rate limits</li>
        <li>To send transactional email (e.g. verification) when you sign up</li>
        <li>To comply with law and respond to lawful requests where required</li>
      </ul>

      <h2>4. Legal bases (EEA / UK visitors)</h2>
      <p>
        Where GDPR applies, we rely on <strong>contract</strong> (providing the service you asked for),{" "}
        <strong>legitimate interests</strong> (security, abuse prevention, product improvement), and where
        applicable <strong>consent</strong> (e.g. non-essential communications if we add them). You may
        withdraw consent where processing is consent-based.
      </p>

      <h2>5. How long we keep data</h2>
      <p>
        We retain data only as long as needed for the purposes above, unless a longer period is required by
        law. Challenge data is typically short-lived; account and project data remain until you delete them or
        close your account (and for a short period in backups where applicable).
      </p>

      <h2>6. Sharing and subprocessors</h2>
      <p>We use infrastructure providers to run the product. Categories include:</p>
      <ul>
        <li>
          <strong>Hosting / edge:</strong> e.g. Vercel (web), Cloudflare (API Worker) — may process request
          metadata.
        </li>
        <li>
          <strong>Database:</strong> e.g. Neon (PostgreSQL) for accounts, projects, and keys.
        </li>
        <li>
          <strong>Cache / KV:</strong> e.g. Upstash (Redis) for challenges, rate limits, guestbook, benchmarks
          as configured.
        </li>
        <li>
          <strong>Email:</strong> SMTP provider you configure for transactional mail.
        </li>
        <li>
          <strong>Analytics:</strong> if enabled (e.g. Vercel Analytics), aggregated usage metrics.
        </li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>7. International transfers</h2>
      <p>
        Providers may process data in the United States and other regions. Where required, we rely on
        appropriate safeguards (e.g. Standard Contractual Clauses offered by vendors) or other lawful transfer
        mechanisms.
      </p>

      <h2>8. Your rights</h2>
      <p>
        Depending on your location, you may have rights to access, rectify, delete, restrict, or object to
        certain processing, and to data portability. See{" "}
        <Link href="/legal/dsr">Data subject requests (DSR / DSAR)</Link> for how to submit a request.
      </p>

      <h2>9. Children</h2>
      <p>
        Capgent is not directed at children under 16. We do not knowingly collect personal information from
        children.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy. The &quot;Effective date&quot; at the top will change when we do.
        Continued use after changes means you accept the updated policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        Privacy questions and requests: follow the process on{" "}
        <Link href="/legal/dsr">/legal/dsr</Link>. Project repository:{" "}
        <a href="https://github.com/piyushdhoka/Capgent">github.com/piyushdhoka/Capgent</a>.
      </p>
    </LegalDoc>
  )
}
