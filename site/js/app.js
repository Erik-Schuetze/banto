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
    const titleElement = column.querySelector(".kanban-column-title-text");
    const title = titleElement ? titleElement.innerText.trim() : "";

    const items = [];
    column.querySelectorAll(".kanban-item").forEach((item) => {
      const titleEl = item.querySelector(".kanban-item-title");
      const notesEl = item.querySelector(".kanban-item-notes");

      items.push({
        title: titleEl ? titleEl.innerText : "",
        notes: notesEl ? notesEl.innerText : "",
        titleKey: titleEl ? titleEl.dataset.key : "",
        notesKey: notesEl ? notesEl.dataset.key : "",
        completed: !!item.querySelector(".kanban-item-complete.completed")
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
  item.setAttribute("draggable", "true");

  const header = document.createElement("div");
  header.className = "kanban-item-header";

  const title = createElement("div", "kanban-item-title", itemData.title || "Title");
  title.dataset.key = itemData.titleKey || generateKey("title");

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "kanban-item-delete";
  deleteBtn.type = "button";
  deleteBtn.textContent = "×";
  deleteBtn.setAttribute("aria-label", "Delete item");

  const completeBtn = document.createElement("button");
  completeBtn.className = "kanban-item-complete";
  completeBtn.type = "button";
  completeBtn.textContent = "✔";
  completeBtn.setAttribute("aria-label", "Toggle complete");

  if (itemData.completed) {
    completeBtn.classList.add("completed");
    title.classList.add("completed");
  }

  header.append(title, completeBtn, deleteBtn);

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

  const titleDiv = document.createElement("div");
  titleDiv.className = "kanban-column-title";
  titleDiv.setAttribute("draggable", "true");

  const titleSpan = document.createElement("span");
  titleSpan.className = "kanban-column-title-text";
  titleSpan.setAttribute("contenteditable", "true");
  titleSpan.setAttribute("draggable", "false");
  titleSpan.textContent = titleText;
  titleSpan.dataset.key = generateKey("column-title");

  const deleteBtn = createDeleteButton();

  titleDiv.append(titleSpan, deleteBtn);

  const addButton = document.createElement("button");
  addButton.className = "kanban-item-add";
  addButton.type = "button";
  addButton.textContent = "+";
  addButton.setAttribute("aria-label", `Add item to ${titleText}`);

  column.append(titleDiv);

  items.forEach((itemData) => {
    const item = createItemElement(itemData);
    column.append(item);
  });

  column.append(addButton);

  // Make title editable like item titles
  ensureEditable(titleSpan);

  // Setup column drag - will be called by the event setup below
  titleDiv.dataset.setupColumnDrag = "true";

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

    // Double-rAF ensures the browser has fully applied contenteditable
    // before we focus and place the cursor
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        addColumnButton.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(addColumnButton);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      });
    });
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
      // Setup drag on the new column title
      const titleDiv = column.querySelector(".kanban-column-title");
      if (titleDiv && setupColumnTitleDrag) {
        setupColumnTitleDrag(titleDiv);
      }
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

  // Capture the initial board state as the baseline for undo history
  if (boardHistory.history.length === 0) {
    const initialState = JSON.stringify(
      Array.from(container.querySelectorAll(".kanban-column:not(.kanban-column-add)")).map((column) => {
        const titleElement = column.querySelector(".kanban-column-title-text");
        const title = titleElement ? titleElement.innerText.trim() : "";
        const items = [];
        column.querySelectorAll(".kanban-item").forEach((item) => {
          const titleEl = item.querySelector(".kanban-item-title");
          const notesEl = item.querySelector(".kanban-item-notes");
          items.push({
            title: titleEl ? titleEl.innerText : "",
            notes: notesEl ? notesEl.innerText : "",
            titleKey: titleEl ? titleEl.dataset.key : "",
            notesKey: notesEl ? notesEl.dataset.key : "",
            completed: !!item.querySelector(".kanban-item-complete.completed")
          });
        });
        return { title, items };
      })
    );
    boardHistory.saveState(initialState);
  }

  // Column dragging functionality
  let draggedColumn = null;
  let lastTargetColumn = null;
  let lastDropPosition = null;

  const cleanupColumnDrag = () => {
    if (draggedColumn) {
      draggedColumn.classList.remove("dragging");
      const columnTitle = draggedColumn.querySelector(".kanban-column-title");
      if (columnTitle) {
        columnTitle.classList.remove("dragging");
      }
    }
    draggedColumn = null;
    lastTargetColumn = null;
    lastDropPosition = null;
    container.querySelectorAll(".kanban-column").forEach(col => {
      col.classList.remove("drop-left", "drop-right");
    });
  };

  // Create a function to setup drag on newly created columns
  const setupColumnTitleDrag = (titleDiv) => {
    if (titleDiv.dataset.dragSetup === "true") {
      return; // Already setup
    }
    titleDiv.dataset.dragSetup = "true";

    titleDiv.addEventListener("dragstart", (event) => {
      // Make sure we're not dragging from the delete button
      if (event.target.closest(".kanban-column-delete")) {
        event.preventDefault();
        return;
      }

      draggedColumn = titleDiv.closest(".kanban-column");
      draggedColumn.classList.add("dragging");
      titleDiv.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", "column-drag");
    });

    titleDiv.addEventListener("dragend", (event) => {
      cleanupColumnDrag();
    });
  };

  // Setup drag for all existing column titles
  container.querySelectorAll(".kanban-column-title:not(.kanban-column-add .kanban-column-title)").forEach(titleDiv => {
    setupColumnTitleDrag(titleDiv);
  });

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

    const completeButton = event.target.closest(".kanban-item-complete");
    if (completeButton) {
      const item = completeButton.closest(".kanban-item");
      if (item) {
        const titleEl = item.querySelector(".kanban-item-title");
        completeButton.classList.toggle("completed");
        titleEl.classList.toggle("completed");
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
        // Setup drag handlers on restored columns
        container.querySelectorAll(".kanban-column-title:not(.kanban-column-add .kanban-column-title)").forEach(titleDiv => {
          setupColumnTitleDrag(titleDiv);
        });
      }
    });

    redoBtn.addEventListener("click", () => {
      const nextState = boardHistory.redo();
      if (nextState) {
        restoreBoardState(container, nextState);
        // Setup drag handlers on restored columns
        container.querySelectorAll(".kanban-column-title:not(.kanban-column-add .kanban-column-title)").forEach(titleDiv => {
          setupColumnTitleDrag(titleDiv);
        });
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

  // Drag and drop functionality
  let draggedItem = null;

  const setupDragAndDrop = (container) => {
    // Handle drag start
    container.addEventListener("dragstart", (event) => {
      // Don't handle if this is a column title drag (titleDiv has draggable="true")
      const columnTitle = event.target.closest(".kanban-column-title");
      if (columnTitle) {
        return;
      }

      const item = event.target.closest(".kanban-item");
      if (!item || item.classList.contains("kanban-item-add")) {
        return;
      }

      draggedItem = item;
      item.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/html", item.innerHTML);
    });

    // Handle drag end
    container.addEventListener("dragend", (event) => {
      // Don't handle if this is a column title drag
      if (event.target.closest(".kanban-column-title")) {
        return;
      }

      const item = event.target.closest(".kanban-item");
      if (item) {
        item.classList.remove("dragging");
      }
      draggedItem = null;

      // Remove all drop indicators
      document.querySelectorAll(".kanban-drop-indicator").forEach(ind => ind.remove());
    });

    // Handle drag over (allow drop)
    container.addEventListener("dragover", (event) => {
      if (!draggedItem) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const column = event.target.closest(".kanban-column");
      if (!column || column.classList.contains("kanban-column-add")) {
        return;
      }

      // Remove existing indicator
      document.querySelectorAll(".kanban-drop-indicator").forEach(ind => ind.remove());

      const items = Array.from(column.querySelectorAll(".kanban-item"));
      const addButton = column.querySelector(".kanban-item-add");

      // Find insertion point based on cursor position
      let insertBefore = null;
      for (const item of items) {
        if (item === draggedItem) continue;

        const rect = item.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (event.clientY < midpoint) {
          insertBefore = item;
          break;
        }
      }

      // Create and insert drop indicator
      const dropIndicator = document.createElement("div");
      dropIndicator.className = "kanban-drop-indicator";

      if (insertBefore) {
        column.insertBefore(dropIndicator, insertBefore);
      } else if (addButton) {
        column.insertBefore(dropIndicator, addButton);
      } else {
        column.appendChild(dropIndicator);
      }
    });

    // Handle drop
    container.addEventListener("drop", (event) => {
      if (!draggedItem) {
        return;
      }

      event.preventDefault();

      const targetColumn = event.target.closest(".kanban-column");
      if (!targetColumn || targetColumn.classList.contains("kanban-column-add")) {
        return;
      }

      // Remove drop indicator
      document.querySelectorAll(".kanban-drop-indicator").forEach(ind => ind.remove());

      // Get target position
      const items = Array.from(targetColumn.querySelectorAll(".kanban-item"));
      const addButton = targetColumn.querySelector(".kanban-item-add");
      let insertBefore = null;

      for (const item of items) {
        if (item === draggedItem) continue;

        const rect = item.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (event.clientY < midpoint) {
          insertBefore = item;
          break;
        }
      }

      // Only move if it's a different position
      const currentColumn = draggedItem.closest(".kanban-column");
      const targetIndex = insertBefore
        ? Array.from(targetColumn.querySelectorAll(".kanban-item")).indexOf(insertBefore)
        : targetColumn.querySelectorAll(".kanban-item").length;

      const currentIndex = Array.from(currentColumn.querySelectorAll(".kanban-item")).indexOf(draggedItem);
      const isSameColumn = currentColumn === targetColumn;
      const isSamePosition = isSameColumn && currentIndex === targetIndex;

      if (!isSamePosition) {
        // Move the item
        if (insertBefore) {
          targetColumn.insertBefore(draggedItem, insertBefore);
        } else if (addButton) {
          targetColumn.insertBefore(draggedItem, addButton);
        } else {
          targetColumn.appendChild(draggedItem);
        }

        // Save to history and board
        saveBoard(container);
      }

      draggedItem.classList.remove("dragging");
      draggedItem = null;
    });

    // Drag leave to clean up indicators
    container.addEventListener("dragleave", (event) => {
      if (!event.target.closest(".kanban-item")) {
        document.querySelectorAll(".kanban-drop-indicator").forEach(ind => ind.remove());
      }
    });
  };


  // Column drag and drop handlers for hover effects and drop operations
  const setupColumnDragAndDrop = (container) => {

    // Handle drag over columns
    container.addEventListener("dragover", (event) => {
      if (!draggedColumn) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const targetColumn = event.target.closest(".kanban-column");
      if (!targetColumn || targetColumn.classList.contains("kanban-column-add") || draggedColumn === targetColumn) {
        // Clear indicators when not over a valid target
        if (lastTargetColumn) {
          lastTargetColumn.classList.remove("drop-left", "drop-right");
          lastTargetColumn = null;
          lastDropPosition = null;
        }
        return;
      }

      // Determine drop position based on cursor location
      const rect = targetColumn.getBoundingClientRect();
      const isDropLeft = event.clientX < rect.left + rect.width / 2;
      const dropPosition = isDropLeft ? 'left' : 'right';

      // Only update indicator if target or position has changed (prevents jitter)
      if (targetColumn === lastTargetColumn && dropPosition === lastDropPosition) {
        return;
      }

      // Clear previous indicator
      if (lastTargetColumn) {
        lastTargetColumn.classList.remove("drop-left", "drop-right");
      }

      lastTargetColumn = targetColumn;
      lastDropPosition = dropPosition;

      // Apply CSS class to show indicator via pseudo-element
      targetColumn.classList.add(isDropLeft ? "drop-left" : "drop-right");

      event.stopPropagation();
    }, true); // Use CAPTURE phase

    // Handle column drop
    container.addEventListener("drop", (event) => {
      if (!draggedColumn) {
        return;
      }

      event.preventDefault();

      const targetColumn = event.target.closest(".kanban-column");
      if (!targetColumn || targetColumn.classList.contains("kanban-column-add") || draggedColumn === targetColumn) {
        cleanupColumnDrag();
        event.stopPropagation();
        return;
      }

      // Determine drop position based on cursor location
      const rect = targetColumn.getBoundingClientRect();
      const isDropLeft = event.clientX < rect.left + rect.width / 2;

      // Move the column before or after target
      if (isDropLeft) {
        targetColumn.parentNode.insertBefore(draggedColumn, targetColumn);
      } else {
        targetColumn.parentNode.insertBefore(draggedColumn, targetColumn.nextSibling);
      }

      // Save to history and board
      saveBoard(container);

      cleanupColumnDrag();
      event.stopPropagation();
    }, true); // Use CAPTURE phase

    // Drag leave cleanup
    container.addEventListener("dragleave", (event) => {
      if (!draggedColumn) return;
      // Only clean up when leaving the container entirely
      if (!container.contains(event.relatedTarget)) {
        container.querySelectorAll(".kanban-column").forEach(col => {
          col.classList.remove("drop-left", "drop-right");
        });
        lastTargetColumn = null;
        lastDropPosition = null;
      }
    });
  };

  setupDragAndDrop(container);
  setupColumnDragAndDrop(container);

  // Touch drag & drop (mobile)
  if ("ontouchstart" in window) {
    const LONG_PRESS_MS = 200;
    const MOVE_THRESHOLD = 5;

    const setupTouchItemDrag = (container) => {
      let touchItem = null;
      let clone = null;
      let longPressTimer = null;
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let offsetX = 0;
      let offsetY = 0;

      const cleanup = () => {
        clearTimeout(longPressTimer);
        if (clone) {
          clone.remove();
          clone = null;
        }
        if (touchItem) {
          touchItem.classList.remove("dragging");
        }
        touchItem = null;
        isDragging = false;
        document.querySelectorAll(".kanban-drop-indicator").forEach(ind => ind.remove());
      };

      container.addEventListener("touchstart", (e) => {
        const item = e.target.closest(".kanban-item");
        if (!item) return;

        // Don't drag from buttons or editable content
        if (e.target.closest(".kanban-item-delete") ||
            e.target.closest(".kanban-item-complete") ||
            e.target.closest("[contenteditable='true']")) {
          return;
        }

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        const rect = item.getBoundingClientRect();
        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;

        touchItem = item;

        longPressTimer = setTimeout(() => {
          isDragging = true;
          touchItem.classList.add("dragging");

          clone = touchItem.cloneNode(true);
          clone.className = "kanban-item touch-drag-clone";
          clone.style.width = rect.width + "px";
          clone.style.left = (touch.clientX - offsetX) + "px";
          clone.style.top = (touch.clientY - offsetY) + "px";
          document.body.appendChild(clone);
        }, LONG_PRESS_MS);
      }, { passive: true });

      container.addEventListener("touchmove", (e) => {
        if (!touchItem) return;

        const touch = e.touches[0];

        if (!isDragging) {
          const dx = Math.abs(touch.clientX - startX);
          const dy = Math.abs(touch.clientY - startY);
          if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
            // User is scrolling, cancel long press
            clearTimeout(longPressTimer);
            touchItem = null;
          }
          return;
        }

        e.preventDefault();

        clone.style.left = (touch.clientX - offsetX) + "px";
        clone.style.top = (touch.clientY - offsetY) + "px";

        // Find drop target via elementFromPoint (clone has pointer-events: none)
        const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!targetEl) return;

        const column = targetEl.closest(".kanban-column");
        if (!column || column.classList.contains("kanban-column-add")) {
          document.querySelectorAll(".kanban-drop-indicator").forEach(ind => ind.remove());
          return;
        }

        document.querySelectorAll(".kanban-drop-indicator").forEach(ind => ind.remove());

        const items = Array.from(column.querySelectorAll(".kanban-item"));
        const addButton = column.querySelector(".kanban-item-add");

        let insertBefore = null;
        for (const item of items) {
          if (item === touchItem) continue;
          const rect = item.getBoundingClientRect();
          if (touch.clientY < rect.top + rect.height / 2) {
            insertBefore = item;
            break;
          }
        }

        const dropIndicator = document.createElement("div");
        dropIndicator.className = "kanban-drop-indicator";
        if (insertBefore) {
          column.insertBefore(dropIndicator, insertBefore);
        } else if (addButton) {
          column.insertBefore(dropIndicator, addButton);
        } else {
          column.appendChild(dropIndicator);
        }
      }, { passive: false });

      container.addEventListener("touchend", (e) => {
        clearTimeout(longPressTimer);

        if (!isDragging || !touchItem) {
          cleanup();
          return;
        }

        // Find the drop target from the last indicator position
        const indicator = document.querySelector(".kanban-drop-indicator");
        if (indicator) {
          const targetColumn = indicator.closest(".kanban-column");
          if (targetColumn) {
            const insertBefore = indicator.nextElementSibling;
            indicator.remove();

            if (insertBefore && insertBefore !== touchItem) {
              targetColumn.insertBefore(touchItem, insertBefore);
            } else if (!insertBefore) {
              const addButton = targetColumn.querySelector(".kanban-item-add");
              if (addButton) {
                targetColumn.insertBefore(touchItem, addButton);
              } else {
                targetColumn.appendChild(touchItem);
              }
            }
            saveBoard(container);
          }
        }

        cleanup();
      }, { passive: true });

      container.addEventListener("touchcancel", () => cleanup(), { passive: true });
    };

    const setupTouchColumnDrag = (container) => {
      let touchColumn = null;
      let clone = null;
      let longPressTimer = null;
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let offsetX = 0;
      let lastTarget = null;
      let lastPosition = null;

      const cleanup = () => {
        clearTimeout(longPressTimer);
        if (clone) {
          clone.remove();
          clone = null;
        }
        if (touchColumn) {
          touchColumn.classList.remove("dragging");
          const titleDiv = touchColumn.querySelector(".kanban-column-title");
          if (titleDiv) titleDiv.classList.remove("dragging");
        }
        container.querySelectorAll(".kanban-column").forEach(col => {
          col.classList.remove("drop-left", "drop-right");
        });
        touchColumn = null;
        isDragging = false;
        lastTarget = null;
        lastPosition = null;
      };

      container.addEventListener("touchstart", (e) => {
        const titleDiv = e.target.closest(".kanban-column-title");
        if (!titleDiv) return;
        if (titleDiv.closest(".kanban-column-add")) return;

        // Don't drag from buttons or editable text
        if (e.target.closest(".kanban-column-delete") ||
            e.target.closest(".kanban-column-title-text")) {
          return;
        }

        const column = titleDiv.closest(".kanban-column");
        if (!column) return;

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        const rect = column.getBoundingClientRect();
        offsetX = touch.clientX - rect.left;

        touchColumn = column;

        longPressTimer = setTimeout(() => {
          isDragging = true;
          touchColumn.classList.add("dragging");
          titleDiv.classList.add("dragging");

          clone = touchColumn.cloneNode(true);
          clone.className = "kanban-column touch-drag-clone";
          clone.style.width = rect.width + "px";
          clone.style.height = rect.height + "px";
          clone.style.left = (touch.clientX - offsetX) + "px";
          clone.style.top = rect.top + "px";
          document.body.appendChild(clone);
        }, LONG_PRESS_MS);
      }, { passive: true });

      container.addEventListener("touchmove", (e) => {
        if (!touchColumn) return;

        const touch = e.touches[0];

        if (!isDragging) {
          const dx = Math.abs(touch.clientX - startX);
          const dy = Math.abs(touch.clientY - startY);
          if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            touchColumn = null;
          }
          return;
        }

        e.preventDefault();

        clone.style.left = (touch.clientX - offsetX) + "px";

        const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!targetEl) return;

        const targetColumn = targetEl.closest(".kanban-column");
        if (!targetColumn || targetColumn.classList.contains("kanban-column-add") || targetColumn === touchColumn) {
          if (lastTarget) {
            lastTarget.classList.remove("drop-left", "drop-right");
            lastTarget = null;
            lastPosition = null;
          }
          return;
        }

        const rect = targetColumn.getBoundingClientRect();
        const isDropLeft = touch.clientX < rect.left + rect.width / 2;
        const dropPosition = isDropLeft ? "left" : "right";

        if (targetColumn === lastTarget && dropPosition === lastPosition) return;

        if (lastTarget) {
          lastTarget.classList.remove("drop-left", "drop-right");
        }

        lastTarget = targetColumn;
        lastPosition = dropPosition;
        targetColumn.classList.add(isDropLeft ? "drop-left" : "drop-right");
      }, { passive: false });

      container.addEventListener("touchend", (e) => {
        clearTimeout(longPressTimer);

        if (!isDragging || !touchColumn) {
          cleanup();
          return;
        }

        if (lastTarget && lastPosition) {
          if (lastPosition === "left") {
            lastTarget.parentNode.insertBefore(touchColumn, lastTarget);
          } else {
            lastTarget.parentNode.insertBefore(touchColumn, lastTarget.nextSibling);
          }
          saveBoard(container);
        }

        cleanup();
      }, { passive: true });

      container.addEventListener("touchcancel", () => cleanup(), { passive: true });
    };

    setupTouchItemDrag(container);
    setupTouchColumnDrag(container);
  }
});
