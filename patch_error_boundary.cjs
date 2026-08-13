const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /<ResumoConsolidadoModal([^>]+)\/>/g,
  '<ErrorBoundary name="ResumoConsolidadoModal"><ResumoConsolidadoModal$1/></ErrorBoundary>'
);

code = code.replace(
  /<GerarDossieModal([^>]+)\/>/g,
  '<ErrorBoundary name="GerarDossieModal"><GerarDossieModal$1/></ErrorBoundary>'
);

fs.writeFileSync('src/App.tsx', code);
