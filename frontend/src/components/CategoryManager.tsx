import { FormEvent, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../lib/errors";
import { Category } from "../types";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { InputField } from "./ui/InputField";

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
    <Card title="Categories" subtitle="Organize your menu with clear category groups.">
      <form className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]" onSubmit={createCategory}>
        <InputField
          required
          label="Category name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Rice & Sides"
        />
        <InputField
          label="Sort order"
          type="number"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          placeholder="0"
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Add Category
          </Button>
        </div>
      </form>
      {error ? <p className="mb-3 text-sm font-medium text-danger-700">{error}</p> : null}
      <div className="space-y-2">
        {categories.length === 0 ? (
          <EmptyState title="No categories yet" description="Add your first category to organize menu items." />
        ) : null}
        {categories.map((category) => (
          <div key={category.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            {editingId === category.id ? (
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_130px_auto]">
                <InputField value={editName} onChange={(event) => setEditName(event.target.value)} />
                <InputField
                  type="number"
                  value={editSortOrder}
                  onChange={(event) => setEditSortOrder(event.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" onClick={() => void saveEdit(category.id)}>
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
                  <p className="font-semibold text-slate-900">{category.name}</p>
                  <p className="text-sm text-slate-500">Sort order: {category.sortOrder}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(category)}>
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="danger" onClick={() => void deleteCategory(category.id)}>
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
