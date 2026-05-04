const { withMainActivity } = require('@expo/config-plugins');

const IMPORT_LINE = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

module.exports = function withHealthConnectDelegate(config) {
  return withMainActivity(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!contents.includes(IMPORT_LINE)) {
      contents = contents.replace(
        /^package .*$/m,
        (m) => `${m}\n${IMPORT_LINE}`,
      );
    }

    if (!contents.includes(DELEGATE_CALL)) {
      contents = contents.replace(
        /super\.onCreate\(null\)/,
        `super.onCreate(null)\n    ${DELEGATE_CALL}`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
