import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Presense",
  description: "The terms for using Presense.",
};

export default function TermsPage() {
  return (
    <>
      <h1 className="text-page-title">Terms of Service</h1>
      <p>
        These terms apply when you use Presense, which is run by{" "}
        {LEGAL.operator} in {LEGAL.country}. By signing in, you agree to them
        and to our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Who can use Presense</h2>
      <p>You must be 18 or older.</p>

      <h2>Your content</h2>
      <p>
        What you put in Presense is yours. You allow us to store and process it
        only so we can run the service for you.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t use Presense for anything illegal, and don&apos;t try to
        break, overload or get around its security. We may suspend accounts that
        do.
      </p>

      <h2>The service</h2>
      <p>
        Presense is provided &ldquo;as is&rdquo;, without warranties. We may
        change or discontinue features. If we shut Presense down, we will give
        reasonable notice so you can save your data. Keep your own copy of
        anything important.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or
        consequential losses, or for loss of data, arising from your use of
        Presense.
      </p>

      <h2>Ending your account</h2>
      <p>You can delete your account at any time from Settings.</p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of India.</p>

      <h2>Changes</h2>
      <p>If we change these terms, we will update the date below.</p>
    </>
  );
}
