/**
 * AEGIS — Design Parser Service
 *
 * AI-powered design analysis: takes a design description or screenshot URL,
 * extracts design tokens (colors, typography, spacing), and generates
 * matching React component code.
 *
 * Uses the configured LLM (OpenRouter) for all analysis — no external
 * Figma API dependency required.
 */


// Types
// =============================================================================

/** Extracted design tokens */
export interface DesignTokens {
  /** Primary brand color */
  primaryColor: string;
  /** Secondary/accent color */
  secondaryColor: string;
  /** Background color */
  backgroundColor: string;
  /** Surface/card color */
  surfaceColor: string;
  /** Text color */
  textColor: string;
  /** Muted/secondary text color */
  mutedTextColor: string;
  /** Border color */
  borderColor: string;
  /** Error/danger color */
  errorColor: string;
  /** Success color */
  successColor: string;
  /** Warning color */
  warningColor: string;
  /** Font family */
  fontFamily: string;
  /** Heading font family (or same as fontFamily) */
  headingFont: string;
  /** Base font size (px) */
  baseFontSize: number;
  /** Base border radius (px) */
  borderRadius: number;
  /** Spacing unit (px) — multiples of this used for consistent spacing */
  spacingUnit: number;
  /** Whether the design is dark mode */
  isDark: boolean;
  /** Design style name (e.g. 'minimal', 'glassmorphism', 'neobrutalism') */
  style: string;
  /** Layout style (e.g. 'centered', 'full-width', 'sidebar') */
  layout: string;
}

/** Result of design analysis */
export interface DesignAnalysis {
  tokens: DesignTokens;
  /** Description of the visual style */
  styleNotes: string;
  /** Generated component code suggestions */
  componentSuggestions: string[];
}

// =============================================================================
// Prompt Templates
// =============================================================================

/** System prompt for the design analysis agent */
export const DESIGN_ANALYSIS_SYSTEM = `You are a SENIOR UX/UI DESIGNER AI. Your job is to analyze a design description or image URL and extract precise design tokens.

Output ONLY valid JSON in a code block with this exact structure:

\`\`\`json
{
  "tokens": {
    "primaryColor": "#...",
    "secondaryColor": "#...",
    "backgroundColor": "#...",
    "surfaceColor": "#...",
    "textColor": "#...",
    "mutedTextColor": "#...",
    "borderColor": "#...",
    "errorColor": "#...",
    "successColor": "#...",
    "warningColor": "#...",
    "fontFamily": "'Inter', system-ui, sans-serif",
    "headingFont": "'Inter', system-ui, sans-serif",
    "baseFontSize": 16,
    "borderRadius": 12,
    "spacingUnit": 8,
    "isDark": true,
    "style": "minimal",
    "layout": "centered"
  },
  "styleNotes": "Description of the design style and key visual characteristics.",
  "componentSuggestions": [
    "Suggestion for a component to generate based on this design"
  ]
}
\`\`\`

Design principles:
- Choose colors that form a cohesive, accessible palette (WCAG AA contrast minimum)
- Pick a style that matches the description (minimal, glassmorphism, neobrutalism, 
  cyberpunk, corporate, playful, elegant, etc.)
- Suggest components that would be most impactful for this design style
- For dark mode designs (isDark: true), use darker backgrounds with lighter text
- Ensure sufficient contrast between backgrounds and text

Be creative but precise — the tokens you choose will directly shape the generated UI.`;

/** Prompt to generate a React component from design tokens */
export function buildDesignPrompt(description: string, imageUrl?: string): string {
  const parts: string[] = [];

  if (description) {
    parts.push(`Design Description:\n${description}\n`);
  }

  if (imageUrl) {
    parts.push(`Reference Image URL:\n${imageUrl}\n`);
  }

  parts.push(`Analyze this design and output design tokens as JSON. Be specific about colors, 
typography, and visual style. Consider the target audience and use case implied by the description.`);

  return parts.join('\n---\n');
}

// =============================================================================
// Default tokens (fallback when AI analysis fails)
// =============================================================================

export const DEFAULT_TOKENS: DesignTokens = {
  primaryColor: '#06b6d4',
  secondaryColor: '#8b5cf6',
  backgroundColor: '#0f172a',
  surfaceColor: '#1e293b',
  textColor: '#e2e8f0',
  mutedTextColor: '#64748b',
  borderColor: '#334155',
  errorColor: '#f43f5e',
  successColor: '#22c55e',
  warningColor: '#f59e0b',
  fontFamily: "'Inter', system-ui, sans-serif",
  headingFont: "'Inter', system-ui, sans-serif",
  baseFontSize: 16,
  borderRadius: 12,
  spacingUnit: 8,
  isDark: true,
  style: 'minimal',
  layout: 'centered',
};

