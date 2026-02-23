import { FormEvent, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../lib/errors";
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
  const { showToast } = useToast();
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
      showToast("Item created.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to create item");
      setError(message);
      showToast(message, "error");
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
      showToast("Item updated.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to update item");
      setError(message);
      showToast(message, "error");
    }
  };

  const deleteItem = async (id: number) => {
    setError(null);
    try {
      await api.delete(`/items/${id}`);
      await onChange();
      showToast("Item deleted.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to delete item");
      setError(message);
      showToast(message, "error");
    }
  };

  const toggleAvailability = async (item: Item) => {
    setError(null);
    try {
      await api.patch(`/items/${item.id}`, { isAvailable: !item.isAvailable });
      await onChange();
      showToast(`Item marked as ${item.isAvailable ? "unavailable" : "available"}.`, "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to update availability");
      setError(message);
      showToast(message, "error");
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Items</h3>
      </div>
      <form className="item-form" onSubmit={createItem}>
        <label>
          Category
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
        </label>
        <label>
          Item name
          <input
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. Jollof Rice + Chicken"
          />
        </label>
        <label>
          Description (optional)
          <input
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Short details"
          />
        </label>
        <label>
          Price (NGN)
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
            placeholder="0.00"
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.isAvailable}
            onChange={(event) => setForm((prev) => ({ ...prev, isAvailable: event.target.checked }))}
          />
          Available
        </label>
        <button type="submit" disabled={categories.length === 0}>
          Add Menu Item
        </button>
        {categories.length === 0 ? <p className="muted">Create at least one category before adding items.</p> : null}
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
        {visibleItems.length === 0 ? (
          <p className="empty-state">No items yet. Add your first menu item to start receiving orders.</p>
        ) : null}
        {visibleItems.map((item) => (
          <div key={item.id} className="list-row">
            {editingId === item.id ? (
              <div className="edit-grid">
                <label>
                  Category
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
                </label>
                <label>
                  Item name
                  <input
                    value={editingForm.name}
                    onChange={(event) => setEditingForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </label>
                <label>
                  Description
                  <input
                    value={editingForm.description}
                    onChange={(event) => setEditingForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </label>
                <label>
                  Price (NGN)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingForm.price}
                    onChange={(event) => setEditingForm((prev) => ({ ...prev, price: event.target.value }))}
                  />
                </label>
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
                  <button type="button" onClick={() => void saveEdit(item.id)}>
                    Save
                  </button>
                  <button type="button" className="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <strong>{item.name}</strong>
                  <p className="muted">
                    NGN {Number(item.price).toLocaleString()} | {item.isAvailable ? "Available" : "Unavailable"}
                  </p>
                </div>
                <div className="actions">
                  <button type="button" className="ghost" onClick={() => void toggleAvailability(item)}>
                    {item.isAvailable ? "Set Unavailable" : "Set Available"}
                  </button>
                  <button type="button" className="ghost" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => void deleteItem(item.id)}>
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
