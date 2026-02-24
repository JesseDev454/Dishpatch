import { FormEvent, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../lib/errors";
import { Category } from "../types";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { InputField } from "./ui/InputField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "./ui/DropdownMenu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/Table";

type CategoryManagerProps = {
  categories: Category[];
  onChange: () => Promise<void>;
};

type CategoryFormState = {
  name: string;
  sortOrder: string;
};

const initialForm: CategoryFormState = {
  name: "",
  sortOrder: "0"
};

export const CategoryManager = ({ categories, onChange }: CategoryManagerProps) => {
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CategoryFormState>(initialForm);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CategoryFormState>(initialForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  const openEditDialog = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditForm({
      name: category.name,
      sortOrder: String(category.sortOrder)
    });
    setEditDialogOpen(true);
  };

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.post("/categories", { name: createForm.name, sortOrder: Number(createForm.sortOrder) });
      setCreateForm(initialForm);
      setCreateDialogOpen(false);
      await onChange();
      showToast("Category created.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to create category");
      setError(message);
      showToast(message, "error");
    } finally {
      setCreating(false);
    }
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingCategoryId) {
      return;
    }

    setError(null);
    setSavingEdit(true);
    try {
      await api.patch(`/categories/${editingCategoryId}`, {
        name: editForm.name,
        sortOrder: Number(editForm.sortOrder)
      });
      setEditDialogOpen(false);
      setEditingCategoryId(null);
      await onChange();
      showToast("Category updated.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to update category");
      setError(message);
      showToast(message, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteCategory = async (id: number) => {
    setError(null);
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await api.delete(`/categories/${id}`);
      await onChange();
      showToast("Category deleted.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to delete category");
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

  return (
    <Card
      title="Categories"
      subtitle="Organize your menu with clear category groups."
      action={
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Category</DialogTitle>
              <DialogDescription>Add a new grouping for menu items.</DialogDescription>
            </DialogHeader>
            <form onSubmit={createCategory} className="space-y-4">
              <InputField
                required
                label="Category name"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Rice & Sides"
              />
              <InputField
                label="Sort order"
                type="number"
                value={createForm.sortOrder}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
              />
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={creating}>
                  {creating ? "Creating..." : "Create Category"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {error ? <p className="mb-3 text-sm font-medium text-destructive">{error}</p> : null}

      {categories.length === 0 ? (
        <EmptyState title="No categories yet" description="Create your first category to organize menu items." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead className="w-[68px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>{category.sortOrder}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(category)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void deleteCategory(category.id)}
                        disabled={deletingIds.has(category.id)}
                        className="text-destructive focus:text-destructive"
                      >
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
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update category details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <InputField
              required
              label="Category name"
              value={editForm.name}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <InputField
              type="number"
              label="Sort order"
              value={editForm.sortOrder}
              onChange={(event) => setEditForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={savingEdit}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

