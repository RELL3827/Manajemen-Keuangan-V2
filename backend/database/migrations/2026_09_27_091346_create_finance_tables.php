<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add profile fields to users table
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar')->nullable()->after('email');
            $table->string('currency', 10)->default('IDR')->after('avatar');
            $table->string('timezone', 50)->default('Asia/Jakarta')->after('currency');
            $table->string('language', 10)->default('id')->after('timezone');
        });

        // Accounts / Dompet
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('type', 30)->default('cash'); // cash, bank, ewallet, savings, investment, other
            $table->decimal('initial_balance', 15, 2)->default(0);
            $table->decimal('current_balance', 15, 2)->default(0);
            $table->string('account_number')->nullable();
            $table->string('color', 20)->default('#2563EB');
            $table->string('icon', 50)->default('Wallet');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Categories
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('type', 20)->default('expense'); // income, expense, both
            $table->string('icon', 50)->default('Tag');
            $table->string('color', 20)->default('#64748B');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        // Transactions
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('to_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 20); // income, expense, transfer
            $table->decimal('amount', 15, 2);
            $table->text('description')->nullable();
            $table->date('transaction_date');
            $table->string('input_method', 20)->default('manual'); // manual, voice
            $table->text('voice_text')->nullable();
            $table->longText('attachment')->nullable(); // base64 or storage url
            $table->timestamps();

            $table->index(['user_id', 'transaction_date']);
            $table->index(['user_id', 'type']);
        });

        // Budgets
        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->string('month', 7); // YYYY-MM
            $table->integer('alert_threshold')->default(80); // percentage
            $table->timestamps();

            $table->unique(['user_id', 'category_id', 'month']);
        });

        // Savings Goals
        Schema::create('savings_goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->decimal('target_amount', 15, 2);
            $table->decimal('current_amount', 15, 2)->default(0);
            $table->date('target_date')->nullable();
            $table->string('icon', 50)->default('Target');
            $table->string('color', 20)->default('#2563EB');
            $table->text('notes')->nullable();
            $table->boolean('is_completed')->default(false);
            $table->timestamps();
        });

        // Notifications
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 50); // budget_warning, budget_exceeded, savings_reached, reminder, system
            $table->string('title');
            $table->text('message');
            $table->boolean('is_read')->default(false);
            $table->json('data')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_read']);
        });

        // Settings
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->text('value')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('savings_goals');
        Schema::dropIfExists('budgets');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('accounts');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['avatar', 'currency', 'timezone', 'language']);
        });
    }
};
