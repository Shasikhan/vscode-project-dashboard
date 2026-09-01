// Project Dashboard Webview Client Script
(function () {
  // Acquire VS Code API
  const vscode = acquireVsCodeApi();

  // Color Presets
  const PRESET_COLORS = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#14b8a6', // Teal
    '#84cc16', // Lime
    '#f97316', // Orange
    '#64748b'  // Slate
  ];

  // Retrieve saved webview preferences (persisted across sessions/reloads)
  const savedState = vscode.getState() || {};

  // State
  let state = {
    projects: [],
    categories: [],
    selectedCategory: savedState.selectedCategory || 'all', // 'all' | 'favorites' | categoryId
    searchQuery: '',
    sortBy: savedState.sortBy || 'recent',
    viewMode: savedState.viewMode || 'grid', // 'grid' | 'list'
    editingProjectId: null,
    editingCategoryId: null,
    selectedColor: PRESET_COLORS[0]
  };

  function saveWebviewState() {
    vscode.setState({
      sortBy: state.sortBy,
      viewMode: state.viewMode,
      selectedCategory: state.selectedCategory
    });
    // Persist globally into VS Code globalState via extension host
    vscode.postMessage({
      command: 'savePreferences',
      preferences: {
        sortBy: state.sortBy,
        viewMode: state.viewMode,
        selectedCategory: state.selectedCategory
      }
    });
  }

  // DOM Elements
  const projectsContainer = document.getElementById('projects-container');
  const emptyState = document.getElementById('empty-state');
  const categoryFilterBar = document.getElementById('category-filter-bar');
  const searchInput = document.getElementById('project-search-input');
  const clearSearchBtn = document.getElementById('btn-clear-search');
  const sortSelect = document.getElementById('sort-select');
  const totalProjectsPill = document.getElementById('total-projects-pill');
  const totalCategoriesPill = document.getElementById('total-categories-pill');

  // View Mode Toggles
  const btnViewGrid = document.getElementById('view-mode-grid');
  const btnViewList = document.getElementById('view-mode-list');

  // Action Buttons
  const btnAddProject = document.getElementById('btn-add-project');
  const btnEmptyAddProject = document.getElementById('btn-empty-add-project');
  const btnManageCategories = document.getElementById('btn-manage-categories');
  const btnOpenFullDashboard = document.getElementById('btn-open-full-dashboard');
  const btnRefreshData = document.getElementById('btn-refresh-data');
  const btnExport = document.getElementById('btn-export-data');
  const btnImport = document.getElementById('btn-import-data');

  // Project Modal Elements
  const projectModal = document.getElementById('project-modal');
  const projectForm = document.getElementById('project-form');
  const modalProjectTitle = document.getElementById('modal-project-title');
  const btnCloseProjectModal = document.getElementById('btn-close-project-modal');
  const btnCancelProject = document.getElementById('btn-cancel-project');
  const formProjectId = document.getElementById('form-project-id');
  const formProjectName = document.getElementById('form-project-name');
  const formProjectPath = document.getElementById('form-project-path');
  const formProjectCategory = document.getElementById('form-project-category');
  const formProjectColor = document.getElementById('form-project-color');
  const formProjectTags = document.getElementById('form-project-tags');
  const formProjectDescription = document.getElementById('form-project-description');
  const formProjectFavorite = document.getElementById('form-project-favorite');
  const btnBrowseFolder = document.getElementById('btn-browse-folder');
  const colorPresetsContainer = document.getElementById('color-presets');
  const customColorHex = document.getElementById('custom-color-hex');

  // Category Modal Elements
  const categoryModal = document.getElementById('category-modal');
  const categoryForm = document.getElementById('category-form');
  const btnCloseCatModal = document.getElementById('btn-close-category-modal');
  const btnDoneCategories = document.getElementById('btn-done-categories');
  const formCatId = document.getElementById('form-cat-id');
  const formCatName = document.getElementById('form-cat-name');
  const formCatColor = document.getElementById('form-cat-color');
  const btnSaveCategory = document.getElementById('btn-save-category');
  const btnCancelCatEdit = document.getElementById('btn-cancel-cat-edit');
  const categoriesManageList = document.getElementById('categories-manage-list');

  // Render Skeleton Cards while loading
  function renderSkeletons(count = 4) {
    if (!projectsContainer) return;
    projectsContainer.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const skel = document.createElement('div');
      skel.className = 'skeleton-card';
      skel.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-line skeleton-subtitle"></div>
        </div>
        <div class="skeleton-line skeleton-desc"></div>
        <div class="skeleton-line skeleton-path"></div>
        <div class="skeleton-line skeleton-tags"></div>
      `;
      projectsContainer.appendChild(skel);
    }
  }

  // Initialize
  function init() {
    if (window.INITIAL_DATA) {
      state.projects = window.INITIAL_DATA.projects || [];
      state.categories = window.INITIAL_DATA.categories || [];
      if (window.INITIAL_DATA.preferences) {
        if (window.INITIAL_DATA.preferences.sortBy) {
          state.sortBy = window.INITIAL_DATA.preferences.sortBy;
        }
        if (window.INITIAL_DATA.preferences.viewMode) {
          state.viewMode = window.INITIAL_DATA.preferences.viewMode;
        }
        if (window.INITIAL_DATA.preferences.selectedCategory && state.selectedCategory === 'all') {
          state.selectedCategory = window.INITIAL_DATA.preferences.selectedCategory;
        }
      }
    }

    if (sortSelect) {
      sortSelect.value = state.sortBy;
    }
    if (state.viewMode === 'list') {
      btnViewList?.classList.add('active');
      btnViewGrid?.classList.remove('active');
      projectsContainer?.classList.add('is-list-view');
    }
    setupColorPresets();
    setupEventListeners();

    if (state.projects && state.projects.length > 0) {
      render();
    } else {
      renderSkeletons(4);
    }

    // Request fresh/enriched background data from host
    vscode.postMessage({ command: 'getInitialData' });
  }

  // Setup Color Presets in Modal
  function setupColorPresets() {
    if (!colorPresetsContainer) return;
    colorPresetsContainer.innerHTML = '';
    PRESET_COLORS.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = `color-swatch ${color === state.selectedColor ? 'active' : ''}`;
      swatch.style.backgroundColor = color;
      swatch.dataset.color = color;
      swatch.addEventListener('click', () => {
        selectProjectColor(color);
      });
      colorPresetsContainer.appendChild(swatch);
    });
  }

  function selectProjectColor(color) {
    state.selectedColor = color;
    if (formProjectColor) formProjectColor.value = color;
    if (customColorHex) customColorHex.textContent = color.toUpperCase();

    // Update swatches active state
    if (colorPresetsContainer) {
      const swatches = colorPresetsContainer.querySelectorAll('.color-swatch');
      swatches.forEach(swatch => {
        swatch.classList.toggle('active', swatch.dataset.color === color);
      });
    }
  }

  // Event Listeners
  function setupEventListeners() {
    // Window messages from extension host
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'setData':
          state.projects = message.data.projects || [];
          state.categories = message.data.categories || [];
          if (message.data.preferences) {
            if (message.data.preferences.sortBy) {
              state.sortBy = message.data.preferences.sortBy;
              if (sortSelect) sortSelect.value = state.sortBy;
            }
            if (message.data.preferences.viewMode) {
              state.viewMode = message.data.preferences.viewMode;
              if (state.viewMode === 'list') {
                btnViewList?.classList.add('active');
                btnViewGrid?.classList.remove('active');
                projectsContainer?.classList.add('is-list-view');
              } else {
                btnViewGrid?.classList.add('active');
                btnViewList?.classList.remove('active');
                projectsContainer?.classList.remove('is-list-view');
              }
            }
            if (message.data.preferences.selectedCategory && state.selectedCategory === 'all') {
              state.selectedCategory = message.data.preferences.selectedCategory;
            }
          }
          render();
          break;
        case 'folderPicked':
          if (formProjectPath) {
            formProjectPath.value = message.path;
            if (!formProjectName.value && message.name) {
              formProjectName.value = message.name;
            }
          }
          break;
        case 'filterCategory':
          state.selectedCategory = message.categoryId;
          saveWebviewState();
          render();
          break;
      }
    });

    // Search Input
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        if (clearSearchBtn) {
          clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
        }
        renderProjects();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        renderProjects();
      });
    }

    // Sort Dropdown (Preserved in webview state)
    if (sortSelect) {
      sortSelect.addEventListener('change', e => {
        state.sortBy = e.target.value;
        saveWebviewState();
        renderProjects();
      });
    }

    // View Toggles (Preserved in webview state)
    if (btnViewGrid && btnViewList) {
      btnViewGrid.addEventListener('click', () => {
        state.viewMode = 'grid';
        saveWebviewState();
        btnViewGrid.classList.add('active');
        btnViewList.classList.remove('active');
        projectsContainer?.classList.remove('is-list-view');
      });

      btnViewList.addEventListener('click', () => {
        state.viewMode = 'list';
        saveWebviewState();
        btnViewList.classList.add('active');
        btnViewGrid.classList.remove('active');
        projectsContainer?.classList.add('is-list-view');
      });
    }

    // Action buttons
    btnAddProject?.addEventListener('click', () => openProjectModal());
    btnEmptyAddProject?.addEventListener('click', () => openProjectModal());
    btnManageCategories?.addEventListener('click', () => openCategoryModal());
    btnOpenFullDashboard?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openFullDashboard' });
    });

    btnRefreshData?.addEventListener('click', () => {
      btnRefreshData.classList.add('is-spinning');
      vscode.postMessage({ command: 'refreshGitStatus' });
      setTimeout(() => btnRefreshData.classList.remove('is-spinning'), 1200);
    });

    btnExport?.addEventListener('click', () => {
      vscode.postMessage({ command: 'exportData' });
    });

    btnImport?.addEventListener('click', () => {
      vscode.postMessage({ command: 'importData' });
    });

    // Project Modal
    btnCloseProjectModal?.addEventListener('click', () => closeProjectModal());
    btnCancelProject?.addEventListener('click', () => closeProjectModal());
    btnBrowseFolder?.addEventListener('click', () => {
      vscode.postMessage({ command: 'pickFolder' });
    });

    formProjectColor?.addEventListener('input', e => {
      selectProjectColor(e.target.value);
    });

    projectForm?.addEventListener('submit', e => {
      e.preventDefault();
      saveProjectForm();
    });

    // Category Modal
    btnCloseCatModal?.addEventListener('click', () => closeCategoryModal());
    btnDoneCategories?.addEventListener('click', () => closeCategoryModal());
    categoryForm?.addEventListener('submit', e => {
      e.preventDefault();
      saveCategoryForm();
    });

    btnCancelCatEdit?.addEventListener('click', () => resetCategoryForm());

    // Close modals on backdrop click
    projectModal?.addEventListener('click', e => {
      if (e.target === projectModal) closeProjectModal();
    });

    categoryModal?.addEventListener('click', e => {
      if (e.target === categoryModal) closeCategoryModal();
    });
  }

  // Render Everything
  function render() {
    updateHeaderStats();
    renderCategoryFilters();
    populateCategorySelect();
    renderProjects();
    renderManageCategoriesList();
  }

  function updateHeaderStats() {
    if (totalProjectsPill) {
      totalProjectsPill.textContent = `${state.projects.length} Project${state.projects.length === 1 ? '' : 's'}`;
    }
    if (totalCategoriesPill) {
      totalCategoriesPill.textContent = `${state.categories.length} Categor${state.categories.length === 1 ? 'y' : 'ies'}`;
    }
  }

  // Category Filter Bar
  function renderCategoryFilters() {
    if (!categoryFilterBar) return;
    categoryFilterBar.innerHTML = '';

    // "All" filter chip
    const allChip = createCategoryChip('all', 'All', '#64748b', state.projects.length);
    categoryFilterBar.appendChild(allChip);

    // "Favorites" filter chip
    const favCount = state.projects.filter(p => p.favorite).length;
    const favChip = createCategoryChip('favorites', '★ Favorites', '#fbbf24', favCount);
    categoryFilterBar.appendChild(favChip);

    // Dynamic Category Chips
    state.categories.forEach(cat => {
      const count = state.projects.filter(p => p.categoryId === cat.id).length;
      const chip = createCategoryChip(cat.id, cat.name, cat.color, count);
      categoryFilterBar.appendChild(chip);
    });

    // "Uncategorized" chip if any exists
    const uncatCount = state.projects.filter(p => !p.categoryId).length;
    if (uncatCount > 0) {
      const uncatChip = createCategoryChip('uncategorized', 'Uncategorized', '#94a3b8', uncatCount);
      categoryFilterBar.appendChild(uncatChip);
    }
  }

  function createCategoryChip(id, name, color, count) {
    const chip = document.createElement('button');
    chip.className = `category-chip ${state.selectedCategory === id ? 'active' : ''}`;
    
    let dotHtml = color ? `<span class="category-dot" style="background-color: ${escapeHtml(color)};"></span>` : '';
    chip.innerHTML = `
      ${dotHtml}
      <span>${escapeHtml(name)}</span>
      <span class="category-count">${count}</span>
    `;

    chip.addEventListener('click', () => {
      state.selectedCategory = id;
      saveWebviewState();
      renderCategoryFilters();
      renderProjects();
    });

    return chip;
  }

  // Populate Categories in Project Modal Dropdown
  function populateCategorySelect() {
    if (!formProjectCategory) return;
    formProjectCategory.innerHTML = '<option value="">(None / Uncategorized)</option>';
    state.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      formProjectCategory.appendChild(opt);
    });
  }

  // Filter & Sort Projects
  function getFilteredProjects() {
    return state.projects.filter(p => {
      // Category filter
      if (state.selectedCategory === 'favorites') {
        if (!p.favorite) return false;
      } else if (state.selectedCategory === 'uncategorized') {
        if (p.categoryId) return false;
      } else if (state.selectedCategory !== 'all') {
        if (p.categoryId !== state.selectedCategory) return false;
      }

      // Search query filter
      if (state.searchQuery) {
        const q = state.searchQuery;
        const nameMatch = p.name.toLowerCase().includes(q);
        const pathMatch = p.path.toLowerCase().includes(q);
        const descMatch = p.description && p.description.toLowerCase().includes(q);
        const tagsMatch = p.tags && p.tags.some(t => t.toLowerCase().includes(q));
        const techMatch = p.techStack && p.techStack.some(t => t.toLowerCase().includes(q));
        const cat = state.categories.find(c => c.id === p.categoryId);
        const catMatch = cat && cat.name.toLowerCase().includes(q);
        return nameMatch || pathMatch || descMatch || tagsMatch || techMatch || catMatch;
      }

      return true;
    }).sort((a, b) => {
      // Favorite pinning: favorites always on top if sorting by recent/created
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;

      switch (state.sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'created-desc':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'created-asc':
          return (a.createdAt || 0) - (b.createdAt || 0);
        case 'recent':
        default:
          return (b.lastOpened || 0) - (a.lastOpened || 0);
      }
    });
  }

  // Render Project Cards
  function renderProjects() {
    if (!projectsContainer) return;
    const filtered = getFilteredProjects();

    projectsContainer.innerHTML = '';

    if (filtered.length === 0) {
      if (emptyState) {
        emptyState.style.display = 'flex';
        const titleEl = document.getElementById('empty-state-title');
        const descEl = document.getElementById('empty-state-desc');
        if (state.searchQuery) {
          if (titleEl) titleEl.textContent = 'No matching projects';
          if (descEl) descEl.textContent = `No projects matched "${state.searchQuery}". Try a different keyword.`;
        } else if (state.selectedCategory !== 'all') {
          if (titleEl) titleEl.textContent = 'No projects in this category';
          if (descEl) descEl.textContent = 'Add a project to this category or select a different filter.';
        } else {
          if (titleEl) titleEl.textContent = 'No Projects Found';
          if (descEl) descEl.textContent = 'Get started by adding your first project to your dashboard.';
        }
      }
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    filtered.forEach(project => {
      const card = createProjectCard(project);
      projectsContainer.appendChild(card);
    });
  }

  // Build Project Card Element
  function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    const projectColor = project.color || '#3b82f6';
    card.style.setProperty('--project-color', projectColor);
    card.style.borderTopColor = projectColor;

    const category = state.categories.find(c => c.id === project.categoryId);
    const categoryName = category ? category.name : (project.categoryId ? 'Unknown' : '');
    const categoryColor = category ? category.color : '#64748b';

    const lastOpenedFormatted = formatTimeAgo(project.lastOpened);

    card.innerHTML = `
      <div class="project-card-header">
        <div class="project-title-area">
          <div class="project-name-row">
            <span class="project-name" title="${escapeHtml(project.name)}">${escapeHtml(project.name)}</span>
            <button class="btn-star ${project.favorite ? 'is-favorite' : ''}" title="${project.favorite ? 'Unpin favorite' : 'Pin as favorite'}">
              ★
            </button>
          </div>
          ${categoryName ? `
            <div class="project-category-tag" style="background-color: ${escapeHtml(categoryColor)}22; color: ${escapeHtml(categoryColor)}; border: 1px solid ${escapeHtml(categoryColor)}44;">
              <span class="category-dot" style="background-color: ${escapeHtml(categoryColor)};"></span>
              ${escapeHtml(categoryName)}
            </div>
          ` : ''}
        </div>

        <div class="project-card-actions">
          <button class="card-action-btn btn-open-terminal" title="Open Integrated Terminal Here">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          </button>
          <button class="card-action-btn btn-reveal-folder" title="Reveal in Finder / Explorer">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </button>
          <button class="card-action-btn edit-btn" title="Edit Project">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="card-action-btn delete-btn" title="Delete Project">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>

      <div class="project-card-body">
        ${project.description ? `<p class="project-description">${escapeHtml(project.description)}</p>` : ''}
        
        <div class="project-path-row" title="${escapeHtml(project.path)}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <span class="project-path-text">${escapeHtml(project.path)}</span>
          <button class="btn-copy-path" title="Copy Path">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>

        ${(project.techStack && project.techStack.length > 0) || (project.tags && project.tags.length > 0) ? `
          <div class="project-tags-row">
            ${(project.techStack || []).map(t => `<span class="tech-stack-badge">${escapeHtml(t)}</span>`).join('')}
            ${(project.tags || []).map(t => `
              <span class="project-tag">
                #${escapeHtml(t)}
                <button type="button" class="btn-remove-tag" data-tag="${escapeHtml(t)}" title="Remove tag ${escapeHtml(t)}">&times;</button>
              </span>
            `).join('')}
          </div>
        ` : ''}

        ${project.gitInfo && project.gitInfo.isGit ? `
          <div class="project-git-row">
            <span class="git-badge git-branch-badge" title="Git Branch: ${escapeHtml(project.gitInfo.branch || 'HEAD')}">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
              ${escapeHtml(project.gitInfo.branch || 'HEAD')}
            </span>

            ${project.gitInfo.clean ? `
              <span class="git-badge git-status-clean" title="Clean working tree (0 uncommitted changes)">
                ✓ Clean
              </span>
            ` : `
              <span class="git-badge git-status-dirty" title="${project.gitInfo.modified || 0} modified/staged, ${project.gitInfo.untracked || 0} untracked files">
                ● ${(project.gitInfo.modified || 0) + (project.gitInfo.untracked || 0)} changes
              </span>
            `}

            ${(project.gitInfo.ahead || 0) > 0 || (project.gitInfo.behind || 0) > 0 ? `
              <span class="git-badge git-sync-badge" title="${project.gitInfo.ahead || 0} ahead, ${project.gitInfo.behind || 0} behind remote">
                ${(project.gitInfo.ahead || 0) > 0 ? `↑${project.gitInfo.ahead}` : ''} ${(project.gitInfo.behind || 0) > 0 ? `↓${project.gitInfo.behind}` : ''}
              </span>
            ` : ''}
          </div>
        ` : ''}

        ${project.exists === false ? `
          <div class="path-status-warning">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            Folder not found on disk
          </div>
        ` : ''}
      </div>

      <div class="project-card-footer">
        <span class="last-opened-text">${lastOpenedFormatted}</span>
        <div class="launch-buttons-group">
          <button class="secondary-button btn-small btn-open-new-window" title="Open in New Window">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            New Window
          </button>
          <button class="primary-button btn-small btn-open-project" title="Open in Current Window">
            Open
          </button>
        </div>
      </div>
    `;

    // Click project name / open button
    const openBtn = card.querySelector('.btn-open-project');
    const openNewWindowBtn = card.querySelector('.btn-open-new-window');
    const nameEl = card.querySelector('.project-name');

    const handleOpen = (newWindow) => {
      vscode.postMessage({
        command: 'openProject',
        path: project.path,
        newWindow,
        projectId: project.id
      });
    };

    openBtn?.addEventListener('click', () => handleOpen(false));
    nameEl?.addEventListener('click', () => handleOpen(false));
    openNewWindowBtn?.addEventListener('click', () => handleOpen(true));

    // Terminal button
    const terminalBtn = card.querySelector('.btn-open-terminal');
    terminalBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({
        command: 'openTerminal',
        path: project.path,
        name: project.name
      });
    });

    // Reveal Folder button
    const revealBtn = card.querySelector('.btn-reveal-folder');
    revealBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({
        command: 'revealInFinder',
        path: project.path
      });
    });

    // Star / Favorite
    const starBtn = card.querySelector('.btn-star');
    starBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({ command: 'toggleFavorite', id: project.id });
    });

    // Remove single tag button on card
    card.querySelectorAll('.btn-remove-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tagToRemove = btn.dataset.tag;
        const updatedTags = (project.tags || []).filter(t => t !== tagToRemove);
        const updatedProject = { ...project, tags: updatedTags };
        vscode.postMessage({
          command: 'saveProject',
          project: updatedProject
        });
      });
    });

    // Copy Path
    const copyPathBtn = card.querySelector('.btn-copy-path');
    copyPathBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(project.path);
      vscode.postMessage({
        command: 'showNotification',
        message: `Copied path to clipboard: ${project.path}`,
        type: 'info'
      });
    });

    // Edit
    const editBtn = card.querySelector('.edit-btn');
    editBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      openProjectModal(project);
    });

    // Delete
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({ command: 'deleteProject', id: project.id });
    });

    return card;
  }

  // Open Project Modal (Add or Edit)
  function openProjectModal(project = null) {
    if (!projectModal) return;
    state.editingProjectId = project ? project.id : null;

    if (modalProjectTitle) {
      modalProjectTitle.textContent = project ? 'Edit Project' : 'Add Project';
    }

    if (formProjectId) formProjectId.value = project ? project.id : '';
    if (formProjectName) formProjectName.value = project ? project.name : '';
    if (formProjectPath) formProjectPath.value = project ? project.path : '';
    if (formProjectCategory) formProjectCategory.value = project ? project.categoryId : (state.selectedCategory !== 'all' && state.selectedCategory !== 'favorites' && state.selectedCategory !== 'uncategorized' ? state.selectedCategory : '');
    if (formProjectTags) formProjectTags.value = (project && project.tags) ? project.tags.join(', ') : '';
    if (formProjectDescription) formProjectDescription.value = (project && project.description) || '';
    if (formProjectFavorite) formProjectFavorite.checked = !!(project && project.favorite);

    const initialColor = (project && project.color) || PRESET_COLORS[0];
    selectProjectColor(initialColor);

    projectModal.style.display = 'flex';
    if (formProjectName) formProjectName.focus();
  }

  function closeProjectModal() {
    if (projectModal) projectModal.style.display = 'none';
    state.editingProjectId = null;
    projectForm?.reset();
  }

  function saveProjectForm() {
    const name = formProjectName?.value.trim();
    const folderPath = formProjectPath?.value.trim();
    const categoryId = formProjectCategory?.value || '';
    const color = state.selectedColor || '#3b82f6';
    const tagsRaw = formProjectTags?.value.trim() || '';
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const description = formProjectDescription ? formProjectDescription.value.trim() : '';
    const favorite = formProjectFavorite?.checked || false;

    if (!name || !folderPath) {
      vscode.postMessage({
        command: 'showNotification',
        message: 'Please provide both a project name and a folder path.',
        type: 'error'
      });
      return;
    }

    const existing = state.editingProjectId
      ? state.projects.find(p => p.id === state.editingProjectId)
      : null;

    const projectData = {
      id: state.editingProjectId || ('proj-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)),
      name,
      path: folderPath,
      color,
      categoryId,
      tags,
      description,
      favorite,
      createdAt: existing ? existing.createdAt : Date.now(),
      lastOpened: existing ? existing.lastOpened : undefined
    };

    vscode.postMessage({
      command: 'saveProject',
      project: projectData
    });

    closeProjectModal();
  }

  // Category Manager Modal
  function openCategoryModal() {
    if (!categoryModal) return;
    resetCategoryForm();
    renderManageCategoriesList();
    categoryModal.style.display = 'flex';
  }

  function closeCategoryModal() {
    if (categoryModal) categoryModal.style.display = 'none';
    resetCategoryForm();
  }

  function resetCategoryForm() {
    state.editingCategoryId = null;
    if (formCatId) formCatId.value = '';
    if (formCatName) formCatName.value = '';
    if (formCatColor) formCatColor.value = '#3b82f6';
    if (btnSaveCategory) btnSaveCategory.textContent = 'Add Category';
    if (btnCancelCatEdit) btnCancelCatEdit.style.display = 'none';
  }

  function saveCategoryForm() {
    const name = formCatName?.value.trim();
    const color = formCatColor?.value || '#3b82f6';

    if (!name) return;

    const category = {
      id: state.editingCategoryId || ('cat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)),
      name,
      color
    };

    vscode.postMessage({
      command: 'saveCategory',
      category
    });

    resetCategoryForm();
  }

  function renderManageCategoriesList() {
    if (!categoriesManageList) return;
    categoriesManageList.innerHTML = '';

    if (state.categories.length === 0) {
      categoriesManageList.innerHTML = '<p style="font-size: 12px; opacity: 0.6;">No categories created yet.</p>';
      return;
    }

    state.categories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'category-manage-item';
      item.innerHTML = `
        <div class="cat-item-left">
          <span class="category-dot" style="background-color: ${escapeHtml(cat.color)};"></span>
          <span style="font-weight: 500;">${escapeHtml(cat.name)}</span>
        </div>
        <div class="cat-item-actions">
          <button class="card-action-btn btn-edit-cat" title="Edit Category">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="card-action-btn delete-btn btn-del-cat" title="Delete Category">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      item.querySelector('.btn-edit-cat')?.addEventListener('click', () => {
        state.editingCategoryId = cat.id;
        if (formCatId) formCatId.value = cat.id;
        if (formCatName) formCatName.value = cat.name;
        if (formCatColor) formCatColor.value = cat.color;
        if (btnSaveCategory) btnSaveCategory.textContent = 'Update';
        if (btnCancelCatEdit) btnCancelCatEdit.style.display = 'inline-flex';
        formCatName?.focus();
      });

      item.querySelector('.btn-del-cat')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'deleteCategory', id: cat.id });
      });

      categoriesManageList.appendChild(item);
    });
  }

  // Utilities
  function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Never opened';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on startup
  init();
})();
