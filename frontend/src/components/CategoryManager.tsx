import { FormEvent, useState } from "react";
import { api } from "../lib/api";
import { Category } from "../types";

type CategoryManagerProps = {
  categories: Category[];
  onChange: () => Promise<void>;
};

export const CategoryManager = ({ categories, onChange }: CategoryManagerProps) => {
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
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to create category");
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
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to update category");
    }
  };

  const deleteCategory = async (id: number) => {
    setError(null);
    try {
      await api.delete(`/categories/${id}`);
      await onChange();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to delete category");
    }
  };

  return (
    <section className="panel">
      <h3>Categories</h3>
      <form className="inline-form" onSubmit={createCategory}>
        <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Category name" />
        <input
          type="number"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          placeholder="Sort"
        />
        <button type="submit">Add</button>
      </form>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="list">
        {categories.length === 0 ? <p className="muted">No categories yet.</p> : null}
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
                <button onClick={() => void saveEdit(category.id)}>Save</button>
                <button className="ghost" onClick={() => setEditingId(null)}>
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
                  <button className="ghost" onClick={() => startEdit(category)}>
                    Edit
                  </button>
                  <button className="danger" onClick={() => void deleteCategory(category.id)}>
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
