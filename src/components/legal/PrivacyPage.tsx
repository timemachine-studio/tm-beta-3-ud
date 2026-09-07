import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection, LegalList } from './LegalLayout';

const CONTACT_EMAIL = 'privacy@timemachinechat.com';

// NOTE: this describes what the app does TODAY — chat history is stored in
// Supabase. Gate LS moves message storage on-device; when LS.1 lands this
// document must be revised (see production-check.md 0.8 and LS.1).
export function PrivacyPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Privacy Policy" lastUpdated="26 August 2026">
      <LegalSection heading="The short version">
        <p>
          We collect the account details you give us, the conversations you have with TimeMachine,
          and a small amount of technical data needed to keep the service running. We do not sell
          your data and we do not train models on your conversations.
        </p>
        <p className="text-white/70">
          To generate a reply, your messages might be sent to third-party AI providers. That is how
          the product works, so treat anything you type as leaving your device.
        </p>
      </LegalSection>

      <LegalSection heading="What we collect">
        <LegalList
          items={[
            <><span className="text-white/70">Account information</span> — your email address, password (stored hashed by our authentication provider), and any nickname or profile details you choose to add.</>,
            <><span className="text-white/70">Conversation content</span> — the messages you send, the AI's replies, and the chat sessions they belong to.</>,
            <><span className="text-white/70">AI memories</span> — facts the assistant saves about you during a conversation so it can refer back to them later (for example a stated preference or something about your work). You can view and delete these at any time from the Memories page.</>,
            <><span className="text-white/70">Uploads</span> — images and PDFs you attach to a conversation, and images generated for you.</>,
            <><span className="text-white/70">Notes and lists</span> — anything you create in Notes, Albums, group chats, or the Lifestyle tools.</>,
            <><span className="text-white/70">Technical data</span> — your IP address, used to enforce rate limits and prevent abuse, and a signed cookie used for the same purpose when you are not signed in.</>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="Who receives your prompts">
        <p>
          TimeMachine does not run its own language models. When you send a message, its content —
          together with any attached image or PDF text and any AI memories relevant to the
          conversation — might be sent to one of the following processors, which generates the
          reply:
        </p>
        <LegalList
          items={[
            <><span className="text-white/70">NVIDIA</span> (NVIDIA NIM / integrate.api.nvidia.com)</>,
            <><span className="text-white/70">Groq</span> (api.groq.com)</>,
            <><span className="text-white/70">Cerebras</span> (api.cerebras.ai)</>,
            <><span className="text-white/70">Pollinations</span> (gen.pollinations.ai) — also used for image and audio generation</>,
            <><span className="text-white/70">Eaon</span> (api.eaon.dev)</>,
            <><span className="text-white/70">FreeTheAI</span> (api.freetheai.xyz)</>,
          ]}
        />
        <p>
          Which one handles a given message depends on the persona and mode you are using. Each
          provider has its own privacy policy and retention practices, which we do not control.
        </p>
        <p>
          If you enable an MCP server or a connected tool under Flight Controls, the parts of your
          conversation needed to run that tool are also sent to the operator of that server. The
          app asks for your approval before a tool call runs.
        </p>
        <p>
          We also use <span className="text-white/70">Supabase</span> for authentication, database
          storage, and file storage, and <span className="text-white/70">Vercel</span> for hosting.
        </p>
      </LegalSection>

      <LegalSection heading="AI-generated content">
        <p>
          Replies are produced by a language model. They can be wrong, out of date, or misleading,
          and they are not professional advice — medical, legal, financial, or otherwise. The
          Healthcare feature searches a drug reference database and is for information only; it is
          not a diagnosis and does not replace a clinician.
        </p>
        <p>
          Do not send us information you would not want processed by a third-party AI provider —
          including anyone else's personal data, credentials, or payment details.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <LegalList
          items={[
            <>Account data and profile details are kept for as long as your account exists.</>,
            <>Conversations, notes, albums, and AI memories are kept until you delete them, or until you delete your account.</>,
            <>Rate-limiting records are keyed to a rolling 24-hour window and are discarded after it passes.</>,
            <>When you delete your account we remove your profile, AI memories, chat sessions and messages, saved images, and uploaded files. Backups may retain copies for a short period before they age out.</>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="Your choices">
        <LegalList
          items={[
            <><span className="text-white/70">See and delete your memories</span> — the Memories page lists everything the assistant has saved about you.</>,
            <><span className="text-white/70">Delete a conversation</span> — from chat history, at any time.</>,
            <><span className="text-white/70">Delete your account</span> — from Account settings. This is immediate and cannot be undone.</>,
            <><span className="text-white/70">Access, correction, and portability</span> — if you are in a jurisdiction that grants these rights (including the UK/EU under GDPR and California under CCPA/CPRA), write to us and we will action your request.</>,
          ]}
        />
        <p>
          We do not sell or share personal information for cross-context behavioural advertising.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          TimeMachine is not intended for children under 13, and we do not knowingly collect their
          personal information. If you believe a child has created an account, contact us and we
          will remove it.
        </p>
      </LegalSection>

      <LegalSection heading="Changes and contact">
        <p>
          If we make a material change to this policy we will update the date at the top of this
          page and, where the change is significant, tell you in the app.
        </p>
        <p>
          Questions, or a request about your data:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-400/80 hover:text-purple-300">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <p className="text-white/35 text-sm">
          See also our <Link to="/terms" className="text-purple-400/80 hover:text-purple-300">Terms of Service</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

export default PrivacyPage;
