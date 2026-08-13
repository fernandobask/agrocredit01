const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /const modelsToTry = \[\s*"gemini-3\.6-flash",\s*"gemini-flash-latest",\s*"gemini-3\.1-flash-lite"\s*\];/,
  'const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];'
);

fs.writeFileSync('server.ts', content);
