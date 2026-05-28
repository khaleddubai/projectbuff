import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TOKENS,
  tokensToTailwindConfig,
  tokensToCSSVariables,
  buildDesignPrompt,
  buildComponentPrompt,
  DESIGN_ANALYSIS_SYSTEM,
  COMPONENT_GENERATOR_SYSTEM,
} from './designParser';

describe('DEFAULT_TOKENS', () => {
  it('should have all required design token fields', () => {
    expect(DEFAULT_TOKENS).toMatchObject({
      primaryColor: expect.any(String),
      secondaryColor: expect.any(String),
      backgroundColor: expect.any(String),
      surfaceColor: expect.any(String),
      textColor: expect.any(String),
      mutedTextColor: expect.any(String),
      borderColor: expect.any(String),
      errorColor: expect.any(String),
      successColor: expect.any(String),
      warningColor: expect.any(String),
      fontFamily: expect.any(String),
      headingFont: expect.any(String),
      baseFontSize: expect.any(Number),
      borderRadius: expect.any(Number),
      spacingUnit: expect.any(Number),
      isDark: expect.any(Boolean),
      style: expect.any(String),
      layout: expect.any(String),
    });
  });

  it('should default to dark mode and minimal style', () => {
    expect(DEFAULT_TOKENS.isDark).toBe(true);
    expect(DEFAULT_TOKENS.style).toBe('minimal');
    expect(DEFAULT_TOKENS.layout).toBe('centered');
  });

  it('should have valid hex color values', () => {
    const colorKeys = [
      'primaryColor', 'secondaryColor', 'backgroundColor', 'surfaceColor',
      'textColor', 'mutedTextColor', 'borderColor', 'errorColor',
      'successColor', 'warningColor',
    ] as const;

    for (const key of colorKeys) {
      expect(DEFAULT_TOKENS[key]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('tokensToTailwindConfig', () => {
  it('should generate a valid Tailwind config with brand colors', () => {
    const result = tokensToTailwindConfig(DEFAULT_TOKENS);
    expect(result).toContain('brand');
    expect(result).toContain('primary');
    expect(result).toContain(DEFAULT_TOKENS.primaryColor);
    expect(result).toContain(DEFAULT_TOKENS.secondaryColor);
  });

  it('should include font family configuration', () => {
    const result = tokensToTailwindConfig(DEFAULT_TOKENS);
    expect(result).toContain('fontFamily');
    expect(result).toContain('sans');
    expect(result).toContain('heading');
  });

  it('should include border radius and spacing', () => {
    const result = tokensToTailwindConfig(DEFAULT_TOKENS);
    expect(result).toContain('borderRadius');
    expect(result).toContain(`${DEFAULT_TOKENS.borderRadius}px`);
    expect(result).toContain('spacing');
    expect(result).toContain(`${DEFAULT_TOKENS.spacingUnit}px`);
  });

  it('should include content paths', () => {
    const result = tokensToTailwindConfig(DEFAULT_TOKENS);
    expect(result).toContain('content');
    expect(result).toContain('./app/**/*.{js,ts,jsx,tsx}');
  });

  it('should be a valid module.exports string', () => {
    const result = tokensToTailwindConfig(DEFAULT_TOKENS);
    expect(result).toContain('module.exports');
    expect(result).toMatch(/tailwindcss|Config/);
  });
});

describe('tokensToCSSVariables', () => {
  it('should generate CSS custom properties for all color tokens', () => {
    const result = tokensToCSSVariables(DEFAULT_TOKENS);
    expect(result).toContain('--color-primary');
    expect(result).toContain('--color-secondary');
    expect(result).toContain('--color-bg');
    expect(result).toContain('--color-surface');
    expect(result).toContain('--color-text');
    expect(result).toContain('--color-text-muted');
    expect(result).toContain('--color-border');
    expect(result).toContain('--color-error');
    expect(result).toContain('--color-success');
    expect(result).toContain('--color-warning');
  });

  it('should include typography and spacing variables', () => {
    const result = tokensToCSSVariables(DEFAULT_TOKENS);
    expect(result).toContain('--font-sans');
    expect(result).toContain('--font-heading');
    expect(result).toContain('--font-size-base');
    expect(result).toContain('--radius-base');
    expect(result).toContain('--spacing-unit');
  });

  it('should reference the correct color values', () => {
    const result = tokensToCSSVariables(DEFAULT_TOKENS);
    expect(result).toContain(DEFAULT_TOKENS.primaryColor);
    expect(result).toContain(DEFAULT_TOKENS.backgroundColor);
    expect(result).toContain(DEFAULT_TOKENS.fontFamily);
  });

  it('should be wrapped in :root selector', () => {
    const result = tokensToCSSVariables(DEFAULT_TOKENS);
    expect(result.trim()).toMatch(/^:root\s*\{/);
    expect(result).toContain('}');
  });
});

describe('buildDesignPrompt', () => {
  it('should include the design description', () => {
    const result = buildDesignPrompt('A minimal dashboard design');
    expect(result).toContain('A minimal dashboard design');
    expect(result).toContain('Design Description:');
  });

  it('should include the image URL when provided', () => {
    const result = buildDesignPrompt('A design', 'https://example.com/design.png');
    expect(result).toContain('https://example.com/design.png');
    expect(result).toContain('Reference Image URL:');
  });

  it('should work without an image URL', () => {
    const result = buildDesignPrompt('Just text');
    expect(result).not.toContain('Reference Image URL:');
  });

  it('should include analysis instructions', () => {
    const result = buildDesignPrompt('Design a landing page');
    expect(result).toContain('output design tokens as JSON');
  });
});

describe('buildComponentPrompt', () => {
  it('should include component name and specification', () => {
    const result = buildComponentPrompt(
      'Button',
      'A primary call-to-action button',
      DEFAULT_TOKENS,
      tokensToCSSVariables(DEFAULT_TOKENS),
    );
    expect(result).toContain('Button');
    expect(result).toContain('A primary call-to-action button');
  });

  it('should include all design token values', () => {
    const result = buildComponentPrompt(
      'Card',
      'A card component',
      DEFAULT_TOKENS,
      tokensToCSSVariables(DEFAULT_TOKENS),
    );
    expect(result).toContain(`Primary: ${DEFAULT_TOKENS.primaryColor}`);
    expect(result).toContain(`Secondary: ${DEFAULT_TOKENS.secondaryColor}`);
    expect(result).toContain(`Background: ${DEFAULT_TOKENS.backgroundColor}`);
    expect(result).toContain(`Surface: ${DEFAULT_TOKENS.surfaceColor}`);
    expect(result).toContain(`Text: ${DEFAULT_TOKENS.textColor}`);
    expect(result).toContain(`Style: ${DEFAULT_TOKENS.style}`);
  });

  it('should include CSS variables', () => {
    const cssVars = tokensToCSSVariables(DEFAULT_TOKENS);
    const result = buildComponentPrompt('Nav', 'Navigation bar', DEFAULT_TOKENS, cssVars);
    expect(result).toContain('CSS Variables:');
    expect(result).toContain(cssVars);
  });

  it('should include instructions for Tailwind arbitrary values', () => {
    const result = buildComponentPrompt('Modal', 'A modal dialog', DEFAULT_TOKENS, '');
    expect(result).toContain('arbitrary values');
    expect(result).toContain('bg-[');
    expect(result).toContain('text-[');
  });
});

describe('System prompts', () => {
  it('should export DESIGN_ANALYSIS_SYSTEM with JSON output instructions', () => {
    expect(DESIGN_ANALYSIS_SYSTEM).toContain('SENIOR UX/UI DESIGNER');
    expect(DESIGN_ANALYSIS_SYSTEM).toContain('tokens');
    expect(DESIGN_ANALYSIS_SYSTEM).toContain('primaryColor');
    expect(DESIGN_ANALYSIS_SYSTEM).toContain('JSON');
  });

  it('should export COMPONENT_GENERATOR_SYSTEM with React + Tailwind instructions', () => {
    expect(COMPONENT_GENERATOR_SYSTEM).toContain('PRINCIPAL FRONTEND ENGINEER');
    expect(COMPONENT_GENERATOR_SYSTEM).toContain('React');
    expect(COMPONENT_GENERATOR_SYSTEM).toContain('Tailwind');
    expect(COMPONENT_GENERATOR_SYSTEM).toContain('lucide-react');
  });
});
