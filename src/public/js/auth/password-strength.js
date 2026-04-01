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

    var passwordInput = document.querySelector('input[name="password"]');
    var confirmInput = document.querySelector('input[name="confirm_password"]');
    var rulesContainer = document.querySelector('[data-pwd-rules]');
    var submitBtn = document.querySelector('[data-pwd-submit]');

    if (!passwordInput || !confirmInput || !rulesContainer || !submitBtn) return;

    var rules = {
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

    var CLASS_DEFAULT = 'text-base-content/60';
    var CLASS_VALID = 'text-success';

    function checkRules() {
        var pwd = passwordInput.value;
        var allValid = true;

        Object.keys(rules).forEach(function (key) {
            var li = rulesContainer.querySelector('[data-rule="' + key + '"]');
            if (!li) return;

            var passed = pwd.length > 0 && rules[key](pwd);
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
        var pwd = passwordInput.value;
        var confirm = confirmInput.value;
        return pwd.length > 0 && confirm.length > 0 && pwd === confirm;
    }

    function update() {
        var rulesOk = checkRules();
        var matchOk = checkMatch();
        submitBtn.disabled = !(rulesOk && matchOk);
    }

    // Disable the button on page load
    submitBtn.disabled = true;

    passwordInput.addEventListener('input', update);
    confirmInput.addEventListener('input', update);
})();
