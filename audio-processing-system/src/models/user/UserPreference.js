class UserPreference {
    constructor({ userId, theme = 'dark', preferredFormat = 'wav', defaultBpm = 90, autoSave = true, layout = 'classic' }) {
      this.userId = userId;
      this.theme = theme;               // dark, light, system
      this.preferredFormat = preferredFormat; // wav, mp3, flac
      this.defaultBpm = defaultBpm;
      this.autoSave = autoSave;
      this.layout = layout;            // UI layout preference (classic, compact, advanced)
    }
  
    updatePrefs(prefs = {}) {
      Object.assign(this, prefs);
    }
  
    getPrefs() {
      return {
        userId: this.userId,
        theme: this.theme,
        preferredFormat: this.preferredFormat,
        defaultBpm: this.defaultBpm,
        autoSave: this.autoSave,
        layout: this.layout
      };
    }
  }
  
  module.exports = UserPreference;
  