const STORAGE_PREFIX = "banto:kanban:";
const STORAGE_BOARD_KEY = "banto:board";
const STORAGE_HISTORY_KEY = "banto:history";
const ADD_COLUMN_LABEL = "add column";

// History management
class BoardHistory {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
    this.loadHistory();
  }

  saveState(boardState) {
    // Remove any future states if we're not at the end
    this.history = this.history.slice(0, this.currentIndex + 1);
    // Add new state
    this.history.push(boardState);
    this.currentIndex++;
    this.persistHistory();
    this.updateUndoRedoButtons();
  }

  undo() {
    if (this.canUndo()) {
      this.currentIndex--;
      this.persistHistory();
      return this.history[this.currentIndex];
    }
    return null;
  }

  redo() {
    if (this.canRedo()) {
      this.currentIndex++;
      this.persistHistory();
      return this.history[this.currentIndex];
    }
    return null;
  }

  canUndo() {
    return this.currentIndex > 0;
  }

  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  loadHistory() {
    const stored = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.history = data.history || [];
        this.currentIndex = data.currentIndex ?? -1;
      } catch (e) {
        console.error("Failed to load history:", e);
      }
    }
  }

  persistHistory() {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify({
      history: this.history,
      currentIndex: this.currentIndex
    }));
  }

  updateUndoRedoButtons() {
    const undoBtn = document.querySelector(".nav-undo-btn");
    const redoBtn = document.querySelector(".nav-redo-btn");

    if (undoBtn) {
      undoBtn.disabled = !this.canUndo();
    }
    if (redoBtn) {
      redoBtn.disabled = !this.canRedo();
    }
  }

  clear() {
    this.history = [];
    this.currentIndex = -1;
    this.persistHistory();
    this.updateUndoRedoButtons();
  }
}

let boardHistory = new BoardHistory();

const normalizeText = (value) => value.replace(/\r\n/g, "\n").trim();

const saveBoard = (container) => {
  const columns = [];

  container.querySelectorAll(".kanban-column:not(.kanban-column-add)").forEach((column) => {
    const titleElement = column.querySelector(".kanban-column-title");
    const title = titleElement ? titleElement.firstChild.textContent.trim() : "";

    const items = [];
    column.querySelectorAll(".kanban-item").forEach((item) => {
      const titleEl = item.querySelector(".kanban-item-title");
      const notesEl = item.querySelector(".kanban-item-notes");

      items.push({
        title: titleEl ? titleEl.innerText : "",
        notes: notesEl ? notesEl.innerText : "",
        titleKey: titleEl ? titleEl.dataset.key : "",
        notesKey: notesEl ? notesEl.dataset.key : ""
      });
    });

    columns.push({ title, items });
  });

  const boardState = JSON.stringify(columns);
  localStorage.setItem(STORAGE_BOARD_KEY, boardState);
  boardHistory.saveState(boardState);
};

const applyStoredValue = (element) => {
  const key = `${STORAGE_PREFIX}${element.dataset.key}`;
  const stored = localStorage.getItem(key);
  if (stored !== null) {
    element.innerText = stored;
  }
};

const persistValue = (element) => {
  const key = `${STORAGE_PREFIX}${element.dataset.key}`;
  const normalized = normalizeText(element.innerText);
  element.innerText = normalized;
  localStorage.setItem(key, normalized);
};

const ensureEditable = (element) => {
  if (element.dataset.bound === "true") {
    return;
  }

  element.dataset.bound = "true";
  element.setAttribute("contenteditable", "true");
  applyStoredValue(element);

  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey) {
      return;
    }

    event.preventDefault();
    persistValue(element);
    element.blur();
  });

  element.addEventListener("input", () => {
    const key = `${STORAGE_PREFIX}${element.dataset.key}`;
    localStorage.setItem(key, element.innerText);
  });

  element.addEventListener("blur", () => {
    persistValue(element);
    const container = document.querySelector(".kanban-container");
    if (container) {
      saveBoard(container);
    }
  });
};

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
};

const generateKey = (suffix) => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${crypto.randomUUID()}-${suffix}`;
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${suffix}`;
};

const restoreBoardState = (container, boardStateJson) => {
  try {
    const columns = JSON.parse(boardStateJson);
    const addColumnColumn = container.querySelector(".kanban-column-add");

    container.querySelectorAll(".kanban-column:not(.kanban-column-add)").forEach(col => col.remove());

    columns.forEach((columnData) => {
      const column = createColumnElement(columnData.title, columnData.items);
      container.insertBefore(column, addColumnColumn);
    });

    localStorage.setItem(STORAGE_BOARD_KEY, boardStateJson);
    boardHistory.updateUndoRedoButtons();
  } catch (e) {
    console.error("Failed to restore board state:", e);
  }
};

const createItemElement = (itemData = {}) => {
  const item = document.createElement("div");
  item.className = "kanban-item";

  const header = document.createElement("div");
  header.className = "kanban-item-header";

  const title = createElement("div", "kanban-item-title", itemData.title || "Title");
  title.dataset.key = itemData.titleKey || generateKey("title");

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "kanban-item-delete";
  deleteBtn.type = "button";
  deleteBtn.textContent = "×";
  deleteBtn.setAttribute("aria-label", "Delete item");

  header.append(title, deleteBtn);

  const notes = createElement("p", "kanban-item-notes", itemData.notes || "Description");
  notes.dataset.key = itemData.notesKey || generateKey("notes");

  ensureEditable(title);
  ensureEditable(notes);

  item.append(header, notes);
  return item;
};

