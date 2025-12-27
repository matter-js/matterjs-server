/**
 * Mocha configuration for root-level integration tests.
 */

module.exports = {
    spec: ["test/**/*Test.ts"],
    require: ["tsx"],
    timeout: 120000,
    exit: true,
};
