const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'packages/backend/convex/lib/notification-card.ts');
let content = fs.readFileSync(file, 'utf8');

// I replaced `projectName` with `_projectName` globally earlier because of the lint error,
// which replaced it everywhere, not just in `buildTaskUpdateCard`!

content = content.replace(/_projectName: string/g, 'projectName: string');
content = content.replace(/projectName: string\n\): \{ header: Record<string, unknown>; elements: CardElement\[\] \} => \{\n  return \{\n    elements: \[\n      \{\n        fields: \[\n          \{\n            is_short: true,\n            text: \{\n              content: `\*\*Task:\*\* \$\{payload.taskTitle\}`,\n              tag: "lark_md",\n            \},\n          \},\n          \{\n            is_short: true,\n            text: \{\n              content: `\*\*Status:\*\* \$\{payload.taskStatus\}`,\n              tag: "lark_md",\n            \},\n          \},/g,
`_projectName: string
): { header: Record<string, unknown>; elements: CardElement[] } => {
  return {
    elements: [
      {
        fields: [
          {
            is_short: true,
            text: {
              content: \`**Task:** \${payload.taskTitle}\`,
              tag: "lark_md",
            },
          },
          {
            is_short: true,
            text: {
              content: \`**Status:** \${payload.taskStatus}\`,
              tag: "lark_md",
            },
          },`);

fs.writeFileSync(file, content, 'utf8');
