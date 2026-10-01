import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Presense",
  description: "What Presense collects, why, and your rights over it.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-page-title">Privacy Policy</h1>
      <p>
        Presense is run by {LEGAL.operator} in {LEGAL.country}{" "}
        (&ldquo;we&rdquo;). This policy explains what personal data we collect,
        why, and what you can do about it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> the email address, name and profile
          picture from the Google account you sign in with.
        </li>
        <li>
          <strong>What you put in Presense:</strong> tasks, notes, settings and
          activity such as completed rituals.
        </li>
        <li>
          <strong>Technical data:</strong> your IP address (to stop abuse),
          error reports when something breaks, and page-speed measurements.
          These include your browser type and the page you were on.
        </li>
      </ul>
      <p>
        We only use cookies that keep you signed in. There are no advertising or
        analytics trackers.
      </p>

      <h2>Why we use it</h2>
      <p>
        To run Presense for you: sign you in, store and sync your data, keep the
        service secure, and fix bugs. We do not sell your data, use it for
        advertising, or share it with anyone except the providers below.
      </p>

      <h2>Who processes it for us</h2>
      <ul>
        <li>Supabase: database and sign-in (servers in Australia)</li>
        <li>Vercel: hosting (United States)</li>
        <li>Sentry: error reports (United States)</li>
        <li>Upstash: rate limiting by IP address</li>
        <li>Google: sign-in</li>
      </ul>
      <p>This means your data is stored and processed outside India.</p>

      <h2>How long we keep it</h2>
      <p>
        For as long as you have an account. When you delete your account, your
        data is erased from our database immediately. Copies in our
        providers&apos; backups and logs expire on their own schedules.
      </p>

      <h2>Your rights</h2>
      <p>You can:</p>
      <ul>
        <li>see, correct or update your data in the app;</li>
        <li>
          delete your account and all its data at any time from Settings, which
          also withdraws your consent.
        </li>
      </ul>
      <p>
        You can complain to the Data Protection Board of India. If you live in
        the EU or UK, you can also complain to your local data protection
        authority.
      </p>

      <h2>Age</h2>
      <p>
        Presense is for people aged 18 or over. We do not knowingly collect data
        from anyone younger.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit, and each account can only read its own
        data. If a breach affects your data, we will tell you and the
        authorities as the law requires.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we will update the date below. See also our{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>
    </>
  );
}
