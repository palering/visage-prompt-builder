# Public Repository Safety Policy

This repository is public. Treat every committed file as internet-visible.

## Do not commit

- User-supplied or private reference images.
- Face profiles derived from identifiable private references unless explicitly cleared for public release.
- Names, contact details, account identifiers, local machine paths, or other personal metadata that is not required by the project.
- API keys, access tokens, cookies, credentials, private keys, or secret configuration.
- Private datasets, model-provider credentials, paid asset files, or restricted material.
- Temporary exports that may contain source metadata.

## Safe defaults

- Keep raw references outside the repository.
- Use synthetic example profiles in public documentation.
- Store local experiments under ignored paths such as `private/`, `references/`, or `baselines/private/`.
- Review diffs before every public commit.
- When uncertain whether a file is safe to publish, omit it until reviewed.

## Face-data policy

The public repository should contain the schema, compiler logic, documentation, test fixtures, and synthetic examples.

Reference-derived Face DNA can be useful during development, but should remain local/private by default. A reference-derived profile may be published only when its source and intended use are explicitly cleared for public release.
