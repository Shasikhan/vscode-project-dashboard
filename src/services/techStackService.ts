import * as fs from 'fs';
import * as path from 'path';

export class TechStackService {
  /**
   * Fast detection of tech stack from project root
   */
  public static async detectTechStack(folderPath: string): Promise<string[]> {
    if (!folderPath) return [];

    try {
      if (!fs.existsSync(folderPath)) return [];
    } catch {
      return [];
    }

    const techSet = new Set<string>();

    try {
      // 1. Check Node.js / JavaScript / TypeScript projects
      const pkgPath = path.join(folderPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const raw = await fs.promises.readFile(pkgPath, 'utf8');
          const pkg = JSON.parse(raw);
          const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
            ...pkg.peerDependencies
          };

          // Frameworks & Libraries
          if (allDeps['next']) techSet.add('Next.js');
          else if (allDeps['nuxt']) techSet.add('Nuxt');
          else if (allDeps['@remix-run/react']) techSet.add('Remix');
          else if (allDeps['astro']) techSet.add('Astro');
          else if (allDeps['svelte'] || allDeps['@sveltejs/kit']) techSet.add('Svelte');
          else if (allDeps['vue']) techSet.add('Vue');
          else if (allDeps['react'] || allDeps['react-dom']) techSet.add('React');
          else if (allDeps['@angular/core']) techSet.add('Angular');
          else if (allDeps['electron']) techSet.add('Electron');
          else if (allDeps['express'] || allDeps['fastify'] || allDeps['@nestjs/core'] || allDeps['koa']) {
            if (allDeps['@nestjs/core']) techSet.add('NestJS');
            else if (allDeps['express']) techSet.add('Express');
            else techSet.add('Node.js');
          }

          // Languages / Tooling
          if (allDeps['typescript'] || fs.existsSync(path.join(folderPath, 'tsconfig.json'))) {
            techSet.add('TypeScript');
          } else {
            techSet.add('JavaScript');
          }

          if (allDeps['tailwindcss']) techSet.add('Tailwind');
        } catch {
          techSet.add('Node.js');
        }
      }

      // 2. Python
      if (
        fs.existsSync(path.join(folderPath, 'pyproject.toml')) ||
        fs.existsSync(path.join(folderPath, 'requirements.txt')) ||
        fs.existsSync(path.join(folderPath, 'Pipfile')) ||
        fs.existsSync(path.join(folderPath, 'setup.py'))
      ) {
        techSet.add('Python');
        // Quick inspection for Django / FastAPI / Flask
        try {
          const reqPath = path.join(folderPath, 'requirements.txt');
          if (fs.existsSync(reqPath)) {
            const content = await fs.promises.readFile(reqPath, 'utf8');
            if (/django/i.test(content)) techSet.add('Django');
            if (/fastapi/i.test(content)) techSet.add('FastAPI');
            if (/flask/i.test(content)) techSet.add('Flask');
          }
        } catch {
          // ignore
        }
      }

      // 3. Rust
      if (fs.existsSync(path.join(folderPath, 'Cargo.toml'))) {
        techSet.add('Rust');
      }

      // 4. Go
      if (fs.existsSync(path.join(folderPath, 'go.mod'))) {
        techSet.add('Go');
      }

      // 5. PHP
      if (fs.existsSync(path.join(folderPath, 'composer.json'))) {
        techSet.add('PHP');
        try {
          const raw = await fs.promises.readFile(path.join(folderPath, 'composer.json'), 'utf8');
          if (/laravel/i.test(raw)) techSet.add('Laravel');
          if (/symfony/i.test(raw)) techSet.add('Symfony');
        } catch {
          // ignore
        }
      }

      // 6. Ruby
      if (fs.existsSync(path.join(folderPath, 'Gemfile'))) {
        techSet.add('Ruby');
        try {
          const gemfile = await fs.promises.readFile(path.join(folderPath, 'Gemfile'), 'utf8');
          if (/rails/i.test(gemfile)) techSet.add('Rails');
        } catch {
          // ignore
        }
      }

      // 7. Java / Kotlin
      if (
        fs.existsSync(path.join(folderPath, 'pom.xml')) ||
        fs.existsSync(path.join(folderPath, 'build.gradle')) ||
        fs.existsSync(path.join(folderPath, 'build.gradle.kts'))
      ) {
        if (fs.existsSync(path.join(folderPath, 'build.gradle.kts'))) {
          techSet.add('Kotlin');
        } else {
          techSet.add('Java');
        }
      }

      // 8. Flutter / Dart
      if (fs.existsSync(path.join(folderPath, 'pubspec.yaml'))) {
        techSet.add('Flutter');
      }

      // 9. Swift / iOS
      if (fs.existsSync(path.join(folderPath, 'Package.swift'))) {
        techSet.add('Swift');
      }

      // 10. Docker
      if (
        fs.existsSync(path.join(folderPath, 'Dockerfile')) ||
        fs.existsSync(path.join(folderPath, 'docker-compose.yml')) ||
        fs.existsSync(path.join(folderPath, 'docker-compose.yaml'))
      ) {
        techSet.add('Docker');
      }
    } catch {
      // Fallback gracefully
    }

    return Array.from(techSet);
  }

  /**
   * Enriches multiple projects with detected tech stacks in parallel
   */
  public static async enrichProjectsWithTechStack(projects: { path: string }[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    const promises = projects.map(async (p) => {
      const tech = await TechStackService.detectTechStack(p.path);
      map.set(p.path, tech);
    });

    await Promise.all(promises);
    return map;
  }
}
