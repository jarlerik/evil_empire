<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	export let form: ActionData;
</script>

<div class="login-container">
	<div class="login-box">
		<div>
			<h2>Sign in to your account</h2>
		</div>
		<form method="POST" use:enhance>
			<div class="form-group">
				<div>
					<label for="email">Email address</label>
					<input id="email" name="email" type="email" required placeholder="Email address" />
				</div>
				<div>
					<label for="password">Password</label>
					<input id="password" name="password" type="password" required placeholder="Password" />
				</div>
			</div>

			{#if form?.error}
				<div class="error-message">{form.error}</div>
			{/if}

			<div>
				<button type="submit"> Sign in </button>
			</div>
		</form>
	</div>
</div>

<style>
	.login-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #f5f5f5;
	}

	.login-box {
		width: 100%;
		max-width: 400px;
		padding: 2rem;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	h2 {
		text-align: center;
		font-size: 1.5rem;
		font-weight: bold;
		margin-bottom: 2rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group > div {
		margin-bottom: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
	}

	input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
	}

	input:focus {
		outline: none;
		border-color: #4f46e5;
		box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
	}

	button {
		width: 100%;
		padding: 0.75rem;
		background-color: #4f46e5;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	button:hover {
		background-color: #4338ca;
	}

	.error-message {
		color: #dc2626;
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}
</style>
