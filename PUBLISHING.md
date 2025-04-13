# Publishing to GitHub Packages

This document explains how to publish this package to GitHub Packages.

## Prerequisites

1. You need to have a GitHub personal access token (classic) with the appropriate permissions:
   - `read:packages` to download packages
   - `write:packages` to publish packages
   - `delete:packages` to delete packages

## Setup for Publishing

### Local Publishing

1. Create a `.npmrc` file in your home directory (`~/.npmrc`):

```bash
//npm.pkg.github.com/:_authToken=YOUR_PERSONAL_ACCESS_TOKEN
```

2. Make sure your package.json has the correct configuration:

```json
{
  "name": "mcp-express-adapter",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com/",
    "access": "public"
  }
}
```

3. Publish the package:

```bash
npm publish
```

### Using GitHub Actions

This repository is configured to automatically publish to GitHub Packages when a new release is created using GitHub Actions.

To publish a new version:

1. Update the version in package.json
2. Commit and push your changes
3. Create a new release on GitHub
4. The GitHub Action will automatically build and publish the package

## Installing the Package

To install the package from GitHub Packages, users need to:

1. Create or edit `.npmrc` in their project:

```bash
registry=https://npm.pkg.github.com/moe03
```

2. Install the package:

```bash
npm install mcp-express-adapter@latest
```

For private packages, authentication with a personal access token is required.

## Troubleshooting

If you encounter issues:

1. Ensure your token has the correct permissions
2. Check that your package name follows the format `@OWNER/PACKAGE-NAME`
3. Verify the repository URL in package.json matches your GitHub repository

For more information, refer to the [GitHub Packages documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).
