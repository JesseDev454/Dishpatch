import { FormEvent, useEffect, useMemo, useState } from "react";
import { AxiosProgressEvent } from "axios";
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

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const emptyItemForm: ItemFormState = {
  categoryId: "",
  name: "",
  description: "",
  price: "0",
  isAvailable: true
};

const validateImageFile = (file: File): string | null => {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Only JPEG, PNG, and WEBP images are allowed.";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "Image size must be 2MB or less.";
  }

  return null;
};

export const ItemManager = ({ items, categories, onChange }: ItemManagerProps) => {
  const { showToast } = useToast();
  const [form, setForm] = useState<ItemFormState>(emptyItemForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<ItemFormState>(emptyItemForm);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [createUploadProgress, setCreateUploadProgress] = useState<number | null>(null);
  const [uploadingItemIds, setUploadingItemIds] = useState<Set<number>>(new Set());
  const [uploadProgressByItem, setUploadProgressByItem] = useState<Record<number, number>>({});
  const [editingImageFile, setEditingImageFile] = useState<File | null>(null);
  const [editingImagePreview, setEditingImagePreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (createImagePreview) {
        URL.revokeObjectURL(createImagePreview);
      }
      if (editingImagePreview) {
        URL.revokeObjectURL(editingImagePreview);
      }
    };
  }, [createImagePreview, editingImagePreview]);

  const visibleItems = useMemo(() => {
    if (categoryFilter === "all") {
      return items;
    }
    return items.filter((item) => item.categoryId === Number(categoryFilter));
  }, [items, categoryFilter]);

  const setItemUploading = (itemId: number, uploading: boolean) => {
    setUploadingItemIds((prev) => {
      const next = new Set(prev);
      if (uploading) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  const uploadItemImage = async (
    itemId: number,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    const validationError = validateImageFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    const formData = new FormData();
    formData.append("image", file);

    await api.post(`/items/${itemId}/image`, formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      },
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (!event.total || !onProgress) {
          return;
        }

        const value = Math.round((event.loaded * 100) / event.total);
        onProgress(value);
      }
    });
  };

  const createItem = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setCreatingItem(true);

    try {
      const createResponse = await api.post<{ item: Item }>("/items", {
        categoryId: Number(form.categoryId),
        name: form.name,
        description: form.description || null,
        price: Number(form.price),
        isAvailable: form.isAvailable
      });

      const createdItem = createResponse.data.item;

      if (createImageFile) {
        try {
          await uploadItemImage(createdItem.id, createImageFile, (progress) => setCreateUploadProgress(progress));
        } catch (imageError: unknown) {
          showToast(
            getApiErrorMessage(imageError, "Item created but image upload failed"),
            "error"
          );
        }
      }

      setForm(emptyItemForm);
      setCreateImageFile(null);
      if (createImagePreview) {
        URL.revokeObjectURL(createImagePreview);
      }
      setCreateImagePreview(null);
      setCreateUploadProgress(null);

      await onChange();
      showToast("Item created successfully.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to create item");
      setError(message);
      showToast(message, "error");
    } finally {
      setCreatingItem(false);
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
    setEditingImageFile(null);
    if (editingImagePreview) {
      URL.revokeObjectURL(editingImagePreview);
      setEditingImagePreview(null);
    }
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

      if (editingImageFile) {
        setItemUploading(id, true);
        try {
          await uploadItemImage(id, editingImageFile, (progress) =>
            setUploadProgressByItem((prev) => ({ ...prev, [id]: progress }))
          );
        } finally {
          setItemUploading(id, false);
          setUploadProgressByItem((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      }

      setEditingId(null);
      setEditingImageFile(null);
      if (editingImagePreview) {
        URL.revokeObjectURL(editingImagePreview);
        setEditingImagePreview(null);
      }
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

  const removeImage = async (itemId: number) => {
    setError(null);
    setItemUploading(itemId, true);
    try {
      await api.delete(`/items/${itemId}/image`);
      await onChange();
      showToast("Item image removed.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to remove item image");
      setError(message);
      showToast(message, "error");
    } finally {
      setItemUploading(itemId, false);
      setUploadProgressByItem((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  };

  const handleItemImageSelection = async (itemId: number, file: File | null) => {
    if (!file) {
      return;
    }

    setItemUploading(itemId, true);
    setError(null);
    try {
      await uploadItemImage(itemId, file, (progress) =>
        setUploadProgressByItem((prev) => ({ ...prev, [itemId]: progress }))
      );
      await onChange();
      showToast("Item image uploaded.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to upload item image");
      setError(message);
      showToast(message, "error");
    } finally {
      setItemUploading(itemId, false);
      setUploadProgressByItem((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  };

  const setCreateImageFromFile = (file: File | null) => {
    if (!file) {
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      showToast(validationError, "error");
      return;
    }

    setError(null);
    setCreateImageFile(file);
    if (createImagePreview) {
      URL.revokeObjectURL(createImagePreview);
    }
    setCreateImagePreview(URL.createObjectURL(file));
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

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">Item image (optional)</p>
          <p className="mt-1 text-xs text-slate-500">JPEG, PNG or WEBP up to 2MB.</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Choose image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => setCreateImageFromFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {createImagePreview ? (
              <img src={createImagePreview} alt="Item preview" className="h-14 w-14 rounded-lg object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
                No image
              </div>
            )}
            {createImageFile ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreateImageFile(null);
                  if (createImagePreview) {
                    URL.revokeObjectURL(createImagePreview);
                    setCreateImagePreview(null);
                  }
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
          {createUploadProgress !== null ? (
            <p className="mt-2 text-xs font-medium text-brand-700">Uploading image... {createUploadProgress}%</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={categories.length === 0} loading={creatingItem}>
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
        {visibleItems.map((item) => {
          const isUploading = uploadingItemIds.has(item.id);
          const progress = uploadProgressByItem[item.id];
          return (
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

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                    <p className="text-sm font-medium text-slate-700">Update image (optional)</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                        Choose image
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            if (!file) {
                              return;
                            }
                            const validationError = validateImageFile(file);
                            if (validationError) {
                              setError(validationError);
                              showToast(validationError, "error");
                              return;
                            }

                            setEditingImageFile(file);
                            if (editingImagePreview) {
                              URL.revokeObjectURL(editingImagePreview);
                            }
                            setEditingImagePreview(URL.createObjectURL(file));
                          }}
                        />
                      </label>
                      {editingImagePreview ? (
                        <img src={editingImagePreview} alt="Editing preview" className="h-14 w-14 rounded-lg object-cover" />
                      ) : item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="h-14 w-14 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
                          No image
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 md:col-span-2">
                    <Button type="button" size="sm" onClick={() => void saveEdit(item.id)}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingId(null);
                        setEditingImageFile(null);
                        if (editingImagePreview) {
                          URL.revokeObjectURL(editingImagePreview);
                          setEditingImagePreview(null);
                        }
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
                        No image
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-500">
                        NGN {Number(item.price).toLocaleString()} | {item.isAvailable ? "Available" : "Unavailable"}
                      </p>
                      {progress !== undefined ? (
                        <p className="text-xs font-medium text-brand-700">Uploading image... {progress}%</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Upload image
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          void handleItemImageSelection(item.id, file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void removeImage(item.id)}
                      disabled={!item.imageUrl || isUploading}
                    >
                      Remove image
                    </Button>
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
          );
        })}
      </div>
    </Card>
  );
};
