module.exports = {
  "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,css,md}": ["prettier --write"],
  // Run tsc on the whole project if any ts/tsx files changed
  "**/*.{ts,tsx}": () => "npx tsc --noEmit",
};
