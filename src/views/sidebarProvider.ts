import * as vscode from 'vscode';
import * as path from 'path';
import { StorageService } from '../services/storageService';
import { WebviewToHostMessage, Project, Category } from '../models/project';
import { DashboardPanel } from './dashboardPanel';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'projectDashboard.sidebarView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _storageService: StorageService
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'media')
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    const dataListener = this._storageService.onDidChangeData(data => {
      this._view?.webview.postMessage({
        command: 'setData',
        data
      });
    });

    webviewView.onDidDispose(() => {
      dataListener.dispose();
    });

    webviewView.webview.onDidReceiveMessage(async (message: WebviewToHostMessage | { command: 'openFullDashboard' }) => {
      if (message.command === 'openFullDashboard') {
        DashboardPanel.createOrShow(this._extensionUri);
        return;
      }

      switch (message.command) {
        case 'getInitialData':
        case 'refreshGitStatus': {
          const immediateData = this._storageService.getData();
          this._view?.webview.postMessage({
            command: 'setData',
            data: immediateData
          });

          this._storageService.getDataAsync().then(enrichedData => {
            this._view?.webview.postMessage({
              command: 'setData',
              data: enrichedData
            });
          }).catch(err => {
            console.error('Failed to enrich projects in sidebar async:', err);
          });
          break;
        }

        case 'pickFolder': {
          const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: 'Select Project Folder'
          };
          const folderUri = await vscode.window.showOpenDialog(options);
          if (folderUri && folderUri[0]) {
            const selectedPath = folderUri[0].fsPath;
            const defaultName = path.basename(selectedPath);
            this._view?.webview.postMessage({
              command: 'folderPicked',
              path: selectedPath,
              name: defaultName,
              targetField: message.targetField
            });
          }
          break;
        }

        case 'openProject': {
          try {
            await this._storageService.recordProjectOpen(message.projectId);
            const uri = vscode.Uri.file(message.path);
            await vscode.commands.executeCommand('vscode.openFolder', uri, {
              forceNewWindow: message.newWindow
            });
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to open project: ${err?.message || err}`);
          }
          break;
        }

        case 'openTerminal': {
          try {
            const terminal = vscode.window.createTerminal({
              name: message.name || path.basename(message.path),
              cwd: message.path
            });
            terminal.show();
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to open terminal: ${err?.message || err}`);
          }
          break;
        }

        case 'revealInFinder': {
          try {
            const uri = vscode.Uri.file(message.path);
            await vscode.commands.executeCommand('revealFileInOS', uri);
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to reveal folder: ${err?.message || err}`);
          }
          break;
        }

        case 'savePreferences': {
          await this._storageService.updatePreferences(message.preferences);
          break;
        }

        case 'saveProject': {
          await this._storageService.saveProject(message.project);
          vscode.window.showInformationMessage(`Project "${message.project.name}" saved!`);
          break;
        }

        case 'deleteProject': {
          const project = this._storageService.getData().projects.find(p => p.id === message.id);
          const confirm = await vscode.window.showWarningMessage(
            `Remove "${project?.name || 'this project'}" from dashboard?`,
            { modal: true },
            'Remove'
          );
          if (confirm === 'Remove') {
            await this._storageService.deleteProject(message.id);
          }
          break;
        }

        case 'toggleFavorite': {
          await this._storageService.toggleFavorite(message.id);
          break;
        }

        case 'saveCategory': {
          await this._storageService.saveCategory(message.category);
          break;
        }

        case 'deleteCategory': {
          await this._storageService.deleteCategory(message.id);
          break;
        }

        case 'showNotification': {
          if (message.type === 'error') {
            vscode.window.showErrorMessage(message.message);
          } else if (message.type === 'warning') {
            vscode.window.showWarningMessage(message.message);
          } else {
            vscode.window.showInformationMessage(message.message);
          }
          break;
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.js')
    );

    const nonce = getNonce();
    const initialData = this._storageService.getData();
    const initialDataJson = JSON.stringify(initialData).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>Projects</title>
</head>
<body class="dashboard-body is-sidebar">
  <div id="app" class="app-container">
    <header class="dashboard-header sidebar-header">
      <div class="sidebar-top-bar">
        <button id="btn-open-full-dashboard" class="primary-button btn-full-width" title="Open Full Dashboard in Tab">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          Open Full Dashboard
        </button>
      </div>

      <div class="sidebar-actions-row">
        <button id="btn-add-project" class="secondary-button btn-small flex-1" title="Add Project">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add
        </button>
        <button id="btn-manage-categories" class="secondary-button btn-small flex-1" title="Manage Categories">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          Categories
        </button>
        <button id="btn-refresh-data" class="icon-button" title="Refresh Git Status">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
      </div>
    </header>

    <section class="toolbar-section">
      <div class="search-box-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="project-search-input" placeholder="Filter projects..." autocomplete="off" />
        <button id="btn-clear-search" class="clear-search-btn" style="display: none;">&times;</button>
      </div>
    </section>

    <nav class="category-filter-bar" id="category-filter-bar">
      <!-- Dynamic category chips -->
    </nav>

    <main class="dashboard-content">
      <div id="projects-container" class="projects-list is-sidebar-mode">
        <!-- Projects rendered here -->
      </div>

      <div id="empty-state" class="empty-state-card" style="display: none;">
        <p id="empty-state-desc">No projects found.</p>
        <button id="btn-empty-add-project" class="primary-button btn-small">Add Project</button>
      </div>
    </main>
  </div>

  <!-- Project Modal (Add / Edit) -->
  <div id="project-modal" class="modal-backdrop" style="display: none;">
    <div class="modal-card">
      <div class="modal-header">
        <h2 id="modal-project-title">Add Project</h2>
        <button id="btn-close-project-modal" class="modal-close-btn">&times;</button>
      </div>
      <form id="project-form">
        <input type="hidden" id="form-project-id" />
        <div class="form-group">
          <label for="form-project-name">Name <span class="required">*</span></label>
          <input type="text" id="form-project-name" class="form-input" required />
        </div>
        <div class="form-group">
          <label for="form-project-path">Folder Path <span class="required">*</span></label>
          <div class="path-input-group">
            <input type="text" id="form-project-path" class="form-input" required />
            <button type="button" id="btn-browse-folder" class="secondary-button browse-btn">Browse</button>
          </div>
        </div>
        <div class="form-group">
          <label for="form-project-category">Category</label>
          <select id="form-project-category" class="form-select"></select>
        </div>
        <div class="form-group">
          <label>Color Accent</label>
          <div class="color-picker-container">
            <div class="color-presets" id="color-presets"></div>
            <input type="color" id="form-project-color" value="#3b82f6" />
          </div>
        </div>
        <div class="form-group">
          <label for="form-project-tags">Tags (Optional)</label>
          <input type="text" id="form-project-tags" class="form-input" placeholder="e.g. Frontend, API" />
        </div>
        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" id="form-project-favorite" />
            <span>Pin as Favorite</span>
          </label>
        </div>
        <div class="modal-footer">
          <button type="button" id="btn-cancel-project" class="secondary-button">Cancel</button>
          <button type="submit" id="btn-save-project" class="primary-button">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Category Manager Modal -->
  <div id="category-modal" class="modal-backdrop" style="display: none;">
    <div class="modal-card">
      <div class="modal-header">
        <h2>Manage Categories</h2>
        <button id="btn-close-category-modal" class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body-scrollable">
        <form id="category-form" class="category-add-form">
          <input type="hidden" id="form-cat-id" />
          <div class="form-group">
            <label for="form-cat-name">Category Name</label>
            <input type="text" id="form-cat-name" class="form-input" required />
          </div>
          <div class="form-group">
            <label>Color</label>
            <div class="cat-color-row">
              <input type="color" id="form-cat-color" value="#3b82f6" />
              <button type="submit" id="btn-save-category" class="primary-button btn-small">Save</button>
            </div>
          </div>
        </form>
        <div class="categories-list-section">
          <h3>Categories</h3>
          <div id="categories-manage-list" class="categories-manage-list"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" id="btn-done-categories" class="primary-button">Done</button>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    window.INITIAL_DATA = ${initialDataJson};
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
