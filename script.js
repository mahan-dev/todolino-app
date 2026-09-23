(() => {
  "use strict";

  const STORAGE_KEY = "todolino_tasks";
  const THEME_KEY = "todolino_theme";

  const STATUS = Object.freeze({
    TODO: "todo",
    IN_PROGRESS: "in_progress",
    DONE: "done",
  });

  const STATUS_LABELS = Object.freeze({
    [STATUS.TODO]: "Todo",
    [STATUS.IN_PROGRESS]: "In Progress",
    [STATUS.DONE]: "Done",
  });

  const dom = {
    board: document.querySelector("#board"),
    addTaskButton: document.querySelector("#addTaskButton"),
    modal: document.querySelector("#taskModal"),
    modalTitle: document.querySelector("#modalTitle"),
    closeModalButton: document.querySelector("#closeModalButton"),
    cancelTaskButton: document.querySelector("#cancelTaskButton"),
    taskForm: document.querySelector("#taskForm"),
    taskTitle: document.querySelector("#taskTitle"),
    taskDescription: document.querySelector("#taskDescription"),
    titleError: document.querySelector("#titleError"),
    taskTemplate: document.querySelector("#taskTemplate"),
    // New elements for the sidebar
    toggleSidebarButton: document.querySelector("#toggleSidebarButton"),
    sidebar: document.querySelector("#sidebar"),
    // Theme toggle
    themeToggle: document.querySelector("#themeToggle"),
    themeIcon: document.querySelector(".theme-icon"),
  };

  const state = {
    tasks: [],
    editingTaskId: null,
    draggedTaskId: null,
  };

  // -----------------------------------------
  // Storage
  // -----------------------------------------

  const storage = {
    load() {
      try {
        const storedTasks = localStorage.getItem(STORAGE_KEY);

        if (!storedTasks) {
          return [];
        }

        const parsedTasks = JSON.parse(storedTasks);

        if (!Array.isArray(parsedTasks)) {
          return [];
        }

        return parsedTasks.filter(isValidTask);
      } catch (error) {
        console.error("Failed to load tasks:", error);
        return [];
      }
    },

    save(tasks) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (error) {
        console.error("Failed to save tasks:", error);
      }
    },
  };

  // -----------------------------------------
  // Validation
  // -----------------------------------------

  function isValidTask(task) {
    return (
      task &&
      typeof task === "object" &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.description === "string" &&
      Object.values(STATUS).includes(task.status) &&
      typeof task.createdAt === "string"
    );
  }

  function validateTitle(title) {
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      return {
        valid: false,
        message: "Task title is required.",
      };
    }

    if (normalizedTitle.length > 100) {
      return {
        valid: false,
        message: "Title must be 100 characters or less.",
      };
    }

    return {
      valid: true,
      message: "",
    };
  }

  // -----------------------------------------
  // Task management
  // -----------------------------------------

  const taskManager = {
    create(title, description) {
      const task = {
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: title.trim(),
        description: description.trim(),
        status: STATUS.TODO,
        createdAt: new Date().toISOString(),
      };

      state.tasks.push(task);
      storage.save(state.tasks);

      return task;
    },

    update(id, updates) {
      const task = state.tasks.find((item) => item.id === id);

      if (!task) {
        return null;
      }

      Object.assign(task, {
        ...updates,
        title: updates.title?.trim() ?? task.title,
        description: updates.description?.trim() ?? task.description,
      });

      storage.save(state.tasks);

      return task;
    },

    remove(id) {
      const initialLength = state.tasks.length;

      state.tasks = state.tasks.filter((task) => task.id !== id);

      if (state.tasks.length !== initialLength) {
        storage.save(state.tasks);
        return true;
      }

      return false;
    },

    move(id, status) {
      if (!Object.values(STATUS).includes(status)) {
        return false;
      }

      const task = state.tasks.find((item) => item.id === id);

      if (!task || task.status === status) {
        return false;
      }

      task.status = status;
      storage.save(state.tasks);

      return true;
    },

    find(id) {
      return state.tasks.find((task) => task.id === id) ?? null;
    },
  };

  // -----------------------------------------
  // Rendering
  // -----------------------------------------

  const renderer = {
    render() {
      const taskLists = {
        [STATUS.TODO]: document.querySelector(
          `[data-task-list="${STATUS.TODO}"]`
        ),
        [STATUS.IN_PROGRESS]: document.querySelector(
          `[data-task-list="${STATUS.IN_PROGRESS}"]`
        ),
        [STATUS.DONE]: document.querySelector(
          `[data-task-list="${STATUS.DONE}"]`
        ),
      };

      Object.values(taskLists).forEach((list) => {
        list.replaceChildren();
      });

      const fragmentByStatus = {
        [STATUS.TODO]: document.createDocumentFragment(),
        [STATUS.IN_PROGRESS]: document.createDocumentFragment(),
        [STATUS.DONE]: document.createDocumentFragment(),
      };

      state.tasks.forEach((task) => {
        const card = renderer.createTaskCard(task);
        fragmentByStatus[task.status].appendChild(card);
      });

      Object.entries(fragmentByStatus).forEach(([status, fragment]) => {
        taskLists[status].appendChild(fragment);
      });

      renderer.updateCounts();
      renderer.updateEmptyStates();
    },

    createTaskCard(task) {
      const card = dom.taskTemplate.content
        .firstElementChild
        .cloneNode(true);

      card.dataset.taskId = task.id;
      card.dataset.status = task.status;

      const statusLabel = card.querySelector(".task-status-label");
      const title = card.querySelector(".task-title");
      const description = card.querySelector(".task-description");
      const date = card.querySelector(".task-date");

      statusLabel.textContent = STATUS_LABELS[task.status];
      title.textContent = task.title;

      if (task.description) {
        description.textContent = task.description;
      } else {
        description.remove();
      }

      date.textContent = formatDate(task.createdAt);
      date.dateTime = task.createdAt;

      return card;
    },

    updateCounts() {
      Object.values(STATUS).forEach((status) => {
        const count = state.tasks.filter(
          (task) => task.status === status
        ).length;

        const countElement = document.querySelector(
          `[data-count="${status}"]`
        );

        countElement.textContent = count;
      });
    },

    updateEmptyStates() {
      document.querySelectorAll(".column").forEach((column) => {
        const status = column.dataset.status;

        const hasTasks = state.tasks.some(
          (task) => task.status === status
        );

        column.classList.toggle("is-empty", !hasTasks);
      });
    },
  };

  // -----------------------------------------
  // Modal
  // -----------------------------------------

  const modal = {
    open(task = null) {
      state.editingTaskId = task?.id ?? null;

      dom.modalTitle.textContent = task
        ? "Edit task"
        : "Create a task";

      dom.taskTitle.value = task?.title ?? "";
      dom.taskDescription.value = task?.description ?? "";

      dom.modal.classList.add("is-open");
      dom.modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      requestAnimationFrame(() => {
        dom.taskTitle.focus();
      });
    },

    close() {
      dom.modal.classList.remove("is-open");
      dom.modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";

      state.editingTaskId = null;

      dom.taskForm.reset();
      clearValidation();
    },
  };

  // -----------------------------------------
  // Form
  // -----------------------------------------

  function handleFormSubmit(event) {
    event.preventDefault();

    const title = dom.taskTitle.value;
    const description = dom.taskDescription.value;

    const validation = validateTitle(title);

    if (!validation.valid) {
      showTitleError(validation.message);
      dom.taskTitle.focus();
      return;
    }

    if (state.editingTaskId) {
      taskManager.update(state.editingTaskId, {
        title,
        description,
      });
    } else {
      taskManager.create(title, description);
    }

    renderer.render();
    modal.close();
  }

  function showTitleError(message) {
    dom.titleError.textContent = message;
    dom.taskTitle.classList.add("input-error");
  }

  function clearValidation() {
    dom.titleError.textContent = "";
    dom.taskTitle.classList.remove("input-error");
  }

  // -----------------------------------------
  // Drag and drop
  // -----------------------------------------

  function handleDragStart(event) {
    const card = event.target.closest(".task-card");

    if (!card) {
      return;
    }

    state.draggedTaskId = card.dataset.taskId;

    card.classList.add("dragging");

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "text/plain",
      state.draggedTaskId
    );
  }

  function handleDragEnd(event) {
    const card = event.target.closest(".task-card");

    if (card) {
      card.classList.remove("dragging");
    }

    state.draggedTaskId = null;

    document.querySelectorAll(".column.drag-over").forEach((column) => {
      column.classList.remove("drag-over");
    });
  }

  function handleDragOver(event) {
    const column = event.target.closest(".column");

    if (!column || !state.draggedTaskId) {
      return;
    }

    event.preventDefault();

    event.dataTransfer.dropEffect = "move";

    document.querySelectorAll(".column.drag-over").forEach((item) => {
      if (item !== column) {
        item.classList.remove("drag-over");
      }
    });

    column.classList.add("drag-over");
  }

  function handleDragLeave(event) {
    const column = event.target.closest(".column");

    if (!column) {
      return;
    }

    const relatedTarget = event.relatedTarget;

    if (relatedTarget && column.contains(relatedTarget)) {
      return;
    }

    column.classList.remove("drag-over");
  }

  function handleDrop(event) {
    const column = event.target.closest(".column");

    if (!column || !state.draggedTaskId) {
      return;
    }

    event.preventDefault();

    const newStatus = column.dataset.status;

    taskManager.move(state.draggedTaskId, newStatus);

    column.classList.remove("drag-over");

    renderer.render();
  }

  // -----------------------------------------
  // Task actions
  // -----------------------------------------

  function handleTaskAction(event) {
    const actionButton = event.target.closest(".task-action");

    if (!actionButton) {
      return;
    }

    const card = actionButton.closest(".task-card");

    if (!card) {
      return;
    }

    const task = taskManager.find(card.dataset.taskId);

    if (!task) {
      return;
    }

    if (actionButton.classList.contains("edit-task")) {
      modal.open(task);
      return;
    }

    if (actionButton.classList.contains("delete-task")) {
      const shouldDelete = window.confirm(
        `Delete "${task.title}"?`
      );

      if (!shouldDelete) {
        return;
      }

      taskManager.remove(task.id);
      renderer.render();
    }
  }

  // -----------------------------------------
  // Utilities
  // -----------------------------------------

  function formatDate(dateString) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "Unknown date";
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  // -----------------------------------------
  // Theme
  // -----------------------------------------

  function applyTheme(isDark) {
    if (isDark) {
      document.body.classList.add("dark-theme");
      if (dom.themeIcon) dom.themeIcon.textContent = "☀️";
    } else {
      document.body.classList.remove("dark-theme");
      if (dom.themeIcon) dom.themeIcon.textContent = "🌙";
    }
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    const isDark = savedTheme ? savedTheme === "dark" : prefersDark;
    applyTheme(isDark);
  }

  function toggleTheme() {
    const isDark = document.body.classList.toggle("dark-theme");
    if (dom.themeIcon) dom.themeIcon.textContent = isDark ? "☀️" : "🌙";
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  }

  // -----------------------------------------
  // Event listeners
  // -----------------------------------------

  function setupEventListeners() {
    dom.addTaskButton.addEventListener("click", () => {
      modal.open();
    });

    dom.closeModalButton.addEventListener("click", () => {
      modal.close();
    });

    dom.cancelTaskButton.addEventListener("click", () => {
      modal.close();
    });

    dom.taskForm.addEventListener("submit", handleFormSubmit);

    dom.taskTitle.addEventListener("input", () => {
      if (dom.taskTitle.value.trim()) {
        clearValidation();
      }
    });

    dom.modal.addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-close-modal")) {
        modal.close();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dom.modal.classList.contains("is-open")) {
        modal.close();
      }
    });

    // Sidebar toggle
    if (dom.toggleSidebarButton && dom.sidebar) {
      // Initialize ARIA attribute
      dom.toggleSidebarButton.setAttribute("aria-expanded", "true");
      dom.toggleSidebarButton.addEventListener("click", () => {
        dom.sidebar.classList.toggle("collapsed");
        const expanded = !dom.sidebar.classList.contains("collapsed");
        dom.toggleSidebarButton.setAttribute("aria-expanded", expanded);
      });
    }

    // Theme toggle
    if (dom.themeToggle) {
      dom.themeToggle.addEventListener("click", toggleTheme);
    }

    // Task card actions (edit / delete) – delegated
    dom.board.addEventListener("click", handleTaskAction);

    // Drag‑and‑drop – delegated
    dom.board.addEventListener("dragstart", handleDragStart);
    dom.board.addEventListener("dragend", handleDragEnd);
    dom.board.addEventListener("dragover", handleDragOver);
    dom.board.addEventListener("dragleave", handleDragLeave);
    dom.board.addEventListener("drop", handleDrop);
  }

  // -----------------------------------------
  // Application initialization
  // -----------------------------------------

  function init() {
    initTheme();
    state.tasks = storage.load();

    setupEventListeners();
    renderer.render();
  }

  init();
})();
