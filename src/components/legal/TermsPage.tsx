import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection, LegalList } from './LegalLayout';

const CONTACT_EMAIL = 'support@timemachinechat.com';

export function TermsPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Terms of Service" lastUpdated="26 August 2026">
      <LegalSection heading="Agreement">
        <p>
          These terms govern your use of TimeMachine Chat. By creating an account or using the
          service you accept them. If you do not agree, do not use the service.
        </p>
        <p>
          You must be at least 13 years old to use TimeMachine, and old enough to form a binding
          contract where you live.
        </p>
      </LegalSection>

      <LegalSection heading="Your account">
        <LegalList
          items={[
            <>You are responsible for keeping your credentials secure and for activity under your account.</>,
            <>Give accurate information when you sign up, and keep it current.</>,
            <>One person per account. Do not share or resell access.</>,
            <>Tell us promptly if you believe your account has been compromised.</>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>You agree not to use TimeMachine to:</p>
        <LegalList
          items={[
            <>Break the law, or help anyone else do so.</>,
            <>Generate content that sexualises minors, incites violence, harasses a person, or is designed to defraud or deceive.</>,
            <>Attempt to extract credentials, bypass our rate limits, or access another user's data.</>,
            <>Scrape, resell, or resell access to the service or to the AI providers behind it.</>,
            <>Upload malware, or content you do not have the right to share.</>,
          ]}
        />
        <p>
          Your use is also subject to the acceptable-use policies of the AI providers that process
          your prompts. A breach of theirs is a breach of these terms. We may suspend or terminate
          an account that violates this section.
        </p>
      </LegalSection>

      <LegalSection heading="AI output — what it is and is not">
        <p>
          TimeMachine generates responses using third-party language models. Output may be
          inaccurate, incomplete, or offensive, and identical prompts can produce different
          answers. Verify anything you intend to rely on.
        </p>
        <p className="text-white/70">
          Output is not professional advice. Nothing TimeMachine produces is medical, legal,
          financial, or safety advice, and the Healthcare feature is an information tool rather
          than a clinical one. Consult a qualified professional for decisions that matter.
        </p>
      </LegalSection>

      <LegalSection heading="Your content">
        <p>
          You keep ownership of what you submit. You grant us the licence needed to operate the
          service — to store your content, display it back to you, and send it to the AI providers
          and tools required to generate a response. Your messages might be sent to third-party AI
          providers for that purpose.
        </p>
        <p>
          We do not use your conversations to train models, and we do not sell them.
        </p>
        <p>
          As between you and us, you may use the output you generate, subject to these terms and to
          the terms of the provider that produced it. Output is not necessarily unique — other
          users may receive similar responses to similar prompts.
        </p>
      </LegalSection>

      <LegalSection heading="Availability, limits, and changes">
        <LegalList
          items={[
            <>The service is provided on an "as is" and "as available" basis, without warranties of any kind.</>,
            <>Usage limits apply per account and per persona, and may change. Free and trial usage is limited by design.</>,
            <>We may add, change, or remove features, and may suspend the service for maintenance.</>,
            <>We may update these terms. Continued use after a material change means you accept the new version.</>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="Liability">
        <p>
          To the fullest extent permitted by law, TimeMachine is not liable for indirect,
          incidental, or consequential damages, or for lost profits or data, arising from your use
          of the service. Nothing here limits liability that cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection heading="Ending your use">
        <p>
          You can delete your account at any time from Account settings; deletion is immediate and
          cannot be undone. We may suspend or terminate an account that breaches these terms or
          creates risk for other users or for the service.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about these terms:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-400/80 hover:text-purple-300">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <p className="text-white/35 text-sm">
          See also our <Link to="/privacy" className="text-purple-400/80 hover:text-purple-300">Privacy Policy</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

export default TermsPage;
