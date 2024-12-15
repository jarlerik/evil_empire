<script lang="ts">
    import type { ActionData } from './$types';
    export let form: ActionData;
</script>

<div class="register-container">
    <h1>Register</h1>

    <form method="POST" action="?/register" class="register-form">
        {#if form?.error}
            <div class="error">{form.error}</div>
        {/if}
        {#if form?.success}
            <div class="success">{form.success}</div>
        {/if}

        <div class="form-group">
            <label for="name">Name</label>
            <input
                type="text"
                id="name"
                name="name"
                placeholder="Enter your name"
                required
            />
        </div>

        <div class="form-group">
            <label for="email">Email</label>
            <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter your email"
                required
            />
        </div>

        <div class="form-group">
            <label for="password">Password</label>
            <input
                type="password"
                id="password"
                name="password"
                placeholder="Enter your password"
                required
            />
        </div>

        <div class="form-group">
            <label for="confirm-password">Confirm Password</label>
            <input
                type="password"
                id="confirm-password"
                name="confirmPassword"
                placeholder="Confirm your password"
                required
            />
        </div>

        <button type="submit">Register</button>
    </form>
</div>

<style>
    .register-container {
        max-width: 400px;
        margin: 0 auto;
        padding: 20px;
    }

    .register-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    label {
        font-weight: bold;
    }

    input {
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 1rem;
    }

    button {
        padding: 10px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
    }

    button:hover {
        background-color: #45a049;
    }

    .error {
        color: red;
        padding: 10px;
        background-color: #ffebee;
        border-radius: 4px;
    }

    .success {
        color: green;
        padding: 10px;
        background-color: #e8f5e9;
        border-radius: 4px;
    }
</style>
