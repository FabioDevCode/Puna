/**
 * Password strength real-time checker.
 *
 * Expects the following DOM structure (added via data-attributes):
 *   - input[name="password"]          → main password field
 *   - input[name="confirm_password"]  → confirmation field
 *   - [data-pwd-rules]                → container wrapping the <li> rule items
 *   - <li data-rule="min_length|uppercase|lowercase|digit|special"> inside that container
 *   - button[data-pwd-submit]         → the submit button
 *
 * Behaviour:
 *   1. While typing in the password field, each <li> switches between
 *      default (base-content/60) and valid (text-success) classes.
 *   2. The submit button stays disabled until:
 *        - all 5 rules pass
 *        - both password fields are non-empty AND match
 */
(function () {
    'use strict';

    const passwordInput = document.querySelector('input[name="password"]');
    const confirmInput = document.querySelector('input[name="confirm_password"]');
    const rulesContainer = document.querySelector('[data-pwd-rules]');
    const submitBtn = document.querySelector('[data-pwd-submit]');

    if (!passwordInput || !confirmInput || !rulesContainer || !submitBtn) return;

    const rules = {
        min_length: function (pwd) {
            return pwd.length >= 16;
        },
        uppercase: function (pwd) {
            return /[A-Z]/.test(pwd);
        },
        lowercase: function (pwd) {
            return /[a-z]/.test(pwd);
        },
        digit: function (pwd) {
            return /[0-9]/.test(pwd);
        },
        special: function (pwd) {
            return /[^A-Za-z0-9]/.test(pwd);
        },
    };

    const CLASS_DEFAULT = 'text-base-content/60';
    const CLASS_VALID = 'text-success';

    function checkRules() {
        const pwd = passwordInput.value;
        let allValid = true;

        Object.keys(rules).forEach(function (key) {
            const li = rulesContainer.querySelector('[data-rule="' + key + '"]');
            if (!li) return;

            const passed = pwd.length > 0 && rules[key](pwd);
            if (passed) {
                li.classList.remove(CLASS_DEFAULT);
                li.classList.add(CLASS_VALID);
            } else {
                li.classList.remove(CLASS_VALID);
                li.classList.add(CLASS_DEFAULT);
                allValid = false;
            }
        });

        return allValid;
    }

    function checkMatch() {
        const pwd = passwordInput.value;
        const confirm = confirmInput.value;
        return pwd.length > 0 && confirm.length > 0 && pwd === confirm;
    }

    function update() {
        const rulesOk = checkRules();
        const matchOk = checkMatch();
        submitBtn.disabled = !(rulesOk && matchOk);
    }

    // Disable the button on page load
    submitBtn.disabled = true;

    passwordInput.addEventListener('input', update);
    confirmInput.addEventListener('input', update);
})();
