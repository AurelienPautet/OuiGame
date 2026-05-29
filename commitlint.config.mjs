export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Every commit must name the specific area it touches, e.g. feat(front): ...
    "scope-empty": [2, "never"],
  },
};
