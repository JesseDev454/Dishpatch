import { FormEvent, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../lib/errors";
import { Category } from "../types";

type CategoryManagerProps = {
  categories: Category[];
  onChange: () => Promise<void>;
};

export const CategoryManager = ({ categories, onChange }: CategoryManagerProps) => {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await api.post("/categories", { name, sortOrder: Number(sortOrder) });
      setName("");
      setSortOrder("0");
      await onChange();
      showToast("Category created.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to create category");
      setError(message);
      showToast(message, "error");
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditSortOrder(String(category.sortOrder));
  };

  const saveEdit = async (id: number) => {
    setError(null);
    try {
      await api.patch(`/categories/${id}`, { name: editName, sortOrder: Number(editSortOrder) });
      setEditingId(null);
      await onChange();
      showToast("Category updated.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to update category");
      setError(message);
      showToast(message, "error");
    }
  };

  const deleteCategory = async (id: number) => {
    setError(null);
    try {
      await api.delete(`/categories/${id}`);
      await onChange();
      showToast("Category deleted.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to delete category");
      setError(message);
      showToast(message, "error");
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Categories</h3>
      </div>
      <form className="inline-form" onSubmit={createCategory}>
        <label>
          Category name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Rice & Sides"
          />
        </label>
        <label>
          Sort order
          <input
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            placeholder="0"
          />
        </label>
        <button type="submit">Add Category</button>
      </form>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="list">
        {categories.length === 0 ? <p className="empty-state">No categories yet. Add your first category to organize items.</p> : null}
        {categories.map((category) => (
          <div key={category.id} className="list-row">
            {editingId === category.id ? (
              <>
                <input value={editName} onChange={(event) => setEditName(event.target.value)} />
                <input
                  type="number"
                  value={editSortOrder}
                  onChange={(event) => setEditSortOrder(event.target.value)}
                />
                <button type="button" onClick={() => void saveEdit(category.id)}>
                  Save
                </button>
                <button type="button" className="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div>
                  <strong>{category.name}</strong>
                  <p className="muted">Sort: {category.sortOrder}</p>
                </div>
                <div className="actions">
                  <button type="button" className="ghost" onClick={() => startEdit(category)}>
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => void deleteCategory(category.id)}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
