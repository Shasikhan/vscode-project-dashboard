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

  // Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'projectDashboard.open';
  statusBarItem.text = '$(dashboard) Projects';
  statusBarItem.tooltip = 'Open Project Dashboard';
  statusBarItem.show();

  context.subscriptions.push(
    openDashboardCmd,
    addCurrentProjectCmd,
    exportCmd,
    importCmd,
    statusBarItem
  );
}

export function deactivate() {
  DashboardPanel.kill();
}
