# Dependency banner

`konnect.demo-banner` v1.0.0 depends on `konnect.demo` v1.0.0 and replaces one
unique, declared fragment of its page. Install the basic package first.
Disabling this package reconstructs the base page from the baseline and retained
enabled packages. Disabling its dependency requires an explicit dependent action.

The patch hashes identify the exact UTF-8 fragment bytes, including the trailing
newline. Editing the dependency's fragment makes this precondition fail.
