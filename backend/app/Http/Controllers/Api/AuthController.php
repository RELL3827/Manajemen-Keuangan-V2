<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Category;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Register a new user.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'currency' => 'IDR',
            'timezone' => 'Asia/Jakarta',
            'language' => 'id',
        ]);

        // Seed default categories for this new user
        $defaultCategories = [
            ['name' => 'Makanan & Minuman', 'type' => 'expense', 'icon' => '🍔', 'color' => '#EF4444'],
            ['name' => 'Transportasi', 'type' => 'expense', 'icon' => '🚗', 'color' => '#F97316'],
            ['name' => 'Belanja', 'type' => 'expense', 'icon' => '🛍️', 'color' => '#EC4899'],
            ['name' => 'Rumah & Tempat Tinggal', 'type' => 'expense', 'icon' => '🏠', 'color' => '#8B5CF6'],
            ['name' => 'Tagihan & Utilitas', 'type' => 'expense', 'icon' => '💡', 'color' => '#06B6D4'],
            ['name' => 'Pendidikan', 'type' => 'expense', 'icon' => '🎓', 'color' => '#3B82F6'],
            ['name' => 'Kesehatan', 'type' => 'expense', 'icon' => '💊', 'color' => '#10B981'],
            ['name' => 'Hiburan', 'type' => 'expense', 'icon' => '🎮', 'color' => '#F59E0B'],
            ['name' => 'Gaji Pokok', 'type' => 'income', 'icon' => '💰', 'color' => '#22C55E'],
            ['name' => 'Freelance', 'type' => 'income', 'icon' => '💼', 'color' => '#14B8A6'],
            ['name' => 'Investasi & Dividen', 'type' => 'both', 'icon' => '📈', 'color' => '#6366F1'],
            ['name' => 'Tabungan', 'type' => 'both', 'icon' => '🏦', 'color' => '#0EA5E9'],
            ['name' => 'Bisnis & Penjualan', 'type' => 'income', 'icon' => '📦', 'color' => '#84CC16'],
            ['name' => 'Paket Data & Internet', 'type' => 'expense', 'icon' => '📱', 'color' => '#A855F7'],
            ['name' => 'Token & Listrik PLN', 'type' => 'expense', 'icon' => '⚡', 'color' => '#EAB308'],
            ['name' => 'Lainnya', 'type' => 'both', 'icon' => '✨', 'color' => '#64748B'],
        ];

        foreach ($defaultCategories as $cat) {
            Category::create([
                'user_id' => $user->id,
                'name' => $cat['name'],
                'type' => $cat['type'],
                'icon' => $cat['icon'],
                'color' => $cat['color'],
                'is_default' => true,
            ]);
        }

        // Default cash account
        Account::create([
            'user_id' => $user->id,
            'name' => 'Dompet Tunai',
            'type' => 'cash',
            'initial_balance' => 0,
            'current_balance' => 0,
            'color' => '#10B981',
            'icon' => 'Banknote',
            'is_active' => true,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Registrasi berhasil.',
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    /**
     * Login user.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Email atau password yang Anda masukkan salah.'],
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login berhasil.',
            'user' => $user,
            'token' => $token,
        ]);
    }

    /**
     * Logout user.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logout berhasil.',
        ]);
    }

    /**
     * Get current authenticated user profile.
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user()->load(['settings']);

        return response()->json([
            'user' => $user,
        ]);
    }

    /**
     * Update user profile.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email,'.$user->id,
            'currency' => 'nullable|string|max:10',
            'timezone' => 'nullable|string|max:50',
            'language' => 'nullable|string|max:10',
            'avatar' => 'nullable|string',
        ]);

        $user->update($validated);

        return response()->json([
            'message' => 'Profil berhasil diperbarui.',
            'user' => $user,
        ]);
    }

    /**
     * Update user password.
     */
    public function updatePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if (! Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Password saat ini tidak sesuai.'],
            ]);
        }

        $user->update([
            'password' => Hash::make($request->password),
        ]);

        return response()->json([
            'message' => 'Password berhasil diubah.',
        ]);
    }

    /**
     * Forgot password simulation.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();
        if (! $user) {
            return response()->json([
                'message' => 'Jika email terdaftar, instruksi reset password telah dikirim.',
            ]);
        }

        return response()->json([
            'message' => 'Tautan pemulihan password berhasil dikirim ke email Anda.',
            'demo_token' => 'reset-demo-token-123',
        ]);
    }

    /**
     * Reset password simulation.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::where('email', $request->email)->first();
        if ($user) {
            $user->update(['password' => Hash::make($request->password)]);
        }

        return response()->json([
            'message' => 'Password berhasil direset. Silakan login kembali.',
        ]);
    }
}
