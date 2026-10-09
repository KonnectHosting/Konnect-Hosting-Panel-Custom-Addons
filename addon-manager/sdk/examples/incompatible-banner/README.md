# Intentionally incompatible banner

`example.demo-conflict` v1.0.0 is a valid package that declares an incompatibility
with `example.demo-banner`. Both change the same base fragment; they cannot be
enabled together. With the basic addon and dependency banner enabled, attempting
to install this package should be blocked before live files change.

This package demonstrates a relationship conflict, not an invalid ZIP. The SDK
validator and exporter should accept it; lifecycle composition should reject the
incompatible enabled set.
