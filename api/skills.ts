// Specialized prompt guidelines and instructions that the PRO model can dynamically retrieve.
export interface Skill {
  name: string;
  description: string;
  content: string;
}

export const SKILLS_DATA: Record<string, Skill> = {
  frontend_aesthetics: {
    name: "frontend_aesthetics",
    description: "Guides creation of distinctive, production-grade frontend interfaces that avoid generic 'AI slop' aesthetics.",
    content: `## Frontend Aesthetics Guidelines
Use this skill to design and build premium web user interfaces. Avoid generic, cookie-cutter templates.

### 1. Color System & Contrast
- Commit to a cohesive theme (sleek dark mode or clean light mode).
- Use curated, harmonious color palettes (e.g., deep charcoal background with electric cyan or neon pink accents).
- Do not mix pure black (#000) and pure white (#fff) crudely. Use subtle borders and translucent overlays (backdrop-filter) for depth.

### 2. Modern Typography
- Avoid default system sans-serif fonts. Prefer fonts with personality (e.g., Outfit, Inter, Montserrat, or Playfair Display).
- Establish a clear hierarchy: use large, bold display weights for headers and clear, readable weights for body text.

### 3. Spatial Layout & Spacing
- Use generous white space to let elements breathe.
- Avoid boring linear grids. Create unexpected layouts, overlapping cards, or offset placements.
- Ensure layouts are fully responsive and fluid.

### 4. Micro-interactions & Motion
- Add smooth transitions on hover, focus, and active states.
- Use subtle gradient movements, scale changes, or shadow adjustments to make the interface feel alive.`
  },
  systematic_reasoning: {
    name: "systematic_reasoning",
    description: "Enables step-by-step reasoning for complex math, coding, and logical problems.",
    content: `## Systematic Reasoning Guidelines
Use this skill to break down and solve highly complex questions or riddles.

### 1. Deconstruction
- Analyze the problem carefully. Identify all variables, constraints, and assumptions.
- State the objective clearly before attempting a solution.

### 2. Chain-of-Thought
- Think step-by-step. Write down your steps explicitly.
- Verify intermediate results. If a contradiction arises, back-track and try an alternative path.

### 3. Edge Cases
- Look for edge cases, boundary conditions, or hidden assumptions that could break the solution.
- Double check math calculations and logic gates.`
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
