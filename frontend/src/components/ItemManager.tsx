import { FormEvent, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../lib/errors";
import { Category, Item } from "../types";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { InputField } from "./ui/InputField";
import { SelectField } from "./ui/SelectField";

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
    <Card title="Items" subtitle="Add, edit, and manage menu item availability.">
      <form className="grid gap-3" onSubmit={createItem}>
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            required
            label="Category"
            value={form.categoryId}
            onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
          <InputField
            required
            label="Item name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. Jollof Rice + Chicken"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
          <InputField
            label="Description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Short details"
          />
          <InputField
            required
            label="Price (NGN)"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
            placeholder="0.00"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
            checked={form.isAvailable}
            onChange={(event) => setForm((prev) => ({ ...prev, isAvailable: event.target.checked }))}
          />
          Available
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={categories.length === 0}>
            Add Menu Item
          </Button>
          {categories.length === 0 ? <p className="text-sm text-slate-500">Create a category before adding items.</p> : null}
        </div>
      </form>

      <div className="mt-5">
        <SelectField label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">All</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-danger-700">{error}</p> : null}

      <div className="mt-4 space-y-2">
        {visibleItems.length === 0 ? (
          <EmptyState title="No items yet" description="Add your first menu item to start receiving orders." />
        ) : null}
        {visibleItems.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            {editingId === item.id ? (
              <div className="grid gap-2 md:grid-cols-2">
                <SelectField
                  label="Category"
                  value={editingForm.categoryId}
                  onChange={(event) => setEditingForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </SelectField>
                <InputField
                  label="Item name"
                  value={editingForm.name}
                  onChange={(event) => setEditingForm((prev) => ({ ...prev, name: event.target.value }))}
                />
                <InputField
                  label="Description"
                  value={editingForm.description}
                  onChange={(event) => setEditingForm((prev) => ({ ...prev, description: event.target.value }))}
                />
                <InputField
                  type="number"
                  label="Price (NGN)"
                  step="0.01"
                  min="0"
                  value={editingForm.price}
                  onChange={(event) => setEditingForm((prev) => ({ ...prev, price: event.target.value }))}
                />
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
                    checked={editingForm.isAvailable}
                    onChange={(event) => setEditingForm((prev) => ({ ...prev, isAvailable: event.target.checked }))}
                  />
                  Available
                </label>
                <div className="flex gap-2 md:col-span-2">
                  <Button type="button" size="sm" onClick={() => void saveEdit(item.id)}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-sm text-slate-500">
                    NGN {Number(item.price).toLocaleString()} | {item.isAvailable ? "Available" : "Unavailable"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => void toggleAvailability(item)}>
                    {item.isAvailable ? "Set Unavailable" : "Set Available"}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(item)}>
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="danger" onClick={() => void deleteItem(item.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
