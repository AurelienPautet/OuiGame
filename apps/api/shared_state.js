// Shared state module to avoid global variables
// This module holds shared state that multiple files need to access

const users = {};

module.exports = {
  users,
};