// =============================================================================
// Design token → CSS / Tailwind utilities
// =============================================================================

/**
 * Generate Tailwind CSS configuration from design tokens.
 */
export function tokensToTailwindConfig(tokens: DesignTokens): string {
  return `/** Auto-generated Tailwind config from design tokens */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary:   '${tokens.primaryColor}',
          secondary: '${tokens.secondaryColor}',
          accent:    '${tokens.secondaryColor}',
        },
        surface: {
          DEFAULT: '${tokens.surfaceColor}',
          muted:   '${tokens.borderColor}',
        },
        text: {
          DEFAULT: '${tokens.textColor}',
          muted:   '${tokens.mutedTextColor}',
        },
      },
      fontFamily: {
        sans: [${tokens.fontFamily}],
        heading: [${tokens.headingFont}],
      },
      borderRadius: {
        DEFAULT: '${tokens.borderRadius}px',
      },
      spacing: {
        unit: '${tokens.spacingUnit}px',
      },
    },
  },
  plugins: [],
};`;
}

/**
 * Generate CSS custom properties from design tokens.
 */
export function tokensToCSSVariables(tokens: DesignTokens): string {
  return `:root {
  --color-primary: ${tokens.primaryColor};
  --color-secondary: ${tokens.secondaryColor};
  --color-bg: ${tokens.backgroundColor};
  --color-surface: ${tokens.surfaceColor};
  --color-text: ${tokens.textColor};
  --color-text-muted: ${tokens.mutedTextColor};
  --color-border: ${tokens.borderColor};
  --color-error: ${tokens.errorColor};
  --color-success: ${tokens.successColor};
  --color-warning: ${tokens.warningColor};
  --font-sans: ${tokens.fontFamily};
  --font-heading: ${tokens.headingFont};
  --font-size-base: ${tokens.baseFontSize}px;
  --radius-base: ${tokens.borderRadius}px;
  --spacing-unit: ${tokens.spacingUnit}px;
}`;
}

// =============================================================================
// Component generation prompt
// =============================================================================

/** System prompt for generating components from design tokens */
export const COMPONENT_GENERATOR_SYSTEM = `You are a PRINCIPAL FRONTEND ENGINEER specializing in React + Tailwind CSS.

You will receive:
- A set of design tokens (colors, typography, spacing, etc.)
- A component specification (what to build)

Your job:
1. Generate a beautiful, production-quality React component using the provided design tokens
2. Use Tailwind CSS classes that match the design tokens as closely as possible
3. Include hover states, transitions, and micro-interactions
4. Make the component responsive and accessible

Rules:
- Use 'use client' directive if the component uses hooks or browser APIs
- Import React icons from 'lucide-react' for any icons needed
- Output using the standard <FILE path="components/ComponentName.tsx"> format
- The component should look visually stunning and professional
- Include proper TypeScript types
- Use the design tokens' color palette and spacing consistently

The design tokens will be provided as CSS variables and Tailwind config context.
Use Tailwind arbitrary values where needed (e.g., text-[#color], bg-[#color]).`;

/**
 * Build a component generation prompt with design context.
 */
export function buildComponentPrompt(
  componentName: string,
  specification: string,
  tokens: DesignTokens,
  cssVariables: string,
): string {
  return [
    `Design Tokens:`,
    `Primary: ${tokens.primaryColor}`,
    `Secondary: ${tokens.secondaryColor}`,
    `Background: ${tokens.backgroundColor}`,
    `Surface: ${tokens.surfaceColor}`,
    `Text: ${tokens.textColor}`,
    `Muted Text: ${tokens.mutedTextColor}`,
    `Border: ${tokens.borderColor}`,
    `Border Radius: ${tokens.borderRadius}px`,
    `Spacing Unit: ${tokens.spacingUnit}px`,
    `Style: ${tokens.style}`,
    `Dark Mode: ${tokens.isDark}`,
    ``,
    `CSS Variables:\n${cssVariables}`,
    ``,
    `Component: ${componentName}`,
    `Specification: ${specification}`,
    ``,
    `Generate a complete, production-ready ${componentName} component using these design tokens.`,
    `Use Tailwind arbitrary values (bg-[${tokens.primaryColor}], text-[${tokens.textColor}], etc.)`,
    `to match the design tokens precisely. Include hover states and transitions.`,
  ].join('\n');
}
