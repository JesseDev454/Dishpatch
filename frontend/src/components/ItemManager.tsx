import { FormEvent, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Category, Item } from "../types";

type ItemManagerProps = {
  items: Item[];
  categories: Category[];
  onChange: () => Promise<void>;
};

type ItemFormState = {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  isAvailable: boolean;
};

const emptyItemForm: ItemFormState = {
  categoryId: "",
  name: "",
  description: "",
  price: "0",
  isAvailable: true
};

export const ItemManager = ({ items, categories, onChange }: ItemManagerProps) => {
  const [form, setForm] = useState<ItemFormState>(emptyItemForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<ItemFormState>(emptyItemForm);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const visibleItems = useMemo(() => {
    if (categoryFilter === "all") {
      return items;
    }
    return items.filter((item) => item.categoryId === Number(categoryFilter));
  }, [items, categoryFilter]);

  const createItem = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await api.post("/items", {
        categoryId: Number(form.categoryId),
        name: form.name,
        description: form.description || null,
        price: Number(form.price),
        isAvailable: form.isAvailable
      });
      setForm(emptyItemForm);
      await onChange();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to create item");
    }
  };

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEditingForm({
      categoryId: String(item.categoryId),
      name: item.name,
      description: item.description ?? "",
      price: item.price,
      isAvailable: item.isAvailable
    });
  };

  const saveEdit = async (id: number) => {
    setError(null);
    try {
      await api.patch(`/items/${id}`, {
        categoryId: Number(editingForm.categoryId),
        name: editingForm.name,
        description: editingForm.description || null,
        price: Number(editingForm.price),
        isAvailable: editingForm.isAvailable
      });
      setEditingId(null);
      await onChange();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to update item");
    }
  };

  const deleteItem = async (id: number) => {
    setError(null);
    try {
      await api.delete(`/items/${id}`);
      await onChange();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to delete item");
    }
  };

  const toggleAvailability = async (item: Item) => {
    setError(null);
    try {
      await api.patch(`/items/${item.id}`, { isAvailable: !item.isAvailable });
      await onChange();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to update availability");
    }
  };

  return (
    <section className="panel">
      <h3>Items</h3>
      <form className="item-form" onSubmit={createItem}>
        <select
          required
          value={form.categoryId}
          onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
        >
          <option value="">Select category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          required
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Item name"
        />
        <input
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Description (optional)"
        />
        <input
          required
          type="number"
          step="0.01"
          min="0"
          value={form.price}
          onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
          placeholder="Price"
        />
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.isAvailable}
            onChange={(event) => setForm((prev) => ({ ...prev, isAvailable: event.target.checked }))}
          />
          Available
        </label>
        <button type="submit" disabled={categories.length === 0}>
          Add Item
        </button>
      </form>

      <div className="toolbar">
        <label>
          Filter by category
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="list">
        {visibleItems.length === 0 ? <p className="muted">No items yet.</p> : null}
        {visibleItems.map((item) => (
          <div key={item.id} className="list-row">
            {editingId === item.id ? (
              <div className="edit-grid">
                <select
                  value={editingForm.categoryId}
                  onChange={(event) => setEditingForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  value={editingForm.name}
                  onChange={(event) => setEditingForm((prev) => ({ ...prev, name: event.target.value }))}
                />
                <input
                  value={editingForm.description}
                  onChange={(event) => setEditingForm((prev) => ({ ...prev, description: event.target.value }))}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingForm.price}
                  onChange={(event) => setEditingForm((prev) => ({ ...prev, price: event.target.value }))}
                />
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={editingForm.isAvailable}
                    onChange={(event) =>
                      setEditingForm((prev) => ({ ...prev, isAvailable: event.target.checked }))
                    }
                  />
                  Available
                </label>
                <div className="actions">
                  <button onClick={() => void saveEdit(item.id)}>Save</button>
                  <button className="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <strong>{item.name}</strong>
                  <p className="muted">
                    ₦{Number(item.price).toLocaleString()} | {item.isAvailable ? "Available" : "Unavailable"}
                  </p>
                </div>
                <div className="actions">
                  <button className="ghost" onClick={() => void toggleAvailability(item)}>
                    {item.isAvailable ? "Set Unavailable" : "Set Available"}
                  </button>
                  <button className="ghost" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button className="danger" onClick={() => void deleteItem(item.id)}>
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
