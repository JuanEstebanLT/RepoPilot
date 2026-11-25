const docs = {
  contributing: '# Contribuir\n\n1. Cree una rama descriptiva.\n2. Mantenga los cambios pequeños y verificables.\n3. Abra un pull request explicando el propósito.\n',
  codeOfConduct: '# Código de conducta\n\nTrate a todas las personas con respeto. No se tolerarán conductas de acoso, discriminación ni ataques personales.\n',
  security: '# Seguridad\n\nNo publique vulnerabilidades en issues públicos. Contacte de forma privada a las personas responsables del repositorio.\n',
};

const templates = {
  empty: () => [],
  'react-vite': (name) => [
    ['package.json', JSON.stringify({ name, private: true, version: '0.1.0', type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { '@vitejs/plugin-react': '^5.1.0', vite: '^7.0.0' } }, null, 2) + '\n'],
    ['index.html', '<!doctype html>\n<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>React + Vite</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n'],
    ['vite.config.js', "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n"],
    ['src/App.jsx', 'export default function App() {\n  return (\n    <main className="app">\n      <h1>React + Vite</h1>\n      <p>Proyecto generado con RepoPilot.</p>\n    </main>\n  );\n}\n'],
    ['src/main.jsx', "import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\nimport './styles.css';\n\ncreateRoot(document.getElementById('root')).render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);\n"],
    ['src/styles.css', ':root { font-family: system-ui, sans-serif; color-scheme: dark; }\nbody { margin: 0; min-height: 100vh; display: grid; place-items: center; }\n.app { text-align: center; padding: 2rem; }\n'],
    ['src/assets/.gitkeep', ''],
  ],
  'node-express': (name) => [
    ['package.json', JSON.stringify({ name, version: '0.1.0', private: true, type: 'module', scripts: { dev: 'node --watch src/index.js', start: 'node src/index.js', test: 'node --test' }, dependencies: { express: '^5.1.0' } }, null, 2) + '\n'],
    ['src/index.js', "import express from 'express';\n\nconst app = express();\napp.use(express.json());\napp.get('/health', (_req, res) => res.json({ status: 'ok' }));\napp.listen(process.env.PORT || 3000, '127.0.0.1');\n"],
    ['.env.example', 'PORT=3000\n'],
  ],
  python: () => [['main.py', 'def main():\n    print("Proyecto Python listo")\n\n\nif __name__ == "__main__":\n    main()\n'], ['requirements.txt', '']],
  fastapi: () => [['app/main.py', 'from fastapi import FastAPI\n\napp = FastAPI(title="API")\n\n\n@app.get("/health")\ndef health():\n    return {"status": "ok"}\n'], ['requirements.txt', 'fastapi\nuvicorn[standard]\n'], ['.env.example', 'APP_ENV=development\n']],
  'android-kotlin': (name) => [
    ['settings.gradle.kts', `pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name = "${name}"\ninclude(":app")\n`],
    ['build.gradle.kts', 'plugins {\n    id("com.android.application") version "8.7.3" apply false\n    id("org.jetbrains.kotlin.android") version "2.1.0" apply false\n}\n'],
    ['app/build.gradle.kts', 'plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }\n\nandroid { namespace = "com.example.app"; compileSdk = 35\n    defaultConfig { applicationId = "com.example.app"; minSdk = 24; targetSdk = 35; versionCode = 1; versionName = "1.0" }\n}\n'],
    ['app/src/main/AndroidManifest.xml', '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:theme="@style/AppTheme" /></manifest>\n'],
    ['app/src/main/res/values/styles.xml', '<resources><style name="AppTheme" parent="android:style/Theme.Material.Light.NoActionBar" /></resources>\n'],
  ],
  java: (name) => [
    ['pom.xml', `<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>com.example</groupId><artifactId>${name}</artifactId><version>0.1.0</version><properties><maven.compiler.release>21</maven.compiler.release></properties></project>\n`],
    ['src/main/java/com/example/App.java', 'package com.example;\n\npublic final class App {\n    public static void main(String[] args) {\n        System.out.println("Proyecto Java listo");\n    }\n}\n'],
  ],
};

export function buildRepoPilotTemplate(kind, name, description = '') {
  const factory = templates[kind];
  if (!factory) throw Object.assign(new Error('La plantilla RepoPilot no existe.'), { status: 422, code: 'INVALID_REPOPILOT_TEMPLATE' });
  return factory(name, description).map(([path, content]) => ({ path, content }));
}

export function buildReadme(name, description, templateKind = 'empty') {
  if (templateKind === 'react-vite') {
    return `# ${name}\n\n${description || 'Aplicación React creada con Vite.'}\n\nEste proyecto fue inicializado mediante la plantilla React + Vite de RepoPilot.\n\n## Desarrollo\n\nInstale las dependencias y levante el servidor local:\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Compilación\n\n\`\`\`bash\nnpm run build\n\`\`\`\n\nPara revisar localmente la compilación:\n\n\`\`\`bash\nnpm run preview\n\`\`\`\n`;
  }
  return `# ${name}\n\n${description || 'Descripción breve del proyecto.'}\n\n## Requisitos\n\nDocumente los requisitos previos.\n\n## Instalación\n\nDocumente los pasos de instalación.\n\n## Uso\n\nExplique cómo utilizar el proyecto.\n\n## Contribución\n\nConsulte [CONTRIBUTING.md](CONTRIBUTING.md) cuando esté disponible.\n`;
}

export function optionalProjectFiles(options) {
  const files = [];
  if (options.envExample) files.push({ path: '.env.example', content: '# Variables públicas de ejemplo, nunca secretos\n' });
  if (options.contributing) files.push({ path: 'CONTRIBUTING.md', content: docs.contributing });
  if (options.codeOfConduct) files.push({ path: 'CODE_OF_CONDUCT.md', content: docs.codeOfConduct });
  if (options.security) files.push({ path: 'SECURITY.md', content: docs.security });
  return files;
}

export const REPOPILOT_TEMPLATES = Object.keys(templates);
