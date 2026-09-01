import * as vscode from 'vscode';
import * as path from 'path';
import { StorageService } from './services/storageService';
import { DashboardPanel } from './views/dashboardPanel';
import { SidebarProvider } from './views/sidebarProvider';
import { Project } from './models/project';

export function activate(context: vscode.ExtensionContext) {
  console.log('Project Dashboard extension is now active!');

  // Initialize Storage Service
  const storageService = StorageService.initialize(context);

  // Register Sidebar Webview View
  const sidebarProvider = new SidebarProvider(context.extensionUri, storageService);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
  );

  // Command: Open Full Project Dashboard
  const openDashboardCmd = vscode.commands.registerCommand('projectDashboard.open', () => {
    DashboardPanel.createOrShow(context.extensionUri);
  });

  // Command: Add Current Workspace Folder as Project
  const addCurrentProjectCmd = vscode.commands.registerCommand('projectDashboard.addProject', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showInformationMessage('No workspace folder currently open. Opening Dashboard to add a project.');
      DashboardPanel.createOrShow(context.extensionUri);
      return;
    }

    const currentFolder = workspaceFolders[0];
    const folderPath = currentFolder.uri.fsPath;
    const defaultName = currentFolder.name || path.basename(folderPath);

    // Check if already in projects
    const existing = storageService.getData().projects.find(p => p.path === folderPath);
    if (existing) {
      const choice = await vscode.window.showInformationMessage(
        `"${existing.name}" is already in your Project Dashboard. Open dashboard?`,
        'Open Dashboard'
      );
      if (choice === 'Open Dashboard') {
        DashboardPanel.createOrShow(context.extensionUri);
      }
      return;
    }

    const categories = storageService.getData().categories;
    const categoryOptions = [
      { label: '$(circle-outline) None / Uncategorized', id: '' },
      ...categories.map(c => ({
        label: `$(folder) ${c.name}`,
        id: c.id
      }))
    ];

    const selectedCategory = await vscode.window.showQuickPick(categoryOptions, {
      placeHolder: 'Select a category for this project'
    });

    if (selectedCategory === undefined) {
      return; // User cancelled
    }

    const newProject: Project = {
      id: 'proj-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      name: defaultName,
      path: folderPath,
      color: '#3b82f6',
      categoryId: selectedCategory.id,
      createdAt: Date.now(),
      lastOpened: Date.now()
    };

    await storageService.saveProject(newProject);
    const viewBtn = await vscode.window.showInformationMessage(
      `Project "${defaultName}" added to Project Dashboard!`,
      'Open Dashboard'
    );
    if (viewBtn === 'Open Dashboard') {
      DashboardPanel.createOrShow(context.extensionUri);
    }
  });

  // Command: Export Data
  const exportCmd = vscode.commands.registerCommand('projectDashboard.exportData', async () => {
    const json = await storageService.exportData();
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('vscode-projects-backup.json'),
      filters: { 'JSON Files': ['json'] }
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf8'));
      vscode.window.showInformationMessage('Project Dashboard data exported successfully!');
    }
  });

  // Command: Import Data
  const importCmd = vscode.commands.registerCommand('projectDashboard.importData', async () => {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'JSON Files': ['json'] },
      openLabel: 'Import Projects Backup'
    });
    if (uris && uris[0]) {
      const fileData = await vscode.workspace.fs.readFile(uris[0]);
      const content = Buffer.from(fileData).toString('utf8');
      const result = await storageService.importData(content);
      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    }
  });

  // Command: Quick Switcher via Command Palette (Cmd+Alt+P / Ctrl+Alt+P)
  const quickSwitchCmd = vscode.commands.registerCommand('projectDashboard.quickSwitch', async () => {
    const data = await storageService.getDataAsync();
    if (data.projects.length === 0) {
      const choice = await vscode.window.showInformationMessage(
        'No projects found in Project Dashboard. Would you like to open the dashboard and add one?',
        'Open Dashboard'
      );
      if (choice === 'Open Dashboard') {
        DashboardPanel.createOrShow(context.extensionUri);
      }
      return;
    }

    const categoriesMap = new Map(data.categories.map(c => [c.id, c.name]));

    const openInNewWindowBtn: vscode.QuickInputButton = {
      iconPath: new vscode.ThemeIcon('link-external'),
      tooltip: 'Open in New Window'
    };
    const openTerminalBtn: vscode.QuickInputButton = {
      iconPath: new vscode.ThemeIcon('terminal'),
      tooltip: 'Open Terminal Here'
    };
    const revealFolderBtn: vscode.QuickInputButton = {
      iconPath: new vscode.ThemeIcon('folder-opened'),
      tooltip: 'Reveal in Finder / File Explorer'
    };

    interface ProjectQuickPickItem extends vscode.QuickPickItem {
      project: Project;
    }

    const items: ProjectQuickPickItem[] = data.projects.map(p => {
      const catName = categoriesMap.get(p.categoryId) || (p.categoryId ? 'Uncategorized' : '');
      const parts: string[] = [];
      if (catName) parts.push(`[${catName}]`);
      if (p.gitInfo?.branch) parts.push(`🌿 ${p.gitInfo.branch}${p.gitInfo.clean ? ' ✓' : ' ●'}`);
      if (p.techStack && p.techStack.length > 0) parts.push(`(${p.techStack.slice(0, 3).join(', ')})`);

      return {
        label: `${p.favorite ? '$(star-full) ' : '$(folder) '}${p.name}`,
        description: parts.join(' '),
        detail: p.path + (p.description ? ` — ${p.description}` : ''),
        buttons: [revealFolderBtn, openTerminalBtn, openInNewWindowBtn],
        project: p
      };
    });

    const quickPick = vscode.window.createQuickPick<ProjectQuickPickItem>();
    quickPick.items = items;
    quickPick.placeholder = 'Search and switch to any project...';
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;

    quickPick.onDidTriggerItemButton(async (e) => {
      const p = e.item.project;
      if (e.button === openInNewWindowBtn) {
        await storageService.recordProjectOpen(p.id);
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(p.path), { forceNewWindow: true });
        quickPick.hide();
      } else if (e.button === openTerminalBtn) {
        const terminal = vscode.window.createTerminal({ name: p.name, cwd: p.path });
        terminal.show();
        quickPick.hide();
      } else if (e.button === revealFolderBtn) {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(p.path));
      }
    });

    quickPick.onDidAccept(async () => {
      const selected = quickPick.selectedItems[0];
      if (selected) {
        const p = selected.project;
        await storageService.recordProjectOpen(p.id);
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(p.path), { forceNewWindow: false });
      }
      quickPick.hide();
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  });

  // Status Bar Item (Right side)
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'projectDashboard.open';
  statusBarItem.text = '$(dashboard) Projects';
  statusBarItem.tooltip = 'Open Project Dashboard (Cmd+Alt+P for Quick Switcher)';

  const config = vscode.workspace.getConfiguration('projectDashboard');
  const showStatusBar = config.get<boolean>('showStatusBarItem', true);
  if (showStatusBar) {
    statusBarItem.show();
  }

  // Handle configuration changes dynamically
  const configListener = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('projectDashboard.showStatusBarItem')) {
      const shouldShow = vscode.workspace.getConfiguration('projectDashboard').get<boolean>('showStatusBarItem', true);
      if (shouldShow) {
        statusBarItem.show();
      } else {
        statusBarItem.hide();
      }
    }
  });

  // Automatically open dashboard immediately when VS Code starts with no folder open (if configured)
  const openOnStartupWhenEmpty = config.get<boolean>('openOnStartupWhenEmpty', false);
  const isWorkspaceEmpty = !vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0;
  if (openOnStartupWhenEmpty && isWorkspaceEmpty) {
    DashboardPanel.createOrShow(context.extensionUri);
  }

  context.subscriptions.push(
    openDashboardCmd,
    quickSwitchCmd,
    addCurrentProjectCmd,
    exportCmd,
    importCmd,
    statusBarItem,
    configListener
  );
}

export function deactivate() {
  DashboardPanel.kill();
}
