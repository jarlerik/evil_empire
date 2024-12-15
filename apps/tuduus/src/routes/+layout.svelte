<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
</script>

<div class="layout">
    <nav>
        <div class="nav-content">
            <div class="logo">
                <a href="/">Tuduus</a>
            </div>
            
            <div class="nav-links">
                <a href="/logout" class="logout-link">Logout</a>
            </div>
        </div>
    </nav>

    <main>
        <slot />
    </main>
</div>

<style>
    .layout {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
    }

    nav {
        background-color: #ffffff;
        border-bottom: 1px solid #e5e7eb;
        padding: 1rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .nav-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .logo a {
        font-size: 1.5rem;
        font-weight: bold;
        color: #4f46e5;
        text-decoration: none;
    }

    .nav-links {
        display: flex;
        gap: 2rem;
        align-items: center;
    }

    .nav-links a {
        color: #4b5563;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s;
    }

    .nav-links a:hover {
        color: #4f46e5;
    }

    .nav-links a.active {
        color: #4f46e5;
    }

    .logout-link {
        color: #ef4444 !important;
        font-weight: 500;
        transition: color 0.2s;
    }

    .logout-link:hover {
        color: #dc2626 !important;
    }

    main {
        flex: 1;
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
    }
</style>
