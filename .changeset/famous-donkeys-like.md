---
'hongzhao': patch
---

feat: add multi-language support

- **Multi-language interface**: support Simplified Chinese, Traditional Chinese, English, Japanese, and Korean across all tools, dialogs, and the standalone receiver.
- **Language selection**: switch display language from the header menu with immediate effect, retaining the choice via the `?lang=` URL parameter without using cookies or browser storage.
- **Transfer link neutrality**: keep generated transfer links free of language parameters so recipients open shared content in their own preferred language.
- **Zero-network bundling**: load translation resources dynamically as script chunks on demand, adhering to the strict zero-network CSP.
