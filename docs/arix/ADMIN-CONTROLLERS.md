# Arix v2.1.3 administration controllers

These 13 vendor controllers were downloaded over verified HTTPS from the exact
versioned URLs used by `app/Console/Commands/arix.php`:

```text
https://arix.gg/internal/v2.1.3/<ControllerName>.php
```

They are stored unchanged in `app/Http/Controllers/Admin/Arix/`, matching the
installer destination. Every request returned HTTP 200, and each response was
checked for its PHP opening tag, controller class, and expected namespace.

All 13 files contain obfuscated control flow and encoded strings. They provide
additional implementation context but are harder to debug and extend than
unobfuscated source. No license checks have been altered. Downloading these
files does not install or activate the theme, and runtime compatibility with an
existing server has not been verified. The theme installer may download and
replace these files again during installation.

The hashes below identify the downloaded bytes; they are not vendor signatures.
The files at these remote URLs may change independently of this repository.

| Controller | SHA-256 |
| --- | --- |
| ArixAdvancedController.php | `54cd7eb5ab02ebbc94443c404a5673bc2e852a4d288dabe6d0383cc19270548f` |
| ArixAnnouncementController.php | `1779baa4f8d66f296c2a9dac1fae7026f5af4851b1e68739e767c3ac519eb47a` |
| ArixColorsController.php | `b4bc68fa13dc022c879c57d209c0709773d1cfa83023bb28190406cb566b802e` |
| ArixComponentsController.php | `28c7b935da350016e360dc5ff500003acd7af7f47e54e3df2671fca509c8fac0` |
| ArixController.php | `a826ad7a24310aef7b7e341d08244c97ac6d214cd5fc13ba72e8e177b0076ede` |
| ArixDashboardController.php | `48230241ff059490d7470b8f4596f8d2692bb94d742a51bf07f7ea3429cb93be` |
| ArixLayoutController.php | `6e7b933ff391a359b7e171d0d53947a3374cf2d13ce2e9ccfb64e1beebe737ac` |
| ArixLinkController.php | `7aebb5fc37ee08cbc833bda1502e5657f07d1244d47294016064c4b40925d7f8` |
| ArixMailController.php | `7a9133e6bc6508f348e3aee53c1fb2caca51f50c8cf22edff97cbbeb52dcee0c` |
| ArixMetaController.php | `89d5791348e06a5e5126f19dde82461ce7664b9e69b39daf015b506c98e677b0` |
| ArixPresetController.php | `0bd78ff9e8230e23344f84d0e4d25588645044d6a2181fe33cab3b746c3adc62` |
| ArixSocialController.php | `3f74d554c032bd7d4721ae798e9f4266e20e656f8fa698ebd03f73340c4f2778` |
| ArixStylingController.php | `75a8c20646d57dfb517dae32bc165345bf2bd695d9c7aec677baad565aba7d8a` |
