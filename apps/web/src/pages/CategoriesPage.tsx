import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  type CategoryRef
} from '../api/client';

export function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLDivElement | null>(null);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    parentId: '',
    isActive: true
  });

  const [editForm, setEditForm] = useState({
    name: '',
    slug: '',
    description: '',
    parentId: '',
    isActive: true
  });

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCategories({ includeInactive: true });
      setCategories(response.data);
    } catch (err) {
      setError('Unable to load categories.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) {
      return categories;
    }
    const lowered = searchQuery.toLowerCase();
    return categories.filter((category) => category.name.toLowerCase().includes(lowered));
  }, [categories, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, CategoryRef[]>();
    categories.forEach((category) => {
      if (!category.parentId) {
        return;
      }
      const list = map.get(category.parentId) ?? [];
      list.push(category);
      map.set(category.parentId, list);
    });
    map.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [categories]);

  const roots = useMemo(() => {
    return categories
      .filter((category) => !category.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  useEffect(() => {
    if (roots.length === 0) {
      return;
    }
    setExpandedParents((prev) => {
      if (prev.size > 0) {
        return prev;
      }
      const next = new Set<string>();
      roots.forEach((root) => {
        if (childrenByParent.get(root.id)?.length) {
          next.add(root.id);
        }
      });
      return next;
    });
  }, [roots, childrenByParent]);

  async function handleCreate() {
    setError(null);
    setNotice(null);
    if (!form.name.trim()) {
      setError('Category name is required.');
      return;
    }
    try {
      const created = await createCategory({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || undefined,
        parentId: form.parentId || undefined,
        isActive: form.isActive
      });
      setCategories((prev) => [...prev, created]);
      setForm({ name: '', slug: '', description: '', parentId: '', isActive: true });
      setNotice('Category created.');
    } catch (err) {
      setError('Unable to create category.');
    }
  }

  function startEdit(category: CategoryRef) {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      slug: category.slug ?? '',
      description: category.description ?? '',
      parentId: category.parentId ?? '',
      isActive: category.isActive
    });
  }

  async function handleUpdate(categoryId: string) {
    setError(null);
    setNotice(null);
    try {
      const updated = await updateCategory(categoryId, {
        name: editForm.name.trim(),
        slug: editForm.slug.trim() || undefined,
        description: editForm.description.trim() || undefined,
        parentId: editForm.parentId || undefined,
        isActive: editForm.isActive
      });
      setCategories((prev) => prev.map((item) => (item.id === categoryId ? updated : item)));
      setEditingId(null);
      setNotice('Category updated.');
    } catch (err) {
      setError('Unable to update category.');
    }
  }

  async function handleDelete(categoryId: string) {
    setError(null);
    setNotice(null);
    const hasChildren = categories.some((item) => item.parentId === categoryId);
    if (hasChildren) {
      setError('Cannot delete a category that has subcategories.');
      return;
    }
    try {
      await deleteCategory(categoryId);
      setCategories((prev) => prev.filter((item) => item.id !== categoryId));
      setNotice('Category deleted.');
    } catch (err) {
      setError('Unable to delete category.');
    }
  }

  function handleAddSubcategory(parentId: string) {
    setForm((prev) => ({ ...prev, parentId }));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      <div className="glass-card p-6" ref={formRef}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Categories</h3>
            <p className="text-sm text-slate-500">Organize ticket categories and subcategories.</p>
          </div>
          <button
            type="button"
            onClick={loadCategories}
            className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.7fr_0.9fr_0.8fr_auto]">
          <input
            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
            placeholder="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
            placeholder="Slug (optional)"
            value={form.slug}
            onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
            placeholder="Description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <select
            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
            value={form.parentId}
            onChange={(event) => setForm((prev) => ({ ...prev, parentId: event.target.value }))}
          >
            <option value="">No parent</option>
            {roots.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            Add category
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
          <input
            className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs"
            placeholder="Search categories"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {error && <span className="text-red-600">{error}</span>}
          {notice && <span className="text-emerald-600">{notice}</span>}
        </div>
      </div>

      {loading && (
        <div className="glass-card p-6">
          <div className="h-4 w-40 rounded-full skeleton-shimmer" />
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="glass-card p-6">
          <p className="text-sm text-slate-500">No categories found.</p>
        </div>
      )}

      <div className="space-y-3">
        {(searchQuery.trim().length > 0 ? sorted : roots).map((category) => {
          const isEditing = editingId === category.id;
          const isRoot = !category.parentId;
          const childCount = childrenByParent.get(category.id)?.length ?? 0;
          const isExpanded = expandedParents.has(category.id);
          return (
            <div key={category.id} className="glass-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{category.name}</p>
                    {isRoot && (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
                        Parent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {category.slug} · {category.isActive ? 'Active' : 'Inactive'}
                  </p>
                  {category.parentId && (
                    <p className="text-xs text-slate-400">
                      Parent: {categories.find((item) => item.id === category.parentId)?.name ?? '—'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isRoot && childCount > 0 && !isEditing && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedParents((prev) => {
                          const next = new Set(prev);
                          if (next.has(category.id)) {
                            next.delete(category.id);
                          } else {
                            next.add(category.id);
                          }
                          return next;
                        })
                      }
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {isExpanded ? 'Collapse' : `Show ${childCount}`}
                    </button>
                  )}
                  {isRoot && !isEditing && (
                    <button
                      type="button"
                      onClick={() => handleAddSubcategory(category.id)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Add subcategory
                    </button>
                  )}
                  {!isEditing && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(category)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(category.id)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-600"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isRoot && childrenByParent.get(category.id) && isExpanded && searchQuery.trim().length === 0 && (
                <div className="mt-3 border-l border-slate-200 pl-4 space-y-2">
                  {childrenByParent.get(category.id)?.map((child) => (
                    <div
                      key={child.id}
                      className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{child.name}</p>
                          <p className="text-xs text-slate-500">{child.slug}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${
                              child.isActive
                                ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                                : 'border-slate-200 bg-slate-100 text-slate-600'
                            }`}
                          >
                            {child.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEdit(child)}
                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(child.id)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {editingId === child.id && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <input
                            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                            value={editForm.name}
                            onChange={(event) =>
                              setEditForm((prev) => ({ ...prev, name: event.target.value }))
                            }
                          />
                          <input
                            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                            value={editForm.slug}
                            onChange={(event) =>
                              setEditForm((prev) => ({ ...prev, slug: event.target.value }))
                            }
                          />
                          <input
                            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm sm:col-span-2"
                            value={editForm.description}
                            onChange={(event) =>
                              setEditForm((prev) => ({ ...prev, description: event.target.value }))
                            }
                          />
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editForm.isActive}
                                onChange={(event) =>
                                  setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))
                                }
                              />
                              Active
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdate(child.id)}
                              className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isEditing && (
                <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.7fr_0.9fr_0.8fr_auto]">
                  <input
                    className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                    value={editForm.name}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                  <input
                    className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                    value={editForm.slug}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, slug: event.target.value }))}
                  />
                  <input
                    className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                  <select
                    className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                    value={editForm.parentId}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, parentId: event.target.value }))
                    }
                  >
                    <option value="">No parent</option>
                    {roots
                      .filter((item) => item.id !== category.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-500 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))
                        }
                      />
                      Active
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate(category.id)}
                        className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
