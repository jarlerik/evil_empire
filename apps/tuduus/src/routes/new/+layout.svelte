<script lang="ts">
	import { LogOut, Plus } from 'lucide-svelte';
	import '../../styles/app.scss';

	let { children } = $props();
</script>

<div class="layout">
	<aside class="sidebar">
		<div class="sidebar-top">
			<button class="icon-button">
				<Plus size={24} />
			</button>
		</div>
		<div class="sidebar-bottom">
			<a href="/logout" class="icon-button">
				<LogOut size={24} />
			</a>
		</div>
	</aside>

	<main class="main-content">
		{@render children()}
	</main>
</div>

<style>
	.layout {
		display: flex;
		min-height: 100vh;
		background-color: #1a1a1a;
		color: #ffffff;
	}

	.sidebar {
		width: 64px;
		background-color: #242424;
		border-right: 1px solid #333333;
		display: flex;
		flex-direction: column;
		justify-content: space-evenly;
		padding: 1rem 0;
	}

	.sidebar-top,
	.sidebar-bottom {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.icon-button {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto;
		background: none;
		border: none;
		cursor: pointer;
		color: #ffffff;
		transition: all 0.2s;
	}

	.icon-button:hover {
		background-color: #333333;
		color: #ffffff;
	}

	.main-content {
		flex: 1;
		padding: 2rem;
	}
</style>
