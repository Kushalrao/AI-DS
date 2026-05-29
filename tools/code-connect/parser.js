#!/usr/bin/env node
/**
 * Figma Code Connect — custom parser for Flutter/Dart components.
 *
 * Protocol (from @figma/code-connect v1.x):
 *   stdin  → { mode: "PARSE", paths: string[], config: object }
 *   stdout → { docs: Doc[], messages: Message[] }
 *
 * Each *.figma.js definition file exports an object matching CodeConnectDef.
 */

const fs   = require('fs');
const path = require('path');

function main() {
  const raw   = fs.readFileSync('/dev/stdin', 'utf-8');
  const input = JSON.parse(raw);

  if (input.mode !== 'PARSE') {
    // CREATE mode not supported — output empty to let the CLI handle it.
    process.stdout.write(JSON.stringify({ docs: [], messages: [] }));
    return;
  }

  const messages = [];
  const docs = [];

  for (const filePath of input.paths) {
    try {
      const def = require(path.resolve(filePath));

      // Figma executes `template` in a QuickJS sandbox at render time.
      // Must be a complete JS module using the figma.code tagged template literal.
      // See: https://developers.figma.com/docs/code-connect/custom-parsers/
      const escaped = def.example
        .replace(/\\/g, '\\\\')   // backslashes first
        .replace(/`/g, '\\`')     // backtick delimiters
        .replace(/\$\{/g, '\\${'); // template interpolations

      const template =
        `const figma = require('figma')\n\nexport default figma.code\`${escaped}\``;

      docs.push({
        figmaNode:      def.figmaNode,
        component:      def.component,
        source:         def.source,
        sourceLocation: { line: 1 },
        template,
        templateData: {
          props:    {},
          imports:  def.imports  ?? [],
          nestable: def.nestable ?? false,
        },
        language: def.language ?? 'dart',
        label:    def.label    ?? 'Flutter',
      });

      messages.push({
        level:   'DEBUG',
        message: `Parsed ${path.basename(filePath)} → ${def.component}`,
        sourceLocation: { file: filePath },
      });
    } catch (err) {
      messages.push({
        level:   'ERROR',
        message: `Failed to parse ${filePath}: ${err.message}`,
        sourceLocation: { file: filePath },
      });
    }
  }

  process.stdout.write(JSON.stringify({ docs, messages }));
}

main();
