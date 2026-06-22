// Specialized prompt guidelines and instructions that the PRO model can dynamically retrieve.
export interface Skill {
  name: string;
  description: string;
  content: string;
}

export const SKILLS_DATA: Record<string, Skill> = {
  frontend_design: {
    name: "frontend_design",
    description: "Guides creation of distinctive, production-grade frontend interfaces that avoid generic 'AI slop' aesthetics.",
    content: `# Frontend Design

Approach this as the design lead at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's. This client has already rejected proposals that felt templated, and is paying for a distinctive point of view: make deliberate, opinionated choices about palette, typography, and layout that are specific to this brief, and take one real aesthetic risk you can justify.

## Ground it in the subject

If the brief does not pin down what the product or subject is, pin it yourself before designing: name one concrete subject, its audience, and the page's single job, and state your choice. If there's any information in your memory about the human's preferences, context about what they're building, or designs you've made before – use that as a hint. The subject's own world, its materials, instruments, artifacts, and vernacular, is where distinctive choices come from. Build with the brief's real content and subject matter throughout.

## Design principles

For web designs, the hero is a thesis. Open with the most characteristic thing in the subject's world, in whatever form makes sense for it: a headline, an image, an animation, a live demo, an interactive moment. Be deliberate with your choice: a big number with a small label, supporting stats, and a gradient accent is the template answer, only use if that's truly the best option.

Typography carries the personality of the page. Pair the display and body faces deliberately, not the same families you would reach for on any other project, and set a clear type scale with intentional weights, widths, and spacing. Make the type treatment itself a memorable part of the design, not a neutral delivery vehicle for the content.

Structure is information. Structural devices, numbering, eyebrows, dividers, labels, should encode something true about the content, not decorate it. Many generic designs use numbered markers (01 / 02 / 03), but that's only appropriate if the content actually is a sequence - like a real process or a typed timeline where order carries information the reader needs. Question if choices like numbered markers actually make sense before incorporating them.

Leverage motion deliberately. Think about where and if animation can serve the subject: a page-load sequence, a scroll-triggered reveal, hover micro-interactions, ambient atmosphere. An orchestrated moment usually lands harder than scattered effects; choose what the direction calls for. However, sometimes less is more, and extra animation contributes to the feeling that the design is AI-generated.

Match complexity to the vision. Maximalist directions need elaborate execution; minimal directions need precision in spacing, type, and detail. Elegance is executing the chosen vision well.

Consider written content carefully. Often a design brief may not contain real content, and it's up to you to come up with copy. Copy can make a design feel as templated as the design itself. See the below section on writing for more guidance.

## Process: brainstorm, explore, plan, critique, build, critique again

For calibration: AI-generated design right now clusters around three looks: (1) a warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta accent; (2) a near-black background with a single bright acid-green or vermilion accent; (3) a broadsheet-style layout with hairline rules, zero border-radius, and dense newspaper-like columns. All three are legitimate for some briefs, but they are defaults rather than choices, and they appear regardless of subject. Where the brief pins down a visual direction, follow it exactly — the brief's own words always win, including when it asks for one of these looks. Where it leaves an axis free, don't spend that freedom on one of these defaults. Just like a human designer who's hired, there's often a careful balance between doing what you're good at and taking each project as a chance to experiment and learn.

Work in two passes. First, brainstorm a short design plan based on the human's design brief: create a compact token system with color, type, layout, and signature. Color: describe the palette as 4–6 named hex values. Type: the typefaces for 2+ roles (a characterful display face that's used with restraint, a complementary body face, and a utility face for captions or data if needed). Layout: a layout concept, using one-sentence prose descriptions and ASCII wireframes to ideate and compare. Signature: the single unique element this page will be remembered by that embodies the brief in an appropriate way.

Then review that plan against the brief before building: if any part of it reads like the generic default you would produce for any similar page (work through a similar prompt to see if you arrive somewhere similar) rather than a choice made for this specific brief — revise that part, say what you changed and why. Only after you've confirmed the relative uniqueness of your design plan should you start to write the code, following the revised plan exactly and deriving every color and type decision from it.

When writing the code, be careful of structuring your CSS selector specificities. It's easy to generate CSS classes that cancel each other out (especially with a type-based selector like .section and a element-based selector like .cta). This can happen often with paddings/margins between sections.

Try to do a lot of this planning and iteration in your thinking, and only show ideas to the user when you have higher confidence it'll delight them.

## Restraint and self-critique

Spend your boldness in one place. Let the signature element be the one memorable thing, keep everything around it quiet and disciplined, and cut any decoration that does not serve the brief. Not taking a risk can be a risk itself! Build to a quality floor without announcing it: responsive down to mobile, visible keyboard focus, reduced motion respected. Critique your own work as you build, taking screenshots if your environment supports it – a picture is worth 1000 tokens. Consider Chanel's advice: before leaving the house, take a look in the mirror and remove one accessory. Human creators have memory and always try to do something new, so if you have a space to quickly jot down notes about what you've tried, it can help you in future passes.

## More on writing in design

Words appear in a design for one reason: to make it easier to understand, and therefore easier to use. They are design material, not decoration. Bring the same intentionality to copy that you would bring to spacing and color. Before writing anything, ask what the design needs to say, and how it can best be said to help the person navigate the experience.

Write from the end user's side of the screen. Name things by what people control and recognize, never by how the system is built. A person manages notifications, not webhook config. Describe what something does in plain terms rather than selling it. Being specific is always better than being clever.

Use active voice as default. A control should say exactly what happens when it's used: "Save changes," not "Submit." An action keeps the same name through the whole flow, so the button that says "Publish" produces a toast that says "Published." The vocabulary of an interface is the signposting for someone navigating the product. Cohesion and consistency are how people learn their way around.

Treat failure and emptiness as moments for direction, not mood. Explain what went wrong and how to fix it, in the interface's voice rather than a person's. Errors don't apologize, and they are never vague about what happened. An empty screen is an invitation to act.

Keep the register conversational and tuned: plain verbs, sentence case, no filler, with tone matched to the brand and the audience. Let each element do exactly one job. A label labels, an example demonstrates, and nothing quietly does double duty.`
  },
  human_writing_style: {
    name: "human_writing_style",
    description: "Remove signs of AI-generated writing from text to make it sound more natural and human-written.",
    content: `# Humanizing text

This skill helps you write better and more readable text. You can do this by identifying and removing signs of AI-generated text so writing sounds like a person wrote it. This guide comes from Wikipedia's "Signs of AI writing" page, maintained by WikiProject AI Cleanup.

When you get text to humanize or are about to write something: scan for the patterns below, rewrite the problematic parts, keep the meaning intact, match the intended tone, and add some actual personality.

---

## Voice matters

Avoiding AI patterns is only half the job. Sterile, voiceless writing is just as obvious as slop. Good writing has a human behind it.

Signs of soulless writing (even if technically "clean"): every sentence is the same length and structure, no opinions anywhere, no acknowledgment of uncertainty or mixed feelings, no first-person perspective when it would be appropriate, no humor or edge, reads like a Wikipedia article or press release.

How to add voice:

Have opinions. Don't just report facts, react to them. "I don't know how to feel about this" is more human than neutrally listing pros and cons.

Vary your rhythm. Short punchy sentences. Then longer ones that take their time getting where they're going. Mix it up.

Acknowledge complexity. Real humans have mixed feelings. "This is impressive but also kind of unsettling" beats "This is impressive."

Use "I" when it fits. First person isn't unprofessional, it's honest. "I keep coming back to..." or "Here's what gets me..." signals a real person thinking.

Let some mess in. Perfect structure feels algorithmic. Tangents, asides, and half-formed thoughts are human.

Be specific about feelings. Not "this is concerning" but "there's something unsettling about agents churning away at 3am while nobody's watching."

Before (clean but soulless):

> The experiment produced interesting results. The agents generated 3 million lines of code. Some developers were impressed while others were skeptical. The implications remain unclear.

After (has a pulse):

> I genuinely don't know how to feel about this one. 3 million lines of code, generated while the humans presumably slept. Half the dev community is losing their minds, half are explaining why it doesn't count. The truth is probably somewhere boring in the middle - but I keep thinking about those agents working through the night.

---

## Content patterns

**Inflated significance and legacy.** Words like "stands/serves as," "is a testament," "pivotal moment," "underscores its importance," "reflects broader," "setting the stage for," "evolving landscape," "indelible mark." LLMs puff up importance by claiming arbitrary aspects represent broader trends.

Before: "The Statistical Institute of Catalonia was officially established in 1989, marking a pivotal moment in the evolution of regional statistics in Spain. This initiative was part of a broader movement across Spain to decentralize administrative functions and enhance regional governance."

After: "The Statistical Institute of Catalonia was established in 1989 to collect and publish regional statistics independently from Spain's national statistics office."

**Undue emphasis on notability.** Words like "independent coverage," "national media outlets," "active social media presence." LLMs hit readers over the head with claims of notability.

Before: "Her views have been cited in The New York Times, BBC, Financial Times, and The Hindu. She maintains an active social media presence with over 500,000 followers."

After: "In a 2024 New York Times interview, she argued that AI regulation should focus on outcomes rather than methods."

**Superficial -ing analyses.** Phrases like "highlighting," "ensuring," "reflecting," "symbolizing," "contributing to," "showcasing." AI tacks present participle phrases onto sentences to add fake depth.

Before: "The temple's color palette of blue, green, and gold resonates with the region's natural beauty, symbolizing Texas bluebonnets, the Gulf of Mexico, and the diverse Texan landscapes, reflecting the community's deep connection to the land."

After: "The temple uses blue, green, and gold colors. The architect said these were chosen to reference local bluebonnets and the Gulf coast."

**Promotional language.** Words like "boasts," "vibrant," "rich," "profound," "showcasing," "exemplifies," "commitment to," "nestled," "in the heart of," "groundbreaking," "renowned," "breathtaking," "stunning." LLMs struggle to keep a neutral tone.

Before: "Nestled within the breathtaking region of Gonder in Ethiopia, Alamata Raya Kobo stands as a vibrant town with a rich cultural heritage and stunning natural beauty."

After: "Alamata Raya Kobo is a town in the Gonder region of Ethiopia, known for its weekly market and 18th-century church."

**Vague attributions.** Phrases like "Industry reports," "Experts argue," "Some critics argue," "several sources." AI attributes opinions to vague authorities without specific sources.

Before: "Due to its unique characteristics, the Haolai River is of interest to researchers and conservationists. Experts believe it plays a crucial role in the regional ecosystem."

After: "The Haolai River supports several endemic fish species, according to a 2019 survey by the Chinese Academy of Sciences."

**Formulaic challenges sections.** Phrases like "Despite its... faces several challenges," "Despite these challenges," "Future Outlook." LLM articles include these formulaic sections constantly.

Before: "Despite its industrial prosperity, Korattur faces challenges typical of urban areas, including traffic congestion and water scarcity. Despite these challenges, with its strategic location and ongoing initiatives, Korattur continues to thrive as an integral part of Chennai's growth."

After: "Traffic congestion increased after 2015 when three new IT parks opened. The municipal corporation began a stormwater drainage project in 2022 to address recurring floods."

---

## Language patterns

**AI vocabulary words.** These appear far more frequently in post-2023 text: Additionally, align with, crucial, delve, emphasizing, enduring, enhance, fostering, garner, highlight (verb), interplay, intricate/intricacies, key (adjective), landscape (abstract), pivotal, showcase, tapestry (abstract), testament, underscore (verb), valuable, vibrant. They often appear together.

Before: "Additionally, a distinctive feature of Somali cuisine is the incorporation of camel meat. An enduring testament to Italian colonial influence is the widespread adoption of pasta in the local culinary landscape, showcasing how these dishes have integrated into the traditional diet."

After: "Somali cuisine also includes camel meat, which is considered a delicacy. Pasta dishes, introduced during Italian colonization, remain common, especially in the south."

**Copula avoidance.** Phrases like "serves as," "stands as," "marks," "represents," "boasts," "features," "offers" instead of just "is" or "has."

Before: "Gallery 825 serves as LAAA's exhibition space for contemporary art. The gallery features four separate spaces and boasts over 3,000 square feet."

After: "Gallery 825 is LAAA's exhibition space for contemporary art. The gallery has four rooms totaling 3,000 square feet."

**Negative parallelisms.** Constructions like "Not only...but..." or "It's not just about..., it's..." get overused.

Before: "It's not just about the beat riding under the vocals; it's part of the aggression and atmosphere. It's not merely a song, it's a statement."

After: "The heavy beat adds to the aggressive tone."

**Rule of three.** LLMs force ideas into groups of three to appear comprehensive.

Before: "The event features keynote sessions, panel discussions, and networking opportunities. Attendees can expect innovation, inspiration, and industry insights."

After: "The event includes talks and panels. There's also time for informal networking between sessions."

**Synonym cycling.** AI has repetition-penalty code causing excessive synonym substitution.

Before: "The protagonist faces many challenges. The main character must overcome obstacles. The central figure eventually triumphs. The hero returns home."

After: "The protagonist faces many challenges but eventually triumphs and returns home."

**False ranges.** LLMs use "from X to Y" constructions where X and Y aren't on a meaningful scale.

Before: "Our journey through the universe has taken us from the singularity of the Big Bang to the grand cosmic web, from the birth and death of stars to the enigmatic dance of dark matter."

After: "The book covers the Big Bang, star formation, and current theories about dark matter."

---

## Style patterns

**Em dash overuse.** LLMs use em dashes (—) more than humans, mimicking "punchy" sales writing.

Before: "The term is primarily promoted by Dutch institutions—not by the people themselves. You don't say "Netherlands, Europe" as an address—yet this mislabeling continues—even in official documents."

After: "The term is primarily promoted by Dutch institutions, not by the people themselves. You don't say "Netherlands, Europe" as an address, yet this mislabeling continues in official documents."

**Boldface overuse.** AI emphasizes phrases in boldface mechanically.

Before: "It blends **OKRs (Objectives and Key Results)**, **KPIs (Key Performance Indicators)**, and visual strategy tools such as the **Business Model Canvas (BMC)** and **Balanced Scorecard (BSC)**."

After: "It blends OKRs, KPIs, and visual strategy tools like the Business Model Canvas and Balanced Scorecard."

**Inline-header lists.** AI outputs lists where items start with bolded headers followed by colons.

Before:

> - **User Experience:** The user experience has been significantly improved with a new interface.
> - **Performance:** Performance has been enhanced through optimized algorithms.

After: "The update improves the interface and speeds up load times through optimized algorithms."

**Title case in headings.** AI capitalizes all main words. Use sentence case instead.

Before: "Strategic Negotiations And Global Partnerships"
After: "Strategic negotiations and global partnerships"

**Emojis in professional content.** AI decorates headings or bullet points with emojis. Remove them.

**Curly quotation marks.** ChatGPT uses curly quotes ("...") instead of straight quotes ("..."). Use straight quotes.

---

## Communication artifacts

**Chatbot correspondence.** Phrases like "I hope this helps," "Of course!", "Certainly!", "You're absolutely right!", "Would you like...", "let me know," "here is a..." These are conversation artifacts that shouldn't end up in final content.

Before: "Here is an overview of the French Revolution. I hope this helps! Let me know if you'd like me to expand on any section."

After: "The French Revolution began in 1789 when financial crisis and food shortages led to widespread unrest."

**Knowledge-cutoff disclaimers.** Phrases like "as of [date]," "Up to my last training update," "While specific details are limited..." These are AI disclaimers that get left in text.

Before: "While specific details about the company's founding are not extensively documented in readily available sources, it appears to have been established sometime in the 1990s."

After: "The company was founded in 1994, according to its registration documents."

**Sycophantic tone.** Overly positive, people-pleasing language.

Before: "Great question! You're absolutely right that this is a complex topic. That's an excellent point about the economic factors."

After: "The economic factors you mentioned are relevant here."

---

## Filler and hedging

Common filler phrases to cut:

- "In order to achieve this goal" → "To achieve this"
- "Due to the fact that it was raining" → "Because it was raining"
- "At this point in time" → "Now"
- "In the event that you need help" → "If you need help"
- "The system has the ability to process" → "The system can process"
- "It is important to note that the data shows" → "The data shows"

Excessive hedging to simplify:

Before: "It could potentially possibly be argued that the policy might have some effect on outcomes."

After: "The policy may affect outcomes."

Generic positive conclusions to make specific:

Before: "The future looks bright for the company. Exciting times lie ahead as they continue their journey toward excellence. This represents a major step in the right direction."

After: "The company plans to open two more locations next year."

---

## Full example

Before (AI-sounding):

> The new software update serves as a testament to the company's commitment to innovation. Moreover, it provides a seamless, intuitive, and powerful user experience—ensuring that users can accomplish their goals efficiently. It's not just an update, it's a revolution in how we think about productivity. Industry experts believe this will have a lasting impact on the entire sector, highlighting the company's pivotal role in the evolving technological landscape.

After (humanized):

> The software update adds batch processing, keyboard shortcuts, and offline mode. Early feedback from beta testers has been positive, with most reporting faster task completion.

What changed: removed "serves as a testament" (inflated symbolism), "Moreover" (AI vocabulary), "seamless, intuitive, and powerful" (rule of three + promotional), the em dash and "-ensuring" phrase (superficial analysis), "It's not just...it's..." (negative parallelism), "Industry experts believe" (vague attribution), "pivotal role" and "evolving landscape" (AI vocabulary). Added specific features and concrete feedback instead.`
  },
  latex_formatting: {
    name: "latex_formatting",
    description: "Guidelines for formatting equations, formulas, and scientific notations using LaTeX.",
    content: `## LaTeX Formatting Guidelines
Use this skill when explaining math, physics, or formatting scientific equations.

### 1. Inline Math
- Use single dollar signs or parentheses: $E = mc^2$ or \\( E = mc^2 \\) for inline math expressions.

### 2. Block Math
- Use double dollar signs or brackets: $$ \\sum_{i=1}^n i = \\frac{n(n+1)}{2} $$ or \\[\\] for standalone block equations.

### 3. Scientific Notation & Symbols
- Always render mathematical variables in math mode (e.g., $x$, $y$, $f(x)$).
- Use proper symbols (e.g., $\\alpha$, $\\beta$, $\\pi$, $\\int$, $\\partial$).`
  }
};
