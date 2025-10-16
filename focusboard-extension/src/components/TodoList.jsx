import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "focusboard-todos";

const loadTodos = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse todos, resetting", error);
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
};

const saveTodos = (todos) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (error) {
    console.warn("Failed to save todos", error);
  }
};

const FILTERS = {
  all: { label: "All", predicate: () => true },
  active: { label: "Active", predicate: (todo) => !todo.done },
  done: { label: "Done", predicate: (todo) => todo.done },
};

const TodoList = () => {
  const [todos, setTodos] = useState(() => loadTodos());
  const [filter, setFilter] = useState("all");
  const [input, setInput] = useState("");

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

  const filteredTodos = useMemo(() => todos.filter(FILTERS[filter].predicate), [todos, filter]);

  const addTodo = (text) => {
    if (!text.trim()) return;
    setTodos((prev) => [
      ...prev,
      {
        id: (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)),
        text: text.trim(),
        done: false,
      },
    ]);
    setInput("");
  };

  const toggleTodo = (id) => {
    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)));
  };

  const removeTodo = (id) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTodo(input);
    }
    if (event.key === "Escape") {
      setInput("");
    }
  };

  return (
    <div className="todo">
      <div className="todo__header">
        <h2 id="todo-heading">To-do List</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addTodo(input);
          }}
          className="todo__form"
        >
          <label className="sr-only" htmlFor="todo-input">
            새 작업 추가
          </label>
          <input
            id="todo-input"
            type="text"
            placeholder="할 일을 입력하고 Enter"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" className="primary">
            추가
          </button>
        </form>
      </div>
      <div className="todo__filters" role="tablist" aria-label="Todo filters">
        {Object.entries(FILTERS).map(([key, filterDef]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
          >
            {filterDef.label}
          </button>
        ))}
      </div>
      <ul className="todo__list">
        {filteredTodos.length === 0 && (
          <li className="empty" aria-live="polite">
            {todos.length === 0 ? "할 일을 추가해 보세요." : "조건에 맞는 작업이 없습니다."}
          </li>
        )}
        {filteredTodos.map((todo) => (
          <li key={todo.id} className={todo.done ? "done" : ""}>
            <label>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => toggleTodo(todo.id)}
                aria-label={`${todo.text} 완료 여부`}
              />
              <span>{todo.text}</span>
            </label>
            <button
              type="button"
              className="danger"
              onClick={() => removeTodo(todo.id)}
              aria-label={`${todo.text} 삭제`}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodoList;
