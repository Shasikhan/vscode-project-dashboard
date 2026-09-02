import * as vscode from 'vscode';
import * as fs from 'fs';
import { Project, Category, DashboardData, UserPreferences } from '../models/project';
import { GitService } from './gitService';
import { TechStackService } from './techStackService';

const STORAGE_KEY_PROJECTS = 'projectDashboard.projects';
const STORAGE_KEY_CATEGORIES = 'projectDashboard.categories';
const STORAGE_KEY_PREFERENCES = 'projectDashboard.preferences';

export const DEFAULT_PREFERENCES: UserPreferences = {
  sortBy: 'recent',
  viewMode: 'grid',
  selectedCategory: 'all',
  allCategoryColor: '#64748b'
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-work', name: 'Work', color: '#3b82f6', icon: 'briefcase' },
  { id: 'cat-personal', name: 'Personal', color: '#10b981', icon: 'person' },
  { id: 'cat-opensource', name: 'Open Source', color: '#8b5cf6', icon: 'git-branch' },
  { id: 'cat-archive', name: 'Archive', color: '#6b7280', icon: 'archive' }
];

export class StorageService {
  private static instance: StorageService;
  private context: vscode.ExtensionContext;
  private onDidChangeDataEmitter = new vscode.EventEmitter<DashboardData>();
  public readonly onDidChangeData = this.onDidChangeDataEmitter.event;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.ensureInitialized();
  }

  public static initialize(context: vscode.ExtensionContext): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService(context);
    }
    return StorageService.instance;
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      throw new Error('StorageService has not been initialized.');
    }
    return StorageService.instance;
  }

  private ensureInitialized(): void {
    const existingCategories = this.context.globalState.get<Category[]>(STORAGE_KEY_CATEGORIES);
    if (!existingCategories || existingCategories.length === 0) {
      this.context.globalState.update(STORAGE_KEY_CATEGORIES, DEFAULT_CATEGORIES);
    }

    const existingProjects = this.context.globalState.get<Project[]>(STORAGE_KEY_PROJECTS);
    if (!existingProjects) {
      this.context.globalState.update(STORAGE_KEY_PROJECTS, []);
    }
  }

  public getPreferences(): UserPreferences {
    return this.context.globalState.get<UserPreferences>(STORAGE_KEY_PREFERENCES) || DEFAULT_PREFERENCES;
  }

  public async updatePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    const current = this.getPreferences();
    const updated: UserPreferences = {
      ...current,
      ...prefs
    };
    await this.context.globalState.update(STORAGE_KEY_PREFERENCES, updated);
  }

  public getData(): DashboardData {
    const categories = this.context.globalState.get<Category[]>(STORAGE_KEY_CATEGORIES) || DEFAULT_CATEGORIES;
    const preferences = this.getPreferences();
    const projects = (this.context.globalState.get<Project[]>(STORAGE_KEY_PROJECTS) || []).map(p => {
      let exists = false;
      try {
        if (p.path && fs.existsSync(p.path)) {
          exists = true;
        }
      } catch {
        exists = false;
      }
      return {
        ...p,
        exists
      };
    });

    return {
      projects,
      categories,
      preferences
    };
  }

  public async getDataAsync(): Promise<DashboardData> {
    const baseData = this.getData();
    const [gitMap, techMap] = await Promise.all([
      GitService.enrichProjectsWithGit(baseData.projects),
      TechStackService.enrichProjectsWithTechStack(baseData.projects)
    ]);

    const enrichedProjects = baseData.projects.map(p => ({
      ...p,
      gitInfo: gitMap.get(p.path),
      techStack: techMap.get(p.path) || []
    }));

    return {
      projects: enrichedProjects,
      categories: baseData.categories,
      preferences: baseData.preferences
    };
  }

  public async saveProject(project: Project): Promise<void> {
    const data = this.getData();
    const existingIndex = data.projects.findIndex(p => p.id === project.id);
    const sanitizedProject: Project = {
      ...project,
      description: project.description !== undefined ? project.description.trim() : '',
      tags: Array.isArray(project.tags) ? project.tags : []
    };

    if (existingIndex >= 0) {
      data.projects[existingIndex] = {
        ...data.projects[existingIndex],
        ...sanitizedProject,
        description: sanitizedProject.description,
        tags: sanitizedProject.tags
      };
    } else {
      data.projects.unshift(sanitizedProject);
    }

    await this.context.globalState.update(STORAGE_KEY_PROJECTS, data.projects);
    this.notifyChange();
  }

  public async deleteProject(id: string): Promise<void> {
    const data = this.getData();
    const updatedProjects = data.projects.filter(p => p.id !== id);
    await this.context.globalState.update(STORAGE_KEY_PROJECTS, updatedProjects);
    this.notifyChange();
  }

  public async toggleFavorite(id: string): Promise<void> {
    const data = this.getData();
    const project = data.projects.find(p => p.id === id);
    if (project) {
      project.favorite = !project.favorite;
      await this.context.globalState.update(STORAGE_KEY_PROJECTS, data.projects);
      this.notifyChange();
    }
  }

  public async recordProjectOpen(id: string): Promise<void> {
    const data = this.getData();
    const project = data.projects.find(p => p.id === id);
    if (project) {
      project.lastOpened = Date.now();
      await this.context.globalState.update(STORAGE_KEY_PROJECTS, data.projects);
      this.notifyChange();
    }
  }

  public async saveCategory(category: Category): Promise<void> {
    if (category.id === 'all') {
      await this.updatePreferences({ allCategoryColor: category.color });
      this.notifyChange();
      return;
    }

    const data = this.getData();
    const existingIndex = data.categories.findIndex(c => c.id === category.id);

    if (existingIndex >= 0) {
      data.categories[existingIndex] = {
        ...data.categories[existingIndex],
        ...category
      };
    } else {
      data.categories.push(category);
    }

    await this.context.globalState.update(STORAGE_KEY_CATEGORIES, data.categories);
    this.notifyChange();
  }

  public async deleteCategory(id: string): Promise<void> {
    if (id === 'all') {
      return;
    }
    const data = this.getData();
    const updatedCategories = data.categories.filter(c => c.id !== id);

    // Also update any projects that were assigned to this category to 'uncategorized'
    const updatedProjects = data.projects.map(p => {
      if (p.categoryId === id) {
        return { ...p, categoryId: '' };
      }
      return p;
    });

    await this.context.globalState.update(STORAGE_KEY_CATEGORIES, updatedCategories);
    await this.context.globalState.update(STORAGE_KEY_PROJECTS, updatedProjects);
    this.notifyChange();
  }

  public async reorderCategories(categoryIds: string[]): Promise<void> {
    const data = this.getData();
    const categoryMap = new Map<string, Category>();
    data.categories.forEach(c => categoryMap.set(c.id, c));

    const reordered: Category[] = [];
    for (const id of categoryIds) {
      if (id === 'all' || id === 'favorites') {
        continue;
      }
      const cat = categoryMap.get(id);
      if (cat) {
        reordered.push(cat);
        categoryMap.delete(id);
      }
    }
    // append any remaining
    categoryMap.forEach(cat => reordered.push(cat));

    // Ensure Archive (if present) is always pinned at the end of the categories list
    const archiveIndex = reordered.findIndex(c => c.id === 'cat-archive' || c.name.trim().toLowerCase() === 'archive');
    if (archiveIndex >= 0 && archiveIndex !== reordered.length - 1) {
      const [archiveCat] = reordered.splice(archiveIndex, 1);
      reordered.push(archiveCat);
    }

    await this.context.globalState.update(STORAGE_KEY_CATEGORIES, reordered);
    this.notifyChange();
  }

  public async exportData(): Promise<string> {
    const data = this.getData();
    return JSON.stringify(data, null, 2);
  }

  public async importData(jsonContent: string): Promise<{ success: boolean; message: string }> {
    try {
      const parsed = JSON.parse(jsonContent) as DashboardData;
      if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.categories)) {
        return { success: false, message: 'Invalid data format: Expected projects and categories arrays.' };
      }

      await this.context.globalState.update(STORAGE_KEY_PROJECTS, parsed.projects);
      await this.context.globalState.update(STORAGE_KEY_CATEGORIES, parsed.categories);
      this.notifyChange();
      return { success: true, message: `Successfully imported ${parsed.projects.length} projects and ${parsed.categories.length} categories!` };
    } catch (err: any) {
      return { success: false, message: `Failed to import JSON: ${err?.message || err}` };
    }
  }

  private async notifyChange(): Promise<void> {
    const data = await this.getDataAsync();
    this.onDidChangeDataEmitter.fire(data);
  }
}
