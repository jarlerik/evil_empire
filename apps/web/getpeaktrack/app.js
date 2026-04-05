/**
 * PeakTrack Landing Page Application
 * - Interactive parser demo
 * - Waitlist form with Supabase integration
 */

import { parseSetInput } from '@evil-empire/parsers';

// Supabase configuration
// The anon key is safe to expose - security comes from RLS policies, not key secrecy
// Set these in a .env file: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ===== Interactive Parser Demo =====

const demoInput = document.getElementById('demo-input');
const demoOutput = document.getElementById('demo-output');

if (demoInput && demoOutput) {
    demoInput.addEventListener('input', (e) => {
        const input = e.target.value.trim();

        if (!input) {
            demoOutput.innerHTML = '<p class="demo-placeholder">Start typing to see how PeakTrack parses your input</p>';
            return;
        }

        const result = parseSetInput(input);

        if (!result.isValid) {
            demoOutput.innerHTML = `<p class="demo-error">${result.errorMessage || 'Could not parse input'}</p>`;
            return;
        }

        // Build the result display based on what was parsed
        let resultHtml = '<div class="demo-result">';

        // Handle different exercise types
        if (result.exerciseType === 'rm_build' && result.targetRm) {
            resultHtml += createResultItem('Type', 'RM Build');
            resultHtml += createResultItem('Target', `${result.targetRm}RM`);
        } else if (result.exerciseType === 'circuit' && result.circuitExercises) {
            resultHtml += createResultItem('Type', 'Circuit');
            resultHtml += createResultItem('Rounds', result.sets.toString());
            resultHtml += createResultItem('Exercises', result.circuitExercises.length.toString());
        } else if (result.exerciseType === 'wave' && result.compoundReps) {
            // Wave exercise
            resultHtml += createResultItem('Type', 'Wave');
            resultHtml += createResultItem('Reps Pattern', result.compoundReps.join('-'));
            resultHtml += createResultItem('Total Sets', result.sets.toString());
            if (result.weights && result.weights.length > 1) {
                resultHtml += createResultItem('Weights', result.weights.join(', ') + 'kg');
            } else if (result.weight > 0) {
                resultHtml += createResultItem('Weight', result.weight + 'kg');
            }
        } else {
            // Standard, compound, percentage, etc.
            resultHtml += createResultItem('Sets', result.sets.toString());

            // Handle compound reps
            if (result.compoundReps && result.compoundReps.length > 0) {
                resultHtml += createResultItem('Reps', result.compoundReps.join(' + '));
            } else {
                resultHtml += createResultItem('Reps', result.reps.toString());
            }

            // Handle weight display
            if (result.needsRmLookup && result.weightPercentage) {
                resultHtml += createResultItem('Weight', `${result.weightPercentage}% of 1RM`);
            } else if (result.weightMinPercentage && result.weightMaxPercentage) {
                resultHtml += createResultItem('Weight', `${result.weightMinPercentage}-${result.weightMaxPercentage}%`);
            } else if (result.weightMin && result.weightMax) {
                resultHtml += createResultItem('Weight', `${result.weightMin}-${result.weightMax}kg`);
            } else if (result.weights && result.weights.length > 0) {
                resultHtml += createResultItem('Weights', result.weights.join(', ') + 'kg');
            } else if (result.weight > 0) {
                resultHtml += createResultItem('Weight', `${result.weight}kg`);
            }

            // Handle RIR
            if (result.rirMin !== undefined) {
                if (result.rirMax !== undefined && result.rirMax !== result.rirMin) {
                    resultHtml += createResultItem('RIR', `${result.rirMin}-${result.rirMax}`);
                } else {
                    resultHtml += createResultItem('RIR', result.rirMin.toString());
                }
            }
        }

        // Rest time (applies to all formats)
        if (result.restTimeSeconds) {
            const minutes = Math.floor(result.restTimeSeconds / 60);
            const seconds = result.restTimeSeconds % 60;
            let restDisplay = '';
            if (minutes > 0 && seconds > 0) {
                restDisplay = `${minutes}m ${seconds}s`;
            } else if (minutes > 0) {
                restDisplay = `${minutes}m`;
            } else {
                restDisplay = `${seconds}s`;
            }
            resultHtml += createResultItem('Rest', restDisplay);
        }

        resultHtml += '</div>';
        demoOutput.innerHTML = resultHtml;
    });
}

function createResultItem(label, value) {
    return `
        <div class="demo-result-item">
            <span class="demo-result-label">${label}</span>
            <span class="demo-result-value">${value}</span>
        </div>
    `;
}

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

        // Show loading state
        submitButton.disabled = true;
        buttonText.style.display = 'none';
        buttonLoading.style.display = 'inline';

        try {
            // Submit to Supabase
            const response = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify({
                    email: email,
                    training_type: trainingType || null,
                }),
            });

            if (response.ok) {
                showMessage("You're on the list! We'll be in touch soon.", 'success');
                waitlistForm.reset();
            } else if (response.status === 409) {
                // Duplicate email
                showMessage("You're already on the waitlist!", 'success');
            } else {
                const error = await response.json();
                if (error.message && error.message.includes('duplicate')) {
                    showMessage("You're already on the waitlist!", 'success');
                } else {
                    throw new Error(error.message || 'Failed to join waitlist');
                }
            }
        } catch (error) {
            console.error('Waitlist submission error:', error);
            showMessage('Something went wrong. Please try again or email us directly.', 'error');
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
