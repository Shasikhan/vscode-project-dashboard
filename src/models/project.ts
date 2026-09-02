export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface GitInfo {
  isGit: boolean;
  branch?: string;
  modified?: number;
  untracked?: number;
  ahead?: number;
  behind?: number;
  clean?: boolean;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  color: string;
  categoryId: string;
  description?: string;
  tags?: string[];
  techStack?: string[];
  favorite?: boolean;
  lastOpened?: number;
  createdAt: number;
  exists?: boolean;
  gitInfo?: GitInfo;
}

export interface UserPreferences {
  sortBy: string;
  viewMode: 'grid' | 'list';
  selectedCategory: string;
  allCategoryColor?: string;
}

export interface DashboardData {
  projects: Project[];
  categories: Category[];
  preferences?: UserPreferences;
}

export type WebviewToHostMessage =
  | { command: 'getInitialData' }
  | { command: 'refreshGitStatus' }
  | { command: 'pickFolder'; targetField?: 'path' }
  | { command: 'openProject'; path: string; newWindow: boolean; projectId: string }
  | { command: 'openTerminal'; path: string; name: string }
  | { command: 'revealInFinder'; path: string }
  | { command: 'savePreferences'; preferences: Partial<UserPreferences> }
  | { command: 'saveProject'; project: Project }
  | { command: 'deleteProject'; id: string }
  | { command: 'toggleFavorite'; id: string }
  | { command: 'saveCategory'; category: Category }
  | { command: 'deleteCategory'; id: string }
  | { command: 'reorderCategories'; categoryIds: string[] }
  | { command: 'exportData' }
  | { command: 'importData' }
  | { command: 'showNotification'; message: string; type: 'info' | 'warning' | 'error' };

export type HostToWebviewMessage =
  | { command: 'setData'; data: DashboardData }
  | { command: 'folderPicked'; path: string; targetField?: string }
  | { command: 'filterCategory'; categoryId: string };
