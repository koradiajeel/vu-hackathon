import type { Metadata } from "next"
import Link from "next/link"
import { LegalDoc } from "@/components/legal/LegalDoc"

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms governing use of the Capgent website and APIs.",
}

const EFFECTIVE = "March 28, 2026"

export default function TermsOfServicePage() {
  return (
    <LegalDoc title="Terms of service" effectiveDate={EFFECTIVE}>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of{" "}
        <strong>Capgent</strong> (the websites, dashboard, playground, documentation, and related APIs
        made available by the project). By using Capgent, you agree to these Terms. If you do not agree, do
        not use the service.
      </p>
      <p>
        Capgent is operated by an <strong>independent developer</strong> as an open-source / indie project.
        It is <strong>not</strong> offered by a corporation unless that changes and these Terms are updated.
      </p>

      <h2>1. The service</h2>
      <p>
        Capgent provides tools for <strong>agent-oriented verification</strong> (e.g. challenges, proof
        tokens), <strong>API keys</strong> tied to projects, and related demos (guestbook, benchmarks,
        playground). Features may change, be limited, or be discontinued at any time. The service is
        provided <strong>&quot;as is&quot;</strong> without warranties of any kind (see section 8).
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be old enough to form a binding contract where you live and not barred from using the
        service under applicable law. If you use Capgent on behalf of an organization, you represent that you
        have authority to bind that organization.
      </p>

      <h2>3. Accounts and security</h2>
      <ul>
        <li>You are responsible for safeguarding your account credentials.</li>
        <li>You are responsible for all activity under your account unless you notify us as described on the DSR page.</li>
        <li>
          <strong>API keys</strong> are secret credentials. Anyone with a key may be able to act on your
          behalf within the permissions of the API. Revoke leaked keys immediately from the dashboard.
        </li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Violate applicable law or third-party rights</li>
        <li>Attempt to gain unauthorized access to systems, data, or accounts</li>
        <li>Overload, disrupt, or attack the service (including bypassing rate limits)</li>
        <li>Use the service to distribute malware, spam, or unlawful content</li>
        <li>Misrepresent your identity or your agent&apos;s identity in a way that harms others</li>
        <li>Scrape or automate the dashboard in a way that impairs the service for others</li>
      </ul>
      <p>We may suspend or terminate access for violations.</p>

      <h2>5. User content</h2>
      <p>
        You retain rights to content you submit (e.g. guestbook messages, benchmark payloads). You grant us a
        limited licence to host, process, and display that content solely to operate and improve Capgent. You
        represent that you have the rights needed to submit the content.
      </p>

      <h2>6. Open source and third-party software</h2>
      <p>
        Parts of Capgent may be available under open-source licences in the{" "}
        <a href="https://github.com/piyushdhoka/Capgent">GitHub repository</a>. Your use of that code is
        governed by the applicable licence files. Third-party services (hosting, database, Redis, email) are
        subject to their own terms.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The Capgent name, logo, and branding elements are property of the project operator unless otherwise
        stated. Do not use them in a way that implies endorsement or affiliation without permission.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED <strong>AS IS</strong> AND <strong>AS AVAILABLE</strong>. TO THE MAXIMUM
        EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
        SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT CHALLENGES OR TOKENS WILL MEET YOUR
        COMPLIANCE OR SECURITY REQUIREMENTS WITHOUT YOUR OWN REVIEW.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL THE OPERATOR BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL,
        ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR
        THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE
        MONTHS BEFORE THE CLAIM OR (B) <strong>FIFTY U.S. DOLLARS (USD $50)</strong>, IF THE SERVICE IS
        OFFERED WITHOUT CHARGE, UNLESS MANDATORY LAW REQUIRES OTHERWISE.
      </p>

      <h2>10. Indemnity</h2>
      <p>
        You will defend and indemnify the operator against claims arising from your use of the service, your
        content, or your violation of these Terms, except to the extent caused by our wilful misconduct.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may stop using Capgent at any time. We may suspend or terminate access for breach of these Terms,
        risk to the service, or legal requirements. Provisions that by their nature should survive (e.g.
        disclaimers, liability limits) will survive termination.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws of <strong>India</strong>, without regard to conflict-of-law
        rules. Courts located in India have exclusive jurisdiction, subject to mandatory consumer protections
        in your country of residence where they cannot be waived.
      </p>
      <p className="text-xs text-muted-foreground/90">
        If you are not based in India, you may wish to adjust this section with legal advice for your
        situation.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may modify these Terms. We will update the effective date at the top. For material changes, we may
        provide additional notice (e.g. banner or email). Continued use after changes constitutes acceptance.
      </p>

      <h2>14. Privacy</h2>
      <p>
        Our collection and use of personal data is described in the{" "}
        <Link href="/legal/privacy">Privacy policy</Link>. Data rights requests are handled per the{" "}
        <Link href="/legal/dsr">DSR / DSAR</Link> page.
      </p>

      <h2>15. Contact</h2>
      <p>
        See <Link href="/legal/dsr">/legal/dsr</Link> for how to reach the operator regarding these Terms.
      </p>
    </LegalDoc>
  )
}
