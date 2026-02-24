import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AxiosProgressEvent } from "axios";
import { ImagePlus, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../lib/errors";
import { Category, Item } from "../types";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "./ui/DropdownMenu";
import { EmptyState } from "./ui/EmptyState";
import { InputField } from "./ui/InputField";
import { SelectField } from "./ui/SelectField";
import { Switch } from "./ui/Switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/Table";

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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(null);
  const [createUploadProgress, setCreateUploadProgress] = useState<number | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<ItemFormState>(emptyItemForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingImageFile, setEditingImageFile] = useState<File | null>(null);
  const [editingImagePreview, setEditingImagePreview] = useState<string | null>(null);
  const [editUploadProgress, setEditUploadProgress] = useState<number | null>(null);

  const [removingImageIds, setRemovingImageIds] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

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

  const setEditImageFromFile = (file: File | null) => {
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
    setEditingImageFile(file);
    if (editingImagePreview) {
      URL.revokeObjectURL(editingImagePreview);
    }
    setEditingImagePreview(URL.createObjectURL(file));
  };

  const resetCreateState = () => {
    setForm(emptyItemForm);
    setCreateImageFile(null);
    setCreateUploadProgress(null);
    if (createImagePreview) {
      URL.revokeObjectURL(createImagePreview);
      setCreateImagePreview(null);
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
    setEditUploadProgress(null);
    if (editingImagePreview) {
      URL.revokeObjectURL(editingImagePreview);
      setEditingImagePreview(null);
    }
    setEditDialogOpen(true);
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
        await uploadItemImage(createdItem.id, createImageFile, (progress) => setCreateUploadProgress(progress));
      }

      await onChange();
      resetCreateState();
      setCreateDialogOpen(false);
      showToast("Item created successfully.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to create item");
      setError(message);
      showToast(message, "error");
    } finally {
      setCreatingItem(false);
    }
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId) {
      return;
    }

    setError(null);
    setSavingEdit(true);
    try {
      await api.patch(`/items/${editingId}`, {
        categoryId: Number(editingForm.categoryId),
        name: editingForm.name,
        description: editingForm.description || null,
        price: Number(editingForm.price),
        isAvailable: editingForm.isAvailable
      });

      if (editingImageFile) {
        await uploadItemImage(editingId, editingImageFile, (progress) => setEditUploadProgress(progress));
      }

      await onChange();
      setEditDialogOpen(false);
      showToast("Item updated.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to update item");
      setError(message);
      showToast(message, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteItem = async (id: number) => {
    setError(null);
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await api.delete(`/items/${id}`);
      await onChange();
      showToast("Item deleted.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to delete item");
      setError(message);
      showToast(message, "error");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const removeImage = async (itemId: number) => {
    setError(null);
    setRemovingImageIds((prev) => new Set(prev).add(itemId));
    try {
      await api.delete(`/items/${itemId}/image`);
      await onChange();
      showToast("Item image removed.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to remove item image");
      setError(message);
      showToast(message, "error");
    } finally {
      setRemovingImageIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const toggleAvailability = async (item: Item) => {
    setError(null);
    setTogglingIds((prev) => new Set(prev).add(item.id));
    try {
      await api.patch(`/items/${item.id}`, { isAvailable: !item.isAvailable });
      await onChange();
      showToast(`Item marked as ${item.isAvailable ? "unavailable" : "available"}.`, "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to update availability");
      setError(message);
      showToast(message, "error");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const activeEditingItem = editingId ? items.find((item) => item.id === editingId) ?? null : null;

  return (
    <Card
      title="Items"
      subtitle="Add, edit, and manage menu item availability."
      action={
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={categories.length === 0}>
              <Plus className="mr-1 h-4 w-4" />
              New Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Menu Item</DialogTitle>
              <DialogDescription>Add item details and optional image.</DialogDescription>
            </DialogHeader>
            <form onSubmit={createItem} className="space-y-4">
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
              />
              <InputField
                label="Description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <InputField
                required
                label="Price (NGN)"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
              />
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm font-medium">Available</span>
                <Switch
                  checked={form.isAvailable}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isAvailable: Boolean(checked) }))}
                />
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">Item image (optional)</p>
                <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG or WEBP up to 2MB.</p>
                <div className="mt-3 flex items-center gap-3">
                  <Button type="button" variant="secondary" size="sm" onClick={() => uploadInputRef.current?.click()}>
                    <ImagePlus className="mr-1 h-4 w-4" />
                    Choose image
                  </Button>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => setCreateImageFromFile(event.target.files?.[0] ?? null)}
                  />
                  {createImagePreview ? (
                    <img src={createImagePreview} alt="Item preview" className="h-14 w-14 rounded-lg border object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                {createUploadProgress !== null ? (
                  <p className="mt-2 text-xs font-medium text-primary">Uploading image... {createUploadProgress}%</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={creatingItem}>
                  {creatingItem ? "Creating..." : "Create Item"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <SelectField label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <div className="hidden sm:block" />
      </div>

      {error ? <p className="mb-3 text-sm font-medium text-destructive">{error}</p> : null}

      {visibleItems.length === 0 ? (
        <EmptyState title="No items yet" description="Create your first menu item to start receiving orders." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[68px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-12 w-12 rounded-lg border object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed text-[10px] text-muted-foreground">
                        No image
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.description || "No description"}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>NGN {Number(item.price).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.isAvailable}
                      disabled={togglingIds.has(item.id)}
                      onCheckedChange={() => void toggleAvailability(item)}
                    />
                    <Badge variant={item.isAvailable ? "success" : "warning"}>{item.isAvailable ? "Available" : "Unavailable"}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEdit(item)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void removeImage(item.id)}
                        disabled={!item.imageUrl || removingImageIds.has(item.id)}
                      >
                        Remove image
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={deletingIds.has(item.id)}
                        onClick={() => void deleteItem(item.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>Update item details, availability and image.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <SelectField
              required
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
              required
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
              required
              label="Price (NGN)"
              type="number"
              step="0.01"
              min="0"
              value={editingForm.price}
              onChange={(event) => setEditingForm((prev) => ({ ...prev, price: event.target.value }))}
            />
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm font-medium">Available</span>
              <Switch
                checked={editingForm.isAvailable}
                onCheckedChange={(checked) => setEditingForm((prev) => ({ ...prev, isAvailable: Boolean(checked) }))}
              />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">Replace image (optional)</p>
              <div className="mt-3 flex items-center gap-3">
                <label className="cursor-pointer">
                  <Button type="button" variant="secondary" size="sm" asChild>
                    <span>
                      <ImagePlus className="mr-1 h-4 w-4" />
                      Choose image
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => setEditImageFromFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                {editingImagePreview ? (
                  <img src={editingImagePreview} alt="Editing preview" className="h-14 w-14 rounded-lg border object-cover" />
                ) : activeEditingItem?.imageUrl ? (
                  <img src={activeEditingItem.imageUrl} alt={activeEditingItem.name} className="h-14 w-14 rounded-lg border object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              {editUploadProgress !== null ? <p className="mt-2 text-xs text-primary">Uploading image... {editUploadProgress}%</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={savingEdit}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

