#!/usr/bin/env bash
set -euo pipefail

## Temporary workaround. Need to switch to mojaloop/build@1.1.10 (ML ci-config-orb-build)

VERSION="$1"

npm version "$VERSION" --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore(release): v${VERSION}"
git tag "v${VERSION}"
git push origin "v${VERSION}"
