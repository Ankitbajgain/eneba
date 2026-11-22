# Marketplace frontend

React + TypeScript + Vite + Tailwind CSS. Use the root Docker Compose setup. API requests use the gateway origin; no backend hostname or credentials are bundled into browser assets.

The preview supplies sign-in/account-creation forms, session restoration, safe errors and sign-out. Mutations bootstrap CSRF cookies and send the decoded XSRF token; credentials/tokens never enter browser storage. No catalog or purchase data is fabricated. See [authentication documentation](../docs/modules/03-authentication.md) and the [root setup](../README.md).
