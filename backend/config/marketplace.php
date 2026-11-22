<?php

return [
    'demo_payments' => (bool) env('DEMO_PAYMENTS_ENABLED', false),
    // Demo fallback only. Production key imports require a separate persistent secret.
    'key_fingerprint_secret' => env('KEY_FINGERPRINT_SECRET') ?: env('APP_KEY'),
];
