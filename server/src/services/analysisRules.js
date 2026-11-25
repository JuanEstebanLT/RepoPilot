function hasPath(paths, matcher) {
  return paths.some((path) => matcher(path.toLowerCase()));
}

export function buildRecommendations({ repository, files, readme, issueCount, languages }) {
  const recommendations = [];
  if (!repository.description) recommendations.push({
    id: 'description', severity: 'recommended', title: 'Agregar una descripción',
    reason: 'El repositorio no tiene una descripción pública que explique su propósito.', action: 'update_description',
    affectedFiles: ['Configuración del repositorio'], permission: 'Administration: write',
  });
  if (!readme.exists) recommendations.push({
    id: 'readme', severity: 'high', title: 'Crear documentación inicial',
    reason: 'No se encontró un README en la rama predeterminada.', action: 'upsert_readme',
    affectedFiles: ['README.md'], permission: 'Contents: write',
  });
  else if (readme.missingSections.length) recommendations.push({
    id: 'readme-sections', severity: 'suggestion', title: 'Completar secciones del README',
    reason: `No se detectaron estas secciones habituales: ${readme.missingSections.join(', ')}.`,
    action: 'upsert_readme', affectedFiles: [readme.path], permission: 'Contents: write',
  });
  if (!hasPath(files, (path) => path === '.gitignore')) recommendations.push({
    id: 'gitignore', severity: 'high', title: 'Crear .gitignore',
    reason: `No se encontró .gitignore. Tecnologías detectadas: ${Object.keys(languages).join(', ') || 'sin determinar'}.`,
    action: 'upsert_gitignore', affectedFiles: ['.gitignore'], permission: 'Contents: write',
  });
  if (!hasPath(files, (path) => /^license(\.|$)/.test(path))) recommendations.push({
    id: 'license', severity: 'informative', title: 'Evaluar una licencia',
    reason: 'No se detectó un archivo LICENSE. La licencia debe elegirse conscientemente según el proyecto.',
    action: null, affectedFiles: ['LICENSE (no se crea automáticamente)'], permission: 'Ninguno para consultar',
  });
  if (issueCount === 0) recommendations.push({
    id: 'issues', severity: 'informative', title: 'Considerar tareas iniciales',
    reason: 'No se encontraron issues abiertos. Puede crear uno si el proyecto necesita seguimiento de trabajo.',
    action: 'create_issue', affectedFiles: ['Ninguno'], permission: 'Issues: write',
  });
  return recommendations;
}

export function defaultReadme(repository) {
  return `# ${repository.name}\n\n${repository.description || 'Descripción breve del proyecto.'}\n\n## Requisitos\n\nDocumente aquí los requisitos previos.\n\n## Instalación\n\nDocumente aquí los pasos de instalación.\n\n## Uso\n\nExplique cómo ejecutar y utilizar el proyecto.\n\n## Contribución\n\nDescriba el flujo para contribuir.\n`;
}

export function defaultGitignore(languages = {}) {
  const names = Object.keys(languages).map((name) => name.toLowerCase());
  const entries = new Set(['.env', '.env.*', '!.env.example', '*.log']);
  if (names.includes('javascript') || names.includes('typescript')) ['node_modules/', 'dist/', '.vite/'].forEach((item) => entries.add(item));
  if (names.includes('python')) ['__pycache__/', '*.py[cod]', '.venv/', 'venv/'].forEach((item) => entries.add(item));
  if (names.includes('java')) ['target/', '*.class', '.gradle/', 'build/'].forEach((item) => entries.add(item));
  if (names.includes('c#')) ['bin/', 'obj/', '*.user'].forEach((item) => entries.add(item));
  entries.add('.DS_Store'); entries.add('Thumbs.db');
  return `${[...entries].join('\n')}\n`;
}