const createDeleteButton = () => {
  const button = document.createElement("button");
  button.className = "kanban-column-delete";
  button.type = "button";
  button.textContent = "×";
  button.setAttribute("aria-label", "Delete column");
  return button;
};

const createColumnElement = (titleText, items = []) => {
  const column = document.createElement("div");
  column.className = "kanban-column";

  const title = document.createElement("div");
  title.className = "kanban-column-title";
  title.textContent = titleText;
  title.append(createDeleteButton());

  const addButton = document.createElement("button");
  addButton.className = "kanban-item-add";
  addButton.type = "button";
  addButton.textContent = "+";
  addButton.setAttribute("aria-label", `Add item to ${titleText}`);

  column.append(title);

  items.forEach((itemData) => {
    const item = createItemElement(itemData);
    column.append(item);
  });

  column.append(addButton);
  return column;
};

const setupAddColumn = (container) => {
  const addColumnButton = container.querySelector(".kanban-column-add .kanban-column-title");
  const addColumnColumn = container.querySelector(".kanban-column-add");

  if (!addColumnButton || !addColumnColumn) {
    return;
  }

  const resetAddColumnButton = () => {
    addColumnButton.dataset.editing = "false";
    addColumnButton.removeAttribute("contenteditable");
    addColumnButton.textContent = ADD_COLUMN_LABEL;
  };

  const startEditing = () => {
    if (addColumnButton.dataset.editing === "true") {
      return;
    }

    addColumnButton.dataset.editing = "true";
    addColumnButton.setAttribute("contenteditable", "true");
    addColumnButton.textContent = "";

    // Use setTimeout to ensure contenteditable is ready and cursor shows
    setTimeout(() => {
      addColumnButton.focus();
    }, 0);
  };

  addColumnButton.addEventListener("click", (event) => {
    event.preventDefault();
    startEditing();
  });

  addColumnButton.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      resetAddColumnButton();
      return;
    }

    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();

    const titleText = normalizeText(addColumnButton.innerText);
    if (titleText) {
      const column = createColumnElement(titleText);
      container.insertBefore(column, addColumnColumn);
      saveBoard(container);
    }

    resetAddColumnButton();
  });

  addColumnButton.addEventListener("blur", () => {
    if (addColumnButton.dataset.editing === "true") {
      resetAddColumnButton();
    }
  });
};

const loadBoard = (container) => {
  const stored = localStorage.getItem(STORAGE_BOARD_KEY);
  if (!stored) {
    return false;
  }

  try {
    const columns = JSON.parse(stored);
    const addColumnColumn = container.querySelector(".kanban-column-add");

    container.querySelectorAll(".kanban-column:not(.kanban-column-add)").forEach(col => col.remove());

    columns.forEach((columnData) => {
      const column = createColumnElement(columnData.title, columnData.items);
      container.insertBefore(column, addColumnColumn);
    });

    return true;
  } catch (e) {
    console.error("Failed to load board:", e);
    return false;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector(".kanban-container");
  if (!container) {
    return;
  }

  const boardLoaded = loadBoard(container);

  if (!boardLoaded) {
    document.querySelectorAll("[data-key]").forEach(ensureEditable);
  }

  setupAddColumn(container);

  container.addEventListener("click", (event) => {
    const deleteButton = event.target.closest(".kanban-column-delete");
    if (deleteButton) {
      const column = deleteButton.closest(".kanban-column");
      if (column && !column.classList.contains("kanban-column-add")) {
        column.remove();
        saveBoard(container);
      }
      return;
    }

    const deleteItemButton = event.target.closest(".kanban-item-delete");
    if (deleteItemButton) {
      const item = deleteItemButton.closest(".kanban-item");
      if (item) {
        item.remove();
        saveBoard(container);
      }
      return;
    }

    const addItemButton = event.target.closest(".kanban-item-add");
    if (addItemButton) {
      const column = addItemButton.closest(".kanban-column");
      if (!column || column.classList.contains("kanban-column-add")) {
        return;
      }

      const item = createItemElement();
      column.insertBefore(item, addItemButton);
      saveBoard(container);
    }
  });

  // Undo/Redo functionality
  const undoBtn = document.querySelector(".nav-undo-btn");
  const redoBtn = document.querySelector(".nav-redo-btn");

  if (undoBtn && redoBtn) {
    undoBtn.addEventListener("click", () => {
      const previousState = boardHistory.undo();
      if (previousState) {
        restoreBoardState(container, previousState);
      }
    });

    redoBtn.addEventListener("click", () => {
      const nextState = boardHistory.redo();
      if (nextState) {
        restoreBoardState(container, nextState);
      }
    });

    // Update button states on load
    boardHistory.updateUndoRedoButtons();
  }

  // Help modal functionality
  const helpBtn = document.querySelector(".nav-help-btn");
  const helpOverlay = document.getElementById("helpOverlay");
  const helpClose = document.querySelector(".help-close");

  if (helpBtn && helpOverlay && helpClose) {
    helpBtn.addEventListener("click", () => {
      helpOverlay.classList.add("active");
    });

    helpClose.addEventListener("click", () => {
      helpOverlay.classList.remove("active");
    });

    helpOverlay.addEventListener("click", (event) => {
      if (event.target === helpOverlay) {
        helpOverlay.classList.remove("active");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && helpOverlay.classList.contains("active")) {
        helpOverlay.classList.remove("active");
      }
    });
  }
});
