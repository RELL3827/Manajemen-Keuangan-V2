<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    /**
     * Get all categories for current user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $categories = Category::where('user_id', $user->id)
            ->orWhereNull('user_id')
            ->orderBy('id', 'asc')
            ->get();

        return response()->json($categories);
    }

    /**
     * Store new category.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'required|in:income,expense,both',
            'icon' => 'required|string|max:50',
            'color' => 'required|string|max:20',
        ]);

        $validated['user_id'] = $request->user()->id;
        $validated['is_default'] = false;

        $category = Category::create($validated);

        return response()->json([
            'message' => 'Kategori berhasil ditambahkan.',
            'category' => $category,
        ], 201);
    }

    /**
     * Update category.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $category = Category::where('user_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'required|in:income,expense,both',
            'icon' => 'required|string|max:50',
            'color' => 'required|string|max:20',
        ]);

        $category->update($validated);

        return response()->json([
            'message' => 'Kategori berhasil diperbarui.',
            'category' => $category,
        ]);
    }

    /**
     * Delete category.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $category = Category::where('user_id', $request->user()->id)->findOrFail($id);

        // Nullify foreign key on transactions
        Transaction::where('category_id', $id)->update(['category_id' => null]);

        $category->delete();

        return response()->json([
            'message' => 'Kategori berhasil dihapus.',
        ]);
    }
}
