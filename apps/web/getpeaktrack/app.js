/**
 * PeakTrack Landing Page Application
 * - Interactive parser demo
 * - Waitlist form with Supabase integration
 */

// Supabase configuration
// The anon key is safe to expose - security comes from RLS policies, not key secrecy
// Set these in a .env file: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ===== Waitlist Form =====

const waitlistForm = document.getElementById('waitlist-form');
const formMessage = document.getElementById('form-message');

if (waitlistForm) {
    waitlistForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('email');
        const trainingTypeSelect = document.getElementById('training-type');
        const submitButton = waitlistForm.querySelector('.form-button');
        const buttonText = submitButton.querySelector('.button-text');
        const buttonLoading = submitButton.querySelector('.button-loading');

        const email = emailInput.value.trim();
        const trainingType = trainingTypeSelect.value;

        if (!email) {
            showMessage('Please enter your email address.', 'error');
            return;
        }

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            showMessage('Waitlist temporarily unavailable. Email us at jarl-erik.malmstrom@vaikia.com', 'error');
            return;
        }

        // Get Turnstile token
        const turnstileToken = typeof turnstile !== 'undefined' ? turnstile.getResponse() : null;
        if (!turnstileToken) {
            showMessage('Please complete the verification check.', 'error');
            return;
        }

        // Show loading state
        submitButton.disabled = true;
        buttonText.style.display = 'none';
        buttonLoading.style.display = 'inline';

        try {
            // Submit via edge function (verifies Turnstile server-side)
            const response = await fetch(`${SUPABASE_URL}/functions/v1/join-waitlist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    email: email,
                    training_type: trainingType || null,
                    turnstile_token: turnstileToken,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(data.message || "You're on the list! We'll be in touch soon.", 'success');
                waitlistForm.reset();
                if (typeof turnstile !== 'undefined') turnstile.reset();
            } else if (response.status === 409) {
                showMessage(data.message || "You're already on the waitlist!", 'success');
                if (typeof turnstile !== 'undefined') turnstile.reset();
            } else {
                throw new Error(data.error || 'Failed to join waitlist');
            }
        } catch (error) {
            console.error('Waitlist submission error:', error);
            showMessage('Something went wrong. Please try again or email us directly.', 'error');
            if (typeof turnstile !== 'undefined') turnstile.reset();
        } finally {
            // Reset button state
            submitButton.disabled = false;
            buttonText.style.display = 'inline';
            buttonLoading.style.display = 'none';
        }
    });
}

function showMessage(text, type) {
    if (formMessage) {
        formMessage.textContent = text;
        formMessage.className = `form-message ${type}`;
    }
}

// ===== Smooth Scroll for Navigation =====

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

console.log('PeakTrack landing page loaded');
